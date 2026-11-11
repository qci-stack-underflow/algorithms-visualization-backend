import { HuffmanNode } from '../../types/huffman.types';

/**
 * Elemento almacenable en la cola de prioridad de Huffman.
 */
export interface HeapItem {
  id: number;
  weight: number;
  node: HuffmanNode;
}

/**
 * Cola de prioridad implementada mediante un Binary Min-Heap en O(log n).
 *
 * Aplica la regla de desempate oficial del proyecto:
 * 1. Menor peso (`weight`).
 * 2. En caso de igualdad de peso, menor `id` (orden de creación / primera aparición).
 */
export class MinHeap {
  private readonly heap: HeapItem[] = [];
  private comparisonsCount = 0;

  get length(): number {
    return this.heap.length;
  }

  get comparisons(): number {
    return this.comparisonsCount;
  }

  /**
   * Compara dos elementos del heap aplicando la regla de desempate.
   * Retorna valor negativo si a < b, positivo si a > b.
   */
  private compare(a: HeapItem, b: HeapItem): number {
    this.comparisonsCount += 1;
    if (a.weight !== b.weight) {
      return a.weight - b.weight;
    }
    return a.id - b.id;
  }

  /**
   * Inserta un nuevo elemento en la cola de prioridad en O(log n).
   */
  push(item: HeapItem): void {
    this.heap.push(item);
    this.siftUp(this.heap.length - 1);
  }

  /**
   * Extrae el elemento con menor prioridad en O(log n).
   */
  pop(): HeapItem | undefined {
    if (this.heap.length === 0) {
      return undefined;
    }
    const top = this.heap[0];
    const bottom = this.heap.pop();
    if (this.heap.length > 0 && bottom !== undefined) {
      this.heap[0] = bottom;
      this.siftDown(0);
    }
    return top;
  }

  /**
   * Observa el elemento de menor prioridad sin extraerlo en O(1).
   */
  peek(): HeapItem | undefined {
    return this.heap[0];
  }

  private siftUp(index: number): void {
    let current = index;
    while (current > 0) {
      const parent = Math.floor((current - 1) / 2);
      if (this.compare(this.heap[current], this.heap[parent]) < 0) {
        const temp = this.heap[current];
        this.heap[current] = this.heap[parent];
        this.heap[parent] = temp;
        current = parent;
      } else {
        break;
      }
    }
  }

  private siftDown(index: number): void {
    let current = index;
    const length = this.heap.length;

    while (true) {
      let smallest = current;
      const left = 2 * current + 1;
      const right = 2 * current + 2;

      if (
        left < length &&
        this.compare(this.heap[left], this.heap[smallest]) < 0
      ) {
        smallest = left;
      }
      if (
        right < length &&
        this.compare(this.heap[right], this.heap[smallest]) < 0
      ) {
        smallest = right;
      }

      if (smallest !== current) {
        const temp = this.heap[current];
        this.heap[current] = this.heap[smallest];
        this.heap[smallest] = temp;
        current = smallest;
      } else {
        break;
      }
    }
  }
}
