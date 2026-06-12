import { Giveaway } from '@prisma/client';
import { prisma } from '../core/database';

export interface CreateGiveawayInput {
  guildId: string;
  channelId: string;
  messageId: string;
  prize: string;
  winnerCount: number;
  hostId: string;
  endsAt: Date;
  excludeRoleId?: string | null;
  blockNitro?: boolean;
  minMessages?: number | null;
  messageWindowHours?: number | null;
  requirement?: string | null;
}

/** Acesso aos sorteios e participações (tabelas Giveaway / GiveawayEntry). */
export const giveawayRepository = {
  async create(data: CreateGiveawayInput): Promise<Giveaway> {
    return prisma.giveaway.create({ data });
  },

  async getByMessage(messageId: string): Promise<Giveaway | null> {
    return prisma.giveaway.findUnique({ where: { messageId } });
  },

  /** Alterna a participação de um usuário. Retorna se entrou e o total atual. */
  async toggleEntry(giveawayId: number, userId: string): Promise<{ joined: boolean; count: number }> {
    const existing = await prisma.giveawayEntry.findUnique({ where: { giveawayId_userId: { giveawayId, userId } } });
    if (existing) {
      await prisma.giveawayEntry.delete({ where: { id: existing.id } });
    } else {
      await prisma.giveawayEntry.create({ data: { giveawayId, userId } });
    }
    const count = await prisma.giveawayEntry.count({ where: { giveawayId } });
    return { joined: !existing, count };
  },

  async getEntries(giveawayId: number): Promise<string[]> {
    const rows = await prisma.giveawayEntry.findMany({ where: { giveawayId }, select: { userId: true } });
    return rows.map((r) => r.userId);
  },

  async hasEntry(giveawayId: number, userId: string): Promise<boolean> {
    const entry = await prisma.giveawayEntry.findUnique({ where: { giveawayId_userId: { giveawayId, userId } } });
    return entry !== null;
  },

  /** Sorteios já vencidos e ainda não encerrados. */
  async dueGiveaways(now: Date): Promise<Giveaway[]> {
    return prisma.giveaway.findMany({ where: { ended: false, endsAt: { lte: now } } });
  },

  async markEnded(id: number): Promise<void> {
    await prisma.giveaway.update({ where: { id }, data: { ended: true } });
  }
};
