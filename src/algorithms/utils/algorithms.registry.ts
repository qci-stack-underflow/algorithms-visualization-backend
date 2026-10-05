import { AlgorithmDefinition } from '../../types/algorithm.types';
import { bubbleSort } from '../definitions/bubble-sort';
import { exchangeSort } from '../definitions/exchange-sort';
import { gnomeSort } from '../definitions/gnome-sort';
import { insertionSort } from '../definitions/insertion-sort';
import { mergeSort } from '../definitions/merge-sort';
import { quickSort } from '../definitions/quick-sort';
import { selectionSort } from '../definitions/selection-sort';
import { stoogeSort } from '../definitions/stooge-sort';

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
