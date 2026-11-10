import {
  HuffmanMetrics,
  HuffmanPreview,
  HuffmanPreviewToken,
  HuffmanResult,
  HuffmanSourceInfo,
  SymbolStat,
} from '../../types/huffman.types';
import { countFrequencies } from './frequency-counter';
import { buildHuffmanTree } from './tree-builder';
import { writeSuf } from '../utils/suf-format';
import { TextCleaner } from '../../books/text-cleaner';

export interface CompressOptions {
  source?: HuffmanSourceInfo;
  title?: string;
  previewPhrase?: string;
  clean?: boolean;
}

export interface HuffmanCompressionOutput {
  result: HuffmanResult;
  sufBuffer: Buffer;
}

/**
 * Limpia y normaliza el texto eliminando BOM, normalizando saltos de línea y
 * recortando encabezados/pies de Project Gutenberg si están presentes.
 */
export function cleanText(rawText: string): string {
  return TextCleaner.clean(rawText);
}

/**
 * Calcula las métricas analíticas de compresión de Huffman.
 *
 * Métrica calculadas:
 * - originalBytes: tamaño del texto limpio original codificado en UTF-8.
 * - totalBits: suma de freq_i * len(code_i).
 * - paddingBits: bits para completar el último byte (8 - (totalBits % 8)) % 8.
 * - compressedBytes: tamaño de los bits empaquetados ceil((totalBits + paddingBits) / 8).
 * - fileSizeBytes: tamaño real del buffer .suf generado (cabecera + diccionario + datos).
 * - headerBytes: fileSizeBytes - compressedBytes.
 * - savingsPercentage: porcentaje de ahorro ((originalBytes - fileSizeBytes) / originalBytes) * 100.
 * - bitsPerSymbol: longitud media del código (totalBits / totalCharacters).
 * - entropy: entropía de Shannon H(X) = -sum(p_i * log2(p_i)).
 * - fixedBits: totalCharacters * ceil(log2(max(distinctSymbols, 2))).
 * - comparisons, merges, steps: métricas operativas de la cola de prioridad y del árbol.
 * - executionTimeMs: tiempo medido sin sobrecosto de grabación de pasos.
 */
export function calculateMetrics(params: {
  text: string;
  totalCharacters: number;
  distinctSymbols: number;
  symbols: string[];
  frequencies: Map<string, number>;
  codes: Record<string, string>;
  sufBufferLength: number;
  comparisons: number;
  merges: number;
  stepsCount: number;
  executionTimeMs: number;
}): HuffmanMetrics {
  const {
    text,
    totalCharacters,
    distinctSymbols,
    symbols,
    frequencies,
    codes,
    sufBufferLength,
    comparisons,
    merges,
    stepsCount,
    executionTimeMs,
  } = params;

  const originalBytes = Buffer.byteLength(text, 'utf-8');
  let totalBits = 0;
  let entropy = 0;

  for (let i = 0; i < distinctSymbols; i += 1) {
    const sym = symbols[i];
    const freq = frequencies.get(sym) ?? 0;
    const code = codes[sym] ?? '';
    const p = freq / totalCharacters;

    if (p > 0) {
      entropy -= p * Math.log2(p);
    }
    totalBits += freq * code.length;
  }

  const paddingBits = (8 - (totalBits % 8)) % 8;
  const compressedBytes = Math.ceil((totalBits + paddingBits) / 8);
  const fileSizeBytes = sufBufferLength;
  const headerBytes = fileSizeBytes - compressedBytes;
  const savingsPercentage = Number(
    (((originalBytes - fileSizeBytes) / originalBytes) * 100).toFixed(2),
  );
  const bitsPerSymbol = Number((totalBits / totalCharacters).toFixed(2));
  const fixedBits = totalCharacters * Math.ceil(Math.log2(Math.max(distinctSymbols, 2)));

  return {
    originalBytes,
    compressedBytes,
    fileSizeBytes,
    headerBytes,
    savingsPercentage,
    totalBits,
    paddingBits,
    bitsPerSymbol,
    entropy: Number(entropy.toFixed(2)),
    fixedBits,
    comparisons,
    merges,
    steps: stepsCount,
    executionTimeMs,
  };
}

