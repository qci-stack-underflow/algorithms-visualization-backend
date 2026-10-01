import {
  buildResult,
  createStepList,
  prepareInput,
  recordFinalState,
  recordStep,
} from "./algorithm.utils";

export function gnomeSort(input: number[]) {
  const startedAt = Date.now();
  const array = prepareInput(input);
  const steps = createStepList();
  let comparisons = 0;
  let swaps = 0;
  let index = 1;

  while (index < array.length) {
    const left = index - 1;
    comparisons += 1;
    recordStep(steps, "compare", [left, index], array);

    if (array[left] <= array[index]) {
      index += 1;
      continue;
    }

    [array[left], array[index]] = [array[index], array[left]];
    swaps += 1;
    recordStep(steps, "swap", [left, index], array);
    index = Math.max(1, index - 1);
  }

  recordFinalState(steps, array);

  return buildResult(
    "gnome-sort",
    input,
    array,
    steps,
    { comparisons, swaps, writes: 0 },
    startedAt,
  );
}
