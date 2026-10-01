import {
  buildResult,
  createStepList,
  prepareInput,
  recordFinalState,
  recordStep,
} from "./algorithm.utils";

export function exchangeSort(input: number[]) {
  const startedAt = Date.now();
  const array = prepareInput(input);
  const steps = createStepList();
  let comparisons = 0;
  let swaps = 0;

  for (let left = 0; left < array.length - 1; left += 1) {
    for (let right = left + 1; right < array.length; right += 1) {
      comparisons += 1;
      recordStep(steps, "compare", [left, right], array);

      if (array[left] > array[right]) {
        [array[left], array[right]] = [array[right], array[left]];
        swaps += 1;
        recordStep(steps, "swap", [left, right], array);
      }
    }
  }

  recordFinalState(steps, array);

  return buildResult(
    "exchange-sort",
    input,
    array,
    steps,
    { comparisons, swaps, writes: 0 },
    startedAt,
  );
}
