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

    // Conta nova (≤ 7 dias) → destaca o log em amarelo com aviso.
    const NEW_ACCOUNT_DAYS = 7;
    const ageMs = Date.now() - member.user.createdTimestamp;
    const ageDays = ageMs / 86_400_000;
    const isNew = ageDays <= NEW_ACCOUNT_DAYS;

    const embed = new EmbedBuilder()
      .setColor(isNew ? Palette.warning : Palette.success)
      .setTitle(isNew ? '📥 Membro entrou — 🆕 conta nova!' : '📥 Membro entrou')
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

    if (isNew) {
      const idade =
        ageDays >= 1
          ? `${Math.floor(ageDays)} dia(s)`
          : `${Math.max(1, Math.floor(ageMs / 3_600_000))} hora(s)`;
      embed.addFields({
        name: '⚠️ Atenção: conta recém-criada',
        value: `🆕 A conta tem só **${idade}** de criada. 👀 Possível conta nova/descartável — fique de olho.`
      });
    }

    await sendLog(member.guild, 'entrada', embed);
  }
};

export default event;
