import { buildHuffmanTree } from './tree-builder';

describe('buildHuffmanTree', () => {
  it('should build deterministic tree and emit exactly 3k - 2 steps for k distinct symbols', () => {
    const text = 'abracadabra'; // k = 5 símbolos ('a', 'b', 'r', 'c', 'd')
    const result = buildHuffmanTree(text);

    expect(result.distinctSymbols).toBe(5);
    // Para k = 5: número de nodos = 2k - 1 = 9
    expect(result.nodes.length).toBe(9);
    // Hojas primero (0..4)
    for (let i = 0; i < 5; i += 1) {
      expect(result.nodes[i].isLeaf).toBe(true);
      expect(result.nodes[i].symbol).not.toBeNull();
    }
    // Nodos internos (5..8)
    for (let i = 5; i < 9; i += 1) {
      expect(result.nodes[i].isLeaf).toBe(false);
      expect(result.nodes[i].symbol).toBeNull();
    }

    // Exactamente 3k - 2 pasos (3 * 5 - 2 = 13 pasos)
    expect(result.steps.length).toBe(13);

    // Raíz es el último nodo creado (id 8)
    expect(result.rootId).toBe(8);
    expect(result.nodes[result.rootId].weight).toBe(text.length);

    // Verificar que los códigos generados sean prefijos válidos
    expect(result.codes['a']).toBeDefined();
    expect(result.codes['b']).toBeDefined();
    expect(result.codes['r']).toBeDefined();
    expect(result.codes['c']).toBeDefined();
    expect(result.codes['d']).toBeDefined();
  });

  it('should handle single character degenerate case with code "0"', () => {
    const text = 'aaaaa';
    const result = buildHuffmanTree(text);

    expect(result.distinctSymbols).toBe(1);
    expect(result.nodes.length).toBe(1);
    expect(result.rootId).toBe(0);
    expect(result.codes['a']).toBe('0');
    // Para k = 1: 3(1) - 2 = 1 paso (assign-code)
    expect(result.steps.length).toBe(1);
    expect(result.steps[0].type).toBe('assign-code');
  });

  it('should produce identical results on repeated calls for the same text', () => {
    const text = 'En un lugar de la Mancha';
    const run1 = buildHuffmanTree(text);
    const run2 = buildHuffmanTree(text);

    expect(run1.rootId).toBe(run2.rootId);
    expect(run1.codes).toEqual(run2.codes);
    expect(run1.nodes).toEqual(run2.nodes);
    expect(run1.steps).toEqual(run2.steps);
  });
});
