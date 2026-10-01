import {
  buildResult,
  createStepList,
  prepareInput,
  recordFinalState,
  recordStep,
} from "./algorithm.utils";

export function insertionSort(input: number[]) {
  const startedAt = Date.now();
  const array = prepareInput(input);
  const steps = createStepList();
  let comparisons = 0;
  let swaps = 0;

  for (let index = 1; index < array.length; index += 1) {
    let current = index;

    while (current > 0) {
      const left = current - 1;
      comparisons += 1;
      recordStep(steps, "compare", [left, current], array);

      if (array[left] <= array[current]) {
        break;
      }

      [array[left], array[current]] = [array[current], array[left]];
      swaps += 1;
      recordStep(steps, "swap", [left, current], array);
      current -= 1;
    }
  }

  recordFinalState(steps, array);

  return buildResult(
    "insertion-sort",
    input,
    array,
    steps,
    { comparisons, swaps, writes: 0 },
    startedAt,
  );
}
