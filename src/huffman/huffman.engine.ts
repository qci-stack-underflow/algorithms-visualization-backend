import {
  GutenbergSourceInfo,
  HuffmanMetrics,
  HuffmanNode,
  HuffmanPreview,
  HuffmanResult,
  HuffmanStep,
  SUF_MAGIC,
  SufDictionaryEntry,
  SufHeader,
  SymbolStat,
} from '../types/huffman.types';

export interface ParsedSufFile extends SufHeader {
  headerBytes: number;
  compressedData: Buffer;
}

interface HeapComparisonCounter {
  comparisons: number;
}

class HuffmanMinHeap {
  private readonly items: HuffmanNode[] = [];

  constructor(
    initialNodes: HuffmanNode[],
    private readonly counter?: HeapComparisonCounter,
  ) {
    for (const node of initialNodes) {
      this.insert(node);
    }
  }

  get size(): number {
    return this.items.length;
  }

  insert(node: HuffmanNode): void {
    this.items.push(node);
    this.siftUp(this.items.length - 1);
  }

  extractMin(): HuffmanNode {
    if (this.items.length === 0) {
      throw new Error('Cannot extract from an empty HuffmanMinHeap');
    }
    const min = this.items[0];
    const last = this.items.pop()!;
    if (this.items.length > 0) {
      this.items[0] = last;
      this.siftDown(0);
    }
    return min;
  }

  private hasHigherPriority(a: HuffmanNode, b: HuffmanNode): boolean {
    if (this.counter) {
      this.counter.comparisons += 1;
    }
    if (a.weight !== b.weight) {
      return a.weight < b.weight;
    }
    return a.id < b.id;
  }

  private siftUp(index: number): void {
    let i = index;
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (this.hasHigherPriority(this.items[i], this.items[parent])) {
        [this.items[i], this.items[parent]] = [
          this.items[parent],
          this.items[i],
        ];
        i = parent;
      } else {
        break;
      }
    }
  }

  private siftDown(index: number): void {
    let i = index;
    const length = this.items.length;
    while (true) {
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      let smallest = i;

      if (
        left < length &&
        this.hasHigherPriority(this.items[left], this.items[smallest])
      ) {
        smallest = left;
      }
      if (
        right < length &&
        this.hasHigherPriority(this.items[right], this.items[smallest])
      ) {
        smallest = right;
      }

      if (smallest !== i) {
        [this.items[i], this.items[smallest]] = [
          this.items[smallest],
          this.items[i],
        ];
        i = smallest;
      } else {
        break;
      }
    }
  }
}

