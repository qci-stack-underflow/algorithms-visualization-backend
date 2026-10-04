import { Module } from '@nestjs/common';
import { AlgorithmsService } from './algorithms.service';
import { AlgorithmsController } from './algorithms.controller';

@Module({
  controllers: [AlgorithmsController],
  providers: [AlgorithmsService],
  exports: [AlgorithmsService],
})
export class AlgorithmsModule {}
