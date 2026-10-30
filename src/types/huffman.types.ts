/**
 * Contrato del algoritmo de compresión de Huffman y formato .suf.
 *
 * Define las estructuras de datos para el catálogo de libros, el árbol de Huffman,
 * los pasos animables, la tabla de frecuencias, las métricas de compresión,
 * los resultados devueltos por la API y los límites de la plataforma.
 *
 * Convenciones y decisiones del equipo:
 * 1. Fuente de datos: Libros de texto plano (UTF-8) desde Project Gutenberg.
 * 2. Normalización de texto:
 *    - Se eliminan las cabeceras y pies de licencia entre `*** START OF` y `*** END OF`.
 *    - Se elimina el BOM (Byte Order Mark, \uFEFF) si está presente.
 *    - Se normalizan los saltos de línea Windows (\r\n) a estándar Unix (\n).
 * 3. Conteo de símbolos: Se recorre por punto de código Unicode (for...of), garantizando
 *    que caracteres como 'á', 'ñ' o emojis cuenten como un único símbolo.
 * 4. Regla de desempate en la cola de prioridad (min-heap):
 *    - Menor peso (frecuencia acumulada).
 *    - En caso de igualdad de peso, menor `id` (orden de creación / primera aparición).
 *    - El primer nodo extraído de la cola se asigna a la rama izquierda (hijo izquierdo) con bit '0'.
 *    - El segundo nodo extraído se asigna a la rama derecha (hijo derecho) con bit '1'.
 * 5. Caso degenerado (1 solo símbolo): Se le asigna el código "0".
 * 6. Formato .suf (SUF1): Empaquetado binario de bits con prefijo más significativo a la izquierda
 *    (MSB first) y conteo de bits de relleno (padding) en el último byte.
 */

// ---------------------------------------------------------------------------
// Pseudocódigo oficial (coincide con huffman.html)
// ---------------------------------------------------------------------------

export const HUFFMAN_PSEUDOCODE = [
  'contar las apariciones de cada símbolo',
  'Q = cola de prioridad con una hoja por símbolo',
  'mientras Q tenga más de un nodo',
  '  x = extraerMin(Q)',
  '  y = extraerMin(Q)',
  '  z = nodo(peso = x.peso + y.peso, izq = x, der = y)',
  '  insertar(Q, z)',
  'raíz = extraerMin(Q)',
  'asignar 0 a cada rama izquierda y 1 a cada derecha',
] as const;

export type HuffmanPseudocodeLine = (typeof HUFFMAN_PSEUDOCODE)[number];

// ---------------------------------------------------------------------------
// Catálogo de libros (GET /huffman/books)
// ---------------------------------------------------------------------------

export interface BookInfo {
  /** Identificador numérico del libro en Project Gutenberg (p. ej. 2000 para Don Quijote). */
  id: number;
  /** Título oficial de la obra. */
  title: string;
  /** Autor o autores de la obra. */
  author: string;
  /** Idioma principal de la obra (p. ej. "Español", "Inglés"). */
  language: string;
  /** Tamaño aproximado formateado para la interfaz de usuario (p. ej. "2.2 MB", "772 KB"). */
  size: string;
  /** Tamaño del texto en bytes, si se encuentra registrado. */
  bytes?: number;
}

// ---------------------------------------------------------------------------
// Estructura del árbol de Huffman
// ---------------------------------------------------------------------------

/**
 * Representa un nodo en la lista plana del árbol de Huffman.
 *
 * El árbol completo se devuelve como una lista plana de nodos donde:
 * - Los primeros k elementos (0..k-1) son las hojas en orden de primera aparición en el texto.
 * - Los elementos siguientes (k..2k-2) son los nodos internos producto de las uniones (merge).
 */
export interface HuffmanNode {
  /** Identificador único secuencial del nodo (0..2k-2). */
  id: number;
  /** Frecuencia del símbolo (hoja) o suma de frecuencias de los hijos (nodo interno). */
  weight: number;
  /** Carácter Unicode si es nodo hoja; `null` si es un nodo interno de unión. */
  symbol: string | null;
  /** Id del hijo izquierdo (arista con bit '0'); `null` si es nodo hoja. */
  left: number | null;
  /** Id del hijo derecho (arista con bit '1'); `null` si es nodo hoja. */
  right: number | null;
  /** Id del nodo padre en el árbol; `null` para el nodo raíz. */
  parentId?: number | null;
  /** Código binario de Huffman resultante (p. ej. "010"). */
  code?: string;
  /** Indica explícitamente si el nodo es hoja para facilitar el renderizado SVG. */
  isLeaf: boolean;
}

// ---------------------------------------------------------------------------
// Pasos de la animación (Tracer)
// ---------------------------------------------------------------------------

