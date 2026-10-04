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
} from '@type/algorithm.types';

@Controller('algorithms')
export class AlgorithmsController {
  private readonly isAlgorithm: Function;

  constructor(private readonly algorithmsService: AlgorithmsService) {
    this.isAlgorithm = (id: string) =>
      ALGORITHM_IDS.includes(id as AlgorithmId);
  }

  @Get('/')
  findAll(): AlgorithmInfo[] {
    return this.algorithmsService.findAll();
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
      throw new NotFoundException(
        `Algorithm with id '${id}' does not exist.`,
      );

    if (!body) throw new BadRequestException('Missing body');

    if (body['input'] === undefined)
      throw new BadRequestException('Array input is missing');

    
    try {

      return this.algorithmsService.run(id, body['input']);
    } catch (e: any) {
      if (e["cause"] === "bad-array" )
        throw new BadRequestException("Array input is bad-formatted")
      else
        throw new InternalServerErrorException("Something went wrong")
    }
  }
}
