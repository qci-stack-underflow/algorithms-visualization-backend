import { Test, TestingModule } from '@nestjs/testing';
import { AlgorithmsController } from './algorithms.controller';
import { AlgorithmsService } from './algorithms.service';

describe('AlgorithmsController', () => {
  let controller: AlgorithmsController;
  const mockAlgorithmsService = {
    findAll: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AlgorithmsController],
      providers: [
        {
          provide: AlgorithmsService,
          useValue: mockAlgorithmsService,
        },
      ],
    }).compile();

    controller = module.get<AlgorithmsController>(AlgorithmsController);
    mockAlgorithmsService.findAll.mockReset();
  });

  it('should return all algorithms from the service', () => {
    const algorithms = [{ id: 'bubble-sort', name: 'Bubble Sort' }];
    mockAlgorithmsService.findAll.mockReturnValue(algorithms);

    expect(controller.findAll()).toEqual(algorithms);
    expect(mockAlgorithmsService.findAll).toHaveBeenCalledTimes(1);
  });
});
