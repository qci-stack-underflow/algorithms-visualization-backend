import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SecretsService {
  constructor(private readonly configService: ConfigService) {}

  get PORT(): number {
    const portStr = this.configService.get<string>('PORT', '3000');

    return parseInt(portStr);
  }
}
