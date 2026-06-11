import { Ticket } from '@prisma/client';
import { prisma } from '../core/database';

/** Acesso aos tickets abertos (tabela Ticket). */
export const ticketRepository = {
  async create(guildId: string, channelId: string, openerId: string, type: string): Promise<Ticket> {
    return prisma.ticket.create({ data: { guildId, channelId, openerId, type } });
  },

  async getByChannel(channelId: string): Promise<Ticket | null> {
    return prisma.ticket.findUnique({ where: { channelId } });
  },

  /** Ticket aberto de um usuário no servidor (para impedir múltiplos). */
  async getOpenByUser(guildId: string, openerId: string): Promise<Ticket | null> {
    return prisma.ticket.findFirst({ where: { guildId, openerId } });
  },

  async deleteByChannel(channelId: string): Promise<void> {
    await prisma.ticket.deleteMany({ where: { channelId } });
  }
};
