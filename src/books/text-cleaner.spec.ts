import { TextCleaner } from './text-cleaner';

describe('TextCleaner (B3)', () => {
  it('elimina el marcador BOM (\\uFEFF) al inicio del texto', () => {
    const raw = '\uFEFFEn un lugar de la Mancha';
    expect(TextCleaner.clean(raw)).toBe('En un lugar de la Mancha');
  });

  it('normaliza saltos de línea Windows (\\r\\n) y clásicos (\\r) a Unix (\\n)', () => {
    const raw = 'Línea 1\r\nLínea 2\rLínea 3\nLínea 4';
    expect(TextCleaner.clean(raw)).toBe('Línea 1\nLínea 2\nLínea 3\nLínea 4');
  });

  it('extrae únicamente el contenido entre *** START OF y *** END OF', () => {
    const raw = [
      '\uFEFFThe Project Gutenberg eBook of Don Quijote',
      'Licencia previa...',
      '*** START OF THE PROJECT GUTENBERG EBOOK DON QUIJOTE ***',
      '',
      'Capítulo Primero.',
      'Que trata de la condición y ejercicio del famoso hidalgo.',
      '',
      '*** END OF THE PROJECT GUTENBERG EBOOK DON QUIJOTE ***',
      'Updated editions will replace the previous one...',
    ].join('\r\n');

    expect(TextCleaner.clean(raw)).toBe(
      'Capítulo Primero.\nQue trata de la condición y ejercicio del famoso hidalgo.',
    );
  });

  it('soporta la variante "THIS PROJECT GUTENBERG EBOOK"', () => {
    const raw = [
      'Header info',
      '*** START OF THIS PROJECT GUTENBERG EBOOK ALICE IN WONDERLAND ***',
      'Down the Rabbit-Hole',
      '*** END OF THIS PROJECT GUTENBERG EBOOK ALICE IN WONDERLAND ***',
      'Footer license',
    ].join('\n');

    expect(TextCleaner.clean(raw)).toBe('Down the Rabbit-Hole');
  });

  it('devuelve cadena vacía si la entrada está vacía', () => {
    expect(TextCleaner.clean('')).toBe('');
  });
});
