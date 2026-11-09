import {
  GatewayTimeoutException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import {
  BOOKS_CATALOG,
  CatalogBook,
  findCatalogBookById,
} from '../books/books.catalog';
import { GutenbergClient } from '../books/gutenberg.client';
import { LocalBackupService } from '../books/local-backup.service';
import { TextCleaner } from '../books/text-cleaner';
import {
  HUFFMAN_PSEUDOCODE,
  HuffmanResult,
  VERCEL_MAX_PAYLOAD_BYTES,
} from '../types/huffman.types';
import { HuffmanEngine } from './huffman.engine';

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

    const cleanedText = TextCleaner.clean(rawText);
    return { text: cleanedText, book };
  }

  async processHuffmanMetadata(bookId: number): Promise<HuffmanResult> {
    const { text, book } = await this.getBookText(bookId);
    return HuffmanEngine.compress(text, book);
  }

  async generateSufFile(
    bookId: number,
  ): Promise<{ buffer: Buffer; book: CatalogBook }> {
    const { text, book } = await this.getBookText(bookId);
    const buffer = HuffmanEngine.generateSufBuffer(text, book.title);

    if (buffer.byteLength > VERCEL_MAX_PAYLOAD_BYTES) {
      throw new PayloadTooLargeException(
        'El archivo .suf generado excede el límite de 4.5 MB de Vercel.',
      );
    }

    return { buffer, book };
  }
}
