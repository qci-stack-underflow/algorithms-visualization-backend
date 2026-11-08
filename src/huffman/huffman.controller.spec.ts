import { Test, TestingModule } from '@nestjs/testing';
import { HuffmanController } from './huffman.controller';

describe('HuffmanController', () => {
  let controller: HuffmanController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HuffmanController],
    }).compile();

    controller = module.get<HuffmanController>(HuffmanController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
