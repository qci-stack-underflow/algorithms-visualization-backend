import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  root(): string {
    return 'Algorithm runner ready to work. Check out docs.';
  }
}
