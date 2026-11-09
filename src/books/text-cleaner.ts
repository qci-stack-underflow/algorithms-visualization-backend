export class TextCleaner {
  private static readonly START_MARKER_REGEX =
    /^\*{3}\s*START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^\n]*\n?/im;
  private static readonly GENERIC_START_MARKER_REGEX =
    /^.*?\bSTART OF (?:THE|THIS)?\s*PROJECT GUTENBERG[^\n]*\n?/im;
  private static readonly END_MARKER_REGEX =
    /\n?\*{3}\s*END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[\s\S]*$/im;
  private static readonly GENERIC_END_MARKER_REGEX =
    /\n?.*?\bEND OF (?:THE|THIS)?\s*PROJECT GUTENBERG[\s\S]*$/im;

  static clean(rawText: string): string {
    if (!rawText) return '';

    // 1. Eliminar BOM (\uFEFF) y normalizar saltos de línea (\r\n y \r -> \n)
    let text = rawText
      .replace(/^\uFEFF/, '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n');

    // 2. Extraer el contenido después de la línea "*** START OF ..."
    const startMatch =
      TextCleaner.START_MARKER_REGEX.exec(text) ??
      TextCleaner.GENERIC_START_MARKER_REGEX.exec(text);

    if (startMatch) {
      text = text.slice(startMatch.index + startMatch[0].length);
    }

    // 3. Extraer el contenido antes de la línea "*** END OF ..."
    const endMatch =
      TextCleaner.END_MARKER_REGEX.exec(text) ??
      TextCleaner.GENERIC_END_MARKER_REGEX.exec(text);

    if (endMatch) {
      text = text.slice(0, endMatch.index);
    }

    return text.trim();
  }
}
