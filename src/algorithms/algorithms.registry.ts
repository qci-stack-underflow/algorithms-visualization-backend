import { AlgorithmDefinition } from './algorithm.types';
import { exchangeSort } from './exchange-sort';
import { gnomeSort } from './gnome-sort';
import { insertionSort } from './insertion-sort';
import { stoogeSort } from './stooge-sort';

/**
 * Algoritmos disponibles en la API. Para agregar uno nuevo basta con
 * importarlo y añadirlo a esta lista.
 */
export const ALGORITHM_DEFINITIONS: readonly AlgorithmDefinition[] = [
  insertionSort,
  gnomeSort,
  stoogeSort,
  exchangeSort,
];
