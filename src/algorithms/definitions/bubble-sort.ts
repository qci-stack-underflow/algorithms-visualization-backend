import { AlgorithmDefinition } from '../../types/algorithm.types';

export const bubbleSort: AlgorithmDefinition = {
  info: {
    id: 'bubble-sort',
    name: 'Bubble Sort',
    complexity: { best: 'O(n)', average: 'O(n²)', worst: 'O(n²)' },
    description: 'Intercambia entre elementos adyacentes',
    pseudocode: [
      'for i = 0 to n-2',
      '  swapped = false',
      '  for j = 0 to n-2-i',
      '    if A[j] > A[j+1]',
      '      swap(A[j], A[j+1])',
      '      swapped = true',
      '  if not swapped: break',
    ],
  },
  sort(t) {
    for (let i = 0; i < t.length - 1; i += 1) {
      let swapped = false;

      for (let j = 0; j < t.length - 1 - i; j += 1) {
        if (t.compare(j, j + 1, 3) > 0) {
          t.swap(j, j + 1, 4);
          swapped = true;
        }
      }

      // Al terminar cada pasada, el mayor de lo que quedaba ya está al final.
      t.sorted([t.length - 1 - i]);

      if (!swapped) {
        break;
      }
    }
  },
};
