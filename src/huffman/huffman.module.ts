import { Module } from '@nestjs/common';
import { HuffmanController } from './huffman.controller';
import { HuffmanService } from './huffman.service';

@Module({
  controllers: [HuffmanController],
  providers: [HuffmanService],
  exports: [HuffmanService]
})
export class HuffmanModule {}
