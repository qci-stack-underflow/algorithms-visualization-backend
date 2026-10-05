import { AlgorithmDefinition } from '../../types/algorithm.types';

export const exchangeSort: AlgorithmDefinition = {
  info: {
    id: 'exchange-sort',
    name: 'Exchange Sort',
    complexity: { best: 'O(n²)', average: 'O(n²)', worst: 'O(n²)' },
    description: 'Intercambia entre pares',
    pseudocode: [
      'for i = 0 to n-2',
      '  for j = i+1 to n-1',
      '    if A[i] > A[j]',
      '      swap(A[i], A[j])',
    ],
  },
  sort(t) {
    for (let i = 0; i < t.length - 1; i += 1) {
      for (let j = i + 1; j < t.length; j += 1) {
        if (t.compare(i, j, 2) > 0) {
          t.swap(i, j, 3);
        }
      }

      // Al terminar cada pasada, la posición i ya tiene su valor final.
      t.sorted([i]);
    }
  },
};
