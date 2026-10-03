import { AlgorithmDefinition } from '@type/algorithm.types';
import { bubbleSort } from './bubble-sort';
import { exchangeSort } from './exchange-sort';
import { gnomeSort } from './gnome-sort';
import { insertionSort } from './insertion-sort';
import { mergeSort } from './merge-sort';
import { quickSort } from './quick-sort';
import { selectionSort } from './selection-sort';
import { stoogeSort } from './stooge-sort';

/**
 * Algoritmos disponibles en la API. Para agregar uno nuevo basta con
 * importarlo y añadirlo a esta lista.
 */
export const ALGORITHM_DEFINITIONS: readonly AlgorithmDefinition[] = [
  bubbleSort,
  selectionSort,
  insertionSort,
  stoogeSort,
  gnomeSort,
  exchangeSort,
  mergeSort,
  quickSort,
];
