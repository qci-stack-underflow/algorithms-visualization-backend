import { BookInfo, CATALOG_BOOK_IDS } from '../types/huffman.types';

export interface CatalogBook extends BookInfo {
  readonly id: number;
  readonly title: string;
  readonly author: string;
  readonly language: string;
  readonly size: string;
  readonly bytes: number;
  readonly sizeBytes: number;
}

export const BOOKS_CATALOG: readonly CatalogBook[] = [
  {
    type: 'gutenberg',
    id: 2000,
    title: 'Don Quijote',
    author: 'Miguel de Cervantes Saavedra',
    language: 'Español',
    size: '2.2 MB',
    bytes: 2168320,
    sizeBytes: 2168320,
  },
  {
    type: 'gutenberg',
    id: 1342,
    title: 'Pride and Prejudice',
    author: 'Jane Austen',
    language: 'Inglés',
    size: '772 KB',
    bytes: 772412,
    sizeBytes: 772412,
  },
  {
    type: 'gutenberg',
    id: 2701,
    title: 'Moby Dick; Or, The Whale',
    author: 'Herman Melville',
    language: 'Inglés',
    size: '1.2 MB',
    bytes: 1276235,
    sizeBytes: 1276235,
  },
  {
    type: 'gutenberg',
    id: 84,
    title: 'Frankenstein; Or, The Modern Prometheus',
    author: 'Mary Wollstonecraft Shelley',
    language: 'Inglés',
    size: '440 KB',
    bytes: 448821,
    sizeBytes: 448821,
  },
  {
    type: 'gutenberg',
    id: 1661,
    title: 'The Adventures of Sherlock Holmes',
    author: 'Arthur Conan Doyle',
    language: 'Inglés',
    size: '594 KB',
    bytes: 607788,
    sizeBytes: 607788,
  },
  {
    type: 'gutenberg',
    id: 11,
    title: "Alice's Adventures in Wonderland",
    author: 'Lewis Carroll',
    language: 'Inglés',
    size: '175 KB',
    bytes: 174355,
    sizeBytes: 174355,
  },
] as const;

export function findCatalogBookById(id: number): CatalogBook | undefined {
  return BOOKS_CATALOG.find((book) => book.id === id);
}

export { CATALOG_BOOK_IDS };
