import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  Client,
  ContainerBuilder,
  EmbedBuilder,
  MessageFlags,
  SectionBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
  ThumbnailBuilder,
  User
} from 'discord.js';
import { EconomyConfig, Wallet } from '@prisma/client';
import { economyRepository } from '../repositories/economy.repository';
import { errorEmbed } from '../utils/embeds';
import { discordTimestamp } from '../utils/formatter';
import { config } from '../core/config';
import { isOwner } from './permission.service';

export const CURRENCY = 'kurocoins';
export const GOLD = 0xf1c40f;

// "Mistério": os números do dono do bot ficam escondidos no público (revela só em /kuro).
const MASK_AMOUNT = '???';
const MASK_COUNT = '?';

// Mensagens por faixa de valor (use {n} para a quantia).
const LOW_MESSAGES = [
  'Eita... só **{n}** kurocoins. Melhor que nada, né? 😕',
  '**{n}** kurocoins... a economia tá osso. 😮‍💨',
  'Você pegou **{n}** kurocoins. Dá pra um chiclete. 🫠'
];
const MEDIUM_MESSAGES = [
  'Boa! Você coletou **{n}** kurocoins! 😎',
  '**{n}** kurocoins no bolso! Tá indo bem. 💪',
  'Nada mal — **{n}** kurocoins pra você! 😄'
];
const HIGH_MESSAGES = [
  'JACKPOT! 🤑 Você abocanhou **{n}** kurocoins!! 🎉',
  'VOCÊ FICOU RICO! 💰🔥 **{n}** kurocoins de uma vez!!',
  'CARAMBA! **{n}** kurocoins!! Tá voando! 🚀'
];

/**
 * Sorteia o valor de um drop com viés forte para valores baixos: valores altos
 * (perto do máximo) são bem mais raros. Usa uma curva de potência (expoente 3).
 */
function weightedAmount(min: number, max: number): number {
  if (max <= min) return min;
  const r = Math.pow(Math.random(), 3);
  return Math.round(min + (max - min) * r);
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

/** Mensagem especial conforme a faixa do valor coletado. */
export function getCollectMessage(amount: number, min: number, max: number): string {
  const range = Math.max(1, max - min);
  const ratio = (amount - min) / range;
  const pool = ratio < 1 / 3 ? LOW_MESSAGES : ratio < 2 / 3 ? MEDIUM_MESSAGES : HIGH_MESSAGES;
  return pick(pool).replace('{n}', `${amount}`);
}

export function buildDropEmbed(amount: number, gifUrl: string | null): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(GOLD)
    .setTitle('💰 Apareceu dinheiro!')
    .setDescription(
      `**${amount} ${CURRENCY}** caíram aqui!\n\nAperte **Coletar** para pegar os kurocoins — rápido, antes que peguem! 🏃💨`
    )
    .setTimestamp();
  if (gifUrl) embed.setImage(gifUrl);
  return embed;
}

/** Botão "Coletar" anexado ao embed do drop. */
export function buildCollectRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('eco:collect').setLabel('Coletar').setEmoji('💰').setStyle(ButtonStyle.Success)
  );
}

export function buildClaimedEmbed(userTag: string, amount: number): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle('💸 Coletado!')
    .setDescription(`**${amount} ${CURRENCY}** foram coletados por **${userTag}**. 🏆`)
    .setTimestamp();
}

export function buildProfileEmbed(user: User, wallet: Wallet, rank: number): EmbedBuilder {
  const masked = isOwner(user.id); // o dono é um mistério no público
  return new EmbedBuilder()
    .setColor(GOLD)
    .setTitle(`Perfil de ${user.username}`)
    .setThumbnail(user.displayAvatarURL({ size: 256 }))
    .addFields(
      { name: '💰 Saldo', value: masked ? `**${MASK_AMOUNT}** ${CURRENCY}` : `**${wallet.balance}** ${CURRENCY}`, inline: true },
      { name: '🏆 Ranking', value: masked ? '👑' : `#${rank}`, inline: true },
      { name: '🔢 Coletas', value: masked ? MASK_COUNT : `${wallet.collectCount}`, inline: true },
      { name: '📥 Total coletado', value: masked ? `${MASK_AMOUNT} ${CURRENCY}` : `${wallet.totalCollected} ${CURRENCY}`, inline: true },
      { name: '📅 Perfil criado', value: discordTimestamp(wallet.createdAt, 'D'), inline: true }
    );
}

