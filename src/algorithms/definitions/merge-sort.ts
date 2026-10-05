import { AlgorithmDefinition } from '../../types/algorithm.types';

export const mergeSort: AlgorithmDefinition = {
  info: {
    id: 'merge-sort',
    name: 'Merge Sort',
    complexity: {
      best: 'O(n log n)',
      average: 'O(n log n)',
      worst: 'O(n log n)',
    },
    description: 'Recursivo (mezcla)',
    pseudocode: [
      'mergeSort(A, lo, hi)',
      '  if lo >= hi: return',
      '  mid = (lo + hi) / 2',
      '  mergeSort(A, lo, mid)',
      '  mergeSort(A, mid+1, hi)',
      '  merge(A, lo, mid, hi)',
      'merge(A, lo, mid, hi)',
      '  L = A[lo..mid], R = A[mid+1..hi]',
      '  while L and R have elements',
      '    if L[i] <= R[j]',
      '      A[k] = L[i]; i = i + 1',
      '    else',
      '      A[k] = R[j]; j = j + 1',
      '  copy the rest of L into A',
    ],
  },
  sort(t) {
    const merge = (lo: number, mid: number, hi: number): void => {
      t.range(lo, hi, 5);
      const left = t.array.slice(lo, mid + 1);
      const right = t.array.slice(mid + 1, hi + 1);
      let i = 0;
      let j = 0;
      let k = lo;

      while (i < left.length && j < right.length) {
        // Se resalta la posición original de cada valor que se compara.
        if (t.compareValues(left[i], right[j], [lo + i, mid + 1 + j], 9) <= 0) {
          t.write(k, left[i], 10);
          i += 1;
        } else {
          t.write(k, right[j], 12);
          j += 1;
        }
        k += 1;
      }

      // Lo que sobra de R ya está en su lugar; solo hay que copiar lo de L.
      while (i < left.length) {
        t.write(k, left[i], 13);
        i += 1;
        k += 1;
      }
    };

    const sortRange = (lo: number, hi: number): void => {
      if (lo >= hi) {
        return;
      }

      const mid = Math.floor((lo + hi) / 2);
      sortRange(lo, mid);
      sortRange(mid + 1, hi);
      merge(lo, mid, hi);
    };

    sortRange(0, t.length - 1);
  },
};
