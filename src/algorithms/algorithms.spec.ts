import { runAlgorithm } from './algorithm.tracer';
import {
  AlgorithmDefinition,
  AlgorithmStep,
  MAX_INPUT_LENGTH,
} from '@type/algorithm.types';
import { ALGORITHM_DEFINITIONS } from './algorithms.registry';

const edgeCases: { name: string; input: number[] }[] = [
  { name: 'vacío', input: [] },
  { name: 'un elemento', input: [5] },
  { name: 'con repetidos', input: [1, 5, 7, 4, 7] },
  { name: 'con negativos', input: [3, -1, 3, 0] },
  { name: 'ya ordenado', input: [1, 2, 3, 4, 5] },
  { name: 'orden inverso', input: [5, 4, 3, 2, 1] },
  { name: 'decimales', input: [2.5, -0.5, 2.25, 0] },
];

const SIZES = [10, 25, MAX_INPUT_LENGTH];

// Generador con semilla para que las pruebas siempre usen los mismos arreglos.
function randomArray(length: number, seed: number): number[] {
  let state = seed;
  return Array.from({ length }, () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return (state % 201) - 100;
  });
}

// Lo mismo que hará el frontend: partir de input y aplicar swap y write.
function replay(input: number[], steps: AlgorithmStep[]): number[] {
  const array = [...input];
  for (const step of steps) {
    if (step.type === 'swap') {
      const [i, j] = step.indices;
      [array[i], array[j]] = [array[j], array[i]];
    } else if (step.type === 'write') {
      array[step.index] = step.value;
    }
  }
  return array;
}

function countSteps(
  steps: AlgorithmStep[],
  type: AlgorithmStep['type'],
): number {
  return steps.filter((step) => step.type === type).length;
}

function checkResult(definition: AlgorithmDefinition, input: number[]): void {
  const original = [...input];
  const result = runAlgorithm(definition, input);
  const expected = [...original].sort((a, b) => a - b);

  expect(result.algorithm).toBe(definition.info.id);
  expect(input).toEqual(original);
  expect(result.input).toEqual(original);
  expect(result.output).toEqual(expected);
  expect(replay(result.input, result.steps)).toEqual(result.output);

  expect(result.metrics.comparisons).toBe(countSteps(result.steps, 'compare'));
  expect(result.metrics.swaps).toBe(countSteps(result.steps, 'swap'));
  expect(result.metrics.writes).toBe(countSteps(result.steps, 'write'));
  expect(result.metrics.steps).toBe(result.steps.length);
  expect(result.metrics.executionTimeMs).toBeGreaterThanOrEqual(0);

  for (const step of result.steps) {
    if (step.line !== undefined) {
      expect(step.line).toBeGreaterThanOrEqual(0);
      expect(step.line).toBeLessThan(definition.info.pseudocode.length);
    }
  }

  if (original.length > 0) {
    expect(result.steps.at(-1)).toEqual({
      type: 'sorted',
      indices: original.map((_, index) => index),
    });
  }
}

describe.each(ALGORITHM_DEFINITIONS.map((d) => [d.info.name, d] as const))(
  '%s',
  (_name, definition) => {
    it.each(edgeCases)('ordena el caso $name', ({ input }) => {
      checkResult(definition, input);
    });

    it.each(SIZES)('ordena 3 arreglos aleatorios de tamaño %i', (size) => {
      for (const seed of [1, 2, 3]) {
        checkResult(definition, randomArray(size, seed * size));
      }
    });

    it('rechaza entradas inválidas', () => {
      expect(() => runAlgorithm(definition, [1, Number.NaN])).toThrow(
        TypeError,
      );
      expect(() =>
        runAlgorithm(definition, [1, Number.POSITIVE_INFINITY]),
      ).toThrow(TypeError);
      expect(() => runAlgorithm(definition, '1,2,3')).toThrow(TypeError);
      expect(() =>
        runAlgorithm(definition, randomArray(MAX_INPUT_LENGTH + 1, 7)),
      ).toThrow(RangeError);
    });
  },
);

it('los ids de los algoritmos son únicos', () => {
  const ids = ALGORITHM_DEFINITIONS.map((definition) => definition.info.id);
  expect(new Set(ids).size).toBe(ids.length);
});
