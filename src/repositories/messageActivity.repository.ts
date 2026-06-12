import { prisma } from '../core/database';

const HOUR_MS = 3_600_000;

export function currentHourBucket(): number {
  return Math.floor(Date.now() / HOUR_MS);
}

/** Atividade de mensagens agregada por hora (tabela MessageActivity). */
export const messageActivityRepository = {
  /** Registra +1 mensagem do usuário no bucket da hora atual. */
  async record(guildId: string, userId: string): Promise<void> {
    const hourBucket = currentHourBucket();
    await prisma.messageActivity.upsert({
      where: { guildId_userId_hourBucket: { guildId, userId, hourBucket } },
      create: { guildId, userId, hourBucket, count: 1 },
      update: { count: { increment: 1 } }
    });
  },

  /** Total de mensagens do usuário a partir de um bucket (inclusive). */
  async countSince(guildId: string, userId: string, sinceHourBucket: number): Promise<number> {
    const result = await prisma.messageActivity.aggregate({
      _sum: { count: true },
      where: { guildId, userId, hourBucket: { gte: sinceHourBucket } }
    });
    return result._sum.count ?? 0;
  },

  /** Remove buckets mais antigos que o limite (manutenção). */
  async pruneOlderThan(beforeHourBucket: number): Promise<number> {
    const result = await prisma.messageActivity.deleteMany({ where: { hourBucket: { lt: beforeHourBucket } } });
    return result.count;
  }
};
