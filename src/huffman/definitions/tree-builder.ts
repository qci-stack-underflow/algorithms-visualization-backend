import { HuffmanNode, HuffmanStep } from '../../types/huffman.types';
import { countFrequencies } from './frequency-counter';
import { MinHeap } from '../utils/min-heap';
import { HuffmanRecordingTracer } from '../utils/huffman.tracer';

export interface TreeBuildResult {
  nodes: HuffmanNode[];
  rootId: number;
  distinctSymbols: number;
  steps: HuffmanStep[];
  codes: Record<string, string>;
  comparisons: number;
  merges: number;
}

/**
 * Construye el árbol de Huffman y registra los pasos de animación según el pseudocódigo oficial.
 *
 * Convenciones:
 * - Para k símbolos distintos se crean 2k - 1 nodos en una lista plana (hojas 0..k-1 primero).
 * - Se emiten exactamente 3k - 2 pasos con sus líneas correspondientes del pseudocódigo.
 * - Caso degenerado (1 solo símbolo): recibe código "0".
 * - Primer nodo extraído es el hijo izquierdo con bit '0', segundo es hijo derecho con bit '1'.
 */
export function buildHuffmanTree(text: string): TreeBuildResult {
  if (text.length === 0) {
    throw new Error('El texto proporcionado para construir el árbol de Huffman está vacío.');
  }

  const { symbols, frequencies } = countFrequencies(text);
  const distinctSymbols = symbols.length;
  const tracer = new HuffmanRecordingTracer();

  // 1. Construir nodos hoja (0..k-1 en orden de primera aparición)
  const nodes: HuffmanNode[] = [];
  for (let i = 0; i < distinctSymbols; i += 1) {
    const sym = symbols[i];
    const weight = frequencies.get(sym) ?? 0;
    nodes.push({
      id: i,
      weight,
      symbol: sym,
      left: null,
      right: null,
      parentId: null,
      isLeaf: true,
    });
  }

  // 2. Insertar hojas en la cola de prioridad
  const heap = new MinHeap();
  for (const leaf of nodes) {
    heap.push({ id: leaf.id, weight: leaf.weight, node: leaf });
  }

  let nextId = distinctSymbols;
  let merges = 0;

  // 3. Fusión en el min-heap (k-1 uniones)
  while (heap.length > 1) {
    const leftItem = heap.pop();
    if (!leftItem) break;
    tracer.extractMin(
      leftItem.id,
      3,
      `Extrae nodo ${leftItem.id} (${leftItem.node.isLeaf ? JSON.stringify(leftItem.node.symbol) : 'interno'}, peso ${leftItem.weight})`,
    );

    const rightItem = heap.pop();
    if (!rightItem) break;
    tracer.extractMin(
      rightItem.id,
      4,
      `Extrae nodo ${rightItem.id} (${rightItem.node.isLeaf ? JSON.stringify(rightItem.node.symbol) : 'interno'}, peso ${rightItem.weight})`,
    );

    const parentNode: HuffmanNode = {
      id: nextId,
      weight: leftItem.weight + rightItem.weight,
      symbol: null,
      left: leftItem.id,
      right: rightItem.id,
      parentId: null,
      isLeaf: false,
    };
    nextId += 1;
    merges += 1;

    leftItem.node.parentId = parentNode.id;
    rightItem.node.parentId = parentNode.id;
    nodes.push(parentNode);

    heap.push({
      id: parentNode.id,
      weight: parentNode.weight,
      node: parentNode,
    });

    tracer.merge(
      leftItem.id,
      rightItem.id,
      parentNode.id,
      parentNode.weight,
      5,
      `Une nodo ${leftItem.id} (peso ${leftItem.weight}) + nodo ${rightItem.id} (peso ${rightItem.weight}) en nodo ${parentNode.id} con peso ${parentNode.weight}`,
    );
  }

  const rootItem = heap.pop();
  if (!rootItem) {
    throw new Error('Error inesperado al extraer la raíz del árbol.');
  }
  const rootNode = rootItem.node;

  // 4. Asignación de prefijos binarios ('0' a izquierda, '1' a derecha)
  const codes: Record<string, string> = {};

  function assignCodes(nodeId: number, prefix: string): void {
    const current = nodes[nodeId];
    current.code = prefix;
    if (current.isLeaf) {
      codes[current.symbol ?? ''] = prefix;
    } else {
      if (current.left !== null) {
        assignCodes(current.left, prefix + '0');
      }
      if (current.right !== null) {
        assignCodes(current.right, prefix + '1');
      }
    }
  }

  if (rootNode.isLeaf) {
    // Caso degenerado: 1 solo símbolo distinto
    rootNode.code = '0';
    codes[rootNode.symbol ?? ''] = '0';
  } else {
    assignCodes(rootNode.id, '');
  }

  tracer.assignCode(
    rootNode.id,
    rootNode.code ?? '',
    8,
    'Códigos prefijo asignados recorriendo el árbol (0 izquierda, 1 derecha)',
  );

  return {
    nodes,
    rootId: rootNode.id,
    distinctSymbols,
    steps: tracer.steps,
    codes,
    comparisons: heap.comparisons,
    merges,
  };
}
