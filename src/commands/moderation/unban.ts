import {
  ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder
} from 'discord.js';
import { Command } from '../../interfaces/Command';
import { errorEmbed, successEmbed } from '../../utils/embeds';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Remove o banimento de um usuário (revoga o ban).')
    .addStringOption((opt) => opt.setName('id').setDescription('ID do usuário banido.').setRequired(true))
    .addStringOption((opt) => opt.setName('motivo').setDescription('Motivo.').setRequired(false)),

  restricted: true,

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({
        embeds: [errorEmbed('Este comando só pode ser usado em um servidor.')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (!interaction.appPermissions?.has(PermissionFlagsBits.BanMembers)) {
      await interaction.reply({
        embeds: [errorEmbed('Eu não tenho a permissão **Banir Membros** neste servidor.')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const userId = interaction.options.getString('id', true).trim();
    const reason = interaction.options.getString('motivo')?.trim() || 'Sem motivo informado';

    if (!/^\d{17,20}$/.test(userId)) {
      await interaction.reply({ embeds: [errorEmbed('ID inválido. Informe o ID numérico do usuário.')], flags: MessageFlags.Ephemeral });
      return;
    }

    const ban = await interaction.guild.bans.fetch(userId).catch(() => null);
    if (!ban) {
      await interaction.reply({ embeds: [errorEmbed('Esse usuário não está banido.')], flags: MessageFlags.Ephemeral });
      return;
    }

    // O evento guildBanRemove cuida do log no #log-de-moderação.
    await interaction.guild.bans.remove(userId, `${interaction.user.tag}: ${reason}`);

    await interaction.reply({
      embeds: [successEmbed(`✅ Banimento de **${ban.user.tag}** removido.\nMotivo: ${reason}`)],
      flags: MessageFlags.Ephemeral
    });
  }
};

export default command;
