import { Injectable } from '@nestjs/common';
import { runAlgorithm } from '@algorithm/util/algorithm.tracer';
import {
  AlgorithmDefinition,
  AlgorithmInfo,
  AlgorithmResult,
} from '@type/algorithm.types';
import { ALGORITHM_DEFINITIONS } from './utils/algorithms.registry';

@Injectable()
export class AlgorithmsService {
  private readonly definitions = new Map<string, AlgorithmDefinition>(
    ALGORITHM_DEFINITIONS.map((definition) => [definition.info.id, definition]),
  );

  /** Catálogo para GET /algorithms. */
  findAll(): AlgorithmInfo[] {
    return [...this.definitions.values()].map((definition) => definition.info);
  }

  /** Ficha de un algoritmo; 404 si el id no existe. */
  findOne(id: string): AlgorithmInfo {
    return this.getDefinition(id).info;
  }

  /** Ejecuta un algoritmo; 404 si el id no existe, 400 si la entrada es inválida. */
  run(id: string, input: unknown): AlgorithmResult {
    const definition = this.getDefinition(id);

    try {
      return runAlgorithm(definition, input);
    } catch (error) {
      if (error instanceof TypeError || error instanceof RangeError) {
        throw new Error(error.message, {
          cause: "bad-array"
        });
      }
      throw error;
    }
  }

  /** Ejecuta varios algoritmos, cada uno sobre su propia copia del mismo arreglo. */
  compare(ids: unknown, input: unknown): AlgorithmResult[] {
    if (
      !Array.isArray(ids) ||
      ids.length < 2 ||
      ids.some((id) => typeof id !== 'string')
    ) {
      throw new Error('At least two algorithm ids are required to compare.');
    }

    if (new Set(ids).size !== ids.length) {
      throw new Error('Algorithm ids cannot be repeated.');
    }

    const algorithmIds = ids as string[];
    algorithmIds.forEach((id) => this.getDefinition(id));

    return algorithmIds.map((id) => this.run(id, input));
  }

  private getDefinition(id: string): AlgorithmDefinition {
    const definition = this.definitions.get(id);
    if (!definition) {
      throw new Error(`Algorithm "${id}" does not exist.`, {
        cause: 'unknown-id',
      });
    }
    return definition;
  }
}
