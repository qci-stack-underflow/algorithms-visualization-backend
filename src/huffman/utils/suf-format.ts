import {
  SUF_MAGIC,
  SufDictionaryEntry,
  SufHeader,
} from '../../types/huffman.types';
import { packBits, unpackBits } from './bit-packer';

export interface WriteSufOptions {
  text: string;
  title: string;
  frequencies: Array<{ symbol: string; frequency: number }>;
  codes: Record<string, string>;
}

export interface ReadSufResult {
  header: SufHeader;
  decodedText: string;
}

/**
 * Serializa texto comprimido en el formato binario propietario .suf (SUF1).
 *
 * Estructura byte a byte:
 * 1. Magic bytes: "SUF1" (4 bytes ASCII)
 * 2. Total caracteres originales: uint32 BE (4 bytes)
 * 3. Bits de relleno (padding): uint8 (1 byte: 0..7)
 * 4. Cantidad de símbolos (k): uint16 BE (2 bytes)
 * 5. Longitud del título: uint16 BE (2 bytes) + Título en UTF-8
 * 6. Diccionario de k símbolos:
 *    - Longitud en bytes del símbolo UTF-8: uint8 (1 byte)
 *    - Símbolo UTF-8
 *    - Frecuencia absoluta: uint32 BE (4 bytes)
 *    - Longitud del código en bits: uint8 (1 byte)
 *    - Código Huffman en caracteres ASCII (codeLength bytes)
 * 7. Cuerpo de datos: Bits comprimidos empaquetados en bytes (MSB first)
 */
export function writeSuf(options: WriteSufOptions): Buffer {
  const { text, title, frequencies, codes } = options;

  // 1. Empaquetar la secuencia de bits
  let bitString = '';
  for (const char of text) {
    const code = codes[char];
    if (code === undefined) {
      throw new Error(
        `Código Huffman no encontrado para el símbolo: ${JSON.stringify(char)}`,
      );
    }
    bitString += code;
  }

  const { data: compressedData, paddingBits } = packBits(bitString);

  // 2. Construir cabecera
  const titleBuffer = Buffer.from(title, 'utf-8');
  const magicBuffer = Buffer.from(SUF_MAGIC, 'ascii');

  let headerSize =
    4 + // magic
    4 + // totalCharacters uint32
    1 + // paddingBits uint8
    2 + // symbolCount uint16
    2 + // titleLength uint16
    titleBuffer.length;

  const dictionaryEntries: Array<{
    symbolBuffer: Buffer;
    frequency: number;
    codeBuffer: Buffer;
  }> = [];

  for (const entry of frequencies) {
    const symbolBuffer = Buffer.from(entry.symbol, 'utf-8');
    const code = codes[entry.symbol] ?? '';
    const codeBuffer = Buffer.from(code, 'ascii');
    dictionaryEntries.push({
      symbolBuffer,
      frequency: entry.frequency,
      codeBuffer,
    });

    headerSize +=
      1 + // symbol length uint8
      symbolBuffer.length +
      4 + // frequency uint32
      1 + // code length uint8
      codeBuffer.length;
  }

  const sufBuffer = Buffer.alloc(headerSize + compressedData.length);
  let offset = 0;

  // Magic (4 bytes)
  magicBuffer.copy(sufBuffer, offset);
  offset += 4;

  // Total de caracteres Unicode (uint32 BE)
  let totalUnicodeChars = 0;
  for (const _ of text) {
    totalUnicodeChars += 1;
  }
  sufBuffer.writeUInt32BE(totalUnicodeChars, offset);
  offset += 4;

  // Bits de relleno (uint8)
  sufBuffer.writeUInt8(paddingBits, offset);
  offset += 1;

  // Cantidad de símbolos k (uint16 BE)
  sufBuffer.writeUInt16BE(dictionaryEntries.length, offset);
  offset += 2;

  // Longitud del título y título en UTF-8
  sufBuffer.writeUInt16BE(titleBuffer.length, offset);
  offset += 2;
  titleBuffer.copy(sufBuffer, offset);
  offset += titleBuffer.length;

  // Diccionario
  for (const item of dictionaryEntries) {
    sufBuffer.writeUInt8(item.symbolBuffer.length, offset);
    offset += 1;

    item.symbolBuffer.copy(sufBuffer, offset);
    offset += item.symbolBuffer.length;

    sufBuffer.writeUInt32BE(item.frequency, offset);
    offset += 4;

    sufBuffer.writeUInt8(item.codeBuffer.length, offset);
    offset += 1;

    item.codeBuffer.copy(sufBuffer, offset);
    offset += item.codeBuffer.length;
  }

  // Cuerpo de datos comprimidos
  Buffer.from(
    compressedData.buffer,
    compressedData.byteOffset,
    compressedData.byteLength,
  ).copy(sufBuffer, offset);

  return sufBuffer;
}

/**
 * Lee y decodifica un archivo binario .suf (SUF1), reconstruyendo el texto original.
 */
export function readSuf(buffer: Buffer): ReadSufResult {
  let offset = 0;

  if (buffer.length < 13) {
    throw new Error(
      'Archivo .suf corrupto o demasiado pequeño para contener la cabecera.',
    );
  }

  // 1. Magic bytes
  const magic = buffer.toString('ascii', offset, offset + 4);
  offset += 4;
  if (magic !== SUF_MAGIC) {
    throw new Error(
      `Identificador mágico inválido: "${magic}". Se esperaba "${SUF_MAGIC}".`,
    );
  }

  // 2. Total caracteres
  const totalCharacters = buffer.readUInt32BE(offset);
  offset += 4;

  // 3. Padding bits
  const paddingBits = buffer.readUInt8(offset);
  offset += 1;

  // 4. Cantidad de símbolos k
  const symbolCount = buffer.readUInt16BE(offset);
  offset += 2;

  // 5. Título
  const titleLength = buffer.readUInt16BE(offset);
  offset += 2;
  const title = buffer.toString('utf-8', offset, offset + titleLength);
  offset += titleLength;

  // 6. Diccionario
  const dictionary: SufDictionaryEntry[] = [];
  const codeToSymbolMap = new Map<string, string>();

  for (let i = 0; i < symbolCount; i += 1) {
    const symbolLength = buffer.readUInt8(offset);
    offset += 1;
    const symbol = buffer.toString('utf-8', offset, offset + symbolLength);
    offset += symbolLength;

    const frequency = buffer.readUInt32BE(offset);
    offset += 4;

    const codeLength = buffer.readUInt8(offset);
    offset += 1;
    const code = buffer.toString('ascii', offset, offset + codeLength);
    offset += codeLength;

    dictionary.push({ symbol, frequency, codeLength, code });
    codeToSymbolMap.set(code, symbol);
  }

  // 7. Cuerpo de datos comprimidos
  const compressedBytes = buffer.subarray(offset);
  const bitString = unpackBits(new Uint8Array(compressedBytes), paddingBits);

  // Decodificación prefijo
  let decodedText = '';
  let currentBits = '';

  for (const bit of bitString) {
    currentBits += bit;
    const matchedSymbol = codeToSymbolMap.get(currentBits);
    if (matchedSymbol !== undefined) {
      decodedText += matchedSymbol;
      currentBits = '';
    }
  }

  const header: SufHeader = {
    magic,
    totalCharacters,
    paddingBits,
    symbolCount,
    title,
    dictionary,
  };

  return {
    header,
    decodedText,
  };
}
