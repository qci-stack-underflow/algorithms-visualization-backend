import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  let healthController: HealthController;

  beforeEach(async () => {
    const health: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [HealthService],
    }).compile();

    healthController = health.get<HealthController>(HealthController);
  });

  describe('ServerHealth', () => {
    it('Object with message and code reporting good state', () => {
      expect(healthController.checkHealth()).toEqual({
        code: 200,
        msg: 'Server running normally',
      });
    });
  });
});
