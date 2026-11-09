import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { GutenbergClient } from '../books/gutenberg.client';
import { LocalBackupService } from '../books/local-backup.service';
import { SUF_MAGIC } from '../types/huffman.types';
import { HuffmanEngine } from './huffman.engine';
import { HuffmanService } from './huffman.service';

describe('HuffmanService (B5)', () => {
  let service: HuffmanService;
  let gutenbergClient: { fetchBookText: jest.Mock };

  beforeEach(async () => {
    gutenbergClient = {
      fetchBookText: jest.fn().mockResolvedValue(
        '*** START OF THE PROJECT GUTENBERG EBOOK DON QUIJOTE ***\nEn un lugar de la Mancha, de cuyo nombre no quiero acordarme.\n*** END OF THE PROJECT GUTENBERG EBOOK DON QUIJOTE ***',
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HuffmanService,
        { provide: GutenbergClient, useValue: gutenbergClient },
        { provide: LocalBackupService, useValue: new LocalBackupService() },
      ],
    }).compile();

    service = module.get<HuffmanService>(HuffmanService);
  });

  it('procesa metadatos de Huffman y construye árbol, tabla, pasos y métricas', async () => {
    const result = await service.processHuffmanMetadata(2000);
    expect(result.source.title).toBe('Don Quijote');
    expect(result.distinctSymbols).toBeGreaterThan(5);
    expect(result.steps.length).toBe(3 * result.distinctSymbols - 2);
    expect(result.metrics.fileSizeBytes).toBe(
      result.metrics.headerBytes! + result.metrics.compressedBytes,
    );
  });

  it('usa el respaldo local (B4) si Gutenberg bloquea la petición', async () => {
    gutenbergClient.fetchBookText.mockRejectedValueOnce(
      new BadRequestException('Gutenberg IP blocked'),
    );

    const result = await service.processHuffmanMetadata(2000);
    expect(result.source.id).toBe(2000);
    expect(result.totalCharacters).toBeGreaterThan(50);
  });

  it('genera un archivo binario .suf válido con encabezado SUF1', async () => {
    const { buffer } = await service.generateSufFile(2000);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    const parsed = HuffmanEngine.parseSufBuffer(buffer);
    expect(parsed.magic).toBe(SUF_MAGIC);
    expect(parsed.title).toBe('Don Quijote');
    expect(parsed.dictionary.length).toBe(parsed.symbolCount);
  });

  it('lanza NotFoundException si el ID no existe en el catálogo', async () => {
    await expect(service.processHuffmanMetadata(999999)).rejects.toThrow(
      NotFoundException,
    );
  });
});
