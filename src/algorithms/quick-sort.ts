import { AlgorithmDefinition } from '@type/algorithm.types';

export const quickSort: AlgorithmDefinition = {
  info: {
    id: 'quick-sort',
    name: 'Quick Sort',
    complexity: { best: 'O(n log n)', average: 'O(n log n)', worst: 'O(n²)' },
    description: 'Recursivo (pivote)',
    pseudocode: [
      'quickSort(A, lo, hi)',
      '  if lo >= hi: return',
      '  p = partition(A, lo, hi)',
      '  quickSort(A, lo, p-1)',
      '  quickSort(A, p+1, hi)',
      'partition(A, lo, hi)',
      '  pivot = A[hi]',
      '  i = lo',
      '  for j = lo to hi-1',
      '    if A[j] < pivot',
      '      swap(A[i], A[j])',
      '      i = i + 1',
      '  swap(A[i], A[hi])',
      '  return i',
    ],
  },
  sort(t) {
    // Partición de Lomuto: el pivote es el último elemento del subarreglo.
    const partition = (lo: number, hi: number): number => {
      t.range(lo, hi, 2);
      t.pivot(hi, 6);
      let i = lo;

      for (let j = lo; j < hi; j += 1) {
        if (t.compare(j, hi, 9) < 0) {
          if (i !== j) {
            t.swap(i, j, 10);
          }
          i += 1;
        }
      }

      if (i !== hi) {
        t.swap(i, hi, 12);
      }
      t.sorted([i], 12);
      return i;
    };

    const sortRange = (lo: number, hi: number): void => {
      if (lo > hi) {
        return;
      }

      if (lo === hi) {
        t.sorted([lo], 1);
        return;
      }

      const p = partition(lo, hi);
      sortRange(lo, p - 1);
      sortRange(p + 1, hi);
    };

    sortRange(0, t.length - 1);
  },
};
