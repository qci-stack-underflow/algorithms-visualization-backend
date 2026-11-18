import { writeSuf, readSuf } from './suf-format';
import { buildHuffmanTree } from '../definitions/tree-builder';

describe('suf-format (SUF1 binary serialization)', () => {
  it('should serialize and deserialize a text back to its exact original form', () => {
    const text =
      '¡Hola mundo! Esto es una prueba de Huffman con caracteres especiales: á, é, í, ó, ú, ñ, emoji 🚀.';
    const title = 'Prueba Especial';

    const { codes } = buildHuffmanTree(text);

    const freqs = new Map<string, number>();
    for (const char of text) {
      freqs.set(char, (freqs.get(char) ?? 0) + 1);
    }
    const frequencies = Array.from(freqs.entries()).map(
      ([symbol, frequency]) => ({
        symbol,
        frequency,
      }),
    );

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
    expect(() => readSuf(corruptedBuffer)).toThrow(
      /Identificador mágico inválido/,
    );
  });

  it('should throw an error if the buffer is too small to contain a header', () => {
    const tinyBuffer = Buffer.from('SUF');
    expect(() => readSuf(tinyBuffer)).toThrow(
      /Archivo \.suf corrupto o demasiado pequeño/,
    );
  });

  it('should throw an error for invalid paddingBits or truncated payload', () => {
    const valid = writeSuf({
      text: 'ab',
      title: 'T',
      frequencies: [
        { symbol: 'a', frequency: 1 },
        { symbol: 'b', frequency: 1 },
      ],
      codes: { a: '0', b: '1' },
    });

    const badPadding = Buffer.from(valid);
    badPadding.writeUInt8(9, 8);
    expect(() => readSuf(badPadding)).toThrow(/Bits de relleno inválidos/);

    const truncated = valid.subarray(0, 15);
    expect(() => readSuf(truncated)).toThrow(/corrupt[ao] o truncad[ao]/);

    const wrongCount = Buffer.from(valid);
    wrongCount.writeUInt32BE(99, 4);
    expect(() => readSuf(wrongCount)).toThrow(/no coincide con los caracteres/);
  });
});
