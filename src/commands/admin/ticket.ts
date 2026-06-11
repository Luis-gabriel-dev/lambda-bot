import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChannelType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  TextChannel
} from 'discord.js';
import { Command } from '../../interfaces/Command';
import { Component, ComponentInteraction } from '../../interfaces/Component';
import { applyColor, applyUrl, errorEmbed, infoEmbed, Palette, successEmbed } from '../../utils/embeds';
import { isAdminOrOwner } from '../../services/permission.service';
import { sendLog } from '../../services/log.service';
import { buildTicketTranscript, createTicketChannel, isTicketStaff } from '../../services/ticket.service';
import { ticketRepository } from '../../repositories/ticket.repository';
import { ticketConfigRepository } from '../../repositories/ticketConfig.repository';
import { truncate } from '../../utils/formatter';

const TYPE_OPTIONS = ['tipo1', 'tipo2', 'tipo3', 'tipo4', 'tipo5'];

// ============ Handlers de componente ============

/** Painel: o usuário escolheu um tipo → pede confirmação (efêmero). */
async function handleOpenSelect(interaction: StringSelectMenuInteraction): Promise<void> {
  if (!interaction.inCachedGuild()) return;
  const type = interaction.values[0];
  if (!type) return;

  const existing = await ticketRepository.getOpenByUser(interaction.guildId, interaction.user.id);
  if (existing) {
    const channel = await interaction.guild.channels.fetch(existing.channelId).catch(() => null);
    if (channel) {
      await interaction.reply({ embeds: [errorEmbed(`Você já tem um ticket aberto: ${channel}.`)], flags: MessageFlags.Ephemeral });
      return;
    }
    await ticketRepository.deleteByChannel(existing.channelId); // canal sumiu → registro órfão
  }

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`ticket:confirm:${type}`).setLabel('Confirmar').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('ticket:cancel').setLabel('Cancelar').setStyle(ButtonStyle.Danger)
  );
  await interaction.reply({
    embeds: [infoEmbed(`Deseja abrir um ticket de **${type}**?`)],
    components: [row],
    flags: MessageFlags.Ephemeral
  });
}

async function handleConfirm(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.inCachedGuild()) return;
  const type = interaction.customId.split(':').slice(2).join(':');
  await interaction.deferUpdate();

  const existing = await ticketRepository.getOpenByUser(interaction.guildId, interaction.user.id);
  if (existing) {
    const channel = await interaction.guild.channels.fetch(existing.channelId).catch(() => null);
    if (channel) {
      await interaction.editReply({ embeds: [errorEmbed(`Você já tem um ticket aberto: ${channel}.`)], components: [] });
      return;
    }
    await ticketRepository.deleteByChannel(existing.channelId);
  }

  const me = interaction.guild.members.me;
  if (!me?.permissions.has(PermissionFlagsBits.ManageChannels)) {
    await interaction.editReply({
      embeds: [errorEmbed('Não tenho a permissão **Gerenciar Canais** para criar o ticket.')],
      components: []
    });
    return;
  }

  const supportRoleIds = await ticketConfigRepository.getSupportRoleIds(interaction.guildId);
  const categoryId = await ticketConfigRepository.getCategory(interaction.guildId);

  const channel = await createTicketChannel(interaction.guild, interaction.member, supportRoleIds, categoryId).catch(() => null);
  if (!channel) {
    await interaction.editReply({ embeds: [errorEmbed('Não consegui criar o canal do ticket.')], components: [] });
    return;
  }

  await ticketRepository.create(interaction.guildId, channel.id, interaction.user.id, type);

  const welcome = new EmbedBuilder()
    .setColor(Palette.info)
    .setTitle('🎫 Ticket aberto')
    .setDescription('O seu ticket foi aberto, espere até alguém te atender!')
    .addFields({ name: 'Tipo', value: type })
    .setTimestamp();
  const closeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('ticket:close').setLabel('Fechar ticket').setEmoji('🔒').setStyle(ButtonStyle.Danger)
  );
  const mention = [interaction.member.toString(), ...supportRoleIds.map((id) => `<@&${id}>`)].join(' ');
  await channel.send({ content: mention, embeds: [welcome], components: [closeRow] });

  await interaction.editReply({ embeds: [successEmbed(`Ticket criado: ${channel}`)], components: [] });
}

async function handleCancel(interaction: ButtonInteraction): Promise<void> {
  await interaction.update({ embeds: [infoEmbed('Operação cancelada.')], components: [] });
}

/** Botão "Fechar ticket": revela as opções finais (qualquer um do canal pode abrir as opções). */
async function handleClose(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.inCachedGuild()) return;
  const ticket = await ticketRepository.getByChannel(interaction.channelId);
  if (!ticket) {
    await interaction.reply({ embeds: [errorEmbed('Este canal não é um ticket.')], flags: MessageFlags.Ephemeral });
    return;
  }

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('ticket:finalize').setLabel('Finalizar atendimento').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('ticket:transcript').setLabel('Salvar transcript e finalizar').setStyle(ButtonStyle.Primary)
  );
  await interaction.reply({
    embeds: [infoEmbed('Como deseja encerrar o atendimento?\n*(apenas a staff pode finalizar)*')],
    components: [row]
  });
}

