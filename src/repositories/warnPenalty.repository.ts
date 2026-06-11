import { WarnPenalty } from '@prisma/client';
import { prisma } from '../core/database';

/** Acompanha o ciclo de penalidade por advertências (tabela WarnPenalty). */
export const warnPenaltyRepository = {
  /** Cria/atualiza a penalidade ao aplicar o mute por acúmulo de advertências. */
  async schedule(guildId: string, userId: string, muteEndsAt: Date, resetAt: Date): Promise<void> {
    await prisma.warnPenalty.upsert({
      where: { guildId_userId: { guildId, userId } },
      create: { guildId, userId, muteEndsAt, resetAt, muteEndNotified: false },
      update: { muteEndsAt, resetAt, muteEndNotified: false }
    });
  },

  /** Penalidades cujo mute já acabou mas o aviso ainda não foi enviado. */
  async dueMuteEnd(now: Date): Promise<WarnPenalty[]> {
    return prisma.warnPenalty.findMany({ where: { muteEndsAt: { lte: now }, muteEndNotified: false } });
  },

  async markMuteNotified(id: number): Promise<void> {
    await prisma.warnPenalty.update({ where: { id }, data: { muteEndNotified: true } });
  },

  /**
   * Reagenda a penalidade a partir de agora (usado quando um adm tira o mute manualmente):
   * o prazo de reset passa a contar do unmute. NÃO cria registro se não existir.
   * Retorna true se havia uma penalidade pendente (ou seja, era o mute automático).
   */
  async rescheduleFromNow(guildId: string, userId: string, muteEndsAt: Date, resetAt: Date): Promise<boolean> {
    const result = await prisma.warnPenalty.updateMany({
      where: { guildId, userId },
      data: { muteEndsAt, resetAt, muteEndNotified: false }
    });
    return result.count > 0;
  },

  /** Penalidades cujo prazo de reset (1 semana após o mute) já venceu. */
  async dueReset(now: Date): Promise<WarnPenalty[]> {
    return prisma.warnPenalty.findMany({ where: { resetAt: { lte: now } } });
  },

  async remove(id: number): Promise<void> {
    await prisma.warnPenalty.delete({ where: { id } }).catch(() => undefined);
  },

  /** Cancela a penalidade pendente de um usuário (ex.: advertências limpas manualmente). */
  async removeForUser(guildId: string, userId: string): Promise<void> {
    await prisma.warnPenalty.deleteMany({ where: { guildId, userId } });
  }
};
