import { Drop, EconomyConfig, Wallet } from '@prisma/client';
import { prisma } from '../core/database';

export const economyRepository = {
  // ---- Config ----
  async getConfig(guildId: string): Promise<EconomyConfig | null> {
    return prisma.economyConfig.findUnique({ where: { guildId } });
  },

  async setChannel(guildId: string, channelId: string | null): Promise<void> {
    await prisma.economyConfig.upsert({
      where: { guildId },
      create: { guildId, dropChannelId: channelId },
      update: { dropChannelId: channelId }
    });
  },

  async setInterval(guildId: string, minutes: number): Promise<void> {
    await prisma.economyConfig.upsert({
      where: { guildId },
      create: { guildId, dropIntervalMinutes: minutes },
      update: { dropIntervalMinutes: minutes }
    });
  },

  async setValues(guildId: string, min: number, max: number): Promise<void> {
    await prisma.economyConfig.upsert({
      where: { guildId },
      create: { guildId, dropMin: min, dropMax: max },
      update: { dropMin: min, dropMax: max }
    });
  },

  async setExpireDelete(guildId: string, ms: number | null): Promise<void> {
    await prisma.economyConfig.upsert({
      where: { guildId },
      create: { guildId, expireDeleteMs: ms },
      update: { expireDeleteMs: ms }
    });
  },

  async setClaimedDelete(guildId: string, ms: number | null): Promise<void> {
    await prisma.economyConfig.upsert({
      where: { guildId },
      create: { guildId, claimedDeleteMs: ms },
      update: { claimedDeleteMs: ms }
    });
  },

  async markDropped(guildId: string, when: Date): Promise<void> {
    await prisma.economyConfig.update({ where: { guildId }, data: { lastDropAt: when } }).catch(() => undefined);
  },

  /** Configs com canal e intervalo definidos (candidatas a soltar drop). */
  async getActiveConfigs(): Promise<EconomyConfig[]> {
    return prisma.economyConfig.findMany({ where: { dropChannelId: { not: null }, dropIntervalMinutes: { not: null } } });
  },

  // ---- GIFs ----
  async addGif(guildId: string, url: string): Promise<void> {
    await prisma.economyGif.create({ data: { guildId, url } });
  },

  async removeGif(guildId: string, url: string): Promise<boolean> {
    const result = await prisma.economyGif.deleteMany({ where: { guildId, url } });
    return result.count > 0;
  },

  async listGifs(guildId: string): Promise<string[]> {
    const rows = await prisma.economyGif.findMany({ where: { guildId }, select: { url: true } });
    return rows.map((r) => r.url);
  },

  // ---- GIFs da caça-níquel (/slots) ----
  async addSlotGif(guildId: string, url: string): Promise<void> {
    await prisma.slotGif.create({ data: { guildId, url } });
  },

  async removeSlotGif(guildId: string, url: string): Promise<boolean> {
    const result = await prisma.slotGif.deleteMany({ where: { guildId, url } });
    return result.count > 0;
  },

  async listSlotGifs(guildId: string): Promise<string[]> {
    const rows = await prisma.slotGif.findMany({ where: { guildId }, select: { url: true } });
    return rows.map((r) => r.url);
  },

  /** Soma +1 às jogadas de /slots do membro e devolve o total (define a chance de vitória). */
  async bumpSlotsPlayed(guildId: string, userId: string): Promise<number> {
    const wallet = await prisma.wallet.upsert({
      where: { guildId_userId: { guildId, userId } },
      create: { guildId, userId, slotsPlayed: 1 },
      update: { slotsPlayed: { increment: 1 } }
    });
    return wallet.slotsPlayed;
  },

  /** Define (ou limpa) o tempo de auto-deleção da mensagem da caça-níquel. */
  async setSlotsDelete(guildId: string, ms: number | null): Promise<void> {
    await prisma.economyConfig.upsert({
      where: { guildId },
      create: { guildId, slotsDeleteMs: ms },
      update: { slotsDeleteMs: ms }
    });
  },

  // ---- Carteira ----
  async getWallet(guildId: string, userId: string): Promise<Wallet | null> {
    return prisma.wallet.findUnique({ where: { guildId_userId: { guildId, userId } } });
  },

  async getOrCreateWallet(guildId: string, userId: string): Promise<Wallet> {
    return prisma.wallet.upsert({
      where: { guildId_userId: { guildId, userId } },
      create: { guildId, userId },
      update: {}
    });
  },

  /** Credita uma coleta na carteira (cria se não existir). */
  async addCollected(guildId: string, userId: string, amount: number): Promise<Wallet> {
    return prisma.wallet.upsert({
      where: { guildId_userId: { guildId, userId } },
      create: { guildId, userId, balance: amount, totalCollected: amount, collectCount: 1 },
      update: {
        balance: { increment: amount },
        totalCollected: { increment: amount },
        collectCount: { increment: 1 }
      }
    });
  },

  /** Dá kurocoins direto na carteira (cria se não existir). */
  async giveBalance(guildId: string, userId: string, amount: number): Promise<Wallet> {
    return prisma.wallet.upsert({
      where: { guildId_userId: { guildId, userId } },
      create: { guildId, userId, balance: amount },
      update: { balance: { increment: amount } }
    });
  },

  /** Remove kurocoins da carteira, sem deixar o saldo ficar negativo. */
  async takeBalance(guildId: string, userId: string, amount: number): Promise<{ wallet: Wallet; removed: number }> {
    const current = await this.getOrCreateWallet(guildId, userId);
    const removed = Math.min(amount, current.balance);
    const wallet = await prisma.wallet.update({
      where: { guildId_userId: { guildId, userId } },
      data: { balance: { decrement: removed } }
    });
    return { wallet, removed };
  },

  /**
   * Debita kurocoins de forma atômica (para compras). Retorna ok=false sem alterar
   * nada se o saldo for insuficiente; senão debita e retorna o novo saldo.
   */
  async spend(guildId: string, userId: string, amount: number): Promise<{ ok: boolean; balance: number }> {
    return prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.upsert({
        where: { guildId_userId: { guildId, userId } },
        create: { guildId, userId },
        update: {}
      });
      if (wallet.balance < amount) return { ok: false, balance: wallet.balance };

      const updated = await tx.wallet.update({
        where: { guildId_userId: { guildId, userId } },
        data: { balance: { decrement: amount } }
      });
      return { ok: true, balance: updated.balance };
    });
  },

  /**
   * Transfere kurocoins de um membro para outro, de forma atômica. Retorna ok=false
   * (sem alterar nada) se o remetente não tiver saldo suficiente.
   */
  async transfer(
    guildId: string,
    fromId: string,
    toId: string,
    amount: number
  ): Promise<{ ok: boolean; fromBalance: number }> {
    return prisma.$transaction(async (tx) => {
      const from = await tx.wallet.upsert({
        where: { guildId_userId: { guildId, userId: fromId } },
        create: { guildId, userId: fromId },
        update: {}
      });
      if (from.balance < amount) return { ok: false, fromBalance: from.balance };

      const updatedFrom = await tx.wallet.update({
        where: { guildId_userId: { guildId, userId: fromId } },
        data: { balance: { decrement: amount } }
      });
      await tx.wallet.upsert({
        where: { guildId_userId: { guildId, userId: toId } },
        create: { guildId, userId: toId, balance: amount },
        update: { balance: { increment: amount } }
      });
      return { ok: true, fromBalance: updatedFrom.balance };
    });
  },

  /** Posição do usuário no ranking de saldo do servidor (1 = mais rico). */
  async getRank(guildId: string, balance: number): Promise<number> {
    const richer = await prisma.wallet.count({ where: { guildId, balance: { gt: balance } } });
    return richer + 1;
  },

  /** Quantidade de membros com saldo positivo (entram no ranking). Pode excluir um usuário (ex.: o dono fixado). */
  async countRanked(guildId: string, excludeUserId?: string): Promise<number> {
    return prisma.wallet.count({
      where: { guildId, balance: { gt: 0 }, ...(excludeUserId ? { userId: { not: excludeUserId } } : {}) }
    });
  },

  /** Página do ranking de saldo (maior primeiro). Pode excluir um usuário (ex.: o dono fixado). */
  async getTopWallets(guildId: string, skip: number, take: number, excludeUserId?: string): Promise<Wallet[]> {
    return prisma.wallet.findMany({
      where: { guildId, balance: { gt: 0 }, ...(excludeUserId ? { userId: { not: excludeUserId } } : {}) },
      orderBy: { balance: 'desc' },
      skip,
      take
    });
  },

  // ---- Drops ----
  async createDrop(guildId: string, channelId: string, messageId: string, amount: number): Promise<Drop> {
    return prisma.drop.create({ data: { guildId, channelId, messageId, amount } });
  },

  async getActiveDrop(guildId: string): Promise<Drop | null> {
    return prisma.drop.findFirst({
      where: { guildId, active: true, claimedById: null },
      orderBy: { createdAt: 'desc' }
    });
  },

  async getDropByMessage(messageId: string): Promise<Drop | null> {
    return prisma.drop.findUnique({ where: { messageId } });
  },

  /** Reivindica um drop de forma atômica. Retorna true se ESTE usuário pegou. */
  async claimDrop(dropId: number, userId: string): Promise<boolean> {
    const result = await prisma.drop.updateMany({
      where: { id: dropId, active: true, claimedById: null },
      data: { claimedById: userId, active: false }
    });
    return result.count === 1;
  },

  /** Desativa os drops ainda ativos de um servidor (ao soltar um novo). Retorna os desativados. */
  async deactivateDrops(guildId: string): Promise<Drop[]> {
    const drops = await prisma.drop.findMany({ where: { guildId, active: true } });
    if (drops.length > 0) await prisma.drop.updateMany({ where: { guildId, active: true }, data: { active: false } });
    return drops;
  }
};
