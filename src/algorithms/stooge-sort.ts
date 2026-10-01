import { AlgorithmDefinition } from "./algorithm.types";

export const stoogeSort: AlgorithmDefinition = {
  info: {
    id: "stooge-sort",
    name: "Stooge Sort",
    complexity: { best: "O(n^2.71)", average: "O(n^2.71)", worst: "O(n^2.71)" },
    description: "Recursividad (lenta)",
    pseudocode: [
      "stoogeSort(A, lo, hi)",
      "  if A[lo] > A[hi]",
      "    swap(A[lo], A[hi])",
      "  if hi - lo + 1 > 2",
      "    k = (hi - lo + 1) / 3",
      "    stoogeSort(A, lo, hi - k)",
      "    stoogeSort(A, lo + k, hi)",
      "    stoogeSort(A, lo, hi - k)",
    ],
  },
  sort(t) {
    // Sin pasos `range` por llamada: duplicarían el tamaño de la respuesta.
    const sortRange = (lo: number, hi: number): void => {
      if (lo >= hi) {
        return;
      }

      if (t.compare(lo, hi, 1) > 0) {
        t.swap(lo, hi, 2);
      }

      const length = hi - lo + 1;
      if (length > 2) {
        const k = Math.floor(length / 3);
        sortRange(lo, hi - k);
        sortRange(lo + k, hi);
        sortRange(lo, hi - k);
      }
    };

    sortRange(0, t.length - 1);
  },
};