/**
 * Tipos de pasos emitidos por el tracer de Huffman durante la construcción del árbol.
 *
 * Para un texto con k símbolos distintos, se emiten exactamente 3k - 2 pasos:
 * - (k - 1) rondas de:
 *     1) extract-min para x (línea 3)
 *     2) extract-min para y (línea 4)
 *     3) merge para crear z e insertarlo en Q (líneas 5-6)
 * - 1 paso final assign-code para asignar los prefijos binarios (línea 8).
 */
export type HuffmanStep =
  /**
   * Se extrae el nodo de menor prioridad de la cola Q.
   * `line` corresponde a la línea 3 (x = extraerMin) o 4 (y = extraerMin).
   */
  | {
      type: 'extract-min';
      nodeId: number;
      line: number;
      description?: string;
    }
  /**
   * Se crea un nuevo nodo interno combinando x (izq) e y (der) y se inserta en Q.
   * `line` corresponde a la línea 5 o 6.
   */
  | {
      type: 'merge';
      leftId: number;
      rightId: number;
      parentId: number;
      weight: number;
      line: number;
      description?: string;
    }
  /**
   * Se recorre el árbol asignando '0' a ramas izquierdas y '1' a derechas.
   * `line` corresponde a la línea 8.
   */
  | {
      type: 'assign-code';
      nodeId?: number;
      code?: string;
      line: number;
      description?: string;
    };

export type HuffmanStepType = HuffmanStep['type'];

// ---------------------------------------------------------------------------
// Estadísticas de símbolos y frecuencias
// ---------------------------------------------------------------------------

/**
 * Fila en la tabla de frecuencias de símbolos del frontend.
 */
export interface SymbolStat {
  /** Carácter Unicode del símbolo. */
  symbol: string;
  /** Cantidad total de apariciones en el texto limpio (frecuencia absoluta). */
  frequency: number;
  /** Porcentaje de aparición respecto al total de caracteres (0-100). */
  percentage: number;
  /** Código binario de Huffman asignado (p. ej. "111"). */
  code: string;
  /** Longitud en bits del código (`code.length`). */
  bits: number;
  /** Id del nodo hoja en el árbol correspondiente a este símbolo. */
  nodeId?: number;
}

// ---------------------------------------------------------------------------
// Métricas de compresión
// ---------------------------------------------------------------------------

/**
 * Métricas calculadas para la defensa teórica y el panel informativo de la UI.
 */
export interface HuffmanMetrics {
  /** Tamaño del texto limpio original codificado en UTF-8 en bytes. */
  originalBytes: number;
  /** Tamaño solo de los datos comprimidos en bytes (bits empaquetados). */
  compressedBytes: number;
  /** Tamaño total del archivo binario .suf en bytes (encabezado + tabla + datos). */
  fileSizeBytes: number;
  /** Tamaño del encabezado y metadatos del archivo .suf en bytes. */
  headerBytes?: number;
  /** Porcentaje de ahorro de tamaño: ((originalBytes - fileSizeBytes) / originalBytes) * 100. */
  savingsPercentage: number;
  /** Total de bits de la secuencia codificada (sin contar bits de relleno). */
  totalBits: number;
  /** Bits de relleno (0..7) añadidos en el último byte para completar un octeto. */
  paddingBits: number;
  /** Longitud media del código en bits por símbolo (totalBits / totalCharacters). */
  bitsPerSymbol: number;
  /** Entropía de Shannon del texto en bits/símbolo: H(X) = -Σ (p_i * log2(p_i)). */
  entropy: number;
  /** Total de bits si se usara codificación de longitud fija uniforme. */
  fixedBits?: number;
  /** Cantidad de comparaciones realizadas en la cola de prioridad durante el algoritmo. */
  comparisons: number;
  /** Cantidad de operaciones de unión realizadas (k - 1 para k símbolos distintos). */
  merges: number;
  /** Cantidad total de pasos registrados para la animación (3k - 2). */
  steps: number;
  /** Tiempo de ejecución del algoritmo en milisegundos, medido sin sobrecosto de grabación. */
  executionTimeMs: number;
}

// ---------------------------------------------------------------------------
// Vista previa interactiva de codificación
// ---------------------------------------------------------------------------

/**
 * Ficha individual de carácter para la vista de desglose de frase («En un lugar...»).
 */
export interface HuffmanPreviewToken {
  /** Carácter individual. */
  char: string;
  /** Código binario asignado. */
  code: string;
}

/**
 * Desglose interactivo de una frase muestra para la vista binaria.
 */
export interface HuffmanPreview {
  /** Frase original de muestra (p. ej. "En un lugar de la Mancha"). */
  text: string;
  /** Secuencia de fichas con cada carácter y su código. */
  tokens: HuffmanPreviewToken[];
  /** Cadena binaria concatenada resultante. */
  encodedBits: string;
}

