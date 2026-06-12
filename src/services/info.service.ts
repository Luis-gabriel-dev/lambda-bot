import { ChannelType, EmbedBuilder, Guild, GuildMember, User } from 'discord.js';
import { Palette } from '../utils/embeds';
import { discordTimestamp, truncate } from '../utils/formatter';

/** Embed com informações do servidor. */
export function buildServerInfoEmbed(guild: Guild): EmbedBuilder {
  const channels = guild.channels.cache;
  const text = channels.filter((c) => c.type === ChannelType.GuildText).size;
  const voice = channels.filter((c) => c.type === ChannelType.GuildVoice).size;

  return new EmbedBuilder()
    .setColor(Palette.info)
    .setTitle(guild.name)
    .setThumbnail(guild.iconURL({ size: 256 }))
    .addFields(
      { name: 'Dono', value: `<@${guild.ownerId}>`, inline: true },
      { name: 'ID', value: guild.id, inline: true },
      { name: 'Membros', value: `${guild.memberCount}`, inline: true },
      { name: 'Canais', value: `${channels.size} (💬 ${text} · 🔊 ${voice})`, inline: true },
      { name: 'Cargos', value: `${guild.roles.cache.size}`, inline: true },
      { name: 'Emojis', value: `${guild.emojis.cache.size}`, inline: true },
      { name: 'Boosts', value: `Nível ${guild.premiumTier} (${guild.premiumSubscriptionCount ?? 0})`, inline: true },
      { name: 'Criado em', value: `${discordTimestamp(guild.createdAt, 'D')} (${discordTimestamp(guild.createdAt, 'R')})` }
    );
}

/** Embed com informações de um usuário/membro. */
export function buildUserInfoEmbed(user: User, member: GuildMember | null): EmbedBuilder {
  const color = member && member.displayColor !== 0 ? member.displayColor : Palette.info;

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`Informações de ${user.username}`)
    .setThumbnail(user.displayAvatarURL({ size: 256 }))
    .addFields(
      { name: 'Usuário', value: `${user} \`${user.tag}\`` },
      { name: 'ID', value: user.id, inline: true },
      { name: 'Bot', value: user.bot ? 'Sim' : 'Não', inline: true },
      { name: 'Conta criada', value: `${discordTimestamp(user.createdAt, 'D')} (${discordTimestamp(user.createdAt, 'R')})` }
    );

  if (member) {
    if (member.joinedAt) {
      embed.addFields({
        name: 'Entrou no servidor',
        value: `${discordTimestamp(member.joinedAt, 'D')} (${discordTimestamp(member.joinedAt, 'R')})`
      });
    }
    const roles = [...member.roles.cache.values()]
      .filter((role) => role.id !== member.guild.id)
      .sort((a, b) => b.position - a.position);
    if (roles.length > 0) {
      embed.addFields(
        { name: 'Maior cargo', value: `${roles[0]}`, inline: true },
        { name: `Cargos (${roles.length})`, value: truncate(roles.join(' '), 1024) }
      );
    }
  }

  return embed;
}

/** Embed com o avatar de um usuário (prioriza o avatar do servidor). */
export function buildAvatarEmbed(user: User, member: GuildMember | null): EmbedBuilder {
  const target = member ?? user;
  const color = member && member.displayColor !== 0 ? member.displayColor : Palette.info;

  return new EmbedBuilder()
    .setColor(color)
    .setTitle(`Avatar de ${user.username}`)
    .setImage(target.displayAvatarURL({ size: 1024 }))
    .setDescription(
      `[png](${target.displayAvatarURL({ size: 1024, extension: 'png' })}) · ` +
        `[jpg](${target.displayAvatarURL({ size: 1024, extension: 'jpg' })}) · ` +
        `[webp](${target.displayAvatarURL({ size: 1024, extension: 'webp' })})`
    );
}
