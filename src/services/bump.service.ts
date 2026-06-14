import { Message } from 'discord.js';
import { guildConfigRepository } from '../repositories/guildConfig.repository';
import { isOwner } from './permission.service';

/**
 * Canal exclusivo de /bump: apaga qualquer mensagem que não seja o comando.
 * Bots (ex.: respostas do Disboard), o dono e cargos liberados podem mandar qualquer coisa.
 * Retorna true se a mensagem era do canal de bump (consumida — não processar mais nada).
 */
export async function handleBumpChannel(message: Message): Promise<boolean> {
  if (!message.inGuild()) return false;

  const config = await guildConfigRepository.get(message.guildId);
  if (!config?.bumpChannelId || message.channelId !== config.bumpChannelId) return false;

  // Bots ficam liberados (a resposta do Disboard etc. precisa permanecer).
  if (message.author.bot) return true;

  // "/bump" digitado como texto é tolerado (o uso real é via slash e não gera mensagem).
  if (message.content.trim().toLowerCase() === '/bump') return true;

  const member = message.member ?? (await message.guild.members.fetch(message.author.id).catch(() => null));
  const exemptRoles = await guildConfigRepository.getBumpExemptRoleIds(message.guildId);
  const exempt =
    isOwner(message.author.id) ||
    message.author.id === message.guild.ownerId ||
    (exemptRoles.length > 0 && (member?.roles.cache.hasAny(...exemptRoles) ?? false));
  if (exempt) return true;

  // Não permitido → apaga e avisa rapidamente.
  await message.delete().catch(() => undefined);
  if (message.channel.isSendable()) {
    const notice = await message.channel.send(`${message.author}, aqui só vale **/bump**. 🚀`).catch(() => null);
    if (notice) setTimeout(() => void notice.delete().catch(() => undefined), 6_000);
  }
  return true;
}
