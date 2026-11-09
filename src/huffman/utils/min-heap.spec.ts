import { MinHeap } from './min-heap';

describe('MinHeap', () => {
  it('should extract elements in ascending weight order', () => {
    const heap = new MinHeap();
    heap.push({
      id: 1,
      weight: 10,
      node: { id: 1, weight: 10, symbol: 'a', left: null, right: null, isLeaf: true },
    });
    heap.push({
      id: 2,
      weight: 3,
      node: { id: 2, weight: 3, symbol: 'b', left: null, right: null, isLeaf: true },
    });
    heap.push({
      id: 3,
      weight: 7,
      node: { id: 3, weight: 7, symbol: 'c', left: null, right: null, isLeaf: true },
    });

    expect(heap.length).toBe(3);
    expect(heap.pop()?.weight).toBe(3);
    expect(heap.pop()?.weight).toBe(7);
    expect(heap.pop()?.weight).toBe(10);
    expect(heap.pop()).toBeUndefined();
    expect(heap.length).toBe(0);
  });

  it('should break ties using smaller id', () => {
    const heap = new MinHeap();
    heap.push({
      id: 5,
      weight: 10,
      node: { id: 5, weight: 10, symbol: 'x', left: null, right: null, isLeaf: true },
    });
    heap.push({
      id: 2,
      weight: 10,
      node: { id: 2, weight: 10, symbol: 'y', left: null, right: null, isLeaf: true },
    });
    heap.push({
      id: 8,
      weight: 10,
      node: { id: 8, weight: 10, symbol: 'z', left: null, right: null, isLeaf: true },
    });

    const first = heap.pop();
    const second = heap.pop();
    const third = heap.pop();

    expect(first?.id).toBe(2);
    expect(second?.id).toBe(5);
    expect(third?.id).toBe(8);
  });

  it('should accurately count comparisons during push and pop', () => {
    const heap = new MinHeap();
    expect(heap.comparisons).toBe(0);

    heap.push({
      id: 1,
      weight: 5,
      node: { id: 1, weight: 5, symbol: 'a', left: null, right: null, isLeaf: true },
    });
    heap.push({
      id: 2,
      weight: 2,
      node: { id: 2, weight: 2, symbol: 'b', left: null, right: null, isLeaf: true },
    });

    expect(heap.comparisons).toBeGreaterThan(0);
    const countBeforePop = heap.comparisons;

    heap.pop();
    expect(heap.comparisons).toBeGreaterThanOrEqual(countBeforePop);
  });

  it('should peek the top element without removing it', () => {
    const heap = new MinHeap();
    heap.push({
      id: 1,
      weight: 15,
      node: { id: 1, weight: 15, symbol: 'a', left: null, right: null, isLeaf: true },
    });
    heap.push({
      id: 2,
      weight: 4,
      node: { id: 2, weight: 4, symbol: 'b', left: null, right: null, isLeaf: true },
    });

    expect(heap.peek()?.id).toBe(2);
    expect(heap.length).toBe(2);
  });
});