export class HuffmanEngine {
  static compress(text: string, source: GutenbergSourceInfo): HuffmanResult {
    const startTime = performance.now();

    // 1. Conteo de símbolos por punto de código Unicode en orden de aparición
    const freqMap = new Map<string, number>();
    const symbolsList: string[] = [];
    let totalCharacters = 0;

    for (const char of text) {
      totalCharacters += 1;
      const prev = freqMap.get(char);
      if (prev === undefined) {
        freqMap.set(char, 1);
        symbolsList.push(char);
      } else {
        freqMap.set(char, prev + 1);
      }
    }

    const distinctSymbols = symbolsList.length;
    const nodes: HuffmanNode[] = symbolsList.map((symbol, index) => ({
      id: index,
      weight: freqMap.get(symbol)!,
      symbol,
      left: null,
      right: null,
      parentId: null,
      isLeaf: true,
      code: '',
    }));

    const steps: HuffmanStep[] = [];
    const counter: HeapComparisonCounter = { comparisons: 0 };
    const heap = new HuffmanMinHeap(
      nodes.map((n) => ({ ...n })),
      counter,
    );

    let nextId = distinctSymbols;

    if (distinctSymbols === 1) {
      nodes[0].code = '0';
      steps.push({
        type: 'assign-code',
        nodeId: 0,
        code: '0',
        line: 8,
        description: 'Código asignado al único símbolo',
      });
    } else if (distinctSymbols > 1) {
      while (heap.size > 1) {
        const x = heap.extractMin();
        steps.push({
          type: 'extract-min',
          nodeId: x.id,
          line: 3,
          description: `Extrae nodo ${x.id} (${x.symbol !== null ? `'${x.symbol}'` : 'interno'}, peso ${x.weight})`,
        });

        const y = heap.extractMin();
        steps.push({
          type: 'extract-min',
          nodeId: y.id,
          line: 4,
          description: `Extrae nodo ${y.id} (${y.symbol !== null ? `'${y.symbol}'` : 'interno'}, peso ${y.weight})`,
        });

        const parentId = nextId++;
        const z: HuffmanNode = {
          id: parentId,
          weight: x.weight + y.weight,
          symbol: null,
          left: x.id,
          right: y.id,
          parentId: null,
          isLeaf: false,
          code: '',
        };

        nodes[x.id].parentId = parentId;
        nodes[y.id].parentId = parentId;
        nodes.push(z);

        heap.insert(z);
        steps.push({
          type: 'merge',
          leftId: x.id,
          rightId: y.id,
          parentId,
          weight: z.weight,
          line: 5,
          description: `Une nodo ${x.id} (peso ${x.weight}) + nodo ${y.id} (peso ${y.weight}) en nodo ${parentId} (peso ${z.weight})`,
        });
      }

      const rootId = nodes.length - 1;
      const assignCodes = (nodeId: number, prefix: string): void => {
        const node = nodes[nodeId];
        node.code = prefix;
        if (node.left !== null) {
          assignCodes(node.left, `${prefix}0`);
        }
        if (node.right !== null) {
          assignCodes(node.right, `${prefix}1`);
        }
      };

      assignCodes(rootId, '');

      steps.push({
        type: 'assign-code',
        nodeId: rootId,
        code: '',
        line: 8,
        description: `Códigos asignados a los ${distinctSymbols} símbolos`,
      });
    }

    const executionTimeMs = Number((performance.now() - startTime).toFixed(2));
    const rootId = nodes.length > 0 ? nodes.length - 1 : 0;

    const codes: Record<string, string> = {};
    const frequencies: Record<string, number> = {};
    let totalBits = 0;
    let entropy = 0;

    for (let i = 0; i < distinctSymbols; i += 1) {
      const leaf = nodes[i];
      const symbol = leaf.symbol!;
      const code = leaf.code ?? '0';
      codes[symbol] = code;
      frequencies[symbol] = leaf.weight;
      totalBits += leaf.weight * code.length;
      const p = totalCharacters > 0 ? leaf.weight / totalCharacters : 0;
      if (p > 0) {
        entropy -= p * Math.log2(p);
      }
    }

    const table: SymbolStat[] = nodes
      .slice(0, distinctSymbols)
      .map((leaf) => ({
        symbol: leaf.symbol!,
        frequency: leaf.weight,
        percentage:
          totalCharacters > 0
            ? Number(((leaf.weight / totalCharacters) * 100).toFixed(1))
            : 0,
        code: leaf.code ?? '0',
        bits: (leaf.code ?? '0').length,
        nodeId: leaf.id,
      }))
      .sort((a, b) => b.frequency - a.frequency || a.nodeId! - b.nodeId!);

    const originalBytes = Buffer.byteLength(text, 'utf-8');
    const compressedBytes = Math.ceil(totalBits / 8);
    const paddingBits = (8 - (totalBits % 8)) % 8;
    const headerBytes = HuffmanEngine.calculateHeaderByteLength(
      source.title,
      nodes.slice(0, distinctSymbols),
    );
    const fileSizeBytes = headerBytes + compressedBytes;
    const savingsPercentage =
      originalBytes > 0
        ? Number(
            (((originalBytes - fileSizeBytes) / originalBytes) * 100).toFixed(
              1,
            ),
          )
        : 0;
    const bitsPerSymbol =
      totalCharacters > 0
        ? Number((totalBits / totalCharacters).toFixed(2))
        : 0;
    const fixedBitsPerChar =
      distinctSymbols > 1 ? Math.ceil(Math.log2(distinctSymbols)) : 1;

    const metrics: HuffmanMetrics = {
      originalBytes,
      compressedBytes,
      fileSizeBytes,
      headerBytes,
      savingsPercentage,
      totalBits,
      paddingBits,
      bitsPerSymbol,
      entropy: Number(entropy.toFixed(2)),
      fixedBits: totalCharacters * fixedBitsPerChar,
      comparisons: counter.comparisons,
      merges: Math.max(0, distinctSymbols - 1),
      steps: steps.length,
      executionTimeMs,
    };

    const previewText = text
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.length > 0)
      ?.slice(0, 24) ?? '';
    const previewTokens = Array.from(previewText).map((char) => ({
      char,
      code: codes[char] ?? '',
    }));
    const preview: HuffmanPreview = {
      text: previewText,
      tokens: previewTokens,
      encodedBits: previewTokens.map((t) => t.code).join(''),
    };

