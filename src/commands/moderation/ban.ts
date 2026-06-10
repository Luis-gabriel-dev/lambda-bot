import {
  ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder
} from 'discord.js';
import { Command } from '../../interfaces/Command';
import { errorEmbed, successEmbed } from '../../utils/embeds';
import { checkHierarchy } from '../../services/moderation.service';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Bane um usuário do servidor.')
    .addUserOption((opt) => opt.setName('usuario').setDescription('Usuário a banir.').setRequired(true))
    .addStringOption((opt) => opt.setName('motivo').setDescription('Motivo do banimento.').setRequired(false))
    .addIntegerOption((opt) =>
      opt
        .setName('apagar_dias')
        .setDescription('Apagar mensagens dos últimos N dias (0 a 7).')
        .setMinValue(0)
        .setMaxValue(7)
        .setRequired(false)
    ),

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

    const user = interaction.options.getUser('usuario', true);
    const reason = interaction.options.getString('motivo') ?? 'Sem motivo informado';
    const deleteDays = interaction.options.getInteger('apagar_dias') ?? 0;

    // O membro pode não estar no servidor (banir por ID ainda funciona).
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (member) {
      const hierarchyError = checkHierarchy(interaction.member, member);
      if (hierarchyError) {
        await interaction.reply({ embeds: [errorEmbed(hierarchyError)], flags: MessageFlags.Ephemeral });
        return;
      }
      if (!member.bannable) {
        await interaction.reply({
          embeds: [errorEmbed('Não consigo banir esse membro (o cargo dele está acima do meu).')],
          flags: MessageFlags.Ephemeral
        });
        return;
      }
    }

    // Tenta avisar o usuário por DM antes de banir (depois do ban não há servidor em comum).
    await user
      .send(`Você foi **banido** de **${interaction.guild.name}**.\nMotivo: ${reason}`)
      .catch(() => undefined);

    await interaction.guild.bans.create(user.id, {
      reason: `${interaction.user.tag}: ${reason}`,
      deleteMessageSeconds: deleteDays * 86_400
    });

    await interaction.reply({
      embeds: [successEmbed(`🔨 **${user.tag}** foi banido.\nMotivo: ${reason}`)]
    });
  }
};

export default command;