/** Finaliza o ticket: apaga o canal, com ou sem salvar o transcript. Só staff/admin. */
async function handleFinalize(interaction: ButtonInteraction, withTranscript: boolean): Promise<void> {
  if (!interaction.inCachedGuild()) return;

  const ticket = await ticketRepository.getByChannel(interaction.channelId);
  if (!ticket) {
    await interaction.reply({ embeds: [errorEmbed('Este canal não é um ticket.')], flags: MessageFlags.Ephemeral });
    return;
  }

  const supportRoleIds = await ticketConfigRepository.getSupportRoleIds(interaction.guildId);
  if (!isTicketStaff(interaction.member, supportRoleIds)) {
    await interaction.reply({ embeds: [errorEmbed('Apenas a staff pode finalizar o ticket.')], flags: MessageFlags.Ephemeral });
    return;
  }

  const channel = interaction.channel;
  if (!channel || channel.type !== ChannelType.GuildText) return;

  await interaction.deferReply();

  const opener = await interaction.client.users.fetch(ticket.openerId).catch(() => null);
  const openerTag = opener?.tag ?? ticket.openerId;

  if (withTranscript) {
    const { file, count, attendants } = await buildTicketTranscript(channel as TextChannel, {
      type: ticket.type,
      openerId: ticket.openerId,
      openerTag,
      closedByTag: interaction.user.tag
    });
    const logEmbed = new EmbedBuilder()
      .setColor(Palette.info)
      .setTitle('🎫 Ticket finalizado (com transcript)')
      .addFields(
        { name: 'Tipo', value: ticket.type, inline: true },
        { name: 'Aberto por', value: openerTag, inline: true },
        { name: 'Fechado por', value: interaction.user.tag, inline: true },
        { name: 'Mensagens', value: `${count}`, inline: true },
        { name: 'Atendido por', value: attendants.length > 0 ? attendants.join(', ') : '—' }
      )
      .setTimestamp();
    await sendLog(interaction.guild, 'tickets', logEmbed, [file]);
  } else {
    const logEmbed = new EmbedBuilder()
      .setColor(Palette.warning)
      .setTitle('🎫 Ticket finalizado (sem transcript)')
      .addFields(
        { name: 'Tipo', value: ticket.type, inline: true },
        { name: 'Aberto por', value: openerTag, inline: true },
        { name: 'Fechado por', value: interaction.user.tag, inline: true }
      )
      .setTimestamp();
    await sendLog(interaction.guild, 'tickets', logEmbed);
  }

  await ticketRepository.deleteByChannel(channel.id);
  await channel.delete(`Ticket finalizado por ${interaction.user.tag}`).catch(() => undefined);
}

const component: Component = {
  id: 'ticket',
  execute(interaction: ComponentInteraction) {
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket:open') return handleOpenSelect(interaction);
    if (!interaction.isButton()) return;

    const cid = interaction.customId;
    if (cid.startsWith('ticket:confirm:')) return handleConfirm(interaction);
    if (cid === 'ticket:cancel') return handleCancel(interaction);
    if (cid === 'ticket:close') return handleClose(interaction);
    if (cid === 'ticket:finalize') return handleFinalize(interaction, false);
    if (cid === 'ticket:transcript') return handleFinalize(interaction, true);
  }
};