// ---------------------------------------------------------------------------
// Resultado de una ejecución (GET /huffman/books/:id)
// ---------------------------------------------------------------------------

export interface HuffmanResult {
  /** Información y metadatos del libro procesado. */
  book: BookInfo;
  /** Número total de caracteres procesados en el texto. */
  totalCharacters: number;
  /** Cantidad de símbolos distintos identificados (k). */
  distinctSymbols: number;
  /** Identificador del nodo raíz en la lista `nodes`. */
  rootId: number;
  /** Lista plana de nodos del árbol (hojas 0..k-1 primero, luego nodos internos). */
  nodes: HuffmanNode[];
  /** Pasos generados para la reproducción de la animación en el frontend. */
  steps: HuffmanStep[];
  /** Tabla completa de estadísticas y códigos por símbolo, ordenada por primera aparición o frecuencia. */
  table: SymbolStat[];
  /** Diccionario directo de símbolo a código binario ("a" -> "11"). */
  codes: Record<string, string>;
  /** Métricas analíticas de la compresión. */
  metrics: HuffmanMetrics;
  /** Vista previa de codificación de la primera frase representativa del texto. */
  preview: HuffmanPreview;
}

// ---------------------------------------------------------------------------
// Interfaz del Tracer de Huffman
// ---------------------------------------------------------------------------

/**
 * Interfaz que define las operaciones observables durante la ejecución de Huffman.
 *
 * Al igual que `SortTracer`, desacopla la lógica del algoritmo de la captura
 * de pasos para la animación y de la medición de métricas.
 */
export interface HuffmanTracer {
  /** Registra la extracción del nodo con menor prioridad de la cola. */
  extractMin(nodeId: number, line: number, description?: string): void;
  /** Registra la unión de dos nodos en un nuevo nodo padre insertado en la cola. */
  merge(
    leftId: number,
    rightId: number,
    parentId: number,
    weight: number,
    line: number,
    description?: string,
  ): void;
  /** Registra la asignación de códigos de prefijo en el árbol. */
  assignCode(
    nodeId: number,
    code: string,
    line: number,
    description?: string,
  ): void;
  /** Incrementa el contador de comparaciones efectuadas por el min-heap. */
  recordComparison(): void;
}

// ---------------------------------------------------------------------------
// Formato binario .suf (SUF1)
// ---------------------------------------------------------------------------

/**
 * Estructura del encabezado del archivo binario .suf.
 *
 * Formato del archivo .suf:
 * 1. Magic bytes: "SUF1" (4 bytes ASCII).
 * 2. Total de caracteres originales (4 bytes, unsigned 32-bit int, big-endian).
 * 3. Bits de relleno en el último byte (1 byte, uint8: 0..7).
 * 4. Cantidad de símbolos distintos k (2 bytes, unsigned 16-bit int, big-endian).
 * 5. Longitud del título del libro (2 bytes, unsigned 16-bit int, big-endian) + título UTF-8.
 * 6. Tabla de frecuencias: Para cada uno de los k símbolos:
 *    - Longitud en bytes del símbolo UTF-8 (1 byte uint8).
 *    - Símbolo codificado en UTF-8.
 *    - Frecuencia del símbolo (4 bytes, unsigned 32-bit int, big-endian).
 * 7. Cuerpo de datos: Bits comprimidos empaquetados en bytes (MSB a LSB).
 */
export interface SufHeader {
  magic: string;
  totalCharacters: number;
  paddingBits: number;
  symbolCount: number;
  title: string;
  frequencies: Array<{ symbol: string; frequency: number }>;
}

// ---------------------------------------------------------------------------
// Límites y constantes del sistema
// ---------------------------------------------------------------------------

/** Identificador mágico obligatorio al inicio de todo archivo .suf. */
export const SUF_MAGIC = 'SUF1' as const;

/** Tamaño máximo de libro permitido para descarga y procesamiento (6 MB). */
export const MAX_BOOK_SIZE_BYTES = 6 * 1024 * 1024; // 6 MB

/** Límite estricto de respuesta de función serverless en Vercel (4.5 MB). */
export const VERCEL_MAX_PAYLOAD_BYTES = 4.5 * 1024 * 1024; // 4.5 MB

/** Tiempo de espera máximo para peticiones a Project Gutenberg (10 segundos). */
export const GUTENBERG_REQUEST_TIMEOUT_MS = 10_000;

/** IDs de los libros oficiales acordados en el catálogo de Project Gutenberg. */
export const CATALOG_BOOK_IDS = [2000, 1342, 2701, 84, 1661, 11] as const;
export type CatalogBookId = (typeof CATALOG_BOOK_IDS)[number];