/**
 * Ejecuta el algoritmo de Huffman completo, construyendo el árbol, la tabla de frecuencias,
 * el archivo binario .suf, las métricas y la vista previa interactiva.
 */
export function compressHuffman(
  rawText: string,
  options: CompressOptions = {},
): HuffmanCompressionOutput {
  const shouldClean =
    options.clean ?? (options.source?.type === 'gutenberg');
  const text = shouldClean ? TextCleaner.clean(rawText) : rawText;

  if (text.length === 0) {
    throw new Error('El texto proporcionado para comprimir está vacío.');
  }

  // Medición de tiempo de ejecución del algoritmo puro sin grabación de pasos
  const startTime = performance.now();
  const { symbols, frequencies, totalCharacters } = countFrequencies(text);
  const distinctSymbols = symbols.length;

  // Construcción del árbol y trazado de pasos
  const treeResult = buildHuffmanTree(text);
  const executionTimeMs = Number((performance.now() - startTime).toFixed(2));

  // Tabla de estadísticas de símbolos (SymbolStat[])
  const table: SymbolStat[] = [];
  const frequenciesArray: Array<{ symbol: string; frequency: number }> = [];

  for (let i = 0; i < distinctSymbols; i += 1) {
    const sym = symbols[i];
    const freq = frequencies.get(sym) ?? 0;
    const code = treeResult.codes[sym] ?? '';
    const percentage = Number(((freq / totalCharacters) * 100).toFixed(2));

    table.push({
      symbol: sym,
      frequency: freq,
      percentage,
      code,
      bits: code.length,
      nodeId: i,
    });

    frequenciesArray.push({ symbol: sym, frequency: freq });
  }

  // Generación del archivo binario .suf (SUF1)
  const title = options.title ?? options.source?.title ?? 'document';
  const sufBuffer = writeSuf({
    text,
    title,
    frequencies: frequenciesArray,
    codes: treeResult.codes,
  });

  // Métricas analíticas
  const metrics = calculateMetrics({
    text,
    totalCharacters,
    distinctSymbols,
    symbols,
    frequencies,
    codes: treeResult.codes,
    sufBufferLength: sufBuffer.length,
    comparisons: treeResult.comparisons,
    merges: treeResult.merges,
    stepsCount: treeResult.steps.length,
    executionTimeMs,
  });

  // Vista previa interactiva de codificación
  const previewText = options.previewPhrase ?? text.slice(0, 30);
  const previewTokens: HuffmanPreviewToken[] = [];
  let previewEncodedBits = '';

  for (const char of previewText) {
    const code = treeResult.codes[char] ?? '';
    previewTokens.push({ char, code });
    previewEncodedBits += code;
  }

  const preview: HuffmanPreview = {
    text: previewText,
    tokens: previewTokens,
    encodedBits: previewEncodedBits,
  };

  // Metadatos de origen
  const source: HuffmanSourceInfo = options.source ?? {
    type: 'upload',
    filename: `${title}.txt`,
    title,
    size: `${(metrics.originalBytes / 1024).toFixed(0)} KB`,
    bytes: metrics.originalBytes,
    mimeType: 'text/plain',
  };

  const result: HuffmanResult = {
    source,
    book: source.type === 'gutenberg' ? source : undefined,
    totalCharacters,
    distinctSymbols,
    rootId: treeResult.rootId,
    nodes: treeResult.nodes,
    steps: treeResult.steps,
    table,
    codes: treeResult.codes,
    metrics,
    preview,
  };

  return {
    result,
    sufBuffer,
  };
}
