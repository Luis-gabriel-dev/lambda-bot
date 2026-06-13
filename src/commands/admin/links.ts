import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageActionRowComponentBuilder,
  MessageFlags,
  ModalBuilder,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';
import { Command } from '../../interfaces/Command';
import { Component, ComponentInteraction } from '../../interfaces/Component';
import { errorEmbed, infoEmbed, Palette, successEmbed } from '../../utils/embeds';
import { isAdminOrOwner } from '../../services/permission.service';
import { automodRepository } from '../../repositories/automod.repository';
import { normalizeDomain } from '../../services/automod.service';

type LinkListKind = 'white' | 'black';

/** Monta o embed da whitelist OU blacklist + (se admin) os controles de adicionar/remover. */
async function buildListView(
  guildId: string,
  isAdmin: boolean,
  kind: LinkListKind
): Promise<{ embeds: EmbedBuilder[]; components: ActionRowBuilder<MessageActionRowComponentBuilder>[] }> {
  const isBlack = kind === 'black';
  const domains = [...(isBlack ? await automodRepository.getLinkBlacklist(guildId) : await automodRepository.getLinkWhitelist(guildId))].sort();

  let lista: string;
  if (domains.length === 0) {
    lista = isBlack ? '*Nenhum link bloqueado ainda.*' : '*Nenhum link liberado ainda.*';
  } else if (isBlack) {
    lista = domains.map((d) => `• \`${d}\``).join('\n');
  } else {
    const channelMap = await automodRepository.getDomainChannelMap(guildId);
    lista = domains
      .map((d) => {
        const ch = channelMap.get(d);
        return ch && ch.length > 0 ? `• \`${d}\` — só em ${ch.map((id) => `<#${id}>`).join(', ')}` : `• \`${d}\``;
      })
      .join('\n');
  }

  const embed = new EmbedBuilder()
    .setColor(isBlack ? Palette.error : Palette.info)
    .setTitle(isBlack ? '🚫 Links bloqueados' : '🔗 Links permitidos')
    .setDescription(lista)
    .setFooter({
      text: !isAdmin
        ? isBlack
          ? 'Estes links são bloqueados no servidor.'
          : 'Apenas estes links são permitidos no servidor.'
        : isBlack
          ? 'Modo blacklist: tudo é liberado, só estes são bloqueados.'
          : 'Botões = whitelist global • /links canal restringe a canais • /links cargo libera por cargo'
    });

  if (!isAdmin) return { embeds: [embed], components: [] };

  const components: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [
    new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`links:add:${kind}`)
        .setLabel(isBlack ? 'Bloquear' : 'Adicionar')
        .setEmoji('➕')
        .setStyle(isBlack ? ButtonStyle.Danger : ButtonStyle.Success)
    )
  ];
  if (domains.length > 0) {
    components.push(
      new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`links:remove:${kind}`)
          .setPlaceholder(isBlack ? 'Desbloquear um link…' : 'Remover um link…')
          .addOptions(domains.slice(0, 25).map((d) => ({ label: d, value: d })))
      )
    );
  }
  return { embeds: [embed], components };
}

