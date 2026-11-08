import { Controller, Get, InternalServerErrorException } from '@nestjs/common';
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
}
