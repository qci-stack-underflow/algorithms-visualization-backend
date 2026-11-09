import { StreamableFile } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { BOOKS_CATALOG } from '../books/books.catalog';
import { GutenbergClient } from '../books/gutenberg.client';
import { LocalBackupService } from '../books/local-backup.service';
import { HuffmanController } from './huffman.controller';
import { HuffmanService } from './huffman.service';

describe('HuffmanController (B5)', () => {
  let controller: HuffmanController;
  let gutenbergClient: GutenbergClient;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HuffmanController],
      providers: [
        HuffmanService,
        {
          provide: GutenbergClient,
          useValue: {
            fetchBookText: jest.fn().mockResolvedValue(
              '*** START OF THE PROJECT GUTENBERG EBOOK DON QUIJOTE ***\nEn un lugar de la Mancha\n*** END OF THE PROJECT GUTENBERG EBOOK DON QUIJOTE ***',
            ),
          },
        },
        {
          provide: LocalBackupService,
          useValue: new LocalBackupService(),
        },
      ],
    }).compile();

    controller = module.get<HuffmanController>(HuffmanController);
    gutenbergClient = module.get<GutenbergClient>(GutenbergClient);
  });

  it('GET /huffman/books devuelve el catálogo de libros predefinidos', () => {
    const books = controller.getDefaultBooks();
    expect(books).toEqual(BOOKS_CATALOG);
    expect(books.length).toBeGreaterThanOrEqual(4);
  });

  it('GET /huffman/books/:id devuelve el JSON de compresión Huffman', async () => {
    const result = await controller.compressByIdMetadata(2000);
    expect(gutenbergClient.fetchBookText).toHaveBeenCalledWith(2000);
    expect(result.source.id).toBe(2000);
    expect(result.totalCharacters).toBe('En un lugar de la Mancha'.length);
    expect(result.nodes.length).toBeGreaterThan(0);
    expect(result.steps.length).toBeGreaterThan(0);
    expect(result.metrics.originalBytes).toBeGreaterThan(0);
  });

  it('GET /huffman/books/:id/file devuelve un StreamableFile con el binario .suf', async () => {
    const streamable = await controller.compressByIdDownload(2000);
    expect(streamable).toBeInstanceOf(StreamableFile);
    const headers = streamable.getHeaders();
    expect(headers.type).toBe('application/octet-stream');
    expect(headers.disposition).toContain('book_2000.suf');
  });
});
