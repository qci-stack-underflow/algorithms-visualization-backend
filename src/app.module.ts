import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { AlgorithmsModule } from './algorithms/algorithms.module';

@Module({
  imports: [HealthModule, AlgorithmsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
