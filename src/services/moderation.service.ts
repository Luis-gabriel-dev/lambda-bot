import { EmbedBuilder, GuildMember } from 'discord.js';
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
export const WARN_MUTE_MS = 24 * 60 * 60 * 1000; // 1 dia

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
    .setTimestamp(when);

  if (o.guildIcon) embed.setThumbnail(o.guildIcon);
  if (o.until) {
    embed.addFields({ name: 'Expira', value: `${discordTimestamp(o.until, 'F')} (${discordTimestamp(o.until, 'R')})` });
  }
  if (o.note) embed.addFields({ name: '​', value: o.note });

  return embed;
}
