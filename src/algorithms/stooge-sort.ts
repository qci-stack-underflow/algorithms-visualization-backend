import {
  buildResult,
  createStepList,
  prepareInput,
  recordFinalState,
  recordStep,
} from "./algorithm.utils";

export function stoogeSort(input: number[]) {
  const startedAt = Date.now();
  const array = prepareInput(input);
  const steps = createStepList();
  let comparisons = 0;
  let swaps = 0;

  function sortRange(start: number, end: number): void {
    if (start >= end) {
      return;
    }

    comparisons += 1;
    recordStep(steps, "compare", [start, end], array);

    if (array[start] > array[end]) {
      [array[start], array[end]] = [array[end], array[start]];
      swaps += 1;
      recordStep(steps, "swap", [start, end], array);
    }

    const length = end - start + 1;
    if (length > 2) {
      const third = Math.floor(length / 3);
      sortRange(start, end - third);
      sortRange(start + third, end);
      sortRange(start, end - third);
    }
  }

  sortRange(0, array.length - 1);
  recordFinalState(steps, array);

  return buildResult(
    "stooge-sort",
    input,
    array,
    steps,
    { comparisons, swaps, writes: 0 },
    startedAt,
  );
}
