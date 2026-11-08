import { Test, TestingModule } from '@nestjs/testing';
import { HuffmanService } from './huffman.service';

describe('HuffmanService', () => {
  let service: HuffmanService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HuffmanService],
    }).compile();

    service = module.get<HuffmanService>(HuffmanService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
