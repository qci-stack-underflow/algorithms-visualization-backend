import { Injectable } from '@nestjs/common';
import { HUFFMAN_PSEUDOCODE, HuffmanResult } from '../types/huffman.types';
import {
  compressHuffman,
  CompressOptions,
  HuffmanCompressionOutput,
} from './definitions/huffman-compressor';
import { readSuf, ReadSufResult } from './utils/suf-format';
import { TextCleaner } from '../books/text-cleaner';

@Injectable()
export class HuffmanService {
  getHuffman() {
    return {
      description:
        'Huffman is an algorithm used to compress files from a binary tree. Each leaf of the binary tree is a character, which has frequency and code.',
      pseudocode: HUFFMAN_PSEUDOCODE,
    };
  }

  /**
   * Comprime texto UTF-8 arbitrario y genera el análisis completo junto con el binario .suf.
   *
   * @param rawText Cadena de texto UTF-8 a procesar.
   * @param options Opciones de metadatos (origen, título, frase de vista previa).
   * @returns Objeto con `result` (HuffmanResult) y `sufBuffer` (Buffer binario .suf).
   */
  compress(rawText: string, options?: CompressOptions): HuffmanCompressionOutput {
    return compressHuffman(rawText, options);
  }

  /**
   * Comprime un texto y devuelve únicamente el objeto de análisis y visualización (HuffmanResult).
   */
  compressToResult(rawText: string, options?: CompressOptions): HuffmanResult {
    const { result } = this.compress(rawText, options);
    return result;
  }

  /**
   * Comprime un texto y devuelve únicamente el buffer binario empaquetado en formato .suf.
   */
  compressToBinary(rawText: string, options?: CompressOptions): Buffer {
    const { sufBuffer } = this.compress(rawText, options);
    return sufBuffer;
  }

  /**
   * Descomprime un buffer en formato .suf (SUF1), devolviendo su cabecera y el texto original recuperado.
   */
  decompressBinary(sufBuffer: Buffer): ReadSufResult {
    return readSuf(sufBuffer);
  }

  /**
   * Limpia y normaliza texto eliminando BOM, normalizando saltos de línea y
   * recortando encabezados/pies de Project Gutenberg si están presentes.
   */
  cleanText(rawText: string): string {
    return TextCleaner.clean(rawText);
  }
}
