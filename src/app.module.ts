import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { AlgorithmsModule } from './algorithms/algorithms.module';
import { SecretsModule } from './secrets/secrets.module';
import { HuffmanModule } from './huffman/huffman.module';

@Module({
  imports: [HealthModule, AlgorithmsModule, SecretsModule, HuffmanModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
