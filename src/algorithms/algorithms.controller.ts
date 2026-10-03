import { Controller, Get } from '@nestjs/common';
import { AlgorithmsService } from './algorithms.service';


@Controller('algorithms')
export class AlgorithmsController {
  constructor(private readonly algorithmsService: AlgorithmsService) {}

  @Get()
  getAlgorithms() {
    return this.algorithmsService.findAll();
  }

}
