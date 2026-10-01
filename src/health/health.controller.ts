import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller('checkhealth')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  checkHealth() {
    return this.healthService.goodState();
  }
}
