import { prisma } from '../core/database';

const HOUR_MS = 3_600_000;

export function currentHourBucket(): number {
  return Math.floor(Date.now() / HOUR_MS);
}

interface BufferedActivity {
  guildId: string;
  userId: string;
  hourBucket: number;
  count: number;
}

// Buffer em memória — gravado em lote pelo flush (evita 1 upsert por mensagem).
const buffer = new Map<string, BufferedActivity>();

/** Atividade de mensagens agregada por hora (tabela MessageActivity). */
export const messageActivityRepository = {
  /** Acumula +1 mensagem no buffer (sem tocar no banco). */
  record(guildId: string, userId: string): void {
    const hourBucket = currentHourBucket();
    const key = `${guildId}:${userId}:${hourBucket}`;
    const entry = buffer.get(key);
    if (entry) entry.count += 1;
    else buffer.set(key, { guildId, userId, hourBucket, count: 1 });
  },

  /** Grava o buffer acumulado no banco (chamado periodicamente). */
  async flush(): Promise<void> {
    if (buffer.size === 0) return;
    const entries = [...buffer.values()];
    buffer.clear();

    for (const e of entries) {
      await prisma.messageActivity
        .upsert({
          where: { guildId_userId_hourBucket: { guildId: e.guildId, userId: e.userId, hourBucket: e.hourBucket } },
          create: { guildId: e.guildId, userId: e.userId, hourBucket: e.hourBucket, count: e.count },
          update: { count: { increment: e.count } }
        })
        .catch(() => undefined);
    }
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
