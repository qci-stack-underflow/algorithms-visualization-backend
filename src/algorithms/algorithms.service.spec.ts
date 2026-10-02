import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AlgorithmsService } from './algorithms.service';

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

    it('lanza 404 si el id no existe', () => {
      expect(() => service.findOne('no-existe')).toThrow(NotFoundException);
    });
  });

  describe('run', () => {
    it('ejecuta el algoritmo', () => {
      const result = service.run('insertion-sort', [3, 1, 2]);
      expect(result.output).toEqual([1, 2, 3]);
      expect(result.metrics).toMatchObject({ comparisons: 3, swaps: 2 });
    });

    it('lanza 404 si el id no existe', () => {
      expect(() => service.run('no-existe', [1])).toThrow(NotFoundException);
    });

    it('lanza 400 si la entrada es inválida', () => {
      expect(() => service.run('insertion-sort', 'abc')).toThrow(
        BadRequestException,
      );
      expect(() => service.run('insertion-sort', Array(51).fill(1))).toThrow(
        BadRequestException,
      );
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

    it('lanza 400 con menos de dos algoritmos o ids repetidos', () => {
      expect(() => service.compare(['insertion-sort'], [1])).toThrow(
        BadRequestException,
      );
      expect(() => service.compare('insertion-sort', [1])).toThrow(
        BadRequestException,
      );
      expect(() =>
        service.compare(['insertion-sort', 'insertion-sort'], [1]),
      ).toThrow(BadRequestException);
    });

    it('lanza 404 si algún id no existe', () => {
      expect(() =>
        service.compare(['insertion-sort', 'no-existe'], [1]),
      ).toThrow(NotFoundException);
    });
  });
});
