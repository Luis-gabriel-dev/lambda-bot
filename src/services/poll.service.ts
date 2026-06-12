import { ActionRowBuilder, ButtonBuilder, ButtonStyle, Client, EmbedBuilder } from 'discord.js';
import { Palette } from '../utils/embeds';
import { discordTimestamp, truncate } from '../utils/formatter';
import { pollRepository, PollWithOptions } from '../repositories/poll.repository';

const BAR_LENGTH = 12;

interface PollData {
  question: string;
  color: number | null;
  imageUrl: string | null;
  closed: boolean;
  endsAt?: Date | null;
}

interface PollOptionData {
  idx: number;
  text: string;
}

/** Monta o embed (com barras de %) e os botões (com contagem) da enquete. */
export function renderPoll(
  poll: PollData,
  options: PollOptionData[],
  counts: Map<number, number>
): { embeds: EmbedBuilder[]; components: ActionRowBuilder<ButtonBuilder>[] } {
  const sorted = [...options].sort((a, b) => a.idx - b.idx);
  const total = [...counts.values()].reduce((a, b) => a + b, 0);

  const lines = sorted.map((opt) => {
    const count = counts.get(opt.idx) ?? 0;
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    const filled = total > 0 ? Math.round((count / total) * BAR_LENGTH) : 0;
    const bar = '█'.repeat(filled) + '░'.repeat(BAR_LENGTH - filled);
    return `**${opt.text}**\n\`${bar}\` ${pct}% (${count})`;
  });

  let description = lines.join('\n\n');
  if (!poll.closed && poll.endsAt) description += `\n\n⏰ **Encerra:** ${discordTimestamp(poll.endsAt, 'R')}`;

  const embed = new EmbedBuilder()
    .setColor(poll.color ?? Palette.info)
    .setTitle(`📊 ${poll.question}`)
    .setDescription(description)
    .setFooter({ text: poll.closed ? `Enquete encerrada • ${total} voto(s)` : `${total} voto(s) • clique para votar` });
  if (poll.imageUrl) embed.setImage(poll.imageUrl);

  const buttons = sorted.map((opt) =>
    new ButtonBuilder()
      .setCustomId(`enquete:vote:${opt.idx}`)
      .setLabel(truncate(`${opt.text} (${counts.get(opt.idx) ?? 0})`, 80))
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(poll.closed)
  );

  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let i = 0; i < buttons.length; i += 5) {
    rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(buttons.slice(i, i + 5)));
  }

  return { embeds: [embed], components: rows };
}

/** Encerra a enquete: marca fechada (+ agenda exclusão se configurado) e atualiza a mensagem. */
export async function closePoll(client: Client, poll: PollWithOptions): Promise<void> {
  const deleteAt = poll.deleteAfterMs ? new Date(Date.now() + poll.deleteAfterMs) : null;
  await pollRepository.close(poll.id, deleteAt);

  const counts = await pollRepository.counts(poll.id);
  const guild = client.guilds.cache.get(poll.guildId);
  const channel = guild ? await guild.channels.fetch(poll.channelId).catch(() => null) : null;
  if (channel?.isTextBased()) {
    const message = await channel.messages.fetch(poll.messageId).catch(() => null);
    await message?.edit(renderPoll({ ...poll, closed: true }, poll.options, counts)).catch(() => undefined);
  }
}

/** Apaga a mensagem da enquete e o registro. */
export async function deletePoll(
  client: Client,
  poll: { id: number; guildId: string; channelId: string; messageId: string }
): Promise<void> {
  const guild = client.guilds.cache.get(poll.guildId);
  const channel = guild ? await guild.channels.fetch(poll.channelId).catch(() => null) : null;
  if (channel?.isTextBased()) {
    const message = await channel.messages.fetch(poll.messageId).catch(() => null);
    await message?.delete().catch(() => undefined);
  }
  await pollRepository.delete(poll.id);
}
