import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthService } from './health/health.service';
import { HealthController } from './health/health.controller';

@Module({
  imports: [],
  controllers: [AppController, HealthController],
  providers: [AppService, HealthService],
})
export class AppModule {}
