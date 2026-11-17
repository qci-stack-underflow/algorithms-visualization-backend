import {
  BadRequestException,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { GutenbergClient } from '../books/gutenberg.client';
import { LocalBackupService } from '../books/local-backup.service';
import { SUF_MAGIC, VERCEL_MAX_PAYLOAD_BYTES } from '../types/huffman.types';
import { HuffmanEngine } from './huffman.engine';
import { HuffmanService } from './huffman.service';

describe('HuffmanService (B5 & B7)', () => {
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

  afterEach(() => {
    jest.restoreAllMocks();
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

  it('genera el archivo binario .suf como Buffer (no string) menor a 4.5 MB (B7)', async () => {
    const { buffer } = await service.generateSufFile(2000);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(typeof (buffer as unknown)).not.toBe('string');
    expect(buffer.byteLength).toBeLessThan(VERCEL_MAX_PAYLOAD_BYTES);

    const parsed = HuffmanEngine.parseSufBuffer(buffer);
    expect(parsed.magic).toBe(SUF_MAGIC);
    expect(parsed.title).toBe('Don Quijote');
    expect(parsed.dictionary.length).toBe(parsed.symbolCount);
  });

  it('lanza 413 PayloadTooLargeException si el binario .suf supera 4.5 MB (B7)', async () => {
    jest
      .spyOn(HuffmanEngine, 'generateSufBuffer')
      .mockReturnValueOnce(Buffer.alloc(VERCEL_MAX_PAYLOAD_BYTES + 1));

    await expect(service.generateSufFile(2000)).rejects.toThrow(
      PayloadTooLargeException,
    );
  });

  it('lanza NotFoundException si el ID no existe en el catálogo', async () => {
    await expect(service.processHuffmanMetadata(999999)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should compress raw UTF-8 text and return analysis and SUF1 binary', () => {
    const text = 'Texto de prueba para el servicio de Huffman.';
    const output = service.compress(text, { title: 'Prueba Servicio' });

    expect(output.result).toBeDefined();
    expect(output.sufBuffer).toBeInstanceOf(Buffer);
    expect(output.result.totalCharacters).toBe(text.length);

    // Descomprimir binario con el servicio
    const decompressed = service.decompressBinary(output.sufBuffer);
    expect(decompressed.decodedText).toBe(text);
    expect(decompressed.header.title).toBe('Prueba Servicio');
  });

  it('should return HuffmanResult with compressToResult', () => {
    const text = 'Prueba corta';
    const result = service.compressToResult(text);
    expect(result.totalCharacters).toBe(text.length);
    expect(result.nodes.length).toBeGreaterThan(0);
  });

  it('should return Buffer with compressToBinary', () => {
    const text = 'Prueba binaria';
    const binary = service.compressToBinary(text);
    expect(binary).toBeInstanceOf(Buffer);
    expect(binary.subarray(0, 4).toString('ascii')).toBe('SUF1');
  });

  it('should clean Gutenberg text via cleanText', () => {
    const raw =
      '\uFEFF*** START OF THE PROJECT GUTENBERG EBOOK TEST ***\nContenido real\n*** END OF THE PROJECT GUTENBERG EBOOK TEST ***';
    expect(service.cleanText(raw)).toBe('Contenido real');
  });
});
