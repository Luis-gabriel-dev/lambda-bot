import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder
} from 'discord.js';
import { Command } from '../../interfaces/Command';
import { Component, ComponentInteraction } from '../../interfaces/Component';
import { applyColor, applyUrl, errorEmbed, infoEmbed, Palette, successEmbed } from '../../utils/embeds';
import { isAdminOrOwner } from '../../services/permission.service';
import { giveawayRepository } from '../../repositories/giveaway.repository';
import { endGiveaway, formatWinners, pickWinners, winnerAnnouncement } from '../../services/giveaway.service';
import { currentHourBucket, messageActivityRepository } from '../../repositories/messageActivity.repository';
import { formatDuration, parseDuration } from '../../utils/time';
import { discordTimestamp } from '../../utils/formatter';

const MAX_WINDOW_MS = 30 * 24 * 3_600_000; // janela máxima de 30 dias

// ============ Botão "Participar" ============

/**
 * Detecção best-effort de Nitro (bots NÃO leem premium_type de outros usuários).
 * Sinais: boost no servidor, avatar animado, ou banner de perfil.
 */
async function hasNitroSignals(interaction: ButtonInteraction<'cached'>): Promise<boolean> {
  if (interaction.member.premiumSince) return true; // está boostando → tem Nitro
  if (interaction.user.avatar?.startsWith('a_')) return true; // avatar animado
  const full = await interaction.user.fetch().catch(() => null);
  return Boolean(full?.banner); // banner de perfil
}

