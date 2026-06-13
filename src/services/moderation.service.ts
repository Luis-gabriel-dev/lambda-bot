import { EmbedBuilder, Guild, GuildMember, PermissionFlagsBits, User } from 'discord.js';
import { Palette } from '../utils/embeds';
import { discordTimestamp } from '../utils/formatter';
import { sendLog } from './log.service';
import { warnPenaltyRepository } from '../repositories/warnPenalty.repository';
import { guildConfigRepository } from '../repositories/guildConfig.repository';

/**
 * Envia um embed na DM de um usuário/membro, aplicando a imagem padrão de DM do
 * servidor (se configurada via /dm). Silencioso se a DM estiver fechada.
 */
export async function sendGuildDM(target: User | GuildMember, guildId: string, embed: EmbedBuilder): Promise<void> {
  const config = await guildConfigRepository.get(guildId).catch(() => null);
  if (config?.dmImageUrl) embed.setImage(config.dmImageUrl);
  await target.send({ embeds: [embed] }).catch(() => undefined);
}

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

const DM_FOOTER = 'Feito com amor e carinho por Kuro ❤️';

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
    .setAuthor({ name: o.guildName, iconURL: o.guildIcon ?? undefined }) // ícone do servidor em círculo + nome
    .setTitle(`Você foi ${o.action}`)
    .addFields({ name: 'Motivo', value: o.reason }, { name: 'Quando', value: discordTimestamp(when, 'F') })
    .setFooter({ text: DM_FOOTER })
    .setTimestamp(when);

  if (o.guildIcon) embed.setThumbnail(o.guildIcon); // ícone do servidor em quadrado
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
    .setAuthor({ name: guildName, iconURL: guildIcon ?? undefined }) // ícone do servidor em círculo + nome
    .setTitle(opts.title)
    .setDescription(opts.description)
    .setFooter({ text: DM_FOOTER })
    .setTimestamp();
  if (guildIcon) embed.setThumbnail(guildIcon); // ícone do servidor em quadrado
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
    .setAuthor({ name: opts.guildName, iconURL: opts.guildIcon ?? undefined }) // ícone do servidor em círculo + nome
    .setTitle('Você recebeu uma advertência')
    .addFields(
      { name: 'Motivo', value: opts.reason },
      { name: 'Total de advertências', value: `**${total}**`, inline: true },
      { name: 'Situação', value: status },
      { name: '​', value: 'Evite quebrar as regras do servidor caso queira se manter nele.' }
    )
    .setFooter({ text: DM_FOOTER })
    .setTimestamp();
  if (opts.guildIcon) embed.setThumbnail(opts.guildIcon); // ícone do servidor em quadrado
  return embed;
}

/**
 * Aplica o escalonamento por advertências: ao atingir WARN_BAN_THRESHOLD → ban;
 * ao atingir exatamente WARN_MUTE_THRESHOLD → silenciamento de 1 dia + agenda reset.
 * Usado pelo /warn e pelo automod. Retorna um resumo do que foi aplicado, ou null.
 */
export async function escalateWarnings(guild: Guild, user: User, total: number): Promise<string | null> {
  const me = guild.members.me;
  const member = await guild.members.fetch(user.id).catch(() => null);

  if (total >= WARN_BAN_THRESHOLD) {
    if (!me?.permissions.has(PermissionFlagsBits.BanMembers) || (member && !member.bannable)) return null;
    const reason = `Acúmulo de ${total} advertências`;
    const dm = buildPunishmentDM({
      guildName: guild.name,
      guildIcon: guild.iconURL({ size: 256 }),
      action: 'banido',
      color: Palette.error,
      reason
    });
    await sendGuildDM(user, guild.id, dm);
    await guild.bans.create(user.id, { reason }); // guildBanAdd loga no #log-de-bans
    await warnPenaltyRepository.removeForUser(guild.id, user.id);
    return `atingiu ${total} advertências e foi **banido**`;
  }

  if (total === WARN_MUTE_THRESHOLD) {
    if (!member || !me?.permissions.has(PermissionFlagsBits.ModerateMembers) || !member.moderatable) return null;
    const reason = `Acúmulo de ${WARN_MUTE_THRESHOLD} advertências`;
    const muteEndsAt = new Date(Date.now() + WARN_MUTE_MS);
    const resetAt = new Date(muteEndsAt.getTime() + WARN_RESET_GRACE_MS);
    const dm = buildPunishmentDM({
      guildName: guild.name,
      guildIcon: guild.iconURL({ size: 256 }),
      action: 'silenciado',
      color: Palette.warning,
      reason,
      until: muteEndsAt,
      note:
        `Após o fim do silenciamento, você terá **7 dias** sem novas advertências para que elas sejam **zeradas**. ` +
        `Mas atenção: se receber **${WARN_MUTE_THRESHOLD}** advertências novamente, será **banido** do servidor.\n\n` +
        `Evite quebrar as regras do servidor caso queira se manter nele.`
    });
    await sendGuildDM(user, guild.id, dm);
    await member.timeout(WARN_MUTE_MS, reason);
    await warnPenaltyRepository.schedule(guild.id, user.id, muteEndsAt, resetAt);

    const logEmbed = new EmbedBuilder()
      .setColor(Palette.warning)
      .setTitle('🔇 Silenciado automaticamente')
      .setThumbnail(user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: 'Usuário', value: `${user} \`${user.tag}\``, inline: true },
        { name: 'Motivo', value: reason, inline: true },
        { name: 'Expira', value: discordTimestamp(muteEndsAt, 'R') }
      )
      .setTimestamp();
    await sendLog(guild, 'punicoes', logEmbed);
    return `atingiu ${total} advertências e foi **silenciado por 1 dia**`;
  }

  return null;
}
