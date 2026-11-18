import {
  BadGatewayException,
  BadRequestException,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { HEADERS_METADATA } from '@nestjs/common/constants';
import { Test, TestingModule } from '@nestjs/testing';
import { BOOKS_CATALOG } from '../books/books.catalog';
import { GutenbergClient } from '../books/gutenberg.client';
import { LocalBackupService } from '../books/local-backup.service';
import { RapidApiGutenbergClient } from '../books/rapidapi-gutenberg.client';
import { VERCEL_MAX_PAYLOAD_BYTES } from '../types/huffman.types';
import { HUFFMAN_CACHE_CONTROL, HuffmanController } from './huffman.controller';
import { HuffmanService } from './huffman.service';

describe('HuffmanController (B5, B6 & B7)', () => {
  let controller: HuffmanController;
  let gutenbergClient: { fetchBookText: jest.Mock };
  let rapidApiClient: { searchBooks: jest.Mock };

  beforeEach(async () => {
    rapidApiClient = {
      searchBooks: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HuffmanController],
      providers: [
        HuffmanService,
        {
          provide: GutenbergClient,
          useValue: {
            fetchBookText: jest
              .fn()
              .mockResolvedValue(
                '*** START OF THE PROJECT GUTENBERG EBOOK DON QUIJOTE ***\nEn un lugar de la Mancha\n*** END OF THE PROJECT GUTENBERG EBOOK DON QUIJOTE ***',
              ),
          },
        },
        {
          provide: LocalBackupService,
          useValue: new LocalBackupService(),
        },
        {
          provide: RapidApiGutenbergClient,
          useValue: rapidApiClient,
        },
      ],
    }).compile();

    controller = module.get<HuffmanController>(HuffmanController);
    gutenbergClient = module.get(GutenbergClient);
  });

  it('GET /huffman/books devuelve el catálogo de libros predefinidos', () => {
    const books = controller.getDefaultBooks();
    expect(books).toEqual(BOOKS_CATALOG);
    expect(books.length).toBeGreaterThanOrEqual(4);
  });

  it('GET /huffman/books/:id devuelve el JSON de compresión Huffman compacto (< 4.5 MB)', async () => {
    const result = await controller.compressByIdMetadata(2000);
    expect(gutenbergClient.fetchBookText).toHaveBeenCalledWith(2000);
    expect(result.source.id).toBe(2000);
    expect(result.totalCharacters).toBe('En un lugar de la Mancha'.length);
    expect(result.nodes.length).toBeGreaterThan(0);
    expect(result.steps.length).toBeGreaterThan(0);
    expect(result.metrics.originalBytes).toBeGreaterThan(0);

    const serializedSize = Buffer.byteLength(JSON.stringify(result), 'utf-8');
    expect(serializedSize).toBeLessThan(VERCEL_MAX_PAYLOAD_BYTES);
    expect((result as Record<string, unknown>).encodedDataBits).toBeUndefined();
  });

  it('GET /huffman/books/:id/file devuelve el archivo .suf como bytes (Buffer), no como string (B7)', async () => {
    const streamable = await controller.compressByIdDownload(2000);
    expect(streamable).toBeInstanceOf(StreamableFile);
    const headers = streamable.getHeaders();
    expect(headers.type).toBe('application/octet-stream');
    expect(headers.disposition).toContain('book_2000.suf');

    const chunks: Buffer[] = [];
    for await (const chunk of streamable.getStream()) {
      expect(Buffer.isBuffer(chunk)).toBe(true);
      chunks.push(chunk as Buffer);
    }
    const fullBuffer = Buffer.concat(chunks);
    expect(fullBuffer.subarray(0, 4).toString('ascii')).toBe('SUF1');
    expect(fullBuffer.byteLength).toBeLessThan(VERCEL_MAX_PAYLOAD_BYTES);
  });

  it('añade cabeceras Cache-Control en los endpoints GET para aprovechar la caché de Vercel (B7)', () => {
    const methods = [
      'getDefaultBooks',
      'searchBook',
      'compressByIdMetadata',
      'compressByIdDownload',
    ] as const;

    for (const name of methods) {
      const handler = Object.getOwnPropertyDescriptor(
        HuffmanController.prototype,
        name,
      )?.value as object;
      const headers =
        (Reflect.getMetadata(HEADERS_METADATA, handler) as
          Array<{ name: string; value: string }> | undefined) ?? [];
      expect(headers).toEqual(
        expect.arrayContaining([
          { name: 'Cache-Control', value: HUFFMAN_CACHE_CONTROL },
        ]),
      );
    }
  });

  it('lanza 400 BadRequestException cuando el ID es <= 0', async () => {
    await expect(controller.compressByIdMetadata(0)).rejects.toThrow(
      BadRequestException,
    );
    await expect(controller.compressByIdDownload(-10)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('lanza 404 NotFoundException cuando el libro no existe en Gutenberg', async () => {
    gutenbergClient.fetchBookText.mockRejectedValueOnce(
      new NotFoundException('No existe'),
    );
    await expect(controller.compressByIdMetadata(999999)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('POST /huffman/compress/file devuelve un StreamableFile con el binario combinado [uint32][JSON][.suf]', async () => {
    const sampleText = 'Texto de prueba subido desde el cliente.';
    const streamable = controller.compressFromClient(
      {
        originalname: 'cliente.txt',
        mimetype: 'text/plain',
        size: Buffer.byteLength(sampleText, 'utf-8'),
        buffer: Buffer.from(sampleText, 'utf-8'),
      },
      'Título Cliente',
    );

    expect(streamable).toBeInstanceOf(StreamableFile);
    const headers = streamable.getHeaders();
    expect(headers.type).toBe('application/octet-stream');
    expect(headers.disposition).toContain('cliente.suf');

    const chunks: Buffer[] = [];
    for await (const chunk of streamable.getStream()) {
      chunks.push(chunk as Buffer);
    }
    const combinedBuffer = Buffer.concat(chunks);
    const jsonLen = combinedBuffer.readUInt32BE(0);
    const jsonStr = combinedBuffer.subarray(4, 4 + jsonLen).toString('utf-8');
    const sufPart = combinedBuffer.subarray(4 + jsonLen);

    const parsedResult = JSON.parse(jsonStr) as {
      source: { type: string; title: string };
      totalCharacters: number;
    };
    expect(parsedResult.source.type).toBe('upload');
    expect(parsedResult.source.title).toBe('Título Cliente');
    expect(parsedResult.totalCharacters).toBe(sampleText.length);
    expect(sufPart.subarray(0, 4).toString('ascii')).toBe('SUF1');
  });

  it('POST /huffman/compress/file?metadata=false devuelve únicamente el binario .suf sin JSON', async () => {
    const sampleText = 'Archivo comprimido sin metadatos.';
    const streamable = controller.compressFromClient(
      {
        originalname: 'sin-meta.txt',
        mimetype: 'text/plain',
        size: Buffer.byteLength(sampleText, 'utf-8'),
        buffer: Buffer.from(sampleText, 'utf-8'),
      },
      'Sin Meta',
      'false',
    );

    const chunks: Buffer[] = [];
    for await (const chunk of streamable.getStream()) {
      chunks.push(chunk as Buffer);
    }
    const sufBuffer = Buffer.concat(chunks);
    expect(sufBuffer.subarray(0, 4).toString('ascii')).toBe('SUF1');
  });

  it('POST /huffman/compress/file lanza 400 cuando metadata no es true o false', () => {
    expect(() =>
      controller.compressFromClient(
        {
          originalname: 'test.txt',
          mimetype: 'text/plain',
          size: 4,
          buffer: Buffer.from('hola', 'utf-8'),
        },
        undefined,
        'invalido',
      ),
    ).toThrow(BadRequestException);
  });

  it('POST /huffman/decompress/file (por defecto metadata=false) descomprime .suf puro a .txt', async () => {
    const sampleText = 'Contenido comprimido y recuperado.\n';
    const compressedStream = controller.compressFromClient(
      {
        originalname: 'recuperar.txt',
        mimetype: 'text/plain',
        size: Buffer.byteLength(sampleText, 'utf-8'),
        buffer: Buffer.from(sampleText, 'utf-8'),
      },
      'Recuperar',
      'false',
    );

    const compressedChunks: Buffer[] = [];
    for await (const chunk of compressedStream.getStream()) {
      compressedChunks.push(chunk as Buffer);
    }
    const sufBuffer = Buffer.concat(compressedChunks);

    const decompressedStream = controller.decompressFromClient({
      originalname: 'recuperar.suf',
      mimetype: 'application/octet-stream',
      size: sufBuffer.byteLength,
      buffer: sufBuffer,
    });

    const headers = decompressedStream.getHeaders();
    expect(headers.type).toBe('text/plain; charset=utf-8');
    expect(headers.disposition).toContain('recuperar.txt');

    const decodedChunks: Buffer[] = [];
    for await (const chunk of decompressedStream.getStream()) {
      decodedChunks.push(chunk as Buffer);
    }
    expect(Buffer.concat(decodedChunks).toString('utf-8')).toBe(sampleText);
  });

  it('POST /huffman/decompress/file?metadata=true descomprime archivo combinado a .txt', async () => {
    const sampleText = 'Archivo con metadata JSON adjunta.';
    const compressedStream = controller.compressFromClient({
      originalname: 'con-meta.txt',
      mimetype: 'text/plain',
      size: Buffer.byteLength(sampleText, 'utf-8'),
      buffer: Buffer.from(sampleText, 'utf-8'),
    });

    const compressedChunks: Buffer[] = [];
    for await (const chunk of compressedStream.getStream()) {
      compressedChunks.push(chunk as Buffer);
    }
    const combinedBuffer = Buffer.concat(compressedChunks);

    const decompressedStream = controller.decompressFromClient(
      {
        originalname: 'con-meta.suf',
        mimetype: 'application/octet-stream',
        size: combinedBuffer.byteLength,
        buffer: combinedBuffer,
      },
      'true',
    );

    const decodedChunks: Buffer[] = [];
    for await (const chunk of decompressedStream.getStream()) {
      decodedChunks.push(chunk as Buffer);
    }
    expect(Buffer.concat(decodedChunks).toString('utf-8')).toBe(sampleText);
  });

  it('POST /huffman/decompress/file lanza 400 cuando metadata es inválido', () => {
    expect(() =>
      controller.decompressFromClient(
        {
          originalname: 'test.suf',
          mimetype: 'application/octet-stream',
          size: 4,
          buffer: Buffer.from('SUF1'),
        },
        'otro',
      ),
    ).toThrow(BadRequestException);
  });

  it('GET /huffman/books/search devuelve { result: BookInfo[] } y valida q / errores externos', async () => {
    const mockResults = [
      {
        type: 'gutenberg' as const,
        id: 996,
        title: 'Don Quixote',
        author: 'Cervantes Saavedra, Miguel de',
        language: 'Inglés',
        size: 'Desconocido',
      },
    ];
    rapidApiClient.searchBooks.mockResolvedValueOnce(mockResults);

    const res = await controller.searchBook('cervantes');
    expect(rapidApiClient.searchBooks).toHaveBeenCalledWith('cervantes');
    // Primero el Quijote del catálogo (2000), luego el de RapidAPI.
    expect(res.result.map((book) => book.id)).toEqual([2000, 996]);

    await expect(controller.searchBook(undefined)).rejects.toThrow(
      BadRequestException,
    );
    await expect(controller.searchBook('   ')).rejects.toThrow(
      BadRequestException,
    );

    rapidApiClient.searchBooks.mockRejectedValueOnce(
      new BadGatewayException('Fallo RapidAPI'),
    );
    await expect(controller.searchBook('zzzzqq')).rejects.toThrow(
      BadGatewayException,
    );
  });
});
