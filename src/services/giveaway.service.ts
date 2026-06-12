import { ActionRowBuilder, ButtonBuilder, ButtonStyle, Client, EmbedBuilder } from 'discord.js';
import { Giveaway } from '@prisma/client';
import { giveawayRepository } from '../repositories/giveaway.repository';
import { Palette } from '../utils/embeds';

/** Sorteia `count` vencedores distintos a partir da lista de participantes. */
export function pickWinners(userIds: string[], count: number): string[] {
  const pool = [...userIds];
  const winners: string[] = [];
  while (winners.length < count && pool.length > 0) {
    const index = Math.floor(Math.random() * pool.length);
    winners.push(pool.splice(index, 1)[0]!);
  }
  return winners;
}

/** Formata a lista de vencedores em menções (ou texto de "ninguém"). */
export function formatWinners(winnerIds: string[]): string {
  return winnerIds.length > 0 ? winnerIds.map((id) => `<@${id}>`).join(', ') : 'ninguém participou';
}

/** Mensagem de parabéns com singular/plural conforme a quantidade de vencedores. */
export function winnerAnnouncement(winnerIds: string[], prize: string): string {
  const verb = winnerIds.length === 1 ? 'Você ganhou' : 'Vocês ganharam';
  return `🎉 Parabéns ${formatWinners(winnerIds)}! ${verb} **${prize}**!`;
}

/**
 * Encerra um sorteio: marca como encerrado, edita a mensagem (vencedores + botão
 * desativado) e anuncia no canal. Reusado pelo job e pelo /sorteio finalizar.
 * Retorna os vencedores sorteados.
 */
export async function endGiveaway(client: Client, giveaway: Giveaway): Promise<string[]> {
  await giveawayRepository.markEnded(giveaway.id);

  const guild = client.guilds.cache.get(giveaway.guildId);
  const channel = guild ? await guild.channels.fetch(giveaway.channelId).catch(() => null) : null;

  const entries = await giveawayRepository.getEntries(giveaway.id);
  const winners = pickWinners(entries, giveaway.winnerCount);

  if (channel?.isTextBased()) {
    const message = await channel.messages.fetch(giveaway.messageId).catch(() => null);
    if (message?.embeds[0]) {
      const embed = EmbedBuilder.from(message.embeds[0])
        .setColor(Palette.error)
        .setDescription(`${message.embeds[0].description ?? ''}\n\n🏆 **Vencedor(es):** ${formatWinners(winners)}`)
        .setFooter({ text: `${entries.length} participante(s) • Encerrado` });
      const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('sorteio:ended').setLabel('Sorteio encerrado').setStyle(ButtonStyle.Secondary).setDisabled(true)
      );
      await message.edit({ embeds: [embed], components: [disabledRow] }).catch(() => undefined);
    }

    if (winners.length > 0) {
      await channel.send(winnerAnnouncement(winners, giveaway.prize)).catch(() => undefined);
    } else {
      await channel.send(`O sorteio de **${giveaway.prize}** terminou, mas ninguém participou. 😢`).catch(() => undefined);
    }
  }

  return winners;
}
