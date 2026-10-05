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

@Controller('algorithms')
export class AlgorithmsController {
  private readonly isAlgorithm: Function;

  constructor(private readonly algorithmsService: AlgorithmsService) {
    this.isAlgorithm = (id: string) =>
      ALGORITHM_IDS.includes(id as AlgorithmId);
  }

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
    if (!this.isAlgorithm(id))
      throw new NotFoundException(`Algorithm with id '${id}' does not exist.`);

    try {
      return this.algorithmsService.findOne(id);
    } catch (e: any) {
      throw new InternalServerErrorException('Something went wrong.');
    }
  }

  @Post('/:id/run')
  executeAlgorithm(
    @Body() body: any,
    @Param('id') id: string,
  ): AlgorithmResult {
    if (!this.isAlgorithm(id))
      throw new NotFoundException(`Algorithm with id '${id}' does not exist.`);

    if (!body) throw new BadRequestException('Missing body');

    if (body['input'] === undefined)
      throw new BadRequestException('Array input is missing');

    if (
      !Array.isArray(body['input']) ||
      body['input'].length <= 0 ||
      body['input'].some((n) => typeof n !== 'number' || !Number.isFinite(n))
    )
      throw new BadRequestException('Array input is bad-formatted');

    if (body['input'].length > 50)
      throw new BadRequestException(
        `Array input is too big (up to 50, sent ${body['input'].length})`,
      );
    try {
      return this.algorithmsService.run(id, body['input']);
    } catch (e: any) {
      if (e['cause'] === 'bad-array')
        throw new BadRequestException('Array input is bad-formatted');
      else throw new InternalServerErrorException('Something went wrong');
    }
  }

  @Post('/compare')
  compareAlgorithms(@Body() body: any): AlgorithmResult[] {
    if (!body) throw new BadRequestException('Missing body.');

    if (body['algorithms'] === undefined || body['input'] === undefined)
      throw new BadRequestException('Algorithms or input are missing.');

    if (!Array.isArray(body['algorithms']) || body['algorithms'].length < 2)
      throw new BadRequestException(
        'Algorithms are bad-formatted or there are less than 2',
      );

    if (body['algorithms'].some((id) => !this.isAlgorithm(id)))
      throw new NotFoundException(
        'There are one or more invalid algorithm ids',
      );

    if (
      !Array.isArray(body['input']) ||
      body['input'].length <= 0 ||
      body['input'].some((n) => typeof n !== 'number' || !Number.isFinite(n))
    )
      throw new BadRequestException('input is bad-formatted');

    if (body['input'].length > 50)
      throw new BadRequestException(
        `Array input is too big (up to 50, sent ${body['input'].length})`,
      );

    try {
      return this.algorithmsService.compare(body['algorithms'], body['input']);
    } catch (e: any) {
      if (e['cause'] == 'bad-ids')
        throw new BadRequestException('input is bad-formatted');
      else if (e['cause'] == 'algorithms-repeat')
        throw new BadRequestException('There are repeated algorithms');
      else throw new InternalServerErrorException('Something went wrong.');
    }
  }
}
