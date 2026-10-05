import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SecretsService } from './secrets/secrets.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const secrets = app.get(SecretsService);
  const port = secrets.PORT;

  app.enableCors();

  await app.listen(port, () => console.log(`listening app at port ${port}`));
  // await app.init();
  // return app.getHttpAdapter().getInstance();
}
bootstrap();
