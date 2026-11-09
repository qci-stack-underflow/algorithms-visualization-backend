import {
  Controller,
  Get,
  Header,
  InternalServerErrorException,
  Param,
  ParseIntPipe,
  Post,
  StreamableFile,
} from '@nestjs/common';
import { CatalogBook } from '../books/books.catalog';
import { HuffmanResult } from '../types/huffman.types';
import { HuffmanService } from './huffman.service';

@Controller('huffman')
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
  getDefaultBooks(): readonly CatalogBook[] {
    return this.huffmanService.getCatalog();
  }

  @Get('books/search')
  searchBook() {
    return 'List of found books by query param';
  }

  @Get('books/:id')
  async compressByIdMetadata(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<HuffmanResult> {
    return this.huffmanService.processHuffmanMetadata(id);
  }

  @Get('books/:id/file')
  @Header('Content-Type', 'application/octet-stream')
  async compressByIdDownload(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<StreamableFile> {
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
