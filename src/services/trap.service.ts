import { EmbedBuilder, Message } from 'discord.js';
import { guildConfigRepository } from '../repositories/guildConfig.repository';
import { isOwner } from './permission.service';
import { sendGuildDM } from './moderation.service';
import { sendLog } from './log.service';
import { Palette } from '../utils/embeds';
import { truncate } from '../utils/formatter';

/**
 * Trata mensagens no canal-armadilha (/trap): quem não for isento leva kick na hora.
 * Retorna true se a mensagem era do canal-trap (consumida — não processar mais nada).
 */
export async function handleTrap(message: Message): Promise<boolean> {
  if (!message.inGuild()) return false;

  const config = await guildConfigRepository.get(message.guildId);
  if (!config?.trapChannelId || message.channelId !== config.trapChannelId) return false;

  // O próprio bot nunca é afetado.
  if (message.author.id === message.client.user.id) return true;

  const member = message.member ?? (await message.guild.members.fetch(message.author.id).catch(() => null));
  const exemptRoles = await guildConfigRepository.getTrapExemptRoleIds(message.guildId);
  const exempt =
    isOwner(message.author.id) ||
    message.author.id === message.guild.ownerId ||
    (exemptRoles.length > 0 && (member?.roles.cache.hasAny(...exemptRoles) ?? false));

  // Isentos podem usar o canal de brincadeira sem levar kick.
  if (exempt) return true;

  const reason = 'Caiu no canal-armadilha (anti-bot)';

  // 1) Avisa por DM antes do kick (mensagem-brincadeira).
  if (member) {
    const icon = message.guild.iconURL({ size: 256 });
    const dm = new EmbedBuilder()
      .setColor(Palette.error)
      .setAuthor({ name: message.guild.name, iconURL: icon ?? undefined }) // ícone do servidor em círculo
      .setTitle('Toma bot safado, te peguei haha 🪤')
      .setDescription(
        'Agora se você é um humano que tá lendo isso, bom, eu avisei…\n\n' +
          'Caso você tenha enviado a mensagem por acidente e queira entrar de novo no servidor, me adicione como amigo — meu user é **@kkuro01** — ou procure o servidor no site do **Disboard**, ou pesquise no Google: *"Servidor do Black Disboard"*.'
      )
      .setFooter({ text: 'Feito com amor e carinho por Kuro ❤️' })
      .setTimestamp();
    if (icon) dm.setThumbnail(icon); // ícone do servidor em quadrado
    await sendGuildDM(member, message.guildId, dm);
  }

  // 2) Apaga a mensagem.
  await message.delete().catch(() => undefined);

  // 3) Kick.
  let kicked = false;
  if (member?.kickable) {
    await member.kick(reason).catch(() => undefined);
    kicked = true;
  }

  // 4) Log.
  const log = new EmbedBuilder()
    .setColor(Palette.error)
    .setTitle('🪤 Trap: kick automático')
    .setThumbnail(message.author.displayAvatarURL({ size: 256 }))
    .addFields(
      { name: 'Usuário', value: `${message.author} \`${message.author.tag}\``, inline: true },
      { name: 'Ação', value: kicked ? 'expulso (kick)' : '⚠️ não consegui expulsar', inline: true },
      { name: 'Canal', value: `<#${message.channelId}>`, inline: true }
    )
    .setTimestamp();
  if (message.content?.trim()) log.addFields({ name: 'Mensagem', value: truncate(message.content, 1000) });
  await sendLog(message.guild, 'punicoes', log);

  return true;
}
