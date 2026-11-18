import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { BOOKS_CATALOG } from './books.catalog';
import { LocalBackupService } from './local-backup.service';

describe('LocalBackupService & vercel.json includeFiles (B4)', () => {
  let service: LocalBackupService;

  beforeEach(() => {
    service = new LocalBackupService();
  });

  it('dispone de copias locales en assets/catalog-backup para todos los libros del catálogo', () => {
    for (const book of BOOKS_CATALOG) {
      expect(service.hasLocalCopy(book.id)).toBe(true);
      const text = service.getLocalCopy(book.id);
      expect(text.length).toBeGreaterThan(50);
      expect(text).toContain('START OF THE PROJECT GUTENBERG EBOOK');
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
    const vercelConfig = JSON.parse(fs.readFileSync(vercelConfigPath, 'utf-8'));
    const nodeBuild = vercelConfig.builds?.find(
      (b: { src?: string }) => b.src === 'src/main.ts',
    );

    expect(nodeBuild).toBeDefined();
    expect(nodeBuild.config?.includeFiles).toContain(
      'assets/catalog-backup/**',
    );
  });
});
