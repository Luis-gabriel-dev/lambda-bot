import { EmbedBuilder, GuildMember } from 'discord.js';
import { Palette } from '../utils/embeds';
import { discordTimestamp } from '../utils/formatter';

/**
 * Valida se `executor` pode moderar `target` pela hierarquia de cargos
 * (não considera as permissões do bot — isso é checado via member.bannable/kickable).
 *
 * Retorna uma mensagem de erro (em PT) se a ação não for permitida, ou null se estiver tudo certo.
 */
export function checkHierarchy(executor: GuildMember, target: GuildMember): string | null {
  if (target.id === executor.id) {
    return 'Você não pode usar este comando em si mesmo.';
  }
  if (target.id === executor.guild.ownerId) {
    return 'Não é possível moderar o dono do servidor.';
  }
  const executorIsOwner = executor.id === executor.guild.ownerId;
  if (!executorIsOwner && executor.roles.highest.comparePositionTo(target.roles.highest) <= 0) {
    return 'Esse membro tem um cargo igual ou superior ao seu.';
  }
  return null;
}

// ---- Escalonamento automático por advertências ----
export const WARN_MUTE_THRESHOLD = 4;
export const WARN_BAN_THRESHOLD = 8;
export const WARN_MUTE_MS = 24 * 60 * 60 * 1000; // 1 dia de silenciamento
export const WARN_RESET_GRACE_MS = 7 * 24 * 60 * 60 * 1000; // 1 semana após o mute para zerar

const STAFF_FOOTER = 'Staff do Servidor';

export interface PunishmentDmOptions {
  guildName: string;
  guildIcon: string | null;
  /** Particípio da ação: 'banido', 'silenciado', 'advertido', 'expulso', 'desmutado'. */
  action: string;
  color: number;
  reason: string;
  appliedAt?: Date;
  /** Para punições temporárias (mute), quando expira. */
  until?: Date | null;
  /** Texto extra (ex.: aviso de escalonamento). */
  note?: string;
}

/** Monta o embed enviado na DM da pessoa punida (com ícone do servidor, hora e expiração). */
export function buildPunishmentDM(o: PunishmentDmOptions): EmbedBuilder {
  const when = o.appliedAt ?? new Date();
  const embed = new EmbedBuilder()
    .setColor(o.color)
    .setTitle(`Você foi ${o.action} em ${o.guildName}`)
    .addFields({ name: 'Motivo', value: o.reason }, { name: 'Quando', value: discordTimestamp(when, 'F') })
    .setFooter({ text: STAFF_FOOTER, iconURL: o.guildIcon ?? undefined })
    .setTimestamp(when);

  if (o.guildIcon) embed.setThumbnail(o.guildIcon);
  if (o.until) {
    embed.addFields({ name: 'Expira', value: `${discordTimestamp(o.until, 'F')} (${discordTimestamp(o.until, 'R')})` });
  }
  if (o.note) embed.addFields({ name: '​', value: o.note });

  return embed;
}

/** Embed genérico assinado pela "Staff do Servidor" (avisos do sistema na DM). */
export function buildStaffEmbed(
  guildName: string,
  guildIcon: string | null,
  opts: { title: string; description: string; color: number }
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(opts.color)
    .setTitle(opts.title)
    .setDescription(opts.description)
    .setFooter({ text: STAFF_FOOTER, iconURL: guildIcon ?? undefined })
    .setTimestamp();
  if (guildIcon) embed.setThumbnail(guildIcon);
  return embed;
}

/** DM enviada ao receber uma advertência, mostrando o estado atual e o que falta. */
export function buildWarnDM(opts: { guildName: string; guildIcon: string | null; reason: string; total: number }): EmbedBuilder {
  const { total } = opts;

  let status: string;
  if (total >= WARN_BAN_THRESHOLD) {
    status = 'Você atingiu o limite de advertências e será **banido**.';
  } else if (total >= WARN_MUTE_THRESHOLD) {
    status = `Faltam **${WARN_BAN_THRESHOLD - total}** advertência(s) para o **banimento**.`;
  } else {
    status =
      `Faltam **${WARN_MUTE_THRESHOLD - total}** advertência(s) para um **silenciamento de 1 dia** ` +
      `e **${WARN_BAN_THRESHOLD - total}** para o **banimento**.`;
  }

  const embed = new EmbedBuilder()
    .setColor(Palette.warning)
    .setTitle(`Você recebeu uma advertência em ${opts.guildName}`)
    .addFields(
      { name: 'Motivo', value: opts.reason },
      { name: 'Total de advertências', value: `**${total}**`, inline: true },
      { name: 'Situação', value: status },
      { name: '​', value: 'Evite quebrar as regras do servidor caso queira se manter nele.' }
    )
    .setFooter({ text: STAFF_FOOTER, iconURL: opts.guildIcon ?? undefined })
    .setTimestamp();
  if (opts.guildIcon) embed.setThumbnail(opts.guildIcon);
  return embed;
}
