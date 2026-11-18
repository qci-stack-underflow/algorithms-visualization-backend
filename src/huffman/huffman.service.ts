import {
  BadRequestException,
  GatewayTimeoutException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import {
  HUFFMAN_PSEUDOCODE,
  HuffmanResult,
  MAX_UPLOAD_FILE_SIZE_BYTES,
  SUF_MAGIC,
  SufHeader,
  UserFileSourceInfo,
  VERCEL_MAX_PAYLOAD_BYTES,
} from '../types/huffman.types';
import { TextCleaner } from '../books/text-cleaner';
import {
  compressHuffman,
  CompressOptions,
  HuffmanCompressionOutput,
} from './definitions/huffman-compressor';
import { readSuf, ReadSufResult } from './utils/suf-format';
import {
  BOOKS_CATALOG,
  CatalogBook,
  findCatalogBookById,
} from '../books/books.catalog';
import { GutenbergClient } from '../books/gutenberg.client';
import { LocalBackupService } from '../books/local-backup.service';

export interface UploadedTextFile {
  originalname?: string;
  mimetype?: string;
  size?: number;
  buffer?: Buffer;
}

@Injectable()
export class HuffmanService {
  constructor(
    private readonly gutenbergClient: GutenbergClient,
    private readonly localBackup: LocalBackupService,
  ) {}

  getHuffman() {
    return {
      description:
        'Huffman is an algorithm used to compress files from a binary tree. Each leaf of the binary tree is a character, which has frequency and code.',
      pseudocode: HUFFMAN_PSEUDOCODE,
    };
  }

  /**
   * Comprime texto UTF-8 arbitrario y genera el análisis completo junto con el binario .suf.
   *
   * @param rawText Cadena de texto UTF-8 a procesar.
   * @param options Opciones de metadatos (origen, título, frase de vista previa).
   * @returns Objeto con `result` (HuffmanResult) y `sufBuffer` (Buffer binario .suf).
   */
  compress(
    rawText: string,
    options?: CompressOptions,
  ): HuffmanCompressionOutput {
    return compressHuffman(rawText, options);
  }

  /**
   * Comprime un texto y devuelve únicamente el objeto de análisis y visualización (HuffmanResult).
   */
  compressToResult(rawText: string, options?: CompressOptions): HuffmanResult {
    const { result } = this.compress(rawText, options);
    return result;
  }

  /**
   * Comprime un texto y devuelve únicamente el buffer binario empaquetado en formato .suf.
   */
  compressToBinary(rawText: string, options?: CompressOptions): Buffer {
    const { sufBuffer } = this.compress(rawText, options);
    return sufBuffer;
  }

  /**
   * Descomprime un buffer en formato .suf (SUF1), devolviendo su cabecera y el texto original recuperado.
   */
  decompressBinary(sufBuffer: Buffer): ReadSufResult {
    return readSuf(sufBuffer);
  }

  /**
   * Limpia y normaliza texto eliminando BOM, normalizando saltos de línea y
   * recortando encabezados/pies de Project Gutenberg si están presentes.
   */
  cleanText(rawText: string): string {
    return TextCleaner.clean(rawText);
  }

  getCatalog(): readonly CatalogBook[] {
    return BOOKS_CATALOG;
  }

  async getBookText(
    bookId: number,
  ): Promise<{ text: string; book: CatalogBook }> {
    const book = findCatalogBookById(bookId);
    if (!book) {
      throw new NotFoundException(
        `El libro con id ${bookId} no se encuentra en el catálogo.`,
      );
    }

    let rawText: string;
    try {
      rawText = await this.gutenbergClient.fetchBookText(book.id);
    } catch (error: unknown) {
      if (
        error instanceof PayloadTooLargeException ||
        error instanceof GatewayTimeoutException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      if (this.localBackup.hasLocalCopy(book.id)) {
        rawText = this.localBackup.getLocalCopy(book.id);
      } else {
        throw error;
      }
    }

    const cleanedText = this.cleanText(rawText);
    return { text: cleanedText, book };
  }

  async processHuffmanMetadata(bookId: number): Promise<HuffmanResult> {
    const { text, book } = await this.getBookText(bookId);
    return this.compressToResult(text, {
      source: book,
      title: book.title,
      clean: false,
    });
  }

  async generateSufFile(
    bookId: number,
  ): Promise<{ buffer: Buffer; book: CatalogBook }> {
    const { text, book } = await this.getBookText(bookId);
    const buffer = this.compressToBinary(text, {
      source: book,
      title: book.title,
      clean: false,
    });

    if (buffer.byteLength > VERCEL_MAX_PAYLOAD_BYTES) {
      throw new PayloadTooLargeException(
        'El archivo .suf generado excede el límite de 4.5 MB de Vercel.',
      );
    }

    return { buffer, book };
  }

  compressUploadedFile(
    file?: UploadedTextFile,
    customTitle?: string,
    includeMetadata = true,
  ): {
    buffer: Buffer;
    filename: string;
    result: HuffmanResult;
    sufBuffer: Buffer;
  } {
    if (!file || !Buffer.isBuffer(file.buffer)) {
      throw new BadRequestException(
        'Debe adjuntar un archivo .txt válido en el campo "file".',
      );
    }

    const originalname = file.originalname?.trim() || 'upload.txt';
    const hasExtension = originalname.includes('.');
    const hasTxtExtension = originalname.toLowerCase().endsWith('.txt');
    const normalizedMime = file.mimetype?.toLowerCase().trim() ?? '';
    const isTextPlainMime = normalizedMime.startsWith('text/plain');
    const isAllowedMime =
      normalizedMime === '' ||
      isTextPlainMime ||
      normalizedMime === 'application/octet-stream';

    if (
      (hasExtension && !hasTxtExtension) ||
      !isAllowedMime ||
      (!hasTxtExtension && !isTextPlainMime)
    ) {
      throw new BadRequestException(
        'Solo se aceptan archivos de texto plano (.txt o text/plain).',
      );
    }

    const fileBytes = Math.max(file.buffer.byteLength, file.size ?? 0);
    if (fileBytes > MAX_UPLOAD_FILE_SIZE_BYTES) {
      throw new PayloadTooLargeException(
        'El archivo supera el límite máximo permitido de 4 MB.',
      );
    }

    const rawText = file.buffer.toString('utf-8');
    if (rawText.length === 0) {
      throw new BadRequestException(
        'El archivo de texto proporcionado está vacío.',
      );
    }

    const baseName = originalname.replace(/\.txt$/i, '') || 'document';
    const title =
      customTitle && customTitle.trim().length > 0
        ? customTitle.trim()
        : baseName;
    const rawBytes = Buffer.byteLength(rawText, 'utf-8');
    const formattedSize =
      rawBytes < 1024
        ? `${rawBytes} B`
        : rawBytes < 1024 * 1024
          ? `${(rawBytes / 1024).toFixed(1)} KB`
          : `${(rawBytes / (1024 * 1024)).toFixed(2)} MB`;

    const source: UserFileSourceInfo = {
      type: 'upload',
      filename: hasTxtExtension ? originalname : `${originalname}.txt`,
      title,
      size: formattedSize,
      bytes: rawBytes,
      mimeType: 'text/plain',
    };

    const { result, sufBuffer } = this.compress(rawText, {
      source,
      title,
      clean: false,
    });

    let responseBuffer: Buffer;
    if (includeMetadata) {
      const jsonBuffer = Buffer.from(JSON.stringify(result), 'utf-8');
      const lengthPrefix = Buffer.alloc(4);
      lengthPrefix.writeUInt32BE(jsonBuffer.byteLength, 0);
      responseBuffer = Buffer.concat([lengthPrefix, jsonBuffer, sufBuffer]);
    } else {
      responseBuffer = sufBuffer;
    }

    if (responseBuffer.byteLength > VERCEL_MAX_PAYLOAD_BYTES) {
      throw new PayloadTooLargeException(
        includeMetadata
          ? 'La respuesta combinada excede el límite de 4.5 MB de Vercel.'
          : 'El archivo .suf generado excede el límite de 4.5 MB de Vercel.',
      );
    }

    const safeDispositionName =
      baseName.replace(/[^a-zA-Z0-9._-]/g, '_') || 'document';
    const sufFilename = `${safeDispositionName}.suf`;

    return {
      buffer: responseBuffer,
      filename: sufFilename,
      result,
      sufBuffer,
    };
  }

  /**
   * Descomprime un archivo .suf subido por el cliente (puro o con prefijo de metadatos JSON).
   *
   * @param file Archivo subido vía multipart/form-data.
   * @param hasMetadata Si es `true`, espera el formato combinado `[uint32 BE][JSON][.suf]`; si es `false` (por defecto), espera `.suf` puro (`SUF1`).
   */
  decompressUploadedFile(
    file?: UploadedTextFile,
    hasMetadata = false,
  ): {
    buffer: Buffer;
    filename: string;
    header: SufHeader;
    decodedText: string;
  } {
    if (!file || !Buffer.isBuffer(file.buffer)) {
      throw new BadRequestException(
        'Debe adjuntar un archivo .suf válido en el campo "file".',
      );
    }

    const originalname = file.originalname?.trim() || 'archive.suf';
    const hasExtension = originalname.includes('.');
    const hasSufExtension = originalname.toLowerCase().endsWith('.suf');

    if (hasExtension && !hasSufExtension) {
      throw new BadRequestException(
        'Solo se aceptan archivos comprimidos con extensión .suf.',
      );
    }

    const fileBytes = Math.max(file.buffer.byteLength, file.size ?? 0);
    if (fileBytes > MAX_UPLOAD_FILE_SIZE_BYTES) {
      throw new PayloadTooLargeException(
        'El archivo supera el límite máximo permitido de 4 MB.',
      );
    }

    let sufBuffer: Buffer;
    if (hasMetadata) {
      if (file.buffer.byteLength < 4) {
        throw new BadRequestException(
          'El archivo combinado con metadatos no tiene una cabecera JSON válida.',
        );
      }

      const jsonLength = file.buffer.readUInt32BE(0);
      if (jsonLength === 0 || 4 + jsonLength >= file.buffer.byteLength) {
        throw new BadRequestException(
          'El archivo combinado con metadatos no contiene un bloque .suf válido.',
        );
      }

      try {
        JSON.parse(file.buffer.subarray(4, 4 + jsonLength).toString('utf-8'));
      } catch {
        throw new BadRequestException(
          'El bloque de metadatos JSON en el archivo es inválido.',
        );
      }

      sufBuffer = file.buffer.subarray(4 + jsonLength);
    } else {
      if (
        file.buffer.byteLength < 4 ||
        file.buffer.subarray(0, 4).toString('ascii') !== SUF_MAGIC
      ) {
        throw new BadRequestException(
          'El archivo no tiene el formato binario .suf (SUF1) esperado.',
        );
      }
      sufBuffer = file.buffer;
    }

    let parsed: ReadSufResult;
    try {
      parsed = this.decompressBinary(sufBuffer);
    } catch (error: unknown) {
      const detail =
        error instanceof Error ? error.message : 'Archivo .suf inválido.';
      throw new BadRequestException(detail);
    }

    const decodedBuffer = Buffer.from(parsed.decodedText, 'utf-8');
    if (decodedBuffer.byteLength > VERCEL_MAX_PAYLOAD_BYTES) {
      throw new PayloadTooLargeException(
        'El archivo de texto descomprimido excede el límite de 4.5 MB de Vercel.',
      );
    }

    const baseName = originalname.replace(/\.suf$/i, '') || 'document';
    const safeDispositionName =
      baseName.replace(/[^a-zA-Z0-9._-]/g, '_') || 'document';
    const txtFilename = `${safeDispositionName}.txt`;

    return {
      buffer: decodedBuffer,
      filename: txtFilename,
      header: parsed.header,
      decodedText: parsed.decodedText,
    };
  }
}
