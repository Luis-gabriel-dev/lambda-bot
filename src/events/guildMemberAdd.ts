import { Client, EmbedBuilder, GuildMember, PermissionFlagsBits } from 'discord.js';
import { Event } from '../interfaces/Event';
import { Palette } from '../utils/embeds';
import { discordTimestamp } from '../utils/formatter';
import { sendLog } from '../services/log.service';
import { sendWelcome } from '../services/welcome.service';
import { guildConfigRepository } from '../repositories/guildConfig.repository';

/** Atribui o cargo automático (membro ou bot) configurado para o servidor. */
async function applyAutoRole(member: GuildMember): Promise<void> {
  const config = await guildConfigRepository.get(member.guild.id);
  const roleId = member.user.bot ? config?.botRoleId : config?.autoRoleId;
  if (!roleId) return;

  const me = member.guild.members.me;
  const role = member.guild.roles.cache.get(roleId);
  if (!role || !me?.permissions.has(PermissionFlagsBits.ManageRoles)) return;
  if (me.roles.highest.comparePositionTo(role) <= 0) return; // cargo acima do meu

  await member.roles.add(role).catch(() => undefined);
}

const event: Event<'guildMemberAdd'> = {
  name: 'guildMemberAdd',
  async execute(_client: Client, member) {
    await applyAutoRole(member);

    // Boas-vindas no canal público (separado do log de entrada abaixo).
    await sendWelcome(member);

    const embed = new EmbedBuilder()
      .setColor(Palette.success)
      .setTitle('📥 Membro entrou')
      .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: 'Usuário', value: `${member.user} \`${member.user.tag}\`` },
        { name: 'ID', value: member.id, inline: true },
        { name: 'Membro nº', value: `${member.guild.memberCount}`, inline: true },
        {
          name: 'Conta criada',
          value: `${discordTimestamp(member.user.createdAt, 'D')} (${discordTimestamp(member.user.createdAt, 'R')})`
        }
      )
      .setTimestamp();

    await sendLog(member.guild, 'entrada', embed);
  }
};

export default event;
