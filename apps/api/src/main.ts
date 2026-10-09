import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { EnvironmentVariables } from './config/environment-variables';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService<EnvironmentVariables, true>);

  // Lets Nest run shutdown hooks (closing database connections) on SIGTERM,
  // which is what Render sends when it stops or redeploys the service.
  app.enableShutdownHooks();

  // Every route is served under /api (TECHNICAL_SPEC.md, section 19).
  app.setGlobalPrefix('api');

  await app.listen(config.get('PORT', { infer: true }));
}

void bootstrap();
