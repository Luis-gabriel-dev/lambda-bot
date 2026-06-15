import { ShopRole } from '@prisma/client';
import { prisma } from '../core/database';

/** Acesso à loja de cargos (tabela ShopRole). */
export const shopRepository = {
  /** Adiciona o cargo à loja ou atualiza o preço/descrição se já existir. */
  async addRole(guildId: string, roleId: string, price: number, description: string | null): Promise<ShopRole> {
    return prisma.shopRole.upsert({
      where: { guildId_roleId: { guildId, roleId } },
      create: { guildId, roleId, price, description },
      update: { price, description }
    });
  },

  async removeRole(guildId: string, roleId: string): Promise<boolean> {
    const result = await prisma.shopRole.deleteMany({ where: { guildId, roleId } });
    return result.count > 0;
  },

  /** Cargos da loja, do mais barato ao mais caro. */
  async listRoles(guildId: string): Promise<ShopRole[]> {
    return prisma.shopRole.findMany({ where: { guildId }, orderBy: { price: 'asc' } });
  },

  async getRole(guildId: string, roleId: string): Promise<ShopRole | null> {
    return prisma.shopRole.findUnique({ where: { guildId_roleId: { guildId, roleId } } });
  }
};