const component: Component = {
  id: 'links',
  async execute(interaction: ComponentInteraction) {
    if (!interaction.inCachedGuild()) return;
    if (!interaction.isButton() && !interaction.isStringSelectMenu() && !interaction.isModalSubmit()) return;
    if (!isAdminOrOwner(interaction.user.id, interaction.memberPermissions)) {
      await interaction.reply({ embeds: [errorEmbed('Apenas administradores podem editar a lista.')], flags: MessageFlags.Ephemeral });
      return;
    }

    const [, action, rawKind] = interaction.customId.split(':');
    const kind: LinkListKind = rawKind === 'black' ? 'black' : 'white';
    const isBlack = kind === 'black';
    const guildId = interaction.guildId;

    // Botão "Adicionar/Bloquear" → abre modal.
    if (interaction.isButton() && action === 'add') {
      const modal = new ModalBuilder().setCustomId(`links:modal:${kind}`).setTitle(isBlack ? 'Bloquear link' : 'Adicionar link permitido');
      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('dominio')
            .setLabel('Domínio (ex.: youtube.com)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('youtube.com')
            .setRequired(true)
        )
      );
      await interaction.showModal(modal);
      return;
    }

    // Select "Remover/Desbloquear" → tira o domínio e atualiza o painel.
    if (interaction.isStringSelectMenu() && action === 'remove') {
      const domain = interaction.values[0]!;
      if (isBlack) await automodRepository.removeBlockedDomain(guildId, domain);
      else await automodRepository.removeLinkDomain(guildId, domain);
      await interaction.update(await buildListView(guildId, true, kind));
      return;
    }

    // Modal → valida, adiciona e atualiza o painel.
    if (interaction.isModalSubmit() && action === 'modal') {
      const domain = normalizeDomain(interaction.fields.getTextInputValue('dominio'));
      if (!domain) {
        await interaction.reply({ embeds: [errorEmbed('Domínio inválido. Use algo como `youtube.com`.')], flags: MessageFlags.Ephemeral });
        return;
      }
      const added = isBlack ? await automodRepository.addBlockedDomain(guildId, domain) : await automodRepository.addLinkDomain(guildId, domain);
      const okMsg = isBlack ? `Bloqueado: \`${domain}\`` : `Adicionado: \`${domain}\``;
      const dupMsg = isBlack ? `\`${domain}\` já estava bloqueado.` : `\`${domain}\` já estava na lista.`;
      const result = added ? successEmbed(okMsg) : infoEmbed(dupMsg);
      if (interaction.isFromMessage()) {
        await interaction.update(await buildListView(guildId, true, kind));
        await interaction.followUp({ embeds: [result], flags: MessageFlags.Ephemeral });
      } else {
        await interaction.reply({ embeds: [result], flags: MessageFlags.Ephemeral });
      }
    }
  }
};

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('links')
    .setDescription('Configura os links permitidos/bloqueados do servidor.')
    .addSubcommand((sub) => sub.setName('permitidos').setDescription('Mostra (e, para admins, edita) a whitelist global de links.'))
    .addSubcommand((sub) =>
      sub
        .setName('cargo')
        .setDescription('Libera links para um cargo (todos ou domínios específicos).')
        .addRoleOption((opt) => opt.setName('cargo').setDescription('Cargo a configurar.').setRequired(true))
        .addStringOption((opt) =>
          opt
            .setName('acao')
            .setDescription('O que fazer.')
            .setRequired(true)
            .addChoices(
              { name: 'Liberar TODOS os links', value: 'tudo' },
              { name: 'Adicionar um domínio', value: 'adicionar' },
              { name: 'Remover um domínio', value: 'remover' },
              { name: 'Limpar (tirar liberações)', value: 'limpar' },
              { name: 'Ver liberações do cargo', value: 'ver' }
            )
        )
        .addStringOption((opt) => opt.setName('dominio').setDescription('Domínio (para adicionar/remover). Ex.: youtube.com').setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName('canal')
        .setDescription('Restringe um link a canais/categorias específicos.')
        .addStringOption((opt) =>
          opt
            .setName('acao')
            .setDescription('O que fazer.')
            .setRequired(true)
            .addChoices(
              { name: 'Adicionar canal ao link', value: 'adicionar' },
              { name: 'Remover canal do link', value: 'remover' },
              { name: 'Ver canais do link', value: 'ver' }
            )
        )
        .addStringOption((opt) => opt.setName('dominio').setDescription('Domínio. Ex.: youtube.com').setRequired(true))
        .addChannelOption((opt) =>
          opt
            .setName('canal')
            .setDescription('Canal ou categoria (para adicionar/remover).')
            .addChannelTypes(
              ChannelType.GuildText,
              ChannelType.GuildAnnouncement,
              ChannelType.GuildVoice,
              ChannelType.GuildForum,
              ChannelType.GuildCategory
            )
            .setRequired(false)
        )
    )
    .addSubcommand((sub) => sub.setName('bloqueados').setDescription('Mostra (e, para admins, edita) a blacklist de links (modo blacklist).'))
    .addSubcommand((sub) =>
      sub
        .setName('modo')
        .setDescription('Escolhe o modo do anti-link.')
        .addStringOption((opt) =>
          opt
            .setName('modo')
            .setDescription('whitelist = bloqueia tudo e libera a lista; blacklist = libera tudo e bloqueia a lista.')
            .setRequired(true)
            .addChoices(
              { name: 'whitelist (bloquear tudo, liberar lista)', value: 'whitelist' },
              { name: 'blacklist (liberar tudo, bloquear lista)', value: 'blacklist' }
            )
        )
    ),

  components: [component],

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({ embeds: [errorEmbed('Este comando só pode ser usado em um servidor.')], flags: MessageFlags.Ephemeral });
      return;
    }

    const sub = interaction.options.getSubcommand();
    if (sub === 'cargo') {
      await handleCargo(interaction);
      return;
    }
    if (sub === 'canal') {
      await handleCanal(interaction);
      return;
    }
    if (sub === 'modo') {
      await handleModo(interaction);
      return;
    }

    // permitidos / bloqueados — qualquer um vê; admin edita pelos botões.
    const kind: LinkListKind = sub === 'bloqueados' ? 'black' : 'white';
    const isAdmin = isAdminOrOwner(interaction.user.id, interaction.memberPermissions);
    const view = await buildListView(interaction.guildId, isAdmin, kind);
    await interaction.reply({ embeds: view.embeds, components: view.components, flags: MessageFlags.Ephemeral });
  }
};

