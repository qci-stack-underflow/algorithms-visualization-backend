import { calculateMetrics, compressHuffman } from './huffman-compressor';
import { readSuf } from '../utils/suf-format';

describe('huffman-compressor and calculateMetrics', () => {
  describe('calculateMetrics', () => {
    it('should calculate accurate metrics and Shannon entropy', () => {
      const text = 'aaaaabbbcc';
      const output = compressHuffman(text, { title: 'Test Metrics' });
      const { metrics } = output.result;

      expect(metrics.originalBytes).toBe(Buffer.byteLength(text, 'utf-8'));
      expect(metrics.totalBits).toBeGreaterThan(0);
      expect(metrics.paddingBits).toBe((8 - (metrics.totalBits % 8)) % 8);
      expect(metrics.compressedBytes).toBe(Math.ceil((metrics.totalBits + metrics.paddingBits) / 8));
      expect(metrics.fileSizeBytes).toBe(output.sufBuffer.length);
      expect(metrics.headerBytes).toBe(metrics.fileSizeBytes - metrics.compressedBytes);
      expect(metrics.bitsPerSymbol).toBeCloseTo(metrics.totalBits / text.length, 2);
      expect(metrics.entropy).toBeGreaterThan(0);
      expect(metrics.merges).toBe(output.result.distinctSymbols - 1);
      expect(metrics.steps).toBe(3 * output.result.distinctSymbols - 2);
      expect(metrics.executionTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('compressHuffman integration', () => {
    it('should produce a valid HuffmanResult and lossless SUF1 buffer', () => {
      const text = 'Texto completo para verificar la compresión de Huffman.';
      const output = compressHuffman(text, { title: 'Documento de Prueba' });

      expect(output.result.totalCharacters).toBe(text.length);
      expect(output.result.nodes.length).toBe(2 * output.result.distinctSymbols - 1);
      expect(output.result.steps.length).toBe(3 * output.result.distinctSymbols - 2);
      expect(output.result.table.length).toBe(output.result.distinctSymbols);
      expect(output.result.preview.text).toBe(text.slice(0, 30));

      const { header, decodedText } = readSuf(output.sufBuffer);
      expect(header.magic).toBe('SUF1');
      expect(header.title).toBe('Documento de Prueba');
      expect(decodedText).toBe(text);
    });

    it('should throw an error for empty text', () => {
      expect(() => compressHuffman('')).toThrow(/El texto proporcionado para comprimir está vacío/);
    });
  });
});
