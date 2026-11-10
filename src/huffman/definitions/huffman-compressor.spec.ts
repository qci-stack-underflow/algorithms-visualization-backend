import * as fs from 'fs';
import * as path from 'path';
import {
  calculateMetrics,
  cleanText,
  compressHuffman,
} from './huffman-compressor';
import { readSuf } from '../utils/suf-format';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns every unique pair of indices (i, j) where i < j from an array of
 * length n.
 */
function uniquePairs(n: number): [number, number][] {
  const pairs: [number, number][] = [];
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      pairs.push([i, j]);
    }
  }
  return pairs;
}

/**
 * Verifies that no code in `codes` is a prefix of another code, i.e. the
 * code set is prefix-free.
 */
function assertPrefixFree(codes: Record<string, string>): void {
  const codeList = Object.values(codes);
  for (const [i, j] of uniquePairs(codeList.length)) {
    const ci = codeList[i];
    const cj = codeList[j];
    expect(cj.startsWith(ci)).toBe(false);
    expect(ci.startsWith(cj)).toBe(false);
  }
}

// ---------------------------------------------------------------------------
// calculateMetrics
// ---------------------------------------------------------------------------

describe('calculateMetrics', () => {
  it('should calculate accurate metrics and Shannon entropy', () => {
    const text = 'aaaaabbbcc';
    const output = compressHuffman(text, { title: 'Test Metrics' });
    const { metrics } = output.result;

    expect(metrics.originalBytes).toBe(Buffer.byteLength(text, 'utf-8'));
    expect(metrics.totalBits).toBeGreaterThan(0);
    expect(metrics.paddingBits).toBe((8 - (metrics.totalBits % 8)) % 8);
    expect(metrics.compressedBytes).toBe(
      Math.ceil((metrics.totalBits + metrics.paddingBits) / 8),
    );
    expect(metrics.fileSizeBytes).toBe(output.sufBuffer.length);
    expect(metrics.headerBytes).toBe(
      metrics.fileSizeBytes - metrics.compressedBytes,
    );
    expect(metrics.bitsPerSymbol).toBeCloseTo(
      metrics.totalBits / text.length,
      2,
    );
    expect(metrics.entropy).toBeGreaterThan(0);
    expect(metrics.merges).toBe(output.result.distinctSymbols - 1);
    expect(metrics.steps).toBe(3 * output.result.distinctSymbols - 2);
    expect(metrics.executionTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('should satisfy the Shannon bound: entropy ≤ bitsPerSymbol < entropy + 1', () => {
    const texts = [
      'aaaaabbbcc',
      'abcdefghij',
      'Hola mundo, esta es una prueba de entropía.',
      'aaabbc',
    ];

    for (const text of texts) {
      const { metrics } = compressHuffman(text, {
        title: 'entropy-test',
      }).result;
      expect(metrics.bitsPerSymbol).toBeGreaterThanOrEqual(metrics.entropy);
      expect(metrics.bitsPerSymbol).toBeLessThan(metrics.entropy + 1);
    }
  });

  it('should report entropy = 0 for a single distinct symbol', () => {
    const text = 'aaaa';
    const { metrics } = compressHuffman(text, { title: 'single-sym' }).result;
    // H(X) = 0 for a uniform single symbol; entropy is stored as toFixed(2)
    expect(metrics.entropy).toBe(0);
  });

  it('should report entropy = 1 for two equally probable symbols', () => {
    const text = 'ababababab'; // 5 'a', 5 'b' → p=0.5 each → H=1
    const { metrics } = compressHuffman(text, { title: 'two-sym' }).result;
    expect(metrics.entropy).toBeCloseTo(1, 2);
  });

  it('should ensure sum of frequencies equals totalCharacters', () => {
    const text = 'El veloz murciélago hindú comía feliz cardillo y kiwi.';
    const output = compressHuffman(text, { title: 'freq-sum' });
    const { result } = output;

    const freqSum = result.table.reduce((acc, row) => acc + row.frequency, 0);
    expect(freqSum).toBe(result.totalCharacters);
  });

  it('should compute metrics directly from explicit parameters via calculateMetrics', () => {
    const text = 'aba';
    const freqs = new Map([
      ['a', 2],
      ['b', 1],
    ]);
    const codes = { a: '0', b: '1' };
    const metrics = calculateMetrics({
      text,
      totalCharacters: 3,
      distinctSymbols: 2,
      symbols: ['a', 'b'],
      frequencies: freqs,
      codes,
      sufBufferLength: 50,
      comparisons: 2,
      merges: 1,
      stepsCount: 4,
      executionTimeMs: 1.5,
    });

    expect(metrics.originalBytes).toBe(3);
    expect(metrics.totalBits).toBe(3); // 2*1 + 1*1 = 3
    expect(metrics.paddingBits).toBe(5); // (8 - 3) = 5
    expect(metrics.compressedBytes).toBe(1);
    expect(metrics.fileSizeBytes).toBe(50);
    expect(metrics.headerBytes).toBe(49);
    expect(metrics.comparisons).toBe(2);
    expect(metrics.merges).toBe(1);
    expect(metrics.steps).toBe(4);
    expect(metrics.executionTimeMs).toBe(1.5);
  });
});

// ---------------------------------------------------------------------------
// cleanText – Gutenberg & BOM cleaning
// ---------------------------------------------------------------------------

describe('cleanText & TextCleaner integration', () => {
  it('should remove BOM and extract content between Gutenberg markers', () => {
    const raw =
      '\uFEFF*** START OF THE PROJECT GUTENBERG EBOOK DON QUIJOTE ***\nEn un lugar de la Mancha\n*** END OF THE PROJECT GUTENBERG EBOOK DON QUIJOTE ***';
    expect(cleanText(raw)).toBe('En un lugar de la Mancha');
  });

  it('should auto-clean text when clean option is true or source is gutenberg', () => {
    const raw =
      '*** START OF THE PROJECT GUTENBERG EBOOK TEST ***\nTexto Limpio\n*** END OF THE PROJECT GUTENBERG EBOOK TEST ***';
    const output = compressHuffman(raw, { clean: true, title: 'Cleaned' });
    expect(output.result.totalCharacters).toBe('Texto Limpio'.length);
  });
});

// ---------------------------------------------------------------------------
// compressHuffman – edge cases
// ---------------------------------------------------------------------------

describe('compressHuffman – edge cases', () => {
  it('should throw for empty text', () => {
    expect(() => compressHuffman('')).toThrow(
      /El texto proporcionado para comprimir está vacío/,
    );
  });

  it('should handle a single distinct symbol', () => {
    const text = 'aaaa';
    const output = compressHuffman(text, { title: 'single-a' });
    const { result } = output;

    expect(result.totalCharacters).toBe(4);
    expect(result.distinctSymbols).toBe(1);
    // For k=1 there is exactly 1 node (the leaf itself) and 0 merges
    expect(result.nodes.length).toBe(1);
    expect(result.metrics.merges).toBe(0);
    // The single code must be '0'
    expect(result.codes['a']).toBe('0');
    // steps = 3k-2 = 1 for k=1
    expect(result.steps.length).toBe(1);
  });

  it('should handle two distinct symbols', () => {
    const text = 'aabb';
    const output = compressHuffman(text, { title: 'two-sym' });
    const { result } = output;

    expect(result.distinctSymbols).toBe(2);
    // 2k-1 = 3 nodes, k-1 = 1 merge, 3k-2 = 4 steps
    expect(result.nodes.length).toBe(3);
    expect(result.metrics.merges).toBe(1);
    expect(result.steps.length).toBe(4);
  });

  it('should produce the node-count invariant 2k-1', () => {
    for (const text of ['abc', 'aaabbbccc', 'abcde']) {
      const { result } = compressHuffman(text, { title: 'invariant' });
      expect(result.nodes.length).toBe(2 * result.distinctSymbols - 1);
    }
  });

  it('should handle text made entirely of repeated identical characters', () => {
    const text = 'z'.repeat(100);
    const output = compressHuffman(text, { title: 'repeat' });
    const { result } = output;

    expect(result.distinctSymbols).toBe(1);
    expect(result.codes['z']).toBe('0');
    expect(result.totalCharacters).toBe(100);
  });

  it('should handle text containing only newlines', () => {
    const text = '\n\n\n\n';
    const output = compressHuffman(text, { title: 'newlines' });
    const { result } = output;

    expect(result.distinctSymbols).toBe(1);
    expect(result.codes['\n']).toBe('0');
    expect(result.totalCharacters).toBe(4);
  });

  it('should treat emojis as single symbols (Unicode code points)', () => {
    // '🚀' is U+1F680 (a 4-byte UTF-8 sequence); each emoji = 1 symbol
    const text = '🚀🚀😊🚀😊';
    const output = compressHuffman(text, { title: 'emojis' });
    const { result } = output;

    // 2 distinct emojis
    expect(result.distinctSymbols).toBe(2);
    expect(result.totalCharacters).toBe(5);
    expect(result.codes['🚀']).toBeDefined();
    expect(result.codes['😊']).toBeDefined();
    // Codes should be single-bit since there are only 2 symbols
    expect(result.codes['🚀'].length).toBe(1);
    expect(result.codes['😊'].length).toBe(1);
  });

  it('should handle text with accented and multi-byte Unicode characters', () => {
    const text = 'café café café señor';
    const output = compressHuffman(text, { title: 'unicode' });
    const { result } = output;

    expect(result.totalCharacters).toBe([...text].length);
    expect(result.distinctSymbols).toBeGreaterThan(0);

    const freqSum = result.table.reduce((acc, r) => acc + r.frequency, 0);
    expect(freqSum).toBe(result.totalCharacters);
  });
});

// ---------------------------------------------------------------------------
// Prefix-free codes
// ---------------------------------------------------------------------------

describe('compressHuffman – prefix-free codes', () => {
  it('should produce prefix-free codes for a simple ASCII string', () => {
    const { result } = compressHuffman('aaaaabbbcc', { title: 'prefix' });
    assertPrefixFree(result.codes);
  });

  it('should produce prefix-free codes for a text with many distinct symbols', () => {
    const text = 'The quick brown fox jumps over the lazy dog';
    const { result } = compressHuffman(text, { title: 'prefix-many' });
    assertPrefixFree(result.codes);
  });

  it('should produce prefix-free codes for text with emojis', () => {
    const text = '🚀😊🌍🔥💡🚀😊🌍🔥💡🚀';
    const { result } = compressHuffman(text, { title: 'prefix-emojis' });
    assertPrefixFree(result.codes);
  });
});

// ---------------------------------------------------------------------------
// Lossless round-trip
// ---------------------------------------------------------------------------

describe('compressHuffman – lossless round-trip', () => {
  it('should round-trip a short ASCII text', () => {
    const text = 'Hello, Huffman!';
    const { sufBuffer } = compressHuffman(text, { title: 'round-trip' });
    const { decodedText } = readSuf(sufBuffer);
    expect(decodedText).toBe(text);
  });

  it('should round-trip text with accented characters', () => {
    const text = 'El veloz murciélago hindú comía feliz cardillo y kiwi.';
    const { sufBuffer } = compressHuffman(text, { title: 'accentos' });
    const { decodedText } = readSuf(sufBuffer);
    expect(decodedText).toBe(text);
  });

  it('should round-trip text with emojis', () => {
    const text = '🚀 Lanzamiento al espacio 😊🌍';
    const { sufBuffer } = compressHuffman(text, { title: 'emojis-rt' });
    const { decodedText } = readSuf(sufBuffer);
    expect(decodedText).toBe(text);
  });

  it('should round-trip text containing newlines and spaces', () => {
    const text = 'Primera línea.\nSegunda línea.\nTercera línea.';
    const { sufBuffer } = compressHuffman(text, { title: 'multiline' });
    const { decodedText } = readSuf(sufBuffer);
    expect(decodedText).toBe(text);
  });

  it('should round-trip a single-symbol repeated string', () => {
    const text = 'x'.repeat(50);
    const { sufBuffer } = compressHuffman(text, { title: 'single-rt' });
    const { decodedText } = readSuf(sufBuffer);
    expect(decodedText).toBe(text);
  });

  it('should round-trip a two-symbol string', () => {
    const text = 'ab'.repeat(20);
    const { sufBuffer } = compressHuffman(text, { title: 'two-rt' });
    const { decodedText } = readSuf(sufBuffer);
    expect(decodedText).toBe(text);
  });
});

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------

describe('compressHuffman – determinism', () => {
  it('should produce identical trees, codes, and step sequences on repeated calls', () => {
    const text = 'Determinismo total en el algoritmo de Huffman.';

    const r1 = compressHuffman(text, { title: 'det' }).result;
    const r2 = compressHuffman(text, { title: 'det' }).result;

    expect(r1.rootId).toBe(r2.rootId);
    expect(r1.nodes.length).toBe(r2.nodes.length);
    expect(r1.steps.length).toBe(r2.steps.length);
    expect(JSON.stringify(r1.codes)).toBe(JSON.stringify(r2.codes));

    for (let i = 0; i < r1.nodes.length; i += 1) {
      expect(r1.nodes[i].id).toBe(r2.nodes[i].id);
      expect(r1.nodes[i].weight).toBe(r2.nodes[i].weight);
      expect(r1.nodes[i].symbol).toBe(r2.nodes[i].symbol);
    }
  });

  it('should produce identical metrics (excluding executionTimeMs) on repeated calls', () => {
    const text = 'Texto repetido para verificar métricas.';

    const m1 = compressHuffman(text, { title: 'det-metrics' }).result.metrics;
    const m2 = compressHuffman(text, { title: 'det-metrics' }).result.metrics;

    expect(m1.originalBytes).toBe(m2.originalBytes);
    expect(m1.totalBits).toBe(m2.totalBits);
    expect(m1.entropy).toBe(m2.entropy);
    expect(m1.bitsPerSymbol).toBe(m2.bitsPerSymbol);
    expect(m1.merges).toBe(m2.merges);
    expect(m1.steps).toBe(m2.steps);
  });
});

// ---------------------------------------------------------------------------
// Structural invariants
// ---------------------------------------------------------------------------

describe('compressHuffman – structural invariants', () => {
  it('should satisfy nodes.length === 2k-1 for all k', () => {
    const cases = [
      { text: 'a', k: 1 },
      { text: 'ab', k: 2 },
      { text: 'abc', k: 3 },
      { text: 'aabbccdd', k: 4 },
    ];

    for (const { text, k } of cases) {
      const { result } = compressHuffman(text, { title: 'inv' });
      expect(result.distinctSymbols).toBe(k);
      expect(result.nodes.length).toBe(2 * k - 1);
    }
  });

  it('should satisfy steps.length === 3k-2 for all k', () => {
    const cases = [
      { text: 'a', k: 1 },
      { text: 'ab', k: 2 },
      { text: 'abc', k: 3 },
      { text: 'aaabbbccc', k: 3 },
    ];

    for (const { text, k } of cases) {
      const { result } = compressHuffman(text, { title: 'steps-inv' });
      expect(result.distinctSymbols).toBe(k);
      expect(result.steps.length).toBe(3 * k - 2);
    }
  });

  it('should expose the correct rootId (last internal node)', () => {
    const text = 'abcde';
    const { result } = compressHuffman(text, { title: 'root' });
    // rootId must reference a node in the nodes array
    const rootNode = result.nodes.find((n) => n.id === result.rootId);
    expect(rootNode).toBeDefined();
    // The root has no parent (null as defined in HuffmanNode schema)
    expect(rootNode!.parentId).toBeNull();
  });

  it('should ensure every symbol in table has a non-empty code', () => {
    const text = 'compresión Huffman con símbolos variados.';
    const { result } = compressHuffman(text, { title: 'codes-defined' });

    for (const row of result.table) {
      expect(result.codes[row.symbol]).toBeDefined();
      expect(result.codes[row.symbol].length).toBeGreaterThan(0);
    }
  });

  it('should set preview.text to the first 30 chars by default', () => {
    const text =
      'Texto de prueba para la vista previa de Huffman, con más de 30 caracteres.';
    const { result } = compressHuffman(text, { title: 'preview' });
    expect(result.preview.text).toBe([...text].slice(0, 30).join(''));
  });

  it('should set preview.text to previewPhrase when provided', () => {
    const text = 'Texto completo de prueba.';
    const phrase = 'Hola';
    const { result } = compressHuffman(text, {
      title: 'preview-phrase',
      previewPhrase: phrase,
    });
    expect(result.preview.text).toBe(phrase);
  });

  it('preview tokens should reconstruct encodedBits', () => {
    const text = 'Verificación de tokens de vista previa.';
    const { result } = compressHuffman(text, { title: 'tokens' });
    const reconstructed = result.preview.tokens.map((t) => t.code).join('');
    expect(reconstructed).toBe(result.preview.encodedBits);
  });
});

// ---------------------------------------------------------------------------
// Don Quijote – performance & known metrics
// ---------------------------------------------------------------------------

describe('compressHuffman – Don Quijote (pg2000.txt / don-quijote.suf)', () => {
  const pg2000Path = path.resolve(
    __dirname,
    '../../../.local-tools/pg2000.txt',
  );
  const sufPath = path.resolve(
    __dirname,
    '../../../.local-tools/don-quijote.suf',
  );
  const fileExists = fs.existsSync(pg2000Path) || fs.existsSync(sufPath);

  // Conditionally run only when the file is available (CI may not have it)
  const itWhenFile = fileExists ? it : it.skip;

  let quijoteText: string;
  let rawPg2000Text: string;

  beforeAll(() => {
    if (fs.existsSync(sufPath)) {
      const buf = fs.readFileSync(sufPath);
      quijoteText = readSuf(buf).decodedText;
    } else if (fs.existsSync(pg2000Path)) {
      const rawText = fs.readFileSync(pg2000Path, 'utf-8');
      quijoteText = cleanText(rawText);
    }

    if (fs.existsSync(pg2000Path)) {
      rawPg2000Text = fs.readFileSync(pg2000Path, 'utf-8');
      if (rawPg2000Text.charCodeAt(0) === 0xfeff) {
        rawPg2000Text = rawPg2000Text.slice(1);
      }
    }
  });

  itWhenFile('should compress Don Quijote in under 1 000 ms', () => {
    const { result } = compressHuffman(quijoteText, { title: 'Don Quijote' });
    expect(result.metrics.executionTimeMs).toBeLessThan(1000);
  });

  itWhenFile(
    'should produce totalCharacters = 2 110 737 and distinctSymbols = 92',
    () => {
      const { result } = compressHuffman(quijoteText, { title: 'Don Quijote' });
      expect(result.totalCharacters).toBe(2110737);
      expect(result.distinctSymbols).toBe(92);
    },
  );

  itWhenFile('should produce rootId = 182 and 183 nodes', () => {
    const { result } = compressHuffman(quijoteText, { title: 'Don Quijote' });
    expect(result.rootId).toBe(182);
    expect(result.nodes.length).toBe(183); // 2×92 − 1
  });

  itWhenFile('should produce exactly 274 steps (3×92 − 2)', () => {
    const { result } = compressHuffman(quijoteText, { title: 'Don Quijote' });
    expect(result.steps.length).toBe(274);
  });

  itWhenFile('should round-trip Don Quijote losslessly', () => {
    const { sufBuffer } = compressHuffman(quijoteText, {
      title: 'Don Quijote',
    });
    const { decodedText } = readSuf(sufBuffer);
    expect(decodedText).toBe(quijoteText);
  });

  itWhenFile('should satisfy the Shannon bound for Don Quijote', () => {
    const { metrics } = compressHuffman(quijoteText, {
      title: 'Don Quijote',
    }).result;
    expect(metrics.bitsPerSymbol).toBeGreaterThanOrEqual(metrics.entropy);
    expect(metrics.bitsPerSymbol).toBeLessThan(metrics.entropy + 1);
  });

  itWhenFile(
    'should compress raw full pg2000.txt losslessly and satisfy structural invariants',
    () => {
      if (!rawPg2000Text) return;
      const { result, sufBuffer } = compressHuffman(rawPg2000Text, {
        title: 'Don Quijote Raw',
      });
      expect(result.totalCharacters).toBe(2168116);
      expect(result.distinctSymbols).toBe(111);
      expect(result.nodes.length).toBe(2 * 111 - 1);
      expect(result.steps.length).toBe(3 * 111 - 2);
      expect(result.metrics.executionTimeMs).toBeLessThan(1000);

      const { decodedText } = readSuf(sufBuffer);
      expect(decodedText).toBe(rawPg2000Text);
    },
  );
});
