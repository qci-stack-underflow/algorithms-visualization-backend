import { writeSuf, readSuf } from './suf-format';
import { buildHuffmanTree } from '../definitions/tree-builder';

describe('suf-format (SUF1 binary serialization)', () => {
  it('should serialize and deserialize a text back to its exact original form', () => {
    const text = '¡Hola mundo! Esto es una prueba de Huffman con caracteres especiales: á, é, í, ó, ú, ñ, emoji 🚀.';
    const title = 'Prueba Especial';

    const { codes } = buildHuffmanTree(text);

    const freqs = new Map<string, number>();
    for (const char of text) {
      freqs.set(char, (freqs.get(char) ?? 0) + 1);
    }
    const frequencies = Array.from(freqs.entries()).map(([symbol, frequency]) => ({
      symbol,
      frequency,
    }));

    const sufBuffer = writeSuf({
      text,
      title,
      frequencies,
      codes,
    });

    const { header, decodedText } = readSuf(sufBuffer);

    expect(header.magic).toBe('SUF1');
    expect(header.title).toBe(title);
    expect(header.symbolCount).toBe(frequencies.length);
    expect(decodedText).toBe(text);
  });

  it('should throw an error if the buffer has invalid magic bytes', () => {
    const corruptedBuffer = Buffer.from('BAD1somebinarydata');
    expect(() => readSuf(corruptedBuffer)).toThrow(/Identificador mágico inválido/);
  });

  it('should throw an error if the buffer is too small to contain a header', () => {
    const tinyBuffer = Buffer.from('SUF');
    expect(() => readSuf(tinyBuffer)).toThrow(/Archivo \.suf corrupto o demasiado pequeño/);
  });
});
