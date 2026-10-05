import { AlgorithmDefinition } from '../../types/algorithm.types';

export const selectionSort: AlgorithmDefinition = {
  info: {
    id: 'selection-sort',
    name: 'Selection Sort',
    complexity: { best: 'O(n²)', average: 'O(n²)', worst: 'O(n²)' },
    description: 'Intercambia seleccionando el mínimo',
    pseudocode: [
      'for i = 0 to n-2',
      '  min = i',
      '  for j = i+1 to n-1',
      '    if A[j] < A[min]',
      '      min = j',
      '  if min != i',
      '    swap(A[i], A[min])',
    ],
  },
  sort(t) {
    for (let i = 0; i < t.length - 1; i += 1) {
      let min = i;

      for (let j = i + 1; j < t.length; j += 1) {
        if (t.compare(j, min, 3) < 0) {
          min = j;
        }
      }

      if (min !== i) {
        t.swap(i, min, 6);
      }

      // La posición i ya tiene el mínimo de lo que quedaba.
      t.sorted([i]);
    }
  },
};
