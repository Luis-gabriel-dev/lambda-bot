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
  TextChannel
} from 'discord.js';
import { Command } from '../../interfaces/Command';
import { Component, ComponentInteraction } from '../../interfaces/Component';
import { applyColor, applyUrl, errorEmbed, infoEmbed, Palette, successEmbed } from '../../utils/embeds';
import { isAdminOrOwner, isOwner } from '../../services/permission.service';
import { sendLog } from '../../services/log.service';
import {
  buildPartnershipTranscript,
  buildPublicPartnerEmbed,
  createPartnershipChannel,
  isPartnerStaff,
  stripMassMentions
} from '../../services/partnership.service';
import { partnershipRepository } from '../../repositories/partnership.repository';
import { truncate } from '../../utils/formatter';

/** Botão "Fechar ticket" mostrado após a decisão (e nas boas-vindas). */
function closeRow(channelId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`parceria:fechar:${channelId}`).setLabel('Fechar ticket').setEmoji('🔒').setStyle(ButtonStyle.Secondary)
  );
}

// ============ Handlers de componente ============

/** Painel: o usuário clicou em "Solicitar parceria" → abre o canal do ticket. */
async function handleOpen(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.inCachedGuild()) return;

  const existing = await partnershipRepository.getOpenByUser(interaction.guildId, interaction.user.id);
  if (existing) {
    const channel = await interaction.guild.channels.fetch(existing.channelId).catch(() => null);
    if (channel) {
      await interaction.reply({ embeds: [errorEmbed(`Você já tem um pedido de parceria aberto: ${channel}.`)], flags: MessageFlags.Ephemeral });
      return;
    }
    await partnershipRepository.deleteByChannel(existing.channelId); // canal sumiu → registro órfão
  }

  const me = interaction.guild.members.me;
  if (!me?.permissions.has(PermissionFlagsBits.ManageChannels)) {
    await interaction.reply({ embeds: [errorEmbed('Não tenho a permissão **Gerenciar Canais** para abrir o ticket.')], flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const supportRoleIds = await partnershipRepository.getSupportRoleIds(interaction.guildId);
  const config = await partnershipRepository.getConfig(interaction.guildId);

  const channel = await createPartnershipChannel(interaction.guild, interaction.member, supportRoleIds, config?.partnerCategoryId ?? null).catch(() => null);
  if (!channel) {
    await interaction.editReply({ embeds: [errorEmbed('Não consegui criar o canal do ticket.')] });
    return;
  }

  await partnershipRepository.create(interaction.guildId, channel.id, interaction.user.id);

  const welcome = new EmbedBuilder()
    .setColor(Palette.info)
    .setTitle('🤝 Pedido de parceria')
    .setDescription(
      'Envie aqui o **convite do seu servidor** junto com o texto de divulgação.\n\n' +
        'Assim que você mandar o convite, a equipe vai analisar e confirmar a parceria. ' +
        'Pode mandar gif e formatação à vontade — não precisa marcar `@everyone`/`@here`.'
    )
    .setTimestamp();
  const mention = [interaction.member.toString(), ...supportRoleIds.map((id) => `<@&${id}>`)].join(' ');
  await channel.send({ content: mention, embeds: [welcome], components: [closeRow(channel.id)] });

  await interaction.editReply({ embeds: [successEmbed(`Pedido de parceria aberto: ${channel}`)] });
}

/** Botões "Sim, fechar parceria" / "Não fechar parceria" (só staff). */
async function handleDecision(interaction: ButtonInteraction, approve: boolean): Promise<void> {
  if (!interaction.inCachedGuild()) return;
  const channelId = interaction.customId.split(':')[2] ?? interaction.channelId;

  const ticket = await partnershipRepository.getByChannel(channelId);
  if (!ticket) {
    await interaction.reply({ embeds: [errorEmbed('Este canal não é um ticket de parceria.')], flags: MessageFlags.Ephemeral });
    return;
  }

  const supportRoleIds = await partnershipRepository.getSupportRoleIds(interaction.guildId);
  if (!isPartnerStaff(interaction.member, supportRoleIds) && !isOwner(interaction.user.id)) {
    await interaction.reply({ embeds: [errorEmbed('Apenas a equipe autorizada pode decidir a parceria.')], flags: MessageFlags.Ephemeral });
    return;
  }

  // ----- Recusar -----
  if (!approve) {
    await partnershipRepository.setStatus(channelId, 'recusado');
    await interaction.update({ embeds: [infoEmbed('❌ Parceria **recusada**. Você já pode fechar o ticket.')], components: [] });
    await interaction.followUp({ embeds: [infoEmbed('Quando quiser, feche o ticket — o transcript vai para o log.')], components: [closeRow(channelId)] });
    return;
  }

  // ----- Aprovar -----
  const config = await partnershipRepository.getConfig(interaction.guildId);
  const announceId = config?.partnerAnnounceChannelId;
  const announce = announceId ? await interaction.guild.channels.fetch(announceId).catch(() => null) : null;
  if (!announce || !announce.isTextBased() || !announce.isSendable()) {
    await interaction.reply({
      embeds: [errorEmbed('Configure o canal de anúncio antes com `/parceria anuncio`.')],
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  await interaction.deferUpdate();

  // Anúncio: remove menções em massa, marca @parceria + o autor do pedido.
  const notifyRoleId = config?.partnerNotifyRoleId ?? null;
  const pitch = truncate(stripMassMentions(ticket.pitchText ?? ticket.inviteUrl ?? ''), 1800);
  const header = `${notifyRoleId ? `<@&${notifyRoleId}> ` : ''}Parceria com <@${ticket.openerId}>`;
  await announce
    .send({
      content: `${header}\n\n${pitch}`.slice(0, 2000),
      allowedMentions: { parse: [], users: [ticket.openerId], roles: notifyRoleId ? [notifyRoleId] : [] }
    })
    .catch(() => undefined);

  await partnershipRepository.setStatus(channelId, 'aprovado');
  const closedCount = await partnershipRepository.incrementCloser(interaction.guildId, interaction.user.id);

  // Embed público "fez parceria" (creditando quem aprovou + contador de métricas).
  const publicId = config?.partnerPublicChannelId;
  const publicCh = publicId ? await interaction.guild.channels.fetch(publicId).catch(() => null) : null;
  if (publicCh?.isTextBased() && publicCh.isSendable()) {
    const embed = await buildPublicPartnerEmbed(interaction.user, interaction.guild, ticket.inviteServer, config?.partnerImageUrl ?? null, closedCount);
    await publicCh.send({ embeds: [embed] }).catch(() => undefined);
  }

  await interaction.editReply({ embeds: [successEmbed(`✅ Parceria **fechada** e divulgada em ${announce}.`)], components: [] });
  await interaction.followUp({ embeds: [infoEmbed('Pode fechar o ticket — o transcript vai para o log.')], components: [closeRow(channelId)] });
}

/** Botão "Fechar ticket": gera transcript para o log e apaga o canal (só staff). */
async function handleClose(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.inCachedGuild()) return;

  const ticket = await partnershipRepository.getByChannel(interaction.channelId);
  if (!ticket) {
    await interaction.reply({ embeds: [errorEmbed('Este canal não é um ticket de parceria.')], flags: MessageFlags.Ephemeral });
    return;
  }

  const supportRoleIds = await partnershipRepository.getSupportRoleIds(interaction.guildId);
  if (!isPartnerStaff(interaction.member, supportRoleIds) && !isOwner(interaction.user.id)) {
    await interaction.reply({ embeds: [errorEmbed('Apenas a equipe autorizada pode fechar o ticket.')], flags: MessageFlags.Ephemeral });
    return;
  }

  const channel = interaction.channel;
  if (!channel || channel.type !== ChannelType.GuildText) return;

  await interaction.deferReply();

  const opener = await interaction.client.users.fetch(ticket.openerId).catch(() => null);
  const openerTag = opener?.tag ?? ticket.openerId;

  const { file, count } = await buildPartnershipTranscript(channel as TextChannel, {
    openerId: ticket.openerId,
    openerTag,
    closedByTag: interaction.user.tag,
    status: ticket.status,
    inviteUrl: ticket.inviteUrl,
    inviteServer: ticket.inviteServer
  });

  const logEmbed = new EmbedBuilder()
    .setColor(ticket.status === 'aprovado' ? Palette.success : Palette.warning)
    .setTitle('🤝 Ticket de parceria finalizado')
    .addFields(
      { name: 'Pedido por', value: openerTag, inline: true },
      { name: 'Fechado por', value: interaction.user.tag, inline: true },
      { name: 'Status', value: ticket.status, inline: true },
      { name: 'Servidor parceiro', value: ticket.inviteServer ?? '—', inline: true },
      { name: 'Mensagens', value: `${count}`, inline: true },
      { name: 'Convite', value: ticket.inviteUrl ?? '—' }
    )
    .setTimestamp();
  await sendLog(interaction.guild, 'parcerias', logEmbed, [file]);

  await partnershipRepository.deleteByChannel(channel.id);
  await channel.delete(`Ticket de parceria finalizado por ${interaction.user.tag}`).catch(() => undefined);
}

const component: Component = {
  id: 'parceria',
  execute(interaction: ComponentInteraction) {
    if (!interaction.isButton()) return;
    const cid = interaction.customId;
    if (cid === 'parceria:open') return handleOpen(interaction);
    if (cid.startsWith('parceria:sim:')) return handleDecision(interaction, true);
    if (cid.startsWith('parceria:nao:')) return handleDecision(interaction, false);
    if (cid.startsWith('parceria:fechar:')) return handleClose(interaction);
  }
};

// ============ Comando ============

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('parceria')
    .setDescription('Sistema de parcerias entre servidores.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName('painel')
        .setDescription('Cria o painel para solicitar parceria (botão).')
        .addStringOption((opt) => opt.setName('titulo').setDescription('Título do painel.').setRequired(true))
        .addStringOption((opt) => opt.setName('descricao').setDescription('Descrição (use \\n para pular linha).').setRequired(false))
        .addStringOption((opt) => opt.setName('cor').setDescription('Cor do embed (#RRGGBB ou nome).').setRequired(false))
        .addStringOption((opt) => opt.setName('imagem').setDescription('URL de uma imagem.').setRequired(false))
        .addStringOption((opt) => opt.setName('rodape').setDescription('Texto do rodapé.').setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName('cargo')
        .setDescription('Gerencia os cargos que veem/confirmam as parcerias.')
        .addStringOption((opt) =>
          opt
            .setName('acao')
            .setDescription('Ação.')
            .setRequired(true)
            .addChoices({ name: 'Adicionar', value: 'adicionar' }, { name: 'Remover', value: 'remover' }, { name: 'Listar', value: 'listar' })
        )
        .addRoleOption((opt) => opt.setName('cargo').setDescription('Cargo autorizado (para adicionar/remover).').setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName('categoria')
        .setDescription('Categoria onde os tickets de parceria serão criados.')
        .addChannelOption((opt) => opt.setName('categoria').setDescription('Categoria.').addChannelTypes(ChannelType.GuildCategory).setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('anuncio')
        .setDescription('Canal onde o anúncio da parceria será postado.')
        .addChannelOption((opt) => opt.setName('canal').setDescription('Canal de anúncio.').addChannelTypes(ChannelType.GuildText).setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('notificar')
        .setDescription('Cargo @parceria marcado no anúncio.')
        .addRoleOption((opt) => opt.setName('cargo').setDescription('Cargo a notificar.').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('publico')
        .setDescription('Canal do log público "fez parceria".')
        .addChannelOption((opt) => opt.setName('canal').setDescription('Canal do log público.').addChannelTypes(ChannelType.GuildText).setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('imagem')
        .setDescription('Imagem do embed público (ou "remover").')
        .addStringOption((opt) => opt.setName('url').setDescription('URL da imagem, ou "remover".').setRequired(true))
    )
    .addSubcommand((sub) => sub.setName('status').setDescription('Mostra a configuração de parcerias.')),

  components: [component],

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({ embeds: [errorEmbed('Este comando só pode ser usado em um servidor.')], flags: MessageFlags.Ephemeral });
      return;
    }
    if (!isAdminOrOwner(interaction.user.id, interaction.memberPermissions)) {
      await interaction.reply({ embeds: [errorEmbed('Apenas administradores podem configurar parcerias.')], flags: MessageFlags.Ephemeral });
      return;
    }

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    // ----- /parceria cargo -----
    if (sub === 'cargo') {
      const acao = interaction.options.getString('acao', true);
      if (acao === 'listar') {
        const ids = await partnershipRepository.getSupportRoleIds(guildId);
        const value = ids.length > 0 ? ids.map((id) => `<@&${id}>`).join(', ') : '*nenhum configurado*';
        await interaction.reply({ embeds: [infoEmbed(`**Cargos de parceria:** ${value}`)], flags: MessageFlags.Ephemeral });
        return;
      }
      const cargo = interaction.options.getRole('cargo');
      if (!cargo) {
        await interaction.reply({ embeds: [errorEmbed('Informe o `cargo` para adicionar/remover.')], flags: MessageFlags.Ephemeral });
        return;
      }
      if (acao === 'adicionar') {
        await partnershipRepository.addSupportRole(guildId, cargo.id);
        await interaction.reply({ embeds: [successEmbed(`${cargo} agora pode ver e confirmar parcerias.`)], flags: MessageFlags.Ephemeral });
      } else {
        const removed = await partnershipRepository.removeSupportRole(guildId, cargo.id);
        await interaction.reply({
          embeds: [removed ? successEmbed(`${cargo} não confirma mais parcerias.`) : errorEmbed(`${cargo} não estava configurado.`)],
          flags: MessageFlags.Ephemeral
        });
      }
      return;
    }

    // ----- /parceria categoria -----
    if (sub === 'categoria') {
      const categoria = interaction.options.getChannel('categoria', true);
      await partnershipRepository.setCategory(guildId, categoria.id);
      await interaction.reply({ embeds: [successEmbed(`Tickets de parceria serão criados em **${categoria.name}**.`)], flags: MessageFlags.Ephemeral });
      return;
    }

    // ----- /parceria anuncio -----
    if (sub === 'anuncio') {
      const canal = interaction.options.getChannel('canal', true);
      await partnershipRepository.setAnnounceChannel(guildId, canal.id);
      await interaction.reply({ embeds: [successEmbed(`Anúncios de parceria serão postados em <#${canal.id}>.`)], flags: MessageFlags.Ephemeral });
      return;
    }

    // ----- /parceria notificar -----
    if (sub === 'notificar') {
      const cargo = interaction.options.getRole('cargo', true);
      await partnershipRepository.setNotifyRole(guildId, cargo.id);
      await interaction.reply({ embeds: [successEmbed(`O cargo ${cargo} será marcado nos anúncios de parceria.`)], flags: MessageFlags.Ephemeral });
      return;
    }

    // ----- /parceria publico -----
    if (sub === 'publico') {
      const canal = interaction.options.getChannel('canal', true);
      await partnershipRepository.setPublicChannel(guildId, canal.id);
      await interaction.reply({ embeds: [successEmbed(`O log público de parcerias será postado em <#${canal.id}>.`)], flags: MessageFlags.Ephemeral });
      return;
    }

    // ----- /parceria imagem -----
    if (sub === 'imagem') {
      const url = interaction.options.getString('url', true).trim();
      if (url.toLowerCase() === 'remover') {
        await partnershipRepository.setImage(guildId, null);
        await interaction.reply({ embeds: [successEmbed('Imagem do embed público removida.')], flags: MessageFlags.Ephemeral });
        return;
      }
      if (!/^https?:\/\/\S+$/.test(url)) {
        await interaction.reply({ embeds: [errorEmbed('URL inválida. Envie um link http(s) ou "remover".')], flags: MessageFlags.Ephemeral });
        return;
      }
      await partnershipRepository.setImage(guildId, url);
      await interaction.reply({ embeds: [successEmbed('Imagem do embed público atualizada.')], flags: MessageFlags.Ephemeral });
      return;
    }

    // ----- /parceria status -----
    if (sub === 'status') {
      const config = await partnershipRepository.getConfig(guildId);
      const roles = await partnershipRepository.getSupportRoleIds(guildId);
      const fmtCh = (id?: string | null) => (id ? `<#${id}>` : '*não definido*');
      const fmtRole = (id?: string | null) => (id ? `<@&${id}>` : '*não definido*');
      const cat = config?.partnerCategoryId ? interaction.guild.channels.cache.get(config.partnerCategoryId)?.name ?? config.partnerCategoryId : '*não definida*';
      const desc =
        `**Cargos autorizados:** ${roles.length > 0 ? roles.map((id) => `<@&${id}>`).join(', ') : '*nenhum*'}\n` +
        `**Categoria:** ${cat}\n` +
        `**Canal de anúncio:** ${fmtCh(config?.partnerAnnounceChannelId)}\n` +
        `**Cargo @parceria:** ${fmtRole(config?.partnerNotifyRoleId)}\n` +
        `**Log público:** ${fmtCh(config?.partnerPublicChannelId)}\n` +
        `**Imagem do log:** ${config?.partnerImageUrl ? '✅ definida' : '*padrão*'}\n` +
        `**Transcript:** configure em \`/logs\` o tipo **Parcerias**.`;
      await interaction.reply({ embeds: [infoEmbed(desc)], flags: MessageFlags.Ephemeral });
      return;
    }

    // ----- /parceria painel -----
    if (!interaction.channel?.isSendable()) {
      await interaction.reply({ embeds: [errorEmbed('Não consigo enviar mensagens neste canal.')], flags: MessageFlags.Ephemeral });
      return;
    }

    const titulo = interaction.options.getString('titulo', true);
    const descricao = (interaction.options.getString('descricao') ?? 'Clique no botão abaixo para solicitar uma parceria com o nosso servidor.').replace(/\\n/g, '\n');
    const embed = new EmbedBuilder().setColor(Palette.info).setTitle(titulo).setDescription(descricao);

    const cor = interaction.options.getString('cor');
    const corInvalida = cor ? !applyColor(embed, cor) : false;
    const imagem = interaction.options.getString('imagem');
    if (imagem) applyUrl((url) => embed.setImage(url), imagem);
    const rodape = interaction.options.getString('rodape');
    if (rodape) embed.setFooter({ text: rodape });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('parceria:open').setLabel('Solicitar parceria').setEmoji('🤝').setStyle(ButtonStyle.Success)
    );
    await interaction.channel.send({ embeds: [embed], components: [row] });

    const aviso = corInvalida ? '\n⚠️ Cor inválida — usei a cor padrão.' : '';
    await interaction.reply({ embeds: [successEmbed(`Painel de parceria criado.${aviso}`)], flags: MessageFlags.Ephemeral });
  }
};

export default command;