/**
 * Solta um novo drop no canal configurado (usado pelo job e pelo /economia forcar).
 * Se `fixedAmount` for informado (> 0), usa essa quantia; senão sorteia com viés p/ baixo.
 */
export async function postDrop(client: Client, config: EconomyConfig, fixedAmount?: number): Promise<boolean> {
  if (!config.dropChannelId) return false;
  const guild = client.guilds.cache.get(config.guildId);
  const channel = guild ? await guild.channels.fetch(config.dropChannelId).catch(() => null) : null;
  if (!channel?.isSendable()) return false;

  // Expira drops anteriores não coletados.
  for (const old of await economyRepository.deactivateDrops(config.guildId)) {
    const ch = await guild!.channels.fetch(old.channelId).catch(() => null);
    if (ch?.isTextBased()) {
      const msg = await ch.messages.fetch(old.messageId).catch(() => null);
      if (msg?.embeds[0]) {
        await msg
          .edit({
            embeds: [
              EmbedBuilder.from(msg.embeds[0])
                .setColor(0x95a5a6)
                .setTitle('💸 O dinheiro sumiu...')
                .setDescription('Ninguém coletou a tempo. 😴')
            ],
            components: []
          })
          .catch(() => undefined);

        // Auto-deleta a mensagem de "ninguém coletou" após o tempo configurado.
        if (config.expireDeleteMs && config.expireDeleteMs > 0) {
          setTimeout(() => void msg.delete().catch(() => undefined), config.expireDeleteMs);
        }
      }
    }
  }

  const amount = fixedAmount && fixedAmount > 0 ? fixedAmount : weightedAmount(config.dropMin, config.dropMax);
  const gifs = await economyRepository.listGifs(config.guildId);
  const gif = gifs.length > 0 ? pick(gifs) : null;

  const message = await channel.send({ embeds: [buildDropEmbed(amount, gif)], components: [buildCollectRow()] }).catch(() => null);
  if (!message) return false;

  await economyRepository.createDrop(config.guildId, config.dropChannelId, message.id, amount);
  await economyRepository.markDropped(config.guildId, new Date());
  return true;
}

// ---- Ranking (Components V2: avatar por linha) ----

const RANK_PAGE_SIZE = 8;
const DEFAULT_AVATAR = 'https://cdn.discordapp.com/embed/avatars/0.png';

/** Monta o container do ranking para uma página. Retorna null se ninguém tem saldo. */
async function buildRankingContainer(
  client: Client,
  guildId: string,
  page: number
): Promise<{ container: ContainerBuilder; page: number } | null> {
  // O dono fica sempre no topo (#1), com os números escondidos. Só é fixado se estiver no servidor.
  const ownerId = config.ownerId;
  const guild = client.guilds.cache.get(guildId);
  const ownerMember = guild ? await guild.members.fetch(ownerId).catch(() => null) : null;
  const pinOwner = !!ownerMember;

  const total = await economyRepository.countRanked(guildId, pinOwner ? ownerId : undefined);
  if (total === 0 && !pinOwner) return null;

  const totalPages = Math.max(1, Math.ceil(total / RANK_PAGE_SIZE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const wallets = await economyRepository.getTopWallets(guildId, safePage * RANK_PAGE_SIZE, RANK_PAGE_SIZE, pinOwner ? ownerId : undefined);

  const container = new ContainerBuilder().setAccentColor(GOLD);
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `## 🏆 Ranking de ${CURRENCY}\nPágina ${safePage + 1}/${totalPages} • ${total + (pinOwner ? 1 : 0)} no ranking`
    )
  );

  // Fixa o dono como #1 (mascarado) só na primeira página.
  if (pinOwner && ownerMember && safePage === 0) {
    const avatar = ownerMember.displayAvatarURL({ size: 128, extension: 'png' }) ?? DEFAULT_AVATAR;
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
    container.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`**🥇** <@${ownerId}> 👑\n💰 **${MASK_AMOUNT}** ${CURRENCY} • ${MASK_COUNT} coleta(s)`)
        )
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(avatar))
    );
  }

  let rank = safePage * RANK_PAGE_SIZE;
  for (const wallet of wallets) {
    rank++;
    const displayRank = pinOwner ? rank + 1 : rank; // o dono ocupa o #1
    const user = await client.users.fetch(wallet.userId).catch(() => null);
    const name = user ? `<@${wallet.userId}>` : `Usuário desconhecido`;
    const medal = displayRank === 1 ? '🥇' : displayRank === 2 ? '🥈' : displayRank === 3 ? '🥉' : `#${displayRank}`;
    const avatar = user?.displayAvatarURL({ size: 128, extension: 'png' }) ?? DEFAULT_AVATAR;

    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
    container.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `**${medal}** ${name}\n💰 **${wallet.balance.toLocaleString('pt-BR')}** ${CURRENCY} • ${wallet.collectCount} coleta(s)`
          )
        )
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(avatar))
    );
  }

  if (totalPages > 1) {
    container.addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`ecorank:page:${safePage - 1}`)
          .setLabel('Anterior')
          .setEmoji('◀️')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(safePage === 0),
        new ButtonBuilder()
          .setCustomId(`ecorank:page:${safePage + 1}`)
          .setLabel('Próximo')
          .setEmoji('▶️')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(safePage >= totalPages - 1)
      )
    );
  }

  return { container, page: safePage };
}

