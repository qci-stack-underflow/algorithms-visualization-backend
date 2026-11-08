import {
  Controller,
  Get,
  InternalServerErrorException,
  Post,
} from '@nestjs/common';
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

  // TODO: Return actual list of default books
  @Get('/books')
  getDefaultBooks() {
    return [];
  }

  @Get('/books/search')
  searchBook() {
    return 'List of found books by query param';
  }

  @Get('books/:id')
  compressByIdMetadata() {
    return 'compressed book with metrics from Project Gutenberg from a given ID';
  }

  @Get('books/:id/file')
  compressByIdDonwload() {
    return 'binary .suf file containing compressed book';
  }

  @Post('/compress/file')
  compressFromClient() {
    return 'compressed .txt file from client with metadata';
  }
}
