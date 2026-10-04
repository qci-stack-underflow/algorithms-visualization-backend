import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SecretsService {
  constructor(private readonly configService: ConfigService) {}

  get PORT(): number {
    return this.configService.get<number>('PORT', 3000)
  }
}
