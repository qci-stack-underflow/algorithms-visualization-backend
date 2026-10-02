import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { runAlgorithm } from './algorithm.tracer';
import {
  AlgorithmDefinition,
  AlgorithmInfo,
  AlgorithmResult,
} from './algorithm.types';
import { ALGORITHM_DEFINITIONS } from './algorithms.registry';

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
        throw new BadRequestException(error.message);
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
      throw new BadRequestException(
        'At least two algorithm ids are required to compare.',
      );
    }

    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('Algorithm ids cannot be repeated.');
    }

    const algorithmIds = ids as string[];
    algorithmIds.forEach((id) => this.getDefinition(id));

    return algorithmIds.map((id) => this.run(id, input));
  }

  private getDefinition(id: string): AlgorithmDefinition {
    const definition = this.definitions.get(id);
    if (!definition) {
      throw new NotFoundException(`Algorithm "${id}" does not exist.`);
    }
    return definition;
  }
}