/** /links modo — alterna entre whitelist e blacklist. */
async function handleModo(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.inCachedGuild()) return;
  if (!isAdminOrOwner(interaction.user.id, interaction.memberPermissions)) {
    await interaction.reply({ embeds: [errorEmbed('Apenas administradores podem mudar o modo do anti-link.')], flags: MessageFlags.Ephemeral });
    return;
  }
  const modo = interaction.options.getString('modo', true) as 'whitelist' | 'blacklist';
  await automodRepository.setLinkMode(interaction.guildId, modo);
  const texto =
    modo === 'blacklist'
      ? 'Modo **blacklist**: todos os links são liberados, só os da lista (`/links bloqueados`) são bloqueados.'
      : 'Modo **whitelist**: todos os links são bloqueados, só os liberados (`/links permitidos`, `/links cargo`, `/links canal`) passam.';
  await interaction.reply({ embeds: [successEmbed(texto)], flags: MessageFlags.Ephemeral });
}

/** /links cargo — libera links para um cargo (todos ou domínios específicos). */
async function handleCargo(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.inCachedGuild()) return;
  if (!isAdminOrOwner(interaction.user.id, interaction.memberPermissions)) {
    await interaction.reply({ embeds: [errorEmbed('Apenas administradores podem liberar links para cargos.')], flags: MessageFlags.Ephemeral });
    return;
  }

  const guildId = interaction.guildId;
  const role = interaction.options.getRole('cargo', true);
  const acao = interaction.options.getString('acao', true);

  if (acao === 'ver') {
    const domains = await automodRepository.getRoleLinkDomains(guildId, role.id);
    const desc = domains.includes('*')
      ? `${role} pode enviar **todos os links**.`
      : domains.length > 0
        ? `${role} pode enviar links de: ${domains.map((d) => `\`${d}\``).join(', ')}.`
        : `${role} não tem liberação especial de links.`;
    await interaction.reply({ embeds: [infoEmbed(desc)], flags: MessageFlags.Ephemeral });
    return;
  }

  if (acao === 'tudo') {
    await automodRepository.clearRoleLinks(guildId, role.id);
    await automodRepository.addRoleLink(guildId, role.id, '*');
    await interaction.reply({ embeds: [successEmbed(`${role} agora pode enviar **todos os links**.`)], flags: MessageFlags.Ephemeral });
    return;
  }

  if (acao === 'limpar') {
    const removed = await automodRepository.clearRoleLinks(guildId, role.id);
    await interaction.reply({
      embeds: [removed > 0 ? successEmbed(`Liberações de link de ${role} removidas.`) : errorEmbed(`${role} não tinha liberações de link.`)],
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  // adicionar / remover — exigem domínio.
  const domain = normalizeDomain(interaction.options.getString('dominio') ?? '');
  if (!domain) {
    await interaction.reply({ embeds: [errorEmbed('Informe um `dominio` válido (ex.: `youtube.com`).')], flags: MessageFlags.Ephemeral });
    return;
  }

  if (acao === 'adicionar') {
    await automodRepository.removeRoleLink(guildId, role.id, '*'); // sai do modo "todos os links"
    const added = await automodRepository.addRoleLink(guildId, role.id, domain);
    await interaction.reply({
      embeds: [added ? successEmbed(`${role} agora pode enviar links de \`${domain}\`.`) : infoEmbed(`${role} já podia enviar \`${domain}\`.`)],
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  // remover
  const removed = await automodRepository.removeRoleLink(guildId, role.id, domain);
  await interaction.reply({
    embeds: [removed ? successEmbed(`\`${domain}\` removido de ${role}.`) : errorEmbed(`${role} não tinha \`${domain}\` liberado.`)],
    flags: MessageFlags.Ephemeral
  });
}

