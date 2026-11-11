/**
 * Resultado del empaquetado de bits en un arreglo de bytes.
 */
export interface BitPackResult {
  /** Secuencia de bytes empaquetada. */
  data: Uint8Array;
  /** Cantidad de bits añadidos al último byte para completar un octeto (0..7). */
  paddingBits: number;
  /** Cantidad de bits útiles de la secuencia original antes de rellenar. */
  totalBits: number;
}

/**
 * Empaqueta una cadena binaria ("0101...") en un Uint8Array.
 *
 * Convenciones:
 * - MSB primero (Most Significant Bit en el bit 7 del byte).
 * - Si totalBits % 8 !== 0, se agregan `paddingBits` ceros a la derecha del último byte.
 */
export function packBits(bitString: string): BitPackResult {
  const totalBits = bitString.length;
  const paddingBits = (8 - (totalBits % 8)) % 8;
  const paddedBitString =
    paddingBits > 0 ? bitString + '0'.repeat(paddingBits) : bitString;
  const byteCount = Math.ceil(paddedBitString.length / 8);
  const data = new Uint8Array(byteCount);

  for (let i = 0; i < byteCount; i += 1) {
    const chunk = paddedBitString.slice(i * 8, (i + 1) * 8);
    data[i] = parseInt(chunk, 2);
  }

  return {
    data,
    paddingBits,
    totalBits,
  };
}

/**
 * Desempaqueta un Uint8Array a una cadena de bits binarios ("0101..."), descartando los bits de relleno.
 */
export function unpackBits(data: Uint8Array, paddingBits: number): string {
  if (data.length === 0) {
    return '';
  }

  let bitString = '';
  for (let i = 0; i < data.length; i += 1) {
    const byte = data[i];
    const bits = byte.toString(2).padStart(8, '0');
    if (i === data.length - 1 && paddingBits > 0) {
      bitString += bits.slice(0, 8 - paddingBits);
    } else {
      bitString += bits;
    }
  }

  return bitString;
}

/**
 * Codifica un texto utilizando un diccionario de códigos Huffman (símbolo -> código de bits)
 * y empaqueta el flujo resultante en un Uint8Array.
 */
export function encodeTextToBits(
  text: string,
  codes: Record<string, string>,
): {
  bitString: string;
  packed: BitPackResult;
} {
  let bitString = '';
  for (const char of text) {
    const code = codes[char];
    if (code === undefined) {
      throw new Error(
        `Símbolo no encontrado en la tabla de códigos Huffman: ${JSON.stringify(char)}`,
      );
    }
    bitString += code;
  }

  const packed = packBits(bitString);
  return { bitString, packed };
}
