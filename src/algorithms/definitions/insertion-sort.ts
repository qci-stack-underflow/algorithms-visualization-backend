import { AlgorithmDefinition } from '../../types/algorithm.types';

export const insertionSort: AlgorithmDefinition = {
  info: {
    id: 'insertion-sort',
    name: 'Insertion Sort',
    complexity: { best: 'O(n)', average: 'O(n²)', worst: 'O(n²)' },
    description: 'Inserción en la parte ya ordenada',
    pseudocode: [
      'for i = 1 to n-1',
      '  j = i',
      '  while j > 0 and A[j-1] > A[j]',
      '    swap(A[j-1], A[j])',
      '    j = j - 1',
    ],
  },
  sort(t) {
    for (let i = 1; i < t.length; i += 1) {
      let j = i;

      while (j > 0 && t.compare(j - 1, j, 2) > 0) {
        t.swap(j - 1, j, 3);
        j -= 1;
      }
    }
  },
};
