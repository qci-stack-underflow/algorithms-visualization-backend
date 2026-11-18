import {
  Controller,
  Get,
  Post,
  Body,
  InternalServerErrorException,
  NotFoundException,
  Param,
  BadRequestException,
} from '@nestjs/common';
import { AlgorithmsService } from './algorithms.service';
import {
  ALGORITHM_IDS,
  AlgorithmId,
  type AlgorithmResult,
  type AlgorithmInfo,
} from '../types/algorithm.types';

const MAX_INPUT_LENGTH = 50;

const isAlgorithm = (id: unknown): id is AlgorithmId =>
  typeof id === 'string' && ALGORITHM_IDS.includes(id as AlgorithmId);

// El cuerpo llega sin tipo: se lee como un objeto de claves desconocidas.
const asRecord = (body: unknown): Record<string, unknown> | null =>
  typeof body === 'object' && body !== null
    ? (body as Record<string, unknown>)
    : null;

const isNumberArray = (value: unknown): value is number[] =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every((n) => typeof n === 'number' && Number.isFinite(n));

// Los errores del servicio llevan el motivo en `cause` (ver algorithms.service.ts).
const causeOf = (error: unknown): unknown =>
  error instanceof Error ? error.cause : undefined;

function checkInputLength(input: number[]): void {
  if (input.length > MAX_INPUT_LENGTH)
    throw new BadRequestException(
      `Array input is too big (up to ${MAX_INPUT_LENGTH}, sent ${input.length})`,
    );
}

@Controller('algorithms')
export class AlgorithmsController {
  constructor(private readonly algorithmsService: AlgorithmsService) {}

  @Get('/')
  findAll(): AlgorithmInfo[] {
    try {
      return this.algorithmsService.findAll();
    } catch {
      throw new InternalServerErrorException('Something went wrong.');
    }
  }

  @Get('/:id')
  findOne(@Param('id') id: string): AlgorithmInfo {
    if (!isAlgorithm(id))
      throw new NotFoundException(`Algorithm with id '${id}' does not exist.`);

    try {
      return this.algorithmsService.findOne(id);
    } catch {
      throw new InternalServerErrorException('Something went wrong.');
    }
  }

  @Post('/:id/run')
  executeAlgorithm(
    @Body() rawBody: unknown,
    @Param('id') id: string,
  ): AlgorithmResult {
    if (!isAlgorithm(id))
      throw new NotFoundException(`Algorithm with id '${id}' does not exist.`);

    const body = asRecord(rawBody);
    if (!body) throw new BadRequestException('Missing body');

    const input = body['input'];
    if (input === undefined)
      throw new BadRequestException('Array input is missing');

    if (!isNumberArray(input))
      throw new BadRequestException('Array input is bad-formatted');

    checkInputLength(input);

    try {
      return this.algorithmsService.run(id, input);
    } catch (error: unknown) {
      if (causeOf(error) === 'bad-array')
        throw new BadRequestException('Array input is bad-formatted');
      throw new InternalServerErrorException('Something went wrong');
    }
  }

  @Post('/compare')
  compareAlgorithms(@Body() rawBody: unknown): AlgorithmResult[] {
    const body = asRecord(rawBody);
    if (!body) throw new BadRequestException('Missing body.');

    const algorithms = body['algorithms'];
    const input = body['input'];
    if (algorithms === undefined || input === undefined)
      throw new BadRequestException('Algorithms or input are missing.');

    if (!Array.isArray(algorithms) || algorithms.length < 2)
      throw new BadRequestException(
        'Algorithms are bad-formatted or there are less than 2',
      );

    if (algorithms.some((algorithmId) => !isAlgorithm(algorithmId)))
      throw new NotFoundException(
        'There are one or more invalid algorithm ids',
      );

    if (!isNumberArray(input))
      throw new BadRequestException('input is bad-formatted');

    checkInputLength(input);

    try {
      return this.algorithmsService.compare(algorithms, input);
    } catch (error: unknown) {
      const cause = causeOf(error);
      if (cause === 'bad-ids')
        throw new BadRequestException('input is bad-formatted');
      if (cause === 'algorithms-repeat')
        throw new BadRequestException('There are repeated algorithms');
      throw new InternalServerErrorException('Something went wrong.');
    }
  }
}
