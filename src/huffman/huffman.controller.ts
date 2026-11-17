import {
  BadRequestException,
  Controller,
  Get,
  Header,
  InternalServerErrorException,
  Param,
  ParseIntPipe,
  Post,
  StreamableFile,
  UseFilters,
} from '@nestjs/common';
import { CatalogBook } from '../books/books.catalog';
import { HuffmanExceptionFilter } from '../common/filters/huffman-exception.filter';
import { HuffmanResult } from '../types/huffman.types';
import { HuffmanService } from './huffman.service';

export const HUFFMAN_CACHE_CONTROL =
  'public, max-age=86400, s-maxage=604800';

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
  compressFromClient() {
    return 'compressed .txt file from client with metadata';
  }
}
