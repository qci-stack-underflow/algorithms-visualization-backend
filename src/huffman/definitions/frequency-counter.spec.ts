import { countFrequencies } from './frequency-counter';

describe('countFrequencies (Issue #35 / A2)', () => {
  it('should count frequencies preserving order of first appearance', () => {
    const text = 'abracadabra';
    const { symbols, frequencies, totalCharacters } = countFrequencies(text);

    // Orden de primera aparición: 'a', 'b', 'r', 'c', 'd'
    expect(symbols).toEqual(['a', 'b', 'r', 'c', 'd']);
    expect(frequencies.get('a')).toBe(5);
    expect(frequencies.get('b')).toBe(2);
    expect(frequencies.get('r')).toBe(2);
    expect(frequencies.get('c')).toBe(1);
    expect(frequencies.get('d')).toBe(1);
    expect(totalCharacters).toBe(11);

    // Criterio de aceptación: La suma de frecuencias es igual al total de caracteres
    const sumFrequencies = Array.from(frequencies.values()).reduce(
      (acc, v) => acc + v,
      0,
    );
    expect(sumFrequencies).toBe(totalCharacters);
  });

  it('should treat multi-byte Unicode characters and emojis as single symbols', () => {
    const text = 'año 🚀 café';
    const { symbols, frequencies, totalCharacters } = countFrequencies(text);

    // Los caracteres son: 'a', 'ñ', 'o', ' ', '🚀', ' ', 'c', 'a', 'f', 'é' -> 10 caracteres en total
    expect(symbols).toEqual(['a', 'ñ', 'o', ' ', '🚀', 'c', 'f', 'é']);
    expect(frequencies.get('ñ')).toBe(1);
    expect(frequencies.get('🚀')).toBe(1);
    expect(frequencies.get('é')).toBe(1);
    expect(frequencies.get(' ')).toBe(2);
    expect(frequencies.get('a')).toBe(2);

    const sumFrequencies = Array.from(frequencies.values()).reduce(
      (acc, v) => acc + v,
      0,
    );
    expect(sumFrequencies).toBe(totalCharacters);
    expect(totalCharacters).toBe(10);
  });

  it('should handle an empty string', () => {
    const { symbols, frequencies, totalCharacters } = countFrequencies('');
    expect(symbols).toEqual([]);
    expect(frequencies.size).toBe(0);
    expect(totalCharacters).toBe(0);
  });
});
