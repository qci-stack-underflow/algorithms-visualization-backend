/**
 * Contrato de los algoritmos de ordenamiento (PROPUESTA, pendiente de acordar en #7).
 *
 * Define qué recibe cada algoritmo, qué devuelve la API y qué pasos
 * recibe el frontend para animar el ordenamiento.
 */

// ---------------------------------------------------------------------------
// Identificación y catálogo (GET /algorithms)
// ---------------------------------------------------------------------------

export const ALGORITHM_IDS = [
  "bubble-sort",
  "selection-sort",
  "insertion-sort",
  "stooge-sort",
  "gnome-sort",
  "exchange-sort",
  "merge-sort",
  "quick-sort",
] as const;

export type AlgorithmId = (typeof ALGORITHM_IDS)[number];

/** Clase de complejidad promedio, usada por el filtro del frontend. */
export type ComplexityClass = "O(n log n)" | "O(n²)" | "O(n^2.71)";

export interface AlgorithmInfo {
  id: AlgorithmId;
  /** Nombre para mostrar, p. ej. "Insertion Sort". */
  name: string;
  complexity: {
    best: string;
    average: ComplexityClass;
    worst: string;
  };
  description: string;
  /** Líneas de pseudocódigo; `AlgorithmStep.line` apunta a un índice de esta lista. */
  pseudocode: string[];
}

// ---------------------------------------------------------------------------
// Pasos de la animación
// ---------------------------------------------------------------------------

/**
 * Cada paso describe solo lo que cambia. El frontend parte de
 * `AlgorithmResult.input` y aplica `swap` y `write` en orden para
 * reconstruir el arreglo en cualquier momento.
 */
export type AlgorithmStep =
  /** Se comparan las posiciones `indices[0]` e `indices[1]`. */
  | { type: "compare"; indices: [number, number]; line: number }
  /** Se intercambian las posiciones `indices[0]` e `indices[1]`. */
  | { type: "swap"; indices: [number, number]; line: number }
  /** Se escribe `value` en la posición `index` (Merge Sort). */
  | { type: "write"; index: number; value: number; line: number }
  /** La posición `index` es el pivote actual (Quick Sort). */
  | { type: "pivot"; index: number; line: number }
  /** Subarreglo activo `[start, end]` (algoritmos recursivos). */
  | { type: "range"; start: number; end: number; line: number }
  /** Estas posiciones ya están en su lugar final. */
  | { type: "sorted"; indices: number[]; line?: number };

export type AlgorithmStepType = AlgorithmStep["type"];

// ---------------------------------------------------------------------------
// Resultado de una ejecución (POST /algorithms/:id/run y /compare)
// ---------------------------------------------------------------------------

export interface AlgorithmMetrics {
  comparisons: number;
  swaps: number;
  writes: number;
  /** Cantidad de pasos generados para la animación. */
  steps: number;
  /** Tiempo del algoritmo sin grabar pasos, medido con performance.now(). */
  executionTimeMs: number;
}

export interface AlgorithmResult {
  algorithm: AlgorithmId;
  /** Arreglo inicial: el frontend parte de aquí para animar. */
  input: number[];
  output: number[];
  steps: AlgorithmStep[];
  metrics: AlgorithmMetrics;
}

// ---------------------------------------------------------------------------
// Lo que usa cada algoritmo para operar sobre el arreglo
// ---------------------------------------------------------------------------

/**
 * Cada algoritmo lee y modifica el arreglo solo a través del tracer.
 * Así cada operación queda registrada como paso y contada en las métricas.
 * `line` es el índice de la línea de `AlgorithmInfo.pseudocode` que se ejecuta.
 */
export interface SortTracer {
  readonly array: readonly number[];
  readonly length: number;
  /** Compara `array[i]` con `array[j]`: < 0 si es menor, 0 si son iguales, > 0 si es mayor. */
  compare(i: number, j: number, line: number): number;
  /**
   * Compara dos valores que pueden estar fuera del arreglo (p. ej. las
   * mitades auxiliares de Merge Sort) y resalta las posiciones `indices`.
   */
  compareValues(
    a: number,
    b: number,
    indices: [number, number],
    line: number,
  ): number;
  swap(i: number, j: number, line: number): void;
  write(i: number, value: number, line: number): void;
  pivot(i: number, line: number): void;
  range(start: number, end: number, line: number): void;
  sorted(indices: number[], line?: number): void;
}

export interface AlgorithmDefinition {
  info: AlgorithmInfo;
  sort(tracer: SortTracer): void;
}

// ---------------------------------------------------------------------------
// Límites
// ---------------------------------------------------------------------------

/** Tamaño máximo de entrada para no rebasar el límite de respuesta de Vercel. */
export const MAX_INPUT_LENGTH = 50;
