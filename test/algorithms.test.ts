import assert from "node:assert/strict";
import test from "node:test";

import {
  AlgorithmDefinition,
  AlgorithmStep,
  MAX_INPUT_LENGTH,
  exchangeSort,
  gnomeSort,
  insertionSort,
  runAlgorithm,
  stoogeSort,
} from "../src/algorithms";

const algorithms: AlgorithmDefinition[] = [insertionSort, gnomeSort, stoogeSort, exchangeSort];

const edgeCases = [
  { name: "vacío", input: [] },
  { name: "un elemento", input: [5] },
  { name: "con repetidos", input: [1, 5, 7, 4, 7] },
  { name: "con negativos", input: [3, -1, 3, 0] },
  { name: "ya ordenado", input: [1, 2, 3, 4, 5] },
  { name: "orden inverso", input: [5, 4, 3, 2, 1] },
  { name: "decimales", input: [2.5, -0.5, 2.25, 0] },
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
    if (step.type === "swap") {
      const [i, j] = step.indices;
      [array[i], array[j]] = [array[j], array[i]];
    } else if (step.type === "write") {
      array[step.index] = step.value;
    }
  }
  return array;
}

function countSteps(steps: AlgorithmStep[], type: AlgorithmStep["type"]): number {
  return steps.filter((step) => step.type === type).length;
}

function checkResult(definition: AlgorithmDefinition, input: number[]): void {
  const original = [...input];
  const result = runAlgorithm(definition, input);
  const expected = [...original].sort((a, b) => a - b);

  assert.equal(result.algorithm, definition.info.id);
  assert.deepEqual(input, original, "no debe modificar el arreglo original");
  assert.deepEqual(result.input, original);
  assert.deepEqual(result.output, expected);
  assert.deepEqual(replay(result.input, result.steps), result.output, "los pasos deben reproducir la salida");

  assert.equal(result.metrics.comparisons, countSteps(result.steps, "compare"));
  assert.equal(result.metrics.swaps, countSteps(result.steps, "swap"));
  assert.equal(result.metrics.writes, countSteps(result.steps, "write"));
  assert.equal(result.metrics.steps, result.steps.length);
  assert.ok(result.metrics.executionTimeMs >= 0);

  for (const step of result.steps) {
    if (step.line !== undefined) {
      assert.ok(
        step.line >= 0 && step.line < definition.info.pseudocode.length,
        `la línea ${step.line} no existe en el pseudocódigo`,
      );
    }
  }

  if (original.length > 0) {
    const last = result.steps.at(-1);
    assert.equal(last?.type, "sorted");
    assert.deepEqual(last?.type === "sorted" && last.indices, original.map((_, index) => index));
  }
}

for (const definition of algorithms) {
  const { name } = definition.info;

  test(`${name}: casos borde`, () => {
    for (const edgeCase of edgeCases) {
      checkResult(definition, edgeCase.input);
    }
  });

  test(`${name}: 3 tamaños de entrada (${SIZES.join(", ")})`, () => {
    for (const size of SIZES) {
      for (const seed of [1, 2, 3]) {
        checkResult(definition, randomArray(size, seed * size));
      }
    }
  });

  test(`${name}: rechaza entradas inválidas`, () => {
    assert.throws(() => runAlgorithm(definition, [1, Number.NaN]), TypeError);
    assert.throws(() => runAlgorithm(definition, [1, Number.POSITIVE_INFINITY]), TypeError);
    assert.throws(() => runAlgorithm(definition, "1,2,3"), TypeError);
    assert.throws(() => runAlgorithm(definition, randomArray(MAX_INPUT_LENGTH + 1, 7)), RangeError);
  });
}

test("los ids de los algoritmos son únicos", () => {
  const ids = algorithms.map((definition) => definition.info.id);
  assert.equal(new Set(ids).size, ids.length);
});
