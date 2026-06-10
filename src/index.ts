import { startBot } from './app';
import { logger } from './core/logger';

startBot().catch((err) => {
  logger.error('Falha ao iniciar o bot:', err);
  process.exit(1);
});
