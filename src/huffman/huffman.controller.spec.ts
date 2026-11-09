import { Test, TestingModule } from '@nestjs/testing';
import { HuffmanController } from './huffman.controller';
import { HuffmanService } from './huffman.service';

describe('HuffmanController', () => {
  let controller: HuffmanController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HuffmanController],
      providers: [HuffmanService],
    }).compile();

    controller = module.get<HuffmanController>(HuffmanController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
