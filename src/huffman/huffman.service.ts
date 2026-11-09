import { Injectable } from '@nestjs/common';
import { HUFFMAN_PSEUDOCODE } from '../types/huffman.types';

@Injectable()
export class HuffmanService {
  getHuffman() {
    return {
      description:
        'Huffman is an algorithm used to compress files from a binary tree. Each leaf of the binary tree is a character, which has frequency and code.',
      pseudocode: HUFFMAN_PSEUDOCODE
    };
  }
}
