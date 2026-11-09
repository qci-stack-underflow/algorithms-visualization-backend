import { HuffmanStep, HuffmanTracer } from '../../types/huffman.types';

/**
 * Registrador de pasos para la construcción animada del árbol de Huffman.
 *
 * Mapea directamente a las 9 líneas del pseudocódigo oficial de huffman.html:
 * - extract-min: línea 3 (x = extraerMin) o línea 4 (y = extraerMin)
 * - merge: línea 5 o 6 (z = nodo(peso = x.peso + y.peso, izq = x, der = y))
 * - assign-code: línea 8 (asignar 0 a rama izquierda y 1 a derecha)
 */
export class HuffmanRecordingTracer implements HuffmanTracer {
  readonly steps: HuffmanStep[] = [];
  comparisons = 0;

  extractMin(nodeId: number, line: number, description?: string): void {
    this.steps.push({
      type: 'extract-min',
      nodeId,
      line,
      description,
    });
  }

  merge(
    leftId: number,
    rightId: number,
    parentId: number,
    weight: number,
    line: number,
    description?: string,
  ): void {
    this.steps.push({
      type: 'merge',
      leftId,
      rightId,
      parentId,
      weight,
      line,
      description,
    });
  }

  assignCode(nodeId: number, code: string, line: number, description?: string): void {
    this.steps.push({
      type: 'assign-code',
      nodeId,
      code,
      line,
      description,
    });
  }

  recordComparison(): void {
    this.comparisons += 1;
  }
}
