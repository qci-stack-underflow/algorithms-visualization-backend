import { Injectable } from '@nestjs/common';

@Injectable()
export class HealthService {
  goodState() {
    return {
      code: 200,
      msg: 'Server running normally'
    };
  }
}