// ============ Comando ============

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Sistema de tickets.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) => {
      sub
        .setName('painel')
        .setDescription('Cria o painel de tickets (menu de tipos).')
        .addStringOption((opt) => opt.setName('titulo').setDescription('Título do painel.').setRequired(true))
        .addStringOption((opt) => opt.setName('tipo1').setDescription('1º tipo de ticket (ex.: Suporte geral).').setRequired(true))
        .addStringOption((opt) => opt.setName('descricao').setDescription('Descrição (use \\n para pular linha).').setRequired(false))
        .addStringOption((opt) => opt.setName('cor').setDescription('Cor do embed (#RRGGBB ou nome).').setRequired(false))
        .addStringOption((opt) => opt.setName('imagem').setDescription('URL de uma imagem.').setRequired(false))
        .addStringOption((opt) => opt.setName('rodape').setDescription('Texto do rodapé.').setRequired(false))
        .addStringOption((opt) => opt.setName('placeholder').setDescription('Texto da barra (ex.: Selecione o tipo de ticket).').setRequired(false));
      for (const name of TYPE_OPTIONS.slice(1)) {
        sub.addStringOption((opt) => opt.setName(name).setDescription('Tipo de ticket opcional.').setRequired(false));
      }
      return sub;
    })
    .addSubcommand((sub) =>
      sub
        .setName('suporte')
        .setDescription('Gerencia os cargos que atendem os tickets.')
        .addStringOption((opt) =>
          opt
            .setName('acao')
            .setDescription('Ação.')
            .setRequired(true)
            .addChoices({ name: 'Adicionar', value: 'adicionar' }, { name: 'Remover', value: 'remover' }, { name: 'Listar', value: 'listar' })
        )
        .addRoleOption((opt) => opt.setName('cargo').setDescription('Cargo de suporte (para adicionar/remover).').setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName('categoria')
        .setDescription('Define a categoria onde os tickets serão criados.')
        .addChannelOption((opt) =>
          opt.setName('categoria').setDescription('Categoria.').addChannelTypes(ChannelType.GuildCategory).setRequired(true)
        )
    ),

  components: [component],

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({ embeds: [errorEmbed('Este comando só pode ser usado em um servidor.')], flags: MessageFlags.Ephemeral });
      return;
    }
    if (!isAdminOrOwner(interaction.user.id, interaction.memberPermissions)) {
      await interaction.reply({ embeds: [errorEmbed('Apenas administradores podem configurar tickets.')], flags: MessageFlags.Ephemeral });
      return;
    }

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    // ----- /ticket suporte -----
    if (sub === 'suporte') {
      const acao = interaction.options.getString('acao', true);

      if (acao === 'listar') {
        const ids = await ticketConfigRepository.getSupportRoleIds(guildId);
        const value = ids.length > 0 ? ids.map((id) => `<@&${id}>`).join(', ') : '*nenhum configurado*';
        await interaction.reply({ embeds: [infoEmbed(`**Cargos de suporte:** ${value}`)], flags: MessageFlags.Ephemeral });
        return;
      }

      const cargo = interaction.options.getRole('cargo');
      if (!cargo) {
        await interaction.reply({ embeds: [errorEmbed('Informe o `cargo` para adicionar/remover.')], flags: MessageFlags.Ephemeral });
        return;
      }
      if (acao === 'adicionar') {
        await ticketConfigRepository.addSupportRole(guildId, cargo.id);
        await interaction.reply({ embeds: [successEmbed(`${cargo} agora pode atender tickets.`)], flags: MessageFlags.Ephemeral });
      } else {
        const removed = await ticketConfigRepository.removeSupportRole(guildId, cargo.id);
        await interaction.reply({
          embeds: [removed ? successEmbed(`${cargo} não atende mais tickets.`) : errorEmbed(`${cargo} não estava configurado.`)],
          flags: MessageFlags.Ephemeral
        });
      }
      return;
    }

    // ----- /ticket categoria -----
    if (sub === 'categoria') {
      const categoria = interaction.options.getChannel('categoria', true);
      await ticketConfigRepository.setCategory(guildId, categoria.id);
      await interaction.reply({ embeds: [successEmbed(`Tickets serão criados na categoria **${categoria.name}**.`)], flags: MessageFlags.Ephemeral });
      return;
    }

    // ----- /ticket painel -----
    if (!interaction.channel?.isSendable()) {
      await interaction.reply({ embeds: [errorEmbed('Não consigo enviar mensagens neste canal.')], flags: MessageFlags.Ephemeral });
      return;
    }

    const types: string[] = [];
    for (const optName of TYPE_OPTIONS) {
      const value = interaction.options.getString(optName)?.trim();
      if (value && !types.includes(value)) types.push(truncate(value, 80));
    }

    const titulo = interaction.options.getString('titulo', true);
    const descricao = (interaction.options.getString('descricao') ?? 'Selecione abaixo o tipo de ticket que deseja abrir.').replace(/\\n/g, '\n');
    const embed = new EmbedBuilder().setColor(Palette.info).setTitle(titulo).setDescription(descricao);

    const cor = interaction.options.getString('cor');
    const corInvalida = cor ? !applyColor(embed, cor) : false;
    const imagem = interaction.options.getString('imagem');
    if (imagem) applyUrl((url) => embed.setImage(url), imagem);
    const rodape = interaction.options.getString('rodape');
    if (rodape) embed.setFooter({ text: rodape });

    const menu = new StringSelectMenuBuilder()
      .setCustomId('ticket:open')
      .setPlaceholder(interaction.options.getString('placeholder') ?? 'Selecione o tipo de ticket')
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(types.map((type) => ({ label: truncate(type, 100), value: type })));

    await interaction.channel.send({ embeds: [embed], components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)] });

    const aviso = corInvalida ? '\n⚠️ Cor inválida — usei a cor padrão.' : '';
    await interaction.reply({ embeds: [successEmbed(`Painel de tickets criado com **${types.length}** tipo(s).${aviso}`)], flags: MessageFlags.Ephemeral });
  }
};

export default command;
