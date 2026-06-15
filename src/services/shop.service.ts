import {
  ActionRowBuilder,
  EmbedBuilder,
  GuildMember,
  PermissionFlagsBits,
  StringSelectMenuBuilder
} from 'discord.js';
import { ShopRole, Wallet } from '@prisma/client';
import { shopRepository } from '../repositories/shop.repository';
import { economyRepository } from '../repositories/economy.repository';
import { errorEmbed } from '../utils/embeds';
import { truncate } from '../utils/formatter';
import { CURRENCY, GOLD } from './economy.service';

const n = (v: number) => v.toLocaleString('pt-BR');

export interface PurchaseResult {
  ok: boolean;
  embed: EmbedBuilder;
}

function fail(message: string): PurchaseResult {
  return { ok: false, embed: errorEmbed(message) };
}

/**
 * Compra segura de um cargo da loja. Valida loja/posse/hierarquia, debita de forma
 * atômica e, se a atribuição do cargo falhar, estorna os kurocoins.
 */
export async function purchaseRole(member: GuildMember, roleId: string): Promise<PurchaseResult> {
  const guild = member.guild;

  const shopRole = await shopRepository.getRole(guild.id, roleId);
  if (!shopRole) return fail('Esse cargo não está à venda.');

  if (member.roles.cache.has(roleId)) return fail('Você já tem esse cargo. 😉');

  const role = guild.roles.cache.get(roleId) ?? (await guild.roles.fetch(roleId).catch(() => null));
  if (!role) return fail('Esse cargo não existe mais no servidor. Avise um admin.');

  const me = guild.members.me;
  if (!me?.permissions.has(PermissionFlagsBits.ManageRoles) || role.position >= me.roles.highest.position) {
    return fail('Não consigo entregar esse cargo (hierarquia/permissão). Avise um admin.');
  }

  // Débito atômico — não cobra se faltar saldo (e nunca fica negativo).
  const { ok, balance } = await economyRepository.spend(guild.id, member.id, shopRole.price);
  if (!ok) {
    return fail(
      `Saldo insuficiente. Você tem **${n(balance)}** ${CURRENCY} e esse cargo custa **${n(shopRole.price)}**. ` +
        `Faltam **${n(shopRole.price - balance)}**.`
    );
  }

  try {
    await member.roles.add(roleId, 'Compra na loja de cargos');
  } catch {
    await economyRepository.giveBalance(guild.id, member.id, shopRole.price); // estorno
    return fail('Não consegui aplicar o cargo — seus kurocoins foram **devolvidos**. Avise um admin.');
  }

  return {
    ok: true,
    embed: new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle('🛒 Compra concluída!')
      .setDescription(`Você comprou <@&${roleId}> por **${n(shopRole.price)}** ${CURRENCY}.\n\n💰 Saldo atual: **${n(balance)}** ${CURRENCY}.`)
  };
}

/** Monta o painel da loja: embed com cargos + preços + saldo, e um menu de compra. */
export function buildShopPanel(
  member: GuildMember,
  wallet: Wallet,
  roles: ShopRole[]
): { embed: EmbedBuilder; components: ActionRowBuilder<StringSelectMenuBuilder>[] } {
  const embed = new EmbedBuilder()
    .setColor(GOLD)
    .setTitle('🛒 Loja de cargos')
    .setThumbnail(member.guild.iconURL({ size: 128 }) ?? null);

  if (roles.length === 0) {
    embed.setDescription('A loja está vazia no momento. Volte mais tarde! 🪙');
    embed.addFields({ name: '💰 Seu saldo', value: `**${n(wallet.balance)}** ${CURRENCY}` });
    return { embed, components: [] };
  }

  const lines = roles.map((r) => {
    const owned = member.roles.cache.has(r.roleId) ? '✅ ' : '';
    const head = `${owned}<@&${r.roleId}> • **${n(r.price)}** ${CURRENCY}`;
    return r.description ? `${head}\n${r.description}` : head;
  });
  embed.setDescription(lines.join('\n'));
  embed.addFields({ name: '💰 Seu saldo', value: `**${n(wallet.balance)}** ${CURRENCY}` });
  embed.setFooter({ text: 'Escolha um cargo no menu abaixo para comprar.' });

  // Só os cargos que o membro ainda não tem entram no menu (máx. 25).
  const buyable = roles.filter((r) => !member.roles.cache.has(r.roleId)).slice(0, 25);
  const components: ActionRowBuilder<StringSelectMenuBuilder>[] = [];
  if (buyable.length > 0) {
    const menu = new StringSelectMenuBuilder()
      .setCustomId('loja:buy')
      .setPlaceholder('Comprar um cargo...')
      .addOptions(
        buyable.map((r) => ({
          label: truncate(member.guild.roles.cache.get(r.roleId)?.name ?? `Cargo ${r.roleId}`, 100),
          description: truncate(`${n(r.price)} ${CURRENCY}${r.description ? ` — ${r.description}` : ''}`, 100),
          value: r.roleId
        }))
      );
    components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu));
  }

  return { embed, components };
}
