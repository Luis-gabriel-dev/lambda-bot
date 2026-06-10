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
import { LOG_TYPES, LogType, isLogType } from '../../services/log.service';
import { logChannelRepository } from '../../repositories/logChannel.repository';

const typeChoices = Object.entries(LOG_TYPES).map(([value, name]) => ({ name, value }));

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('logs')
    .setDescription('Configura os canais de log do servidor.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName('definir')
        .setDescription('Define o canal de um tipo de log.')
        .addStringOption((opt) =>
          opt.setName('tipo').setDescription('Tipo de log.').setRequired(true).addChoices(...typeChoices)
        )
        .addChannelOption((opt) =>
          opt
            .setName('canal')
            .setDescription('Canal de texto que receberá os logs.')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('remover')
        .setDescription('Remove o canal de um tipo de log.')
        .addStringOption((opt) =>
          opt.setName('tipo').setDescription('Tipo de log.').setRequired(true).addChoices(...typeChoices)
        )
    )
    .addSubcommand((sub) =>
      sub.setName('listar').setDescription('Lista os canais de log configurados.')
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({
        embeds: [errorEmbed('Este comando só pode ser usado em um servidor.')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (!isAdminOrOwner(interaction.user.id, interaction.memberPermissions)) {
      await interaction.reply({
        embeds: [errorEmbed('Apenas administradores podem configurar os logs.')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (sub === 'listar') {
      const rows = await logChannelRepository.listForGuild(guildId);
      const lines = (Object.keys(LOG_TYPES) as LogType[]).map((type) => {
        const row = rows.find((r) => r.type === type);
        return `**${LOG_TYPES[type]}** → ${row ? `<#${row.channelId}>` : '*não configurado*'}`;
      });
      await interaction.reply({
        embeds: [infoEmbed(`**Canais de log:**\n${lines.join('\n')}`)],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const type = interaction.options.getString('tipo', true);
    if (!isLogType(type)) {
      await interaction.reply({ embeds: [errorEmbed('Tipo de log inválido.')], flags: MessageFlags.Ephemeral });
      return;
    }

    if (sub === 'definir') {
      const channel = interaction.options.getChannel('canal', true);
      await logChannelRepository.setChannel(guildId, type, channel.id);
      await interaction.reply({
        embeds: [successEmbed(`Logs de **${LOG_TYPES[type]}** agora vão para <#${channel.id}>.`)],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (sub === 'remover') {
      const removed = await logChannelRepository.removeChannel(guildId, type);
      await interaction.reply({
        embeds: [
          removed
            ? successEmbed(`Logs de **${LOG_TYPES[type]}** desativados.`)
            : errorEmbed(`**${LOG_TYPES[type]}** não estava configurado.`)
        ],
        flags: MessageFlags.Ephemeral
      });
    }
  }
};

export default command;
