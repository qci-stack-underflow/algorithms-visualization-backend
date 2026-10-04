import { Test, TestingModule } from '@nestjs/testing';
import { AlgorithmsService } from './algorithms.service';

// El servicio lanza Error con una `cause`; el controlador la traduce a HTTP.
function causeOf(fn: () => unknown): unknown {
  try {
    fn();
  } catch (error) {
    return (error as Error).cause;
  }
  throw new Error('Se esperaba que la función lanzara un error.');
}

describe('AlgorithmsService', () => {
  let service: AlgorithmsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AlgorithmsService],
    }).compile();

    service = module.get<AlgorithmsService>(AlgorithmsService);
  });

  describe('findAll', () => {
    it('devuelve la ficha de cada algoritmo registrado', () => {
      const ids = service.findAll().map((info) => info.id);
      expect(ids).toEqual(
        expect.arrayContaining([
          'insertion-sort',
          'gnome-sort',
          'stooge-sort',
          'exchange-sort',
        ]),
      );
    });
  });

  describe('findOne', () => {
    it('devuelve la ficha del algoritmo', () => {
      expect(service.findOne('insertion-sort').name).toBe('Insertion Sort');
    });

    it("lanza 'unknown-id' si el id no existe", () => {
      expect(causeOf(() => service.findOne('no-existe'))).toBe('unknown-id');
    });
  });

  describe('run', () => {
    it('ejecuta el algoritmo', () => {
      const result = service.run('insertion-sort', [3, 1, 2]);
      expect(result.output).toEqual([1, 2, 3]);
      expect(result.metrics).toMatchObject({ comparisons: 3, swaps: 2 });
    });

    it("lanza 'unknown-id' si el id no existe", () => {
      expect(causeOf(() => service.run('no-existe', [1]))).toBe('unknown-id');
    });

    it("lanza 'bad-array' si la entrada es inválida", () => {
      expect(causeOf(() => service.run('insertion-sort', 'abc'))).toBe(
        'bad-array',
      );
      expect(
        causeOf(() => service.run('insertion-sort', Array(51).fill(1))),
      ).toBe('bad-array');
    });
  });

  describe('compare', () => {
    it('ejecuta varios algoritmos sobre el mismo arreglo', () => {
      const input = [4, 2, 5, 1];
      const results = service.compare(['insertion-sort', 'gnome-sort'], input);

      expect(results.map((result) => result.algorithm)).toEqual([
        'insertion-sort',
        'gnome-sort',
      ]);
      for (const result of results) {
        expect(result.input).toEqual(input);
        expect(result.output).toEqual([1, 2, 4, 5]);
      }
    });

    it("lanza 'bad-ids' con menos de dos algoritmos", () => {
      expect(causeOf(() => service.compare(['insertion-sort'], [1]))).toBe(
        'bad-ids',
      );
      expect(causeOf(() => service.compare('insertion-sort', [1]))).toBe(
        'bad-ids',
      );
    });

    it("lanza 'algorithms-repeat' con ids repetidos", () => {
      expect(
        causeOf(() =>
          service.compare(['insertion-sort', 'insertion-sort'], [1]),
        ),
      ).toBe('algorithms-repeat');
    });

    it("lanza 'unknown-id' si algún id no existe", () => {
      expect(
        causeOf(() => service.compare(['insertion-sort', 'no-existe'], [1])),
      ).toBe('unknown-id');
    });
  });
});
