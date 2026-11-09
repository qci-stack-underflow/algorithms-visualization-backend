import {
  BOOKS_CATALOG,
  CATALOG_BOOK_IDS,
  findCatalogBookById,
} from './books.catalog';

describe('BOOKS_CATALOG (B1)', () => {
  it('contiene los libros predefinidos con ID, título, autor, idioma y tamaño', () => {
    expect(BOOKS_CATALOG.length).toBe(CATALOG_BOOK_IDS.length);

    for (const book of BOOKS_CATALOG) {
      expect(book.type).toBe('gutenberg');
      expect(Number.isInteger(book.id)).toBe(true);
      expect(book.id).toBeGreaterThan(0);
      expect(book.title.trim().length).toBeGreaterThan(0);
      expect(book.author.trim().length).toBeGreaterThan(0);
      expect(book.language.trim().length).toBeGreaterThan(0);
      expect(book.size.trim().length).toBeGreaterThan(0);
      expect(book.sizeBytes).toBeGreaterThan(0);
    }
  });

  it('no tiene IDs duplicados en el catálogo', () => {
    const ids = BOOKS_CATALOG.map((book) => book.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('permite buscar un libro por su ID de Gutenberg', () => {
    const quijote = findCatalogBookById(2000);
    expect(quijote).toBeDefined();
    expect(quijote?.title).toBe('Don Quijote');
    expect(findCatalogBookById(999999)).toBeUndefined();
  });
});
