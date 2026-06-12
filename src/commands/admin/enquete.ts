import {
  ButtonInteraction,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder
} from 'discord.js';
import { Command } from '../../interfaces/Command';
import { Component, ComponentInteraction } from '../../interfaces/Component';
import { applyColor, applyUrl, errorEmbed, infoEmbed, successEmbed } from '../../utils/embeds';
import { isAdminOrOwner } from '../../services/permission.service';
import { pollRepository } from '../../repositories/poll.repository';
import { closePoll, renderPoll } from '../../services/poll.service';
import { truncate } from '../../utils/formatter';
import { parseDuration } from '../../utils/time';

const OPTION_FIELDS = ['op1', 'op2', 'op3', 'op4', 'op5'];

// ============ Botão de voto ============

async function handleVote(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.inCachedGuild()) return;

  const poll = await pollRepository.getByMessage(interaction.message.id);
  if (!poll || poll.closed) {
    await interaction.reply({ embeds: [errorEmbed('Esta enquete está encerrada.')], flags: MessageFlags.Ephemeral });
    return;
  }

  const idx = Number(interaction.customId.split(':')[2]);
  const option = poll.options.find((o) => o.idx === idx);
  if (!option) return;

  const result = await pollRepository.vote(poll.id, interaction.user.id, idx);
  const counts = await pollRepository.counts(poll.id);
  await interaction.message.edit(renderPoll(poll, poll.options, counts)).catch(() => undefined);

  const message =
    result === 'added'
      ? `Você votou em **${option.text}**.`
      : result === 'changed'
        ? `Seu voto foi alterado para **${option.text}**.`
        : 'Seu voto foi removido.';
  await interaction.reply({
    embeds: [result === 'removed' ? infoEmbed(message) : successEmbed(message)],
    flags: MessageFlags.Ephemeral
  });
}

const component: Component = {
  id: 'enquete',
  execute(interaction: ComponentInteraction) {
    if (interaction.isButton() && interaction.customId.startsWith('enquete:vote:')) return handleVote(interaction);
  }
};

