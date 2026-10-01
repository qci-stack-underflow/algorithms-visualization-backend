import assert from "node:assert/strict";
import test from "node:test";

import { exchangeSort } from "../src/algorithms/exchange-sort";
import { gnomeSort } from "../src/algorithms/gnome-sort";
import { insertionSort } from "../src/algorithms/insertion-sort";
import { stoogeSort } from "../src/algorithms/stooge-sort";

const algorithms = [insertionSort, gnomeSort, stoogeSort, exchangeSort];

const cases = [
  { input: [1, 5, 7, 4, 7], expected: [1, 4, 5, 7, 7] },
  { input: [], expected: [] },
  { input: [5], expected: [5] },
  { input: [3, -1, 3, 0], expected: [-1, 0, 3, 3] },
  { input: [4, 3, 2, 1], expected: [1, 2, 3, 4] },
];

for (const algorithm of algorithms) {
  test(`${algorithm.name} sorts supported inputs and preserves the original`, () => {
    for (const testCase of cases) {
      const original = [...testCase.input];
      const result = algorithm(testCase.input);

      assert.deepEqual(result.input, original);
      assert.deepEqual(result.output, testCase.expected);
      assert.deepEqual(testCase.input, original);
      assert.ok(result.metrics.comparisons >= 0);
      assert.ok(result.metrics.swaps >= 0);
      assert.ok(result.metrics.executionTimeMs >= 0);

      if (result.output.length > 0) {
        assert.equal(result.steps.at(-1)?.type, "mark-sorted");
      }
    }
  });
}

test("algorithms reject values that cannot be sorted numerically", () => {
  for (const algorithm of algorithms) {
    assert.throws(() => algorithm([1, Number.NaN]), TypeError);
    assert.throws(() => algorithm([1, Number.POSITIVE_INFINITY]), TypeError);
  }
});
