import {
  ChannelType,
  ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder
} from 'discord.js';
import { Command } from '../../interfaces/Command';
import { errorEmbed, infoEmbed, successEmbed } from '../../utils/embeds';
import { isAdminOrOwner } from '../../services/permission.service';
import { AutomodAllowFeature, AutomodToggle, automodRepository } from '../../repositories/automod.repository';

const MODULE_LABEL: Record<AutomodToggle, string> = {
  spam: 'Anti-spam',
  bigmessage: 'Anti-mensagens gigantes',
  invite: 'Anti-convites',
  massmention: 'Anti-menção em massa',
  forward: 'Anti-encaminhamento'
};

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('automod')
    .setDescription('Configura a automoderação do servidor.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName('toggle')
        .setDescription('Liga ou desliga um módulo.')
        .addStringOption((opt) =>
          opt
            .setName('modulo')
            .setDescription('Módulo.')
            .setRequired(true)
            .addChoices(
              { name: 'Spam', value: 'spam' },
              { name: 'Mensagens gigantes', value: 'bigmessage' },
              { name: 'Convites', value: 'invite' },
              { name: 'Menção em massa', value: 'massmention' },
              { name: 'Encaminhamento (forward)', value: 'forward' }
            )
        )
        .addBooleanOption((opt) => opt.setName('ativo').setDescription('Ligar (true) ou desligar (false).').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('limite')
        .setDescription('Define o limite de caracteres das mensagens gigantes.')
        .addIntegerOption((opt) =>
          opt.setName('caracteres').setDescription('Máximo de caracteres permitido.').setMinValue(1).setMaxValue(2000).setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('mencoes')
        .setDescription('Define o máximo de menções por mensagem (anti-menção em massa).')
        .addIntegerOption((opt) =>
          opt.setName('quantidade').setDescription('Máximo de menções permitido por mensagem.').setMinValue(1).setMaxValue(50).setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('isento')
        .setDescription('Gerencia os cargos isentos do automod.')
        .addStringOption((opt) =>
          opt
            .setName('acao')
            .setDescription('Ação.')
            .setRequired(true)
            .addChoices({ name: 'Adicionar', value: 'adicionar' }, { name: 'Remover', value: 'remover' }, { name: 'Listar', value: 'listar' })
        )
        .addRoleOption((opt) => opt.setName('cargo').setDescription('Cargo (para adicionar/remover).').setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName('permitir')
        .setDescription('Libera um canal/categoria de um módulo (gigantes, convites ou spam).')
        .addStringOption((opt) =>
          opt
            .setName('modulo')
            .setDescription('Módulo.')
            .setRequired(true)
            .addChoices(
              { name: 'Mensagens gigantes', value: 'bigmessage' },
              { name: 'Convites', value: 'invite' },
              { name: 'Spam', value: 'spam' },
              { name: 'Menção em massa', value: 'massmention' },
              { name: 'Encaminhamento (forward)', value: 'forward' }
            )
        )
        .addChannelOption((opt) =>
          opt
            .setName('canal')
            .setDescription('Canal ou categoria a liberar.')
            .addChannelTypes(
              ChannelType.GuildText,
              ChannelType.GuildAnnouncement,
              ChannelType.GuildVoice,
              ChannelType.GuildForum,
              ChannelType.GuildCategory
            )
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('desbloquear')
        .setDescription('Remove um canal/categoria da liberação de um módulo.')
        .addStringOption((opt) =>
          opt
            .setName('modulo')
            .setDescription('Módulo.')
            .setRequired(true)
            .addChoices(
              { name: 'Mensagens gigantes', value: 'bigmessage' },
              { name: 'Convites', value: 'invite' },
              { name: 'Spam', value: 'spam' },
              { name: 'Menção em massa', value: 'massmention' },
              { name: 'Encaminhamento (forward)', value: 'forward' }
            )
        )
        .addChannelOption((opt) => opt.setName('canal').setDescription('Canal ou categoria.').setRequired(true))
    )
    .addSubcommand((sub) => sub.setName('status').setDescription('Mostra a configuração atual do automod.')),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({ embeds: [errorEmbed('Este comando só pode ser usado em um servidor.')], flags: MessageFlags.Ephemeral });
      return;
    }
    if (!isAdminOrOwner(interaction.user.id, interaction.memberPermissions)) {
      await interaction.reply({ embeds: [errorEmbed('Apenas administradores podem configurar o automod.')], flags: MessageFlags.Ephemeral });
      return;
    }

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (sub === 'toggle') {
      const modulo = interaction.options.getString('modulo', true) as AutomodToggle;
      const ativo = interaction.options.getBoolean('ativo', true);
      await automodRepository.toggle(guildId, modulo, ativo);
      await interaction.reply({
        embeds: [successEmbed(`**${MODULE_LABEL[modulo]}** ${ativo ? 'ativado' : 'desativado'}.`)],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (sub === 'limite') {
      const caracteres = interaction.options.getInteger('caracteres', true);
      await automodRepository.setMaxLength(guildId, caracteres);
      await interaction.reply({
        embeds: [successEmbed(`Limite de mensagens gigantes definido para **${caracteres}** caracteres.`)],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (sub === 'mencoes') {
      const quantidade = interaction.options.getInteger('quantidade', true);
      await automodRepository.setMaxMentions(guildId, quantidade);
      await interaction.reply({
        embeds: [successEmbed(`Limite de menções por mensagem definido para **${quantidade}**.`)],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (sub === 'isento') {
      const acao = interaction.options.getString('acao', true);
      if (acao === 'listar') {
        const ids = await automodRepository.getExemptRoleIds(guildId);
        const value = ids.length > 0 ? ids.map((id) => `<@&${id}>`).join(', ') : '*nenhum*';
        await interaction.reply({ embeds: [infoEmbed(`**Cargos isentos do automod:** ${value}`)], flags: MessageFlags.Ephemeral });
        return;
      }
      const cargo = interaction.options.getRole('cargo');
      if (!cargo) {
        await interaction.reply({ embeds: [errorEmbed('Informe o `cargo` para adicionar/remover.')], flags: MessageFlags.Ephemeral });
        return;
      }
      if (acao === 'adicionar') {
        await automodRepository.addExemptRole(guildId, cargo.id);
        await interaction.reply({ embeds: [successEmbed(`${cargo} agora é isento do automod.`)], flags: MessageFlags.Ephemeral });
      } else {
        const removed = await automodRepository.removeExemptRole(guildId, cargo.id);
        await interaction.reply({
          embeds: [removed ? successEmbed(`${cargo} não é mais isento.`) : errorEmbed(`${cargo} não estava na lista.`)],
          flags: MessageFlags.Ephemeral
        });
      }
      return;
    }

    if (sub === 'permitir' || sub === 'desbloquear') {
      const modulo = interaction.options.getString('modulo', true) as AutomodAllowFeature;
      const canal = interaction.options.getChannel('canal', true);
      if (sub === 'permitir') {
        await automodRepository.addAllow(guildId, modulo, canal.id);
        await interaction.reply({
          embeds: [successEmbed(`${canal} liberado de **${MODULE_LABEL[modulo]}**.`)],
          flags: MessageFlags.Ephemeral
        });
      } else {
        const removed = await automodRepository.removeAllow(guildId, modulo, canal.id);
        await interaction.reply({
          embeds: [removed ? successEmbed(`${canal} removido da liberação.`) : errorEmbed(`${canal} não estava liberado.`)],
          flags: MessageFlags.Ephemeral
        });
      }
      return;
    }

    // status
    const config = await automodRepository.getConfig(guildId);
    const on = (value?: boolean) => (value ? '✅ ligado' : '❌ desligado');
    const exemptRoles = await automodRepository.getExemptRoleIds(guildId);
    const bigChannels = await automodRepository.getAllowedChannels(guildId, 'bigmessage');
    const inviteChannels = await automodRepository.getAllowedChannels(guildId, 'invite');
    const spamChannels = await automodRepository.getAllowedChannels(guildId, 'spam');
    const mentionChannels = await automodRepository.getAllowedChannels(guildId, 'massmention');
    const forwardChannels = await automodRepository.getAllowedChannels(guildId, 'forward');
    const list = (ids: string[], prefix: string) => (ids.length > 0 ? ids.map((id) => `${prefix}${id}>`).join(', ') : '*nenhum*');

    const lines = [
      `**Anti-spam:** ${on(config?.antiSpam)}`,
      `**Anti-mensagens gigantes:** ${on(config?.antiBigMessage)} — limite **${config?.maxMessageLength ?? 600}** caracteres`,
      `**Anti-convites:** ${on(config?.antiInvite)}`,
      `**Anti-menção em massa:** ${on(config?.antiMassMention)} — limite **${config?.maxMentions ?? 5}** menções`,
      `**Anti-encaminhamento:** ${on(config?.antiForward)}`,
      `**Cargos isentos:** ${list(exemptRoles, '<@&')}`,
      `**Liberado (gigantes):** ${list(bigChannels, '<#')}`,
      `**Liberado (convites):** ${list(inviteChannels, '<#')}`,
      `**Liberado (spam):** ${list(spamChannels, '<#')}`,
      `**Liberado (menções):** ${list(mentionChannels, '<#')}`,
      `**Liberado (encaminhamento):** ${list(forwardChannels, '<#')}`
    ];
    await interaction.reply({ embeds: [infoEmbed(`**Automod**\n${lines.join('\n')}`)], flags: MessageFlags.Ephemeral });
  }
};

export default command;