/** Abre o ranking (efêmero e paginado por quem chamou). */
export async function showRanking(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.inCachedGuild()) {
    await interaction.reply({ embeds: [errorEmbed('Este comando só pode ser usado em um servidor.')], flags: MessageFlags.Ephemeral });
    return;
  }

  const built = await buildRankingContainer(interaction.client, interaction.guildId, 0);
  if (!built) {
    await interaction.reply({ embeds: [errorEmbed(`Ninguém coletou ${CURRENCY} ainda. Seja o primeiro! 💰`)], flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.reply({ components: [built.container], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
}

/** Paginação do ranking (botões Anterior/Próximo). */
export async function handleRankPage(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.inCachedGuild()) return;

  const page = Number(interaction.customId.split(':')[2] ?? '0');
  const built = await buildRankingContainer(interaction.client, interaction.guildId, Number.isNaN(page) ? 0 : page);
  if (!built) {
    await interaction.update({ components: [] });
    return;
  }
  await interaction.update({ components: [built.container] });
}

/** Coleta de um drop pelo botão "Coletar". Primeiro a clicar leva. */
export async function handleCollect(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.inCachedGuild()) return;

  const drop = await economyRepository.getDropByMessage(interaction.message.id);
  if (!drop || !drop.active || drop.claimedById) {
    await interaction.reply({ embeds: [errorEmbed('Esse drop já foi coletado ou expirou. 💨')], flags: MessageFlags.Ephemeral });
    return;
  }

  // Reivindicação atômica: só um ganha.
  const claimed = await economyRepository.claimDrop(drop.id, interaction.user.id);
  if (!claimed) {
    await interaction.reply({ embeds: [errorEmbed('Alguém coletou antes de você! 😢 Mais sorte no próximo.')], flags: MessageFlags.Ephemeral });
    return;
  }

  // Credita (cria o perfil se for a primeira coleta).
  const wallet = await economyRepository.addCollected(drop.guildId, interaction.user.id, drop.amount);
  const config = await economyRepository.getConfig(drop.guildId);
  const tier = getCollectMessage(drop.amount, config?.dropMin ?? 10, config?.dropMax ?? 500);

  // Marca a mensagem do drop como coletada e remove o botão.
  await interaction.update({ embeds: [buildClaimedEmbed(interaction.user.tag, drop.amount)], components: [] });

  // Auto-deleta a mensagem de "coletado" após o tempo configurado.
  if (config?.claimedDeleteMs && config.claimedDeleteMs > 0) {
    setTimeout(() => void interaction.message.delete().catch(() => undefined), config.claimedDeleteMs);
  }

  // Devolve o resultado em particular para quem coletou.
  await interaction.followUp({
    embeds: [new EmbedBuilder().setColor(0x2ecc71).setDescription(`${tier}\n\n💰 Saldo atual: **${wallet.balance}** ${CURRENCY}`)],
    flags: MessageFlags.Ephemeral
  });
}
