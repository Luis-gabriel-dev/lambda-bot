import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder
} from 'discord.js';
import { Command } from '../../interfaces/Command';
import { Component, ComponentInteraction } from '../../interfaces/Component';
import { errorEmbed, infoEmbed } from '../../utils/embeds';
import { economyRepository } from '../../repositories/economy.repository';
import { CURRENCY } from '../../services/economy.service';

const MIN_BET = 10;
const TIMEOUT_MS = 60_000;
const n = (v: number) => v.toLocaleString('pt-BR');

interface Duel {
  challengerId: string;
  opponentId: string;
  bet: number;
  guildId: string;
  timeout: NodeJS.Timeout;
}

// Duelos pendentes em memória (chave = id da interação do desafio).
// Sem escrow: ninguém é debitado até o aceite, então um reinício só descarta o desafio.
const pendingDuels = new Map<string, Duel>();

/** Aceite do desafio: debita os dois (atômico) e sorteia o vencedor. */
async function handleAccept(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.inCachedGuild()) return;
  const id = interaction.customId.split(':')[2];
  const duel = id ? pendingDuels.get(id) : undefined;
  if (!duel) {
    await interaction.reply({ embeds: [errorEmbed('Esse duelo expirou ou já foi resolvido.')], flags: MessageFlags.Ephemeral });
    return;
  }
  if (interaction.user.id !== duel.opponentId) {
    await interaction.reply({ embeds: [errorEmbed('Só quem foi desafiado pode aceitar este duelo.')], flags: MessageFlags.Ephemeral });
    return;
  }

  clearTimeout(duel.timeout);
  pendingDuels.delete(id!);

  // Débito atômico — desafiante primeiro; se faltar, ninguém é cobrado.
  const fromChallenger = await economyRepository.spend(duel.guildId, duel.challengerId, duel.bet);
  if (!fromChallenger.ok) {
    await interaction.update({ embeds: [errorEmbed(`<@${duel.challengerId}> não tem mais saldo. Duelo cancelado.`)], components: [] });
    return;
  }
  const fromOpponent = await economyRepository.spend(duel.guildId, duel.opponentId, duel.bet);
  if (!fromOpponent.ok) {
    await economyRepository.giveBalance(duel.guildId, duel.challengerId, duel.bet); // estorna o desafiante
    await interaction.update({ embeds: [errorEmbed('Você não tem saldo pra cobrir a aposta. Duelo cancelado.')], components: [] });
    return;
  }

  const pot = duel.bet * 2;
  const winnerId = Math.random() < 0.5 ? duel.challengerId : duel.opponentId;
  const loserId = winnerId === duel.challengerId ? duel.opponentId : duel.challengerId;
  await economyRepository.giveBalance(duel.guildId, winnerId, pot);

  const embed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle('⚔️ Duelo encerrado!')
    .setDescription(
      `<@${duel.challengerId}>  ⚔️  <@${duel.opponentId}>\nAposta: **${n(duel.bet)}** ${CURRENCY} de cada\n\n` +
        `🏆 <@${winnerId}> venceu e levou **${n(pot)}** ${CURRENCY}!\n💀 <@${loserId}> perdeu **${n(duel.bet)}**.`
    )
    .setTimestamp();
  await interaction.update({ embeds: [embed], components: [] });
}

/** Recusa (oponente) ou cancelamento (desafiante). Nada é debitado. */
async function handleDecline(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.inCachedGuild()) return;
  const id = interaction.customId.split(':')[2];
  const duel = id ? pendingDuels.get(id) : undefined;
  if (!duel) {
    await interaction.reply({ embeds: [errorEmbed('Esse duelo expirou ou já foi resolvido.')], flags: MessageFlags.Ephemeral });
    return;
  }
  if (interaction.user.id !== duel.opponentId && interaction.user.id !== duel.challengerId) {
    await interaction.reply({ embeds: [errorEmbed('Este duelo não é seu.')], flags: MessageFlags.Ephemeral });
    return;
  }
  clearTimeout(duel.timeout);
  pendingDuels.delete(id!);
  const acao = interaction.user.id === duel.opponentId ? 'recusou o duelo' : 'cancelou o desafio';
  await interaction.update({ embeds: [infoEmbed(`🤝 <@${interaction.user.id}> ${acao}. Ninguém perdeu nada.`)], components: [] });
}

const component: Component = {
  id: 'duelo',
  execute(interaction: ComponentInteraction) {
    if (!interaction.isButton()) return;
    if (interaction.customId.startsWith('duelo:aceitar:')) return handleAccept(interaction);
    if (interaction.customId.startsWith('duelo:recusar:')) return handleDecline(interaction);
  }
};

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('duelo')
    .setDescription('Desafia outro membro para um duelo de kurocoins. ⚔️')
    .addUserOption((opt) => opt.setName('usuario').setDescription('Quem você quer desafiar.').setRequired(true))
    .addIntegerOption((opt) =>
      opt.setName('aposta').setDescription(`Quanto cada um aposta (mínimo ${MIN_BET}).`).setMinValue(MIN_BET).setRequired(true)
    ),

  components: [component],

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({ embeds: [errorEmbed('Este comando só pode ser usado em um servidor.')], flags: MessageFlags.Ephemeral });
      return;
    }

    const opponent = interaction.options.getUser('usuario', true);
    const aposta = interaction.options.getInteger('aposta', true);

    if (opponent.bot) {
      await interaction.reply({ embeds: [errorEmbed('Você não pode duelar contra um bot.')], flags: MessageFlags.Ephemeral });
      return;
    }
    if (opponent.id === interaction.user.id) {
      await interaction.reply({ embeds: [errorEmbed('Você não pode duelar contra si mesmo. 🙃')], flags: MessageFlags.Ephemeral });
      return;
    }

    // Confere o saldo do desafiante agora (a cobrança real é só no aceite).
    const wallet = await economyRepository.getWallet(interaction.guildId, interaction.user.id);
    if ((wallet?.balance ?? 0) < aposta) {
      await interaction.reply({
        embeds: [errorEmbed(`Você tem só **${n(wallet?.balance ?? 0)}** ${CURRENCY} — não dá pra apostar **${n(aposta)}**.`)],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const duelId = interaction.id;
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`duelo:aceitar:${duelId}`).setLabel('Aceitar').setEmoji('⚔️').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`duelo:recusar:${duelId}`).setLabel('Recusar').setEmoji('✖️').setStyle(ButtonStyle.Danger)
    );

    const embed = new EmbedBuilder()
      .setColor(0xf1c40f)
      .setTitle('⚔️ Desafio de duelo!')
      .setDescription(
        `<@${interaction.user.id}> desafiou <@${opponent.id}> para um duelo de **${n(aposta)}** ${CURRENCY}!\n\n` +
          `O vencedor é sorteado e leva o pote de **${n(aposta * 2)}** ${CURRENCY}.\n` +
          `<@${opponent.id}>, você tem **60s** para aceitar.`
      );

    await interaction.reply({ content: `<@${opponent.id}>`, embeds: [embed], components: [row], allowedMentions: { users: [opponent.id] } });

    const timeout = setTimeout(() => {
      pendingDuels.delete(duelId);
      interaction.editReply({ embeds: [infoEmbed('⏳ O desafio expirou — ninguém aceitou a tempo.')], components: [] }).catch(() => undefined);
    }, TIMEOUT_MS);

    pendingDuels.set(duelId, { challengerId: interaction.user.id, opponentId: opponent.id, bet: aposta, guildId: interaction.guildId, timeout });
  }
};

export default command;
