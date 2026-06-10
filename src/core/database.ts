import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

/** Instância única do Prisma Client compartilhada por toda a aplicação. */
export const prisma = new PrismaClient();

/** Conecta ao banco (opcional: o Prisma conecta sob demanda na primeira query). */
export async function connectDatabase(): Promise<void> {
  await prisma.$connect();
  logger.success('Banco de dados conectado.');
}

/** Encerra a conexão de forma limpa no shutdown. */
export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}
