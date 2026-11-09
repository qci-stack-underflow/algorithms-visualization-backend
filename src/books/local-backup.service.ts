import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class LocalBackupService {
  private readonly backupDir: string;

  constructor(customBackupDir?: string) {
    this.backupDir =
      customBackupDir ?? path.join(process.cwd(), 'assets', 'catalog-backup');
  }

  hasLocalCopy(bookId: number): boolean {
    if (!Number.isInteger(bookId) || bookId <= 0) {
      return false;
    }
    return fs.existsSync(this.getFilePath(bookId));
  }

  getLocalCopy(bookId: number): string {
    const filePath = this.getFilePath(bookId);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException(
        `Copia local de respaldo para el libro ${bookId} no encontrada.`,
      );
    }
    return fs.readFileSync(filePath, 'utf-8');
  }

  private getFilePath(bookId: number): string {
    if (!Number.isInteger(bookId) || bookId <= 0) {
      throw new BadRequestException(
        'El ID del libro debe ser un entero positivo.',
      );
    }
    return path.join(this.backupDir, `${bookId}.txt`);
  }
}
