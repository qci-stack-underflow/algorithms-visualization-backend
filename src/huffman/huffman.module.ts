import { Module } from '@nestjs/common';
import { GutenbergClient } from '../books/gutenberg.client';
import { LocalBackupService } from '../books/local-backup.service';
import { RapidApiGutenbergClient } from '../books/rapidapi-gutenberg.client';
import { SecretsModule } from '../secrets/secrets.module';
import { HuffmanController } from './huffman.controller';
import { HuffmanService } from './huffman.service';

@Module({
  imports: [SecretsModule],
  controllers: [HuffmanController],
  providers: [
    HuffmanService,
    GutenbergClient,
    RapidApiGutenbergClient,
    {
      provide: LocalBackupService,
      useFactory: () => new LocalBackupService(),
    },
  ],
  exports: [HuffmanService],
})
export class HuffmanModule {}
