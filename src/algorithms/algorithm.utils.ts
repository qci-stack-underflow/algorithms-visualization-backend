type AlgorithmStepType = "compare" | "swap" | "write" | "mark-sorted";

interface AlgorithmStep {
  type: AlgorithmStepType;
  indices: number[];
  array: number[];
  values?: number[];
}

export function createStepList(): AlgorithmStep[] {
  return [];
}

export function prepareInput(input: number[]): number[] {
  if (!Array.isArray(input) || input.some((value) => !Number.isFinite(value))) {
    throw new TypeError("The algorithm input must be an array of finite numbers.");
  }

  return [...input];
}

export function recordStep(
  steps: AlgorithmStep[],
  type: AlgorithmStepType,
  indices: number[],
  array: number[],
  values?: number[],
): void {
  steps.push({
    type,
    indices: [...indices],
    array: [...array],
    ...(values === undefined ? {} : { values: [...values] }),
  });
}

export function recordFinalState(
  steps: AlgorithmStep[],
  array: number[],
): void {
  if (array.length === 0) {
    return;
  }

  recordStep(
    steps,
    "mark-sorted",
    array.map((_, index) => index),
    array,
  );
}

export function buildResult(
  algorithm: string,
  input: number[],
  output: number[],
  steps: AlgorithmStep[],
  metrics: {
    comparisons: number;
    swaps: number;
    writes: number;
  },
  startedAt: number,
) {
  return {
    algorithm,
    input: [...input],
    output: [...output],
    steps,
    metrics: {
      ...metrics,
      executionTimeMs: Date.now() - startedAt,
    },
  };
}