    return {
      source,
      book: source,
      totalCharacters,
      distinctSymbols,
      rootId,
      nodes,
      steps,
      table,
      codes,
      metrics,
      preview,
    };
  }

  static generateSufBuffer(text: string, title: string): Buffer {
    const dummySource: GutenbergSourceInfo = {
      type: 'gutenberg',
      id: 0,
      title,
      author: '',
      language: '',
      size: '0 B',
    };
    const result = HuffmanEngine.compress(text, dummySource);
    const leaves = result.nodes.slice(0, result.distinctSymbols);

    const titleBytes = Buffer.from(title, 'utf-8');
    const entryBuffers: Buffer[] = [];

    for (const leaf of leaves) {
      const symbolBytes = Buffer.from(leaf.symbol!, 'utf-8');
      const codeBytes = Buffer.from(leaf.code ?? '0', 'ascii');
      const entryBuf = Buffer.alloc(
        1 + symbolBytes.length + 4 + 1 + codeBytes.length,
      );
      let offset = 0;
      entryBuf.writeUInt8(symbolBytes.length, offset);
      offset += 1;
      symbolBytes.copy(entryBuf, offset);
      offset += symbolBytes.length;
      entryBuf.writeUInt32BE(leaf.weight, offset);
      offset += 4;
      entryBuf.writeUInt8(codeBytes.length, offset);
      offset += 1;
      codeBytes.copy(entryBuf, offset);
      entryBuffers.push(entryBuf);
    }

    const fixedHeader = Buffer.alloc(4 + 4 + 1 + 2 + 2 + titleBytes.length);
    let headerOffset = 0;
    fixedHeader.write(SUF_MAGIC, headerOffset, 4, 'ascii');
    headerOffset += 4;
    fixedHeader.writeUInt32BE(result.totalCharacters, headerOffset);
    headerOffset += 4;
    fixedHeader.writeUInt8(result.metrics.paddingBits, headerOffset);
    headerOffset += 1;
    fixedHeader.writeUInt16BE(result.distinctSymbols, headerOffset);
    headerOffset += 2;
    fixedHeader.writeUInt16BE(titleBytes.length, headerOffset);
    headerOffset += 2;
    titleBytes.copy(fixedHeader, headerOffset);

    const bodyBuffer = Buffer.alloc(result.metrics.compressedBytes);
    let byteIndex = 0;
    let currentByte = 0;
    let bitCount = 0;

    for (const char of text) {
      const code = result.codes[char];
      for (let i = 0; i < code.length; i += 1) {
        currentByte = (currentByte << 1) | (code.charCodeAt(i) === 49 ? 1 : 0);
        bitCount += 1;
        if (bitCount === 8) {
          bodyBuffer[byteIndex] = currentByte;
          byteIndex += 1;
          currentByte = 0;
          bitCount = 0;
        }
      }
    }

    if (bitCount > 0) {
      currentByte = currentByte << (8 - bitCount);
      bodyBuffer[byteIndex] = currentByte;
    }

    return Buffer.concat([fixedHeader, ...entryBuffers, bodyBuffer]);
  }

  static parseSufBuffer(buffer: Buffer): ParsedSufFile {
    let offset = 0;
    const magic = buffer.subarray(offset, offset + 4).toString('ascii');
    offset += 4;
    const totalCharacters = buffer.readUInt32BE(offset);
    offset += 4;
    const paddingBits = buffer.readUInt8(offset);
    offset += 1;
    const symbolCount = buffer.readUInt16BE(offset);
    offset += 2;
    const titleLength = buffer.readUInt16BE(offset);
    offset += 2;
    const title = buffer
      .subarray(offset, offset + titleLength)
      .toString('utf-8');
    offset += titleLength;

    const dictionary: SufDictionaryEntry[] = [];
    for (let i = 0; i < symbolCount; i += 1) {
      const symbolByteLength = buffer.readUInt8(offset);
      offset += 1;
      const symbol = buffer
        .subarray(offset, offset + symbolByteLength)
        .toString('utf-8');
      offset += symbolByteLength;
      const frequency = buffer.readUInt32BE(offset);
      offset += 4;
      const codeLength = buffer.readUInt8(offset);
      offset += 1;
      const code = buffer
        .subarray(offset, offset + codeLength)
        .toString('ascii');
      offset += codeLength;

      dictionary.push({
        symbol,
        frequency,
        codeLength,
        code,
      });
    }

    return {
      magic,
      totalCharacters,
      paddingBits,
      symbolCount,
      title,
      dictionary,
      headerBytes: offset,
      compressedData: buffer.subarray(offset),
    };
  }

  private static calculateHeaderByteLength(
    title: string,
    leaves: HuffmanNode[],
  ): number {
    let bytes = 4 + 4 + 1 + 2 + 2 + Buffer.byteLength(title, 'utf-8');
    for (const leaf of leaves) {
      bytes +=
        1 +
        Buffer.byteLength(leaf.symbol!, 'utf-8') +
        4 +
        1 +
        (leaf.code ?? '0').length;
    }
    return bytes;
  }
}