/** /links canal — restringe um domínio a canais/categorias específicos. */
async function handleCanal(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.inCachedGuild()) return;
  if (!isAdminOrOwner(interaction.user.id, interaction.memberPermissions)) {
    await interaction.reply({ embeds: [errorEmbed('Apenas administradores podem restringir links a canais.')], flags: MessageFlags.Ephemeral });
    return;
  }

  const guildId = interaction.guildId;
  const acao = interaction.options.getString('acao', true);
  const domain = normalizeDomain(interaction.options.getString('dominio', true));
  if (!domain) {
    await interaction.reply({ embeds: [errorEmbed('Informe um `dominio` válido (ex.: `youtube.com`).')], flags: MessageFlags.Ephemeral });
    return;
  }

  if (acao === 'ver') {
    const channels = await automodRepository.getDomainChannels(guildId, domain);
    const desc =
      channels.length > 0
        ? `\`${domain}\` só pode ser enviado em: ${channels.map((id) => `<#${id}>`).join(', ')}.`
        : `\`${domain}\` pode ser enviado em **todos os canais** (sem restrição).`;
    await interaction.reply({ embeds: [infoEmbed(desc)], flags: MessageFlags.Ephemeral });
    return;
  }

  const canal = interaction.options.getChannel('canal');
  if (!canal) {
    await interaction.reply({ embeds: [errorEmbed('Informe o `canal` (ou categoria) para adicionar/remover.')], flags: MessageFlags.Ephemeral });
    return;
  }

  if (acao === 'adicionar') {
    const added = await automodRepository.addDomainChannel(guildId, domain, canal.id);
    await interaction.reply({
      embeds: [
        added
          ? successEmbed(`\`${domain}\` agora só é permitido em <#${canal.id}> (e nos outros canais que você adicionar).`)
          : infoEmbed(`\`${domain}\` já estava restrito a <#${canal.id}>.`)
      ],
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  // remover
  const removed = await automodRepository.removeDomainChannel(guildId, domain, canal.id);
  const remaining = await automodRepository.getDomainChannels(guildId, domain);
  const extra = removed && remaining.length === 0 ? ' Agora ele é permitido em **todos os canais**.' : '';
  await interaction.reply({
    embeds: [
      removed
        ? successEmbed(`<#${canal.id}> removido das restrições de \`${domain}\`.${extra}`)
        : errorEmbed(`\`${domain}\` não estava restrito a <#${canal.id}>.`)
    ],
    flags: MessageFlags.Ephemeral
  });
}

export default command;
