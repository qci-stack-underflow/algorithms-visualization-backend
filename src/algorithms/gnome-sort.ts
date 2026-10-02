import { AlgorithmDefinition } from './algorithm.types';

export const gnomeSort: AlgorithmDefinition = {
  info: {
    id: 'gnome-sort',
    name: 'Gnome Sort',
    complexity: { best: 'O(n)', average: 'O(n²)', worst: 'O(n²)' },
    description: 'Intercambia entre elementos adyacentes',
    pseudocode: [
      'i = 1',
      'while i < n',
      '  if A[i-1] <= A[i]',
      '    i = i + 1',
      '  else',
      '    swap(A[i-1], A[i])',
      '    i = max(1, i - 1)',
    ],
  },
  sort(t) {
    let i = 1;

    while (i < t.length) {
      if (t.compare(i - 1, i, 2) <= 0) {
        i += 1;
      } else {
        t.swap(i - 1, i, 5);
        i = Math.max(1, i - 1);
      }
    }
  },
};
