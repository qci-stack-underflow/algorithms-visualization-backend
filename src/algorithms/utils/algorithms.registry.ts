import { AlgorithmDefinition } from '@type/algorithm.types';
import { bubbleSort } from '@algorithm/bubble-sort';
import { exchangeSort } from '@algorithm/exchange-sort';
import { gnomeSort } from '@algorithm/gnome-sort';
import { insertionSort } from '@algorithm/insertion-sort';
import { mergeSort } from '@algorithm/merge-sort';
import { quickSort } from '@algorithm/quick-sort';
import { selectionSort } from '@algorithm/selection-sort';
import { stoogeSort } from '@algorithm/stooge-sort';

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
