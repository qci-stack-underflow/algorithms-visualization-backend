import { Controller, Get } from '@nestjs/common';
import { HuffmanService } from './huffman.service';

@Controller('huffman')
export class HuffmanController {
  constructor(private readonly huffmanService: HuffmanService) {}

  @Get('')
  getHuffman() {
    return "Hello from /huffman!"
  }
}
