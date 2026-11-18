import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SecretsService {
  constructor(private readonly configService: ConfigService) {}

  get PORT(): number {
    const portStr = this.configService.get<string>('PORT', '3000');

    return parseInt(portStr);
  }

  get RAPID_API_KEY(): string {
    return this.configService.get<string>('RAPID_API_KEY', 'none');
  }

  get RAPID_API_URL(): string {
    return this.configService.get<string>('RAPID_API_URL', 'none');
  }
  get RAPID_API_HOST(): string {
    return this.configService.get<string>('RAPID_API_HOST', 'none');
  }
}
