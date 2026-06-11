import {
  ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder
} from 'discord.js';
import { Command } from '../../interfaces/Command';
import { errorEmbed, infoEmbed, successEmbed } from '../../utils/embeds';
import { isAdminOrOwner } from '../../services/permission.service';
import { AutoRoleType, guildConfigRepository } from '../../repositories/guildConfig.repository';

const TYPE_CHOICES = [
  { name: 'Membro (humanos)', value: 'membro' },
  { name: 'Bot', value: 'bot' }
];

function isAutoRoleType(value: string): value is AutoRoleType {
  return value === 'membro' || value === 'bot';
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('autorole')
    .setDescription('Configura os cargos dados automaticamente quando alguém entra no servidor.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName('definir')
        .setDescription('Define o cargo automático de membros ou de bots.')
        .addStringOption((opt) =>
          opt.setName('tipo').setDescription('Para quem é o cargo.').setRequired(true).addChoices(...TYPE_CHOICES)
        )
        .addRoleOption((opt) => opt.setName('cargo').setDescription('Cargo a atribuir automaticamente.').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('remover')
        .setDescription('Desativa o cargo automático de membros ou de bots.')
        .addStringOption((opt) =>
          opt.setName('tipo').setDescription('Qual cargo automático remover.').setRequired(true).addChoices(...TYPE_CHOICES)
        )
    )
    .addSubcommand((sub) => sub.setName('listar').setDescription('Mostra os cargos automáticos configurados.')),

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
        embeds: [errorEmbed('Apenas administradores podem configurar os cargos automáticos.')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (sub === 'listar') {
      const config = await guildConfigRepository.get(guildId);
      const membro = config?.autoRoleId ? `<@&${config.autoRoleId}>` : '*não configurado*';
      const bot = config?.botRoleId ? `<@&${config.botRoleId}>` : '*não configurado*';
      await interaction.reply({
        embeds: [infoEmbed(`**Cargos automáticos:**\n**Membros** → ${membro}\n**Bots** → ${bot}`)],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const type = interaction.options.getString('tipo', true);
    if (!isAutoRoleType(type)) {
      await interaction.reply({ embeds: [errorEmbed('Tipo inválido.')], flags: MessageFlags.Ephemeral });
      return;
    }
    const label = type === 'bot' ? 'bots' : 'membros';

    if (sub === 'definir') {
      const role = interaction.options.getRole('cargo', true);

      if (role.id === guildId || role.managed) {
        await interaction.reply({
          embeds: [errorEmbed('Não é possível usar o `@everyone` nem cargos gerenciados (de bots/integrações).')],
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      // O bot precisa conseguir atribuir o cargo (permissão + cargo abaixo do meu).
      const me = interaction.guild.members.me;
      if (!me?.permissions.has(PermissionFlagsBits.ManageRoles)) {
        await interaction.reply({
          embeds: [errorEmbed('Eu não tenho a permissão **Gerenciar Cargos** neste servidor.')],
          flags: MessageFlags.Ephemeral
        });
        return;
      }
      if (me.roles.highest.comparePositionTo(role.id) <= 0) {
        await interaction.reply({
          embeds: [errorEmbed(`O cargo ${role} está acima (ou no mesmo nível) do meu — não conseguirei atribuí-lo. Mova meu cargo acima dele.`)],
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      await guildConfigRepository.setAutoRole(guildId, type, role.id);
      await interaction.reply({
        embeds: [successEmbed(`Cargo automático de **${label}** definido como ${role}.`)],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (sub === 'remover') {
      const removed = await guildConfigRepository.removeAutoRole(guildId, type);
      await interaction.reply({
        embeds: [
          removed
            ? successEmbed(`Cargo automático de **${label}** desativado.`)
            : errorEmbed(`Não havia cargo automático de **${label}** configurado.`)
        ],
        flags: MessageFlags.Ephemeral
      });
    }
  }
};

export default command;
