/**
 * Resultado del conteo de frecuencias de un texto.
 */
export interface FrequencyCountResult {
  /** Símbolos únicos en orden de primera aparición en el texto original. */
  symbols: string[];
  /** Mapa de símbolo a frecuencia absoluta. */
  frequencies: Map<string, number>;
  /** Cantidad total de caracteres Unicode procesados. */
  totalCharacters: number;
}

/**
 * Cuenta las apariciones de cada símbolo en una cadena de texto respetando puntos de código Unicode.
 *
 * Implementación conforme al Issue #35 (A2) y el contrato de Huffman:
 * 1. Utiliza `for...of` para iterar por punto de código Unicode en lugar de índices UTF-16 o bytes,
 *    asegurando que caracteres como "ñ", vocales acentuadas ("á") o emojis cuenten como un único símbolo.
 * 2. Mantiene el orden de primera aparición en `symbols` para que los IDs iniciales de las hojas (0..k-1)
 *    sean completamente deterministas.
 * 3. La suma de todas las frecuencias en el mapa es idéntica a `totalCharacters`.
 *
 * @param text Texto normalizado a procesar.
 * @returns {FrequencyCountResult} Símbolos en orden de aparición, mapa de frecuencias y conteo total.
 */
export function countFrequencies(text: string): FrequencyCountResult {
  const symbols: string[] = [];
  const frequencies = new Map<string, number>();
  let totalCharacters = 0;

  for (const char of text) {
    totalCharacters += 1;
    const currentCount = frequencies.get(char);
    if (currentCount === undefined) {
      symbols.push(char);
      frequencies.set(char, 1);
    } else {
      frequencies.set(char, currentCount + 1);
    }
  }

  return {
    symbols,
    frequencies,
    totalCharacters,
  };
}
