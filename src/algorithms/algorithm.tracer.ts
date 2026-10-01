/**
 * Implementaciones del tracer y función para ejecutar un algoritmo
 * (PROPUESTA, pendiente de acordar en #7).
 */
import {
  AlgorithmDefinition,
  AlgorithmResult,
  AlgorithmStep,
  MAX_INPUT_LENGTH,
  SortTracer,
} from "./algorithm.types";

/** Solo opera sobre el arreglo y cuenta; se usa para medir el tiempo. */
export class CountingTracer implements SortTracer {
  protected readonly data: number[];
  comparisons = 0;
  swaps = 0;
  writes = 0;

  constructor(input: number[]) {
    this.data = [...input];
  }

  get array(): readonly number[] {
    return this.data;
  }

  get length(): number {
    return this.data.length;
  }

  compare(i: number, j: number, line: number): number {
    return this.compareValues(this.data[i], this.data[j], [i, j], line);
  }

  compareValues(a: number, b: number, _indices: [number, number], _line: number): number {
    this.comparisons += 1;
    return a - b;
  }

  swap(i: number, j: number, _line: number): void {
    [this.data[i], this.data[j]] = [this.data[j], this.data[i]];
    this.swaps += 1;
  }

  write(i: number, value: number, _line: number): void {
    this.data[i] = value;
    this.writes += 1;
  }

  pivot(_i: number, _line: number): void {}

  range(_start: number, _end: number, _line: number): void {}

  sorted(_indices: number[], _line?: number): void {}
}

/** Además de operar y contar, guarda cada paso para la animación. */
export class RecordingTracer extends CountingTracer {
  readonly steps: AlgorithmStep[] = [];

  compareValues(a: number, b: number, indices: [number, number], line: number): number {
    this.steps.push({ type: "compare", indices: [...indices], line });
    return super.compareValues(a, b, indices, line);
  }

  swap(i: number, j: number, line: number): void {
    super.swap(i, j, line);
    this.steps.push({ type: "swap", indices: [i, j], line });
  }

  write(i: number, value: number, line: number): void {
    super.write(i, value, line);
    this.steps.push({ type: "write", index: i, value, line });
  }

  pivot(i: number, line: number): void {
    this.steps.push({ type: "pivot", index: i, line });
  }

  range(start: number, end: number, line: number): void {
    this.steps.push({ type: "range", start, end, line });
  }

  sorted(indices: number[], line?: number): void {
    this.steps.push({
      type: "sorted",
      indices: [...indices],
      ...(line === undefined ? {} : { line }),
    });
  }
}

export function validateInput(input: unknown): number[] {
  if (!Array.isArray(input) || input.some((value) => !Number.isFinite(value))) {
    throw new TypeError("The algorithm input must be an array of finite numbers.");
  }

  if (input.length > MAX_INPUT_LENGTH) {
    throw new RangeError(`The algorithm input cannot exceed ${MAX_INPUT_LENGTH} elements.`);
  }

  return [...input];
}

/**
 * Ejecuta el algoritmo dos veces sobre copias de la entrada:
 * una grabando pasos (animación y contadores) y otra solo contando (tiempo).
 */
export function runAlgorithm(
  definition: AlgorithmDefinition,
  input: unknown,
): AlgorithmResult {
  const values = validateInput(input);

  const recorder = new RecordingTracer(values);
  definition.sort(recorder);
  if (recorder.length > 0) {
    recorder.sorted(values.map((_, index) => index));
  }

  const counter = new CountingTracer(values);
  const startedAt = performance.now();
  definition.sort(counter);
  const executionTimeMs = performance.now() - startedAt;

  return {
    algorithm: definition.info.id,
    input: values,
    output: [...recorder.array],
    steps: recorder.steps,
    metrics: {
      comparisons: recorder.comparisons,
      swaps: recorder.swaps,
      writes: recorder.writes,
      steps: recorder.steps.length,
      executionTimeMs,
    },
  };
}
