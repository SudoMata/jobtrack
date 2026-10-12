import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { EnvironmentVariables } from './config/environment-variables';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService<EnvironmentVariables, true>);

  // Number of reverse proxies in front of the API, so that rate limiting sees the real
  // client address. 0 locally; behind Render it is the verified number of hops.
  app.set('trust proxy', config.get('TRUST_PROXY_HOPS', { infer: true }));

  // Lets Nest run shutdown hooks (closing database connections) on SIGTERM,
  // which is what Render sends when it stops or redeploys the service.
  app.enableShutdownHooks();

  // Every route is served under /api (TECHNICAL_SPEC.md, section 19).
  app.setGlobalPrefix('api');

  await app.listen(config.get('PORT', { infer: true }));
}

void bootstrap();
