import 'dotenv/config';
import { startRestServer } from '@/rest/rest-server';
import { LoggerService } from '@/shared/logger';

const logger = new LoggerService();
logger.setContext('Bootstrap');

async function bootstrap(): Promise<void> {
  const restPort = Number.parseInt(process.env.REST_PORT ?? '9090', 10);
  await startRestServer({ port: restPort });
}

void bootstrap().catch((error) => {
  logger.error('Failed to bootstrap services', error instanceof Error ? error.stack : error);
  process.exit(1);
});
