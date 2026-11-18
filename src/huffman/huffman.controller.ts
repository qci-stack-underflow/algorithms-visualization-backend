import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
  Param,
  ParseIntPipe,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseFilters,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CatalogBook } from '../books/books.catalog';
import { HuffmanExceptionFilter } from '../common/filters/huffman-exception.filter';
import {
  HuffmanResult,
  MAX_UPLOAD_FILE_SIZE_BYTES,
} from '../types/huffman.types';
import { HuffmanService, type UploadedTextFile } from './huffman.service';

export const HUFFMAN_CACHE_CONTROL = 'public, max-age=86400, s-maxage=604800';

/**
 * Parsea el parámetro de consulta `metadata` (`"true"` | `"false"`), devolviendo `defaultValue` si no se envía.
 */
function parseMetadataFlag(
  raw: string | undefined,
  defaultValue: boolean,
): boolean {
  if (raw === undefined) {
    return defaultValue;
  }
  const normalized = raw.trim().toLowerCase();
  if (normalized === 'true') {
    return true;
  }
  if (normalized === 'false') {
    return false;
  }
  throw new BadRequestException(
    'El parámetro "metadata" debe ser "true" o "false".',
  );
}

@Controller('huffman')
@UseFilters(HuffmanExceptionFilter)
export class HuffmanController {
  constructor(private readonly huffmanService: HuffmanService) {}

  @Get('')
  getHuffman() {
    try {
      return this.huffmanService.getHuffman();
    } catch {
      throw new InternalServerErrorException('Something went wrong.');
    }
  }

  @Get('books')
  @Header('Cache-Control', HUFFMAN_CACHE_CONTROL)
  getDefaultBooks(): readonly CatalogBook[] {
    return this.huffmanService.getCatalog();
  }

  @Get('books/search')
  searchBook() {
    return 'List of found books by query param';
  }

  @Get('books/:id')
  @Header('Cache-Control', HUFFMAN_CACHE_CONTROL)
  async compressByIdMetadata(
    @Param(
      'id',
      new ParseIntPipe({
        exceptionFactory: () =>
          new BadRequestException(
            'El ID del libro debe ser un número entero válido.',
          ),
      }),
    )
    id: number,
  ): Promise<HuffmanResult> {
    if (id <= 0) {
      throw new BadRequestException(
        'El ID del libro debe ser un número entero positivo.',
      );
    }
    return this.huffmanService.processHuffmanMetadata(id);
  }

  @Get('books/:id/file')
  @Header('Cache-Control', HUFFMAN_CACHE_CONTROL)
  @Header('Content-Type', 'application/octet-stream')
  async compressByIdDownload(
    @Param(
      'id',
      new ParseIntPipe({
        exceptionFactory: () =>
          new BadRequestException(
            'El ID del libro debe ser un número entero válido.',
          ),
      }),
    )
    id: number,
  ): Promise<StreamableFile> {
    if (id <= 0) {
      throw new BadRequestException(
        'El ID del libro debe ser un número entero positivo.',
      );
    }
    const { buffer } = await this.huffmanService.generateSufFile(id);
    return new StreamableFile(buffer, {
      type: 'application/octet-stream',
      disposition: `attachment; filename="book_${id}.suf"`,
      length: buffer.byteLength,
    });
  }

  @Post('compress/file')
  @HttpCode(HttpStatus.OK)
  @Header('Content-Type', 'application/octet-stream')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_UPLOAD_FILE_SIZE_BYTES },
    }),
  )
  compressFromClient(
    @UploadedFile() file?: UploadedTextFile,
    @Body('title') title?: string,
    @Query('metadata') metadata?: string,
  ): StreamableFile {
    const includeMetadata = parseMetadataFlag(metadata, true);
    const { buffer, filename } = this.huffmanService.compressUploadedFile(
      file,
      title,
      includeMetadata,
    );
    return new StreamableFile(buffer, {
      type: 'application/octet-stream',
      disposition: `attachment; filename="${filename}"`,
      length: buffer.byteLength,
    });
  }

  @Post('decompress/file')
  @HttpCode(HttpStatus.OK)
  @Header('Content-Type', 'text/plain; charset=utf-8')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_UPLOAD_FILE_SIZE_BYTES },
    }),
  )
  decompressFromClient(
    @UploadedFile() file?: UploadedTextFile,
    @Query('metadata') metadata?: string,
  ): StreamableFile {
    const hasMetadata = parseMetadataFlag(metadata, false);
    const { buffer, filename } = this.huffmanService.decompressUploadedFile(
      file,
      hasMetadata,
    );
    return new StreamableFile(buffer, {
      type: 'text/plain; charset=utf-8',
      disposition: `attachment; filename="${filename}"`,
      length: buffer.byteLength,
    });
  }
}
