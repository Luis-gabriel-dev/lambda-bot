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
    .setName('kick')
    .setDescription('Expulsa um membro do servidor.')
    .addUserOption((opt) => opt.setName('usuario').setDescription('Membro a expulsar.').setRequired(true))
    .addStringOption((opt) => opt.setName('motivo').setDescription('Motivo da expulsão.').setRequired(false)),

  restricted: true,

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({
        embeds: [errorEmbed('Este comando só pode ser usado em um servidor.')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (!interaction.appPermissions?.has(PermissionFlagsBits.KickMembers)) {
      await interaction.reply({
        embeds: [errorEmbed('Eu não tenho a permissão **Expulsar Membros** neste servidor.')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const user = interaction.options.getUser('usuario', true);
    const reason = interaction.options.getString('motivo') ?? 'Sem motivo informado';

    // Kick exige o membro presente no servidor.
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) {
      await interaction.reply({
        embeds: [errorEmbed('Esse usuário não está no servidor.')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const hierarchyError = checkHierarchy(interaction.member, member);
    if (hierarchyError) {
      await interaction.reply({ embeds: [errorEmbed(hierarchyError)], flags: MessageFlags.Ephemeral });
      return;
    }

    if (!member.kickable) {
      await interaction.reply({
        embeds: [errorEmbed('Não consigo expulsar esse membro (o cargo dele está acima do meu).')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    // Avisa por DM antes de expulsar.
    await member
      .send(`Você foi **expulso** de **${interaction.guild.name}**.\nMotivo: ${reason}`)
      .catch(() => undefined);

    await member.kick(`${interaction.user.tag}: ${reason}`);

    await interaction.reply({
      embeds: [successEmbed(`👢 **${user.tag}** foi expulso.\nMotivo: ${reason}`)]
    });
  }
};

export default command;