// ============ Comando ============

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('enquete')
    .setDescription('Cria e gerencia enquetes (votação por botões).')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) => {
      sub
        .setName('criar')
        .setDescription('Cria uma enquete.')
        .addStringOption((opt) => opt.setName('pergunta').setDescription('A pergunta da enquete.').setRequired(true))
        .addStringOption((opt) => opt.setName('op1').setDescription('1ª opção.').setRequired(true))
        .addStringOption((opt) => opt.setName('op2').setDescription('2ª opção.').setRequired(true))
        .addStringOption((opt) => opt.setName('op3').setDescription('3ª opção.').setRequired(false))
        .addStringOption((opt) => opt.setName('op4').setDescription('4ª opção.').setRequired(false))
        .addStringOption((opt) => opt.setName('op5').setDescription('5ª opção.').setRequired(false))
        .addStringOption((opt) => opt.setName('cor').setDescription('Cor do embed (#RRGGBB ou nome).').setRequired(false))
        .addStringOption((opt) => opt.setName('imagem').setDescription('URL de uma imagem.').setRequired(false))
        .addStringOption((opt) => opt.setName('tempo').setDescription('Auto-encerrar após (ex.: 30m, 2h, 7d).').setRequired(false))
        .addStringOption((opt) =>
          opt.setName('apagar_apos').setDescription('Apagar a mensagem após encerrar (ex.: 10m, 1h, 1d).').setRequired(false)
        );
      return sub;
    })
    .addSubcommand((sub) =>
      sub
        .setName('encerrar')
        .setDescription('Encerra uma enquete (mostra o resultado final e desativa os votos).')
        .addStringOption((opt) => opt.setName('mensagem').setDescription('ID da mensagem da enquete.').setRequired(true))
    ),

  components: [component],

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({ embeds: [errorEmbed('Este comando só pode ser usado em um servidor.')], flags: MessageFlags.Ephemeral });
      return;
    }
    if (!isAdminOrOwner(interaction.user.id, interaction.memberPermissions)) {
      await interaction.reply({ embeds: [errorEmbed('Apenas administradores podem gerenciar enquetes.')], flags: MessageFlags.Ephemeral });
      return;
    }

    const sub = interaction.options.getSubcommand();

    // ----- /enquete encerrar -----
    if (sub === 'encerrar') {
      const messageId = interaction.options.getString('mensagem', true).trim();
      const poll = await pollRepository.getByMessage(messageId);
      if (!poll || poll.guildId !== interaction.guildId) {
        await interaction.reply({ embeds: [errorEmbed('Enquete não encontrada.')], flags: MessageFlags.Ephemeral });
        return;
      }
      if (poll.closed) {
        await interaction.reply({ embeds: [errorEmbed('Essa enquete já foi encerrada.')], flags: MessageFlags.Ephemeral });
        return;
      }
      await closePoll(interaction.client, poll);
      await interaction.reply({ embeds: [successEmbed('Enquete encerrada.')], flags: MessageFlags.Ephemeral });
      return;
    }

    // ----- /enquete criar -----
    if (!interaction.channel?.isSendable()) {
      await interaction.reply({ embeds: [errorEmbed('Não consigo enviar mensagens neste canal.')], flags: MessageFlags.Ephemeral });
      return;
    }

    const pergunta = interaction.options.getString('pergunta', true);
    const optionTexts: string[] = [];
    for (const field of OPTION_FIELDS) {
      const value = interaction.options.getString(field)?.trim();
      if (value) optionTexts.push(truncate(value, 80));
    }
    const options = [...new Set(optionTexts)];
    if (options.length < 2) {
      await interaction.reply({ embeds: [errorEmbed('A enquete precisa de pelo menos **2 opções diferentes**.')], flags: MessageFlags.Ephemeral });
      return;
    }

    // Auto-encerrar e auto-apagar (opcionais).
    let endsAt: Date | null = null;
    const tempoStr = interaction.options.getString('tempo');
    if (tempoStr) {
      const ms = parseDuration(tempoStr);
      if (ms === null || ms <= 0) {
        await interaction.reply({ embeds: [errorEmbed('Tempo inválido. Use formatos como `30m`, `2h` ou `7d`.')], flags: MessageFlags.Ephemeral });
        return;
      }
      endsAt = new Date(Date.now() + ms);
    }
    let deleteAfterMs: number | null = null;
    const apagarStr = interaction.options.getString('apagar_apos');
    if (apagarStr) {
      const ms = parseDuration(apagarStr);
      if (ms === null || ms <= 0) {
        await interaction.reply({ embeds: [errorEmbed('Tempo de exclusão inválido. Use formatos como `10m`, `1h` ou `1d`.')], flags: MessageFlags.Ephemeral });
        return;
      }
      deleteAfterMs = ms;
    }

    // Cor e imagem (validadas em um embed temporário).
    let color: number | null = null;
    let corInvalida = false;
    const corStr = interaction.options.getString('cor');
    if (corStr) {
      const tmp = new EmbedBuilder();
      if (applyColor(tmp, corStr)) color = tmp.data.color ?? null;
      else corInvalida = true;
    }
    let imageUrl: string | null = null;
    const imagemStr = interaction.options.getString('imagem');
    if (imagemStr) {
      const tmp = new EmbedBuilder();
      if (applyUrl((url) => tmp.setImage(url), imagemStr)) imageUrl = imagemStr;
    }

    const rendered = renderPoll(
      { question: pergunta, color, imageUrl, closed: false, endsAt },
      options.map((text, idx) => ({ idx, text })),
      new Map()
    );
    const message = await interaction.channel.send(rendered);

    await pollRepository.create({
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      messageId: message.id,
      question: pergunta,
      color,
      imageUrl,
      endsAt,
      deleteAfterMs,
      options
    });

    const aviso = corInvalida ? '\n⚠️ Cor inválida — usei a cor padrão.' : '';
    await interaction.reply({ embeds: [successEmbed(`Enquete criada! 📊${aviso}`)], flags: MessageFlags.Ephemeral });
  }
};

export default command;
