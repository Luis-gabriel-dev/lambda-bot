import { EmbedBuilder, GuildMember } from 'discord.js';
import { guildConfigRepository } from '../repositories/guildConfig.repository';
import { discordTimestamp } from '../utils/formatter';

const GREEN = 0x57f287;

/**
 * Monta a mensagem de boas-vindas: o conteúdo menciona o membro (para notificá-lo)
 * e o embed traz o avatar circular (autor) + quadrado (thumbnail), nome, usuário,
 * hora de entrada e, se configurada, a imagem/gif fixa.
 */
export function buildWelcome(member: GuildMember, imageUrl?: string | null): { content: string; embed: EmbedBuilder } {
  const avatar = member.user.displayAvatarURL({ size: 256 });
  const joined = member.joinedAt ?? new Date();

  const embed = new EmbedBuilder()
    .setColor(GREEN)
    .setAuthor({ name: member.user.username, iconURL: avatar }) // avatar em círculo
    .setTitle(`Bem-vindo(a), ${member.displayName}! 🎉`)
    .setDescription(`${member} acabou de chegar no servidor. Sinta-se em casa! 🥳`)
    .setThumbnail(avatar) // avatar em quadrado
    .addFields(
      { name: 'Nome', value: member.displayName, inline: true },
      { name: 'Usuário', value: `@${member.user.username}`, inline: true },
      { name: 'Entrou', value: `${discordTimestamp(joined, 'F')} (${discordTimestamp(joined, 'R')})` }
    )
    .setFooter({ text: `Membro nº ${member.guild.memberCount}` })
    .setTimestamp(joined);

  if (imageUrl) embed.setImage(imageUrl);

  return { content: `${member}`, embed };
}

/** Publica a mensagem de boas-vindas no canal configurado (ignora bots). */
export async function sendWelcome(member: GuildMember): Promise<void> {
  if (member.user.bot) return;

  const config = await guildConfigRepository.get(member.guild.id);
  if (!config?.welcomeChannelId) return;

  const channel = await member.guild.channels.fetch(config.welcomeChannelId).catch(() => null);
  if (!channel?.isSendable()) return;

  const { content, embed } = buildWelcome(member, config.welcomeImageUrl);
  await channel
    .send({ content, embeds: [embed], allowedMentions: { users: [member.id] } })
    .catch(() => undefined);
}
