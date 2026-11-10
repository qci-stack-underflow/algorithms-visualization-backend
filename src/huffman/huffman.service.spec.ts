import { Test, TestingModule } from '@nestjs/testing';
import { HuffmanService } from './huffman.service';

describe('HuffmanService', () => {
  let service: HuffmanService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HuffmanService],
    }).compile();

    service = module.get<HuffmanService>(HuffmanService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
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
