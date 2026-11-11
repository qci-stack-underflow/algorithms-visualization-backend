import { packBits, unpackBits, encodeTextToBits } from './bit-packer';
import { buildHuffmanTree } from '../definitions/tree-builder';

describe('bit-packer', () => {
  describe('packBits and unpackBits', () => {
    it('should pack bits into bytes with MSB first convention', () => {
      // 8 bits exactos: "10110000" -> 176 (0xB0)
      const { data, paddingBits, totalBits } = packBits('10110000');
      expect(totalBits).toBe(8);
      expect(paddingBits).toBe(0);
      expect(data.length).toBe(1);
      expect(data[0]).toBe(0b10110000);
    });

    it('should calculate paddingBits and pad with zeros on the right', () => {
      // 5 bits: "10111" -> padded a "10111000" (0xB8 = 184), paddingBits = 3
      const { data, paddingBits, totalBits } = packBits('10111');
      expect(totalBits).toBe(5);
      expect(paddingBits).toBe(3);
      expect(data.length).toBe(1);
      expect(data[0]).toBe(0b10111000);
    });

    it('should pack and unpack round-trip accurately', () => {
      const bitString =
        '1101001011101101111100001101111101111000100110000000101111100101011111011000111110100000100000110011101001111000';
      const { data, paddingBits } = packBits(bitString);
      const unpacked = unpackBits(data, paddingBits);
      expect(unpacked).toBe(bitString);
    });

    it('should handle empty bit string', () => {
      const { data, paddingBits, totalBits } = packBits('');
      expect(totalBits).toBe(0);
      expect(paddingBits).toBe(0);
      expect(data.length).toBe(0);
      expect(unpackBits(data, paddingBits)).toBe('');
    });
  });

  describe('encodeTextToBits and prefix property', () => {
    it('should ensure no code is a prefix of another code in Huffman tree', () => {
      const text =
        'En un lugar de la Mancha, de cuyo nombre no quiero acordarme...';
      const { codes } = buildHuffmanTree(text);
      const codeList = Object.values(codes);

      for (let i = 0; i < codeList.length; i += 1) {
        for (let j = 0; j < codeList.length; j += 1) {
          if (i !== j) {
            expect(codeList[j].startsWith(codeList[i])).toBe(false);
          }
        }
      }
    });

    it('should encode text and return packed Uint8Array', () => {
      const text = 'abracadabra';
      const { codes } = buildHuffmanTree(text);
      const { bitString, packed } = encodeTextToBits(text, codes);

      expect(packed.totalBits).toBe(bitString.length);
      expect(packed.data.length).toBe(
        Math.ceil((bitString.length + packed.paddingBits) / 8),
      );
      expect(unpackBits(packed.data, packed.paddingBits)).toBe(bitString);
    });

    it('should throw if a character is not in the code dictionary', () => {
      const text = 'abc';
      const codes = { a: '0', b: '10' }; // falta 'c'
      expect(() => encodeTextToBits(text, codes)).toThrow(
        /Símbolo no encontrado/,
      );
    });
  });
});
