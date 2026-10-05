import { Test, TestingModule } from '@nestjs/testing';
import { AlgorithmsController } from './algorithms.controller';
import { AlgorithmsService } from './algorithms.service';

describe('AlgorithmsController', () => {
  let controller: AlgorithmsController;
  const mockAlgorithmsService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    run: jest.fn(),
    compare: jest.fn(),
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
    jest.clearAllMocks();
  });

  it('should return all algorithms from the service', () => {
    const algorithms = [{ id: 'bubble-sort', name: 'Bubble Sort' }];
    mockAlgorithmsService.findAll.mockReturnValue(algorithms);

    expect(controller.findAll()).toEqual(algorithms);
    expect(mockAlgorithmsService.findAll).toHaveBeenCalledTimes(1);
  });

  it('should translate findAll service errors', () => {
    mockAlgorithmsService.findAll.mockImplementation(() => {
      throw new Error('service failure');
    });

    expect(() => controller.findAll()).toThrow('Something went wrong.');
  });

  describe('findOne', () => {
    it('should return one algorithm from the service', () => {
      const algorithm = { id: 'bubble-sort', name: 'Bubble Sort' };
      mockAlgorithmsService.findOne.mockReturnValue(algorithm);

      expect(controller.findOne('bubble-sort')).toEqual(algorithm);
      expect(mockAlgorithmsService.findOne).toHaveBeenCalledWith('bubble-sort');
    });

    it('should reject an unknown algorithm without calling the service', () => {
      expect(() => controller.findOne('unknown')).toThrow(
        "Algorithm with id 'unknown' does not exist.",
      );
      expect(mockAlgorithmsService.findOne).not.toHaveBeenCalled();
    });

    it('should translate service errors', () => {
      mockAlgorithmsService.findOne.mockImplementation(() => {
        throw new Error('service failure');
      });

      expect(() => controller.findOne('bubble-sort')).toThrow(
        'Something went wrong.',
      );
    });
  });

  describe('executeAlgorithm', () => {
    it('should run a valid algorithm with its input', () => {
      const result = { sorted: [1, 2, 3] };
      mockAlgorithmsService.run.mockReturnValue(result);

      expect(
        controller.executeAlgorithm({ input: [3, 1, 2] }, 'bubble-sort'),
      ).toEqual(result);
      expect(mockAlgorithmsService.run).toHaveBeenCalledWith(
        'bubble-sort',
        [3, 1, 2],
      );
    });

    it('should reject an unknown algorithm without calling the service', () => {
      expect(() =>
        controller.executeAlgorithm({ input: [1] }, 'unknown'),
      ).toThrow("Algorithm with id 'unknown' does not exist.");
      expect(mockAlgorithmsService.run).not.toHaveBeenCalled();
    });

    it.each([
      [undefined, 'Missing body'],
      [{}, 'Array input is missing'],
      [{ input: [] }, 'Array input is bad-formatted'],
      [{ input: [1, '2'] }, 'Array input is bad-formatted'],
      [{ input: [Infinity] }, 'Array input is bad-formatted'],
      [
        { input: Array(51).fill(1) },
        'Array input is too big (up to 50, sent 51)',
      ],
    ])('should reject invalid body %p', (body, message) => {
      expect(() => controller.executeAlgorithm(body, 'bubble-sort')).toThrow(
        message,
      );
      expect(mockAlgorithmsService.run).not.toHaveBeenCalled();
    });

    it('should map bad-array service errors to a bad request', () => {
      mockAlgorithmsService.run.mockImplementation(() => {
        throw { cause: 'bad-array' };
      });

      expect(() =>
        controller.executeAlgorithm({ input: [1] }, 'bubble-sort'),
      ).toThrow('Array input is bad-formatted');
    });

    it('should translate other service errors', () => {
      mockAlgorithmsService.run.mockImplementation(() => {
        throw new Error('service failure');
      });

      expect(() =>
        controller.executeAlgorithm({ input: [1] }, 'bubble-sort'),
      ).toThrow('Something went wrong');
    });
  });

  describe('compareAlgorithms', () => {
    const validBody = {
      algorithms: ['bubble-sort', 'insertion-sort'],
      input: [2, 1],
    };

    it('should compare valid algorithms with the provided input', () => {
      const results = [{ sorted: [1, 2] }, { sorted: [1, 2] }];
      mockAlgorithmsService.compare.mockReturnValue(results);

      expect(controller.compareAlgorithms(validBody)).toEqual(results);
      expect(mockAlgorithmsService.compare).toHaveBeenCalledWith(
        validBody.algorithms,
        validBody.input,
      );
    });

    it.each([
      [undefined, 'Missing body.'],
      [{ input: [1] }, 'Algorithms or input are missing.'],
      [
        { algorithms: ['bubble-sort'], input: [1] },
        'Algorithms are bad-formatted or there are less than 2',
      ],
      [
        { algorithms: ['bubble-sort', 'unknown'], input: [1] },
        'There are one or more invalid algorithm ids',
      ],
      [
        { algorithms: ['bubble-sort', 'insertion-sort'], input: [] },
        'input is bad-formatted',
      ],
      [
        { algorithms: ['bubble-sort', 'insertion-sort'], input: [1, '2'] },
        'input is bad-formatted',
      ],
      [
        {
          algorithms: ['bubble-sort', 'insertion-sort'],
          input: Array(51).fill(1),
        },
        'Array input is too big (up to 50, sent 51)',
      ],
    ])('should reject invalid comparison body %p', (body, message) => {
      expect(() => controller.compareAlgorithms(body)).toThrow(message);
      expect(mockAlgorithmsService.compare).not.toHaveBeenCalled();
    });

    it('should map repeated algorithms service errors to a bad request', () => {
      mockAlgorithmsService.compare.mockImplementation(() => {
        throw { cause: 'algorithms-repeat' };
      });

      expect(() => controller.compareAlgorithms(validBody)).toThrow(
        'There are repeated algorithms',
      );
    });

    it('should map bad-ids service errors to a bad request', () => {
      mockAlgorithmsService.compare.mockImplementation(() => {
        throw { cause: 'bad-ids' };
      });

      expect(() => controller.compareAlgorithms(validBody)).toThrow(
        'input is bad-formatted',
      );
    });

    it('should translate other service errors', () => {
      mockAlgorithmsService.compare.mockImplementation(() => {
        throw new Error('service failure');
      });

      expect(() => controller.compareAlgorithms(validBody)).toThrow(
        'Something went wrong.',
      );
    });
  });
});
