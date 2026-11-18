import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { BOOKS_CATALOG } from './books.catalog';
import { LocalBackupService } from './local-backup.service';

const LIBROS_CON_RESPALDO = [2000, 84, 18005];

describe('LocalBackupService & vercel.json includeFiles (B4)', () => {
  let service: LocalBackupService;

  beforeEach(() => {
    service = new LocalBackupService();
  });

  it('tiene copia local de los libros que deben funcionar sin Gutenberg', () => {
    for (const id of LIBROS_CON_RESPALDO) {
      expect(service.hasLocalCopy(id)).toBe(true);
    }
  });

  // Un respaldo se sirve como si fuera el libro (y queda en caché), así que
  // tiene que ser el libro completo, no un fragmento: con el texto entre las
  // marcas START y END, y del mismo tamaño que anuncia el catálogo.
  it('cada copia local es el libro completo', () => {
    const archivos = fs
      .readdirSync(path.join(process.cwd(), 'assets', 'catalog-backup'))
      .filter((nombre) => nombre.endsWith('.txt'));
    expect(archivos.length).toBeGreaterThanOrEqual(LIBROS_CON_RESPALDO.length);

    for (const archivo of archivos) {
      const id = Number(archivo.replace(/\.txt$/, ''));
      const libro = BOOKS_CATALOG.find((book) => book.id === id);
      expect(libro).toBeDefined();

      const text = service.getLocalCopy(id);
      expect(text).toContain('*** START OF THE PROJECT GUTENBERG EBOOK');
      expect(text).toContain('*** END OF THE PROJECT GUTENBERG EBOOK');
      expect(text.length).toBeGreaterThan(100_000);
      expect(Buffer.byteLength(text, 'utf-8')).toBe(libro?.bytes);
    }
  });

  it('lanza NotFoundException cuando no existe respaldo local para un ID', () => {
    expect(service.hasLocalCopy(999999)).toBe(false);
    expect(() => service.getLocalCopy(999999)).toThrow(NotFoundException);
  });

  it('valida que el ID sea un entero positivo', () => {
    expect(service.hasLocalCopy(-5)).toBe(false);
    expect(() => service.getLocalCopy(-5)).toThrow(BadRequestException);
  });

  it('incluye assets/catalog-backup/** en vercel.json (includeFiles)', () => {
    const vercelConfigPath = path.join(process.cwd(), 'vercel.json');
    const vercelConfig = JSON.parse(
      fs.readFileSync(vercelConfigPath, 'utf-8'),
    ) as {
      builds?: Array<{ src?: string; config?: { includeFiles?: string[] } }>;
    };
    const nodeBuild = vercelConfig.builds?.find((b) => b.src === 'src/main.ts');

    expect(nodeBuild).toBeDefined();
    expect(nodeBuild?.config?.includeFiles).toContain(
      'assets/catalog-backup/**',
    );
  });
});