async function handleJoin(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.inCachedGuild()) return;

  const giveaway = await giveawayRepository.getByMessage(interaction.message.id);
  if (!giveaway || giveaway.ended) {
    await interaction.reply({ embeds: [errorEmbed('Este sorteio já foi encerrado.')], flags: MessageFlags.Ephemeral });
    return;
  }

  // Exclusões só valem para ENTRAR (sair é sempre permitido).
  const alreadyIn = await giveawayRepository.hasEntry(giveaway.id, interaction.user.id);
  if (!alreadyIn) {
    if (giveaway.excludeRoleId && interaction.member.roles.cache.has(giveaway.excludeRoleId)) {
      await interaction.reply({
        embeds: [errorEmbed('Você não pode participar deste sorteio (seu cargo está excluído).')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    if (giveaway.blockNitro && (await hasNitroSignals(interaction))) {
      await interaction.reply({
        embeds: [errorEmbed('Este sorteio é apenas para quem **não tem Nitro** — detectei sinais de Nitro no seu perfil.')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    if (giveaway.minMessages && giveaway.messageWindowHours) {
      const sinceHour = currentHourBucket() - giveaway.messageWindowHours + 1;
      const msgs = await messageActivityRepository.countSince(interaction.guildId, interaction.user.id, sinceHour);
      if (msgs < giveaway.minMessages) {
        const janela = formatDuration(giveaway.messageWindowHours * 3_600_000);
        await interaction.reply({
          embeds: [
            errorEmbed(
              `Você precisa de **${giveaway.minMessages}** mensagens nas últimas ${janela} para participar — você tem **${msgs}**.`
            )
          ],
          flags: MessageFlags.Ephemeral
        });
        return;
      }
    }
  }

  const { joined, count } = await giveawayRepository.toggleEntry(giveaway.id, interaction.user.id);

  // Atualiza o contador de participantes no rodapé do embed.
  const base = interaction.message.embeds[0];
  if (base) {
    const embed = EmbedBuilder.from(base).setFooter({ text: `${count} participante(s)` });
    await interaction.message.edit({ embeds: [embed] }).catch(() => undefined);
  }

  await interaction.reply({
    embeds: [joined ? successEmbed(`Você está participando! 🎉 (${count} no total)`) : infoEmbed('Você saiu do sorteio.')],
    flags: MessageFlags.Ephemeral
  });
}

const component: Component = {
  id: 'sorteio',
  execute(interaction: ComponentInteraction) {
    if (interaction.isButton() && interaction.customId === 'sorteio:join') return handleJoin(interaction);
  }
};

// ============ Comando ============

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('sorteio')
    .setDescription('Cria e gerencia sorteios.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName('criar')
        .setDescription('Cria um sorteio.')
        .addStringOption((opt) => opt.setName('premio').setDescription('O que será sorteado.').setRequired(true))
        .addStringOption((opt) => opt.setName('tempo').setDescription('Duração: ex. 30m, 2h, 1d.').setRequired(true))
        .addIntegerOption((opt) =>
          opt.setName('vencedores').setDescription('Quantos vencedores (padrão 1).').setMinValue(1).setMaxValue(20).setRequired(false)
        )
        .addStringOption((opt) => opt.setName('descricao').setDescription('Descrição extra do sorteio.').setRequired(false))
        .addRoleOption((opt) => opt.setName('excluir_cargo').setDescription('Cargo que NÃO pode participar.').setRequired(false))
        .addBooleanOption((opt) =>
          opt.setName('sem_nitro').setDescription('Bloquear sinais de Nitro (best-effort: avatar animado/banner/boost).').setRequired(false)
        )
        .addStringOption((opt) => opt.setName('cor').setDescription('Cor do embed (#RRGGBB ou nome).').setRequired(false))
        .addStringOption((opt) => opt.setName('imagem').setDescription('URL de uma imagem para o sorteio.').setRequired(false))
        .addIntegerOption((opt) =>
          opt.setName('min_mensagens').setDescription('Mínimo de mensagens exigidas no período.').setMinValue(1).setRequired(false)
        )
        .addStringOption((opt) =>
          opt.setName('periodo').setDescription('Período do mínimo de mensagens (ex.: 24h, 7d). Padrão: 24h.').setRequired(false)
        )
        .addStringOption((opt) =>
          opt.setName('requisito').setDescription('Requisito em texto livre (exibido, não validado pelo bot).').setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('reroll')
        .setDescription('Sorteia novos vencedores de um sorteio encerrado.')
        .addStringOption((opt) => opt.setName('mensagem').setDescription('ID da mensagem do sorteio.').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('finalizar')
        .setDescription('Encerra um sorteio agora (antes da hora).')
        .addStringOption((opt) => opt.setName('mensagem').setDescription('ID da mensagem do sorteio.').setRequired(true))
    ),

  components: [component],

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({ embeds: [errorEmbed('Este comando só pode ser usado em um servidor.')], flags: MessageFlags.Ephemeral });
      return;
    }
    if (!isAdminOrOwner(interaction.user.id, interaction.memberPermissions)) {
      await interaction.reply({ embeds: [errorEmbed('Apenas administradores podem gerenciar sorteios.')], flags: MessageFlags.Ephemeral });
      return;
    }

    const sub = interaction.options.getSubcommand();

    // ----- /sorteio reroll -----
    if (sub === 'reroll') {
      const messageId = interaction.options.getString('mensagem', true).trim();
      const giveaway = await giveawayRepository.getByMessage(messageId);
      if (!giveaway || giveaway.guildId !== interaction.guildId) {
        await interaction.reply({ embeds: [errorEmbed('Sorteio não encontrado.')], flags: MessageFlags.Ephemeral });
        return;
      }
      const winners = pickWinners(await giveawayRepository.getEntries(giveaway.id), giveaway.winnerCount);
      if (winners.length === 0) {
        await interaction.reply({ embeds: [errorEmbed('Esse sorteio não teve participantes.')], flags: MessageFlags.Ephemeral });
        return;
      }
      const verbo = winners.length === 1 ? 'ganhou' : 'ganharam';
      await interaction.reply({ content: `🎉 Novo sorteio! ${formatWinners(winners)} ${verbo} **${giveaway.prize}**!` });
      return;
    }

    // ----- /sorteio finalizar -----
    if (sub === 'finalizar') {
      const messageId = interaction.options.getString('mensagem', true).trim();
      const giveaway = await giveawayRepository.getByMessage(messageId);
      if (!giveaway || giveaway.guildId !== interaction.guildId) {
        await interaction.reply({ embeds: [errorEmbed('Sorteio não encontrado.')], flags: MessageFlags.Ephemeral });
        return;
      }
      if (giveaway.ended) {
        await interaction.reply({ embeds: [errorEmbed('Esse sorteio já foi encerrado.')], flags: MessageFlags.Ephemeral });
        return;
      }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      await endGiveaway(interaction.client, giveaway);
      await interaction.editReply({ embeds: [successEmbed('Sorteio encerrado.')] });
      return;
    }

    // ----- /sorteio criar -----
    if (!interaction.channel?.isSendable()) {
      await interaction.reply({ embeds: [errorEmbed('Não consigo enviar mensagens neste canal.')], flags: MessageFlags.Ephemeral });
      return;
    }

    const premio = interaction.options.getString('premio', true);
    const winnerCount = interaction.options.getInteger('vencedores') ?? 1;
    const descricao = interaction.options.getString('descricao')?.trim();
    const excludeRole = interaction.options.getRole('excluir_cargo');
    const blockNitro = interaction.options.getBoolean('sem_nitro') ?? false;
    const requisito = interaction.options.getString('requisito')?.trim();
    const ms = parseDuration(interaction.options.getString('tempo', true));
    if (ms === null || ms <= 0) {
      await interaction.reply({ embeds: [errorEmbed('Tempo inválido. Use formatos como `30m`, `2h` ou `1d`.')], flags: MessageFlags.Ephemeral });
      return;
    }

    // Requisito de atividade (mensagens) — enforçado.
    const minMessages = interaction.options.getInteger('min_mensagens');
    let messageWindowHours: number | null = null;
    if (minMessages) {
      const periodoStr = interaction.options.getString('periodo');
      const windowMs = periodoStr ? parseDuration(periodoStr) : 24 * 3_600_000;
      if (windowMs === null || windowMs <= 0) {
        await interaction.reply({ embeds: [errorEmbed('Período inválido. Use formatos como `12h`, `24h` ou `7d`.')], flags: MessageFlags.Ephemeral });
        return;
      }
      if (windowMs > MAX_WINDOW_MS) {
        await interaction.reply({ embeds: [errorEmbed('O período máximo é de **30 dias**.')], flags: MessageFlags.Ephemeral });
        return;
      }
      messageWindowHours = Math.max(1, Math.ceil(windowMs / 3_600_000));
    }

    const restricoes: string[] = [];
    if (excludeRole) restricoes.push(`apenas quem não tem o cargo ${excludeRole}`);
    if (blockNitro) restricoes.push('apenas pessoas que não possuem Nitro ativo');
    if (minMessages && messageWindowHours) {
      restricoes.push(`mínimo de ${minMessages} mensagens nas últimas ${formatDuration(messageWindowHours * 3_600_000)}`);
    }
    if (requisito) restricoes.push(requisito);

    const endsAt = new Date(Date.now() + ms);
    const embed = new EmbedBuilder()
      .setColor(Palette.success)
      .setTitle(`🎉 ${premio}`)
      .setDescription(
        `${descricao ? `${descricao}\n\n` : ''}Clique em **🎉 Participar** para entrar!\n\n` +
          `**Termina:** ${discordTimestamp(endsAt, 'R')} (${discordTimestamp(endsAt, 'F')})\n` +
          `**Vencedores:** ${winnerCount}\n` +
          `**Organizado por:** ${interaction.user}` +
          (restricoes.length > 0 ? `\n**Restrições:** ${restricoes.join(' • ')}` : '')
      )
      .setFooter({ text: '0 participante(s)' })
      .setTimestamp(endsAt);

    const cor = interaction.options.getString('cor');
    const corInvalida = cor ? !applyColor(embed, cor) : false;
    const imagem = interaction.options.getString('imagem');
    if (imagem) applyUrl((url) => embed.setImage(url), imagem);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('sorteio:join').setLabel('Participar').setEmoji('🎉').setStyle(ButtonStyle.Success)
    );

    const message = await interaction.channel.send({ embeds: [embed], components: [row] });
    await giveawayRepository.create({
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      messageId: message.id,
      prize: premio,
      winnerCount,
      hostId: interaction.user.id,
      endsAt,
      excludeRoleId: excludeRole?.id ?? null,
      blockNitro,
      minMessages: minMessages ?? null,
      messageWindowHours,
      requirement: requisito ?? null
    });

    const aviso = corInvalida ? '\n⚠️ Cor inválida — usei a cor padrão.' : '';
    await interaction.reply({ embeds: [successEmbed(`Sorteio criado! 🎉${aviso}`)], flags: MessageFlags.Ephemeral });
  }
};

export default command;
