import {
  ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder
} from 'discord.js';
import { Command } from '../../interfaces/Command';
import { errorEmbed, infoEmbed, successEmbed } from '../../utils/embeds';
import { isOwner } from '../../services/permission.service';
import { commandPermissionRepository } from '../../repositories/commandPermission.repository';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('permissao')
    .setDescription('Define quais cargos podem usar os comandos restritos.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Autoriza um cargo a usar um comando restrito.')
        .addStringOption((opt) => opt.setName('comando').setDescription('Nome do comando (ex.: clear).').setRequired(true))
        .addRoleOption((opt) => opt.setName('cargo').setDescription('Cargo a autorizar.').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('remover')
        .setDescription('Remove a autorização de um cargo.')
        .addStringOption((opt) => opt.setName('comando').setDescription('Nome do comando (ex.: clear).').setRequired(true))
        .addRoleOption((opt) => opt.setName('cargo').setDescription('Cargo a remover.').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub.setName('listar').setDescription('Lista as permissões configuradas neste servidor.')
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({
        embeds: [errorEmbed('Este comando só pode ser usado em um servidor.')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    // Gate próprio: apenas o dono do bot ou administradores do servidor.
    if (!isOwner(interaction.user.id) && !interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({
        embeds: [errorEmbed('Apenas administradores podem configurar permissões.')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (sub === 'listar') {
      const rows = await commandPermissionRepository.listForGuild(guildId);
      if (rows.length === 0) {
        await interaction.reply({
          embeds: [infoEmbed('Nenhuma permissão configurada. Comandos restritos só podem ser usados pelo dono do bot.')],
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      const byCommand = new Map<string, string[]>();
      for (const row of rows) {
        const list = byCommand.get(row.command) ?? [];
        list.push(`<@&${row.roleId}>`);
        byCommand.set(row.command, list);
      }
      const lines = [...byCommand.entries()].map(([cmd, roles]) => `**/${cmd}** → ${roles.join(', ')}`);

      await interaction.reply({
        embeds: [infoEmbed(`**Permissões configuradas:**\n${lines.join('\n')}`)],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    // add / remover
    const commandName = interaction.options.getString('comando', true).toLowerCase().replace(/^\//, '');
    const role = interaction.options.getRole('cargo', true);

    const target = interaction.client.commands.get(commandName);
    if (!target) {
      await interaction.reply({
        embeds: [errorEmbed(`O comando \`/${commandName}\` não existe.`)],
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    if (!target.restricted) {
      await interaction.reply({
        embeds: [errorEmbed(`\`/${commandName}\` não é um comando restrito — qualquer um já pode usá-lo.`)],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (sub === 'add') {
      await commandPermissionRepository.addRole(guildId, commandName, role.id);
      await interaction.reply({
        embeds: [successEmbed(`${role} agora pode usar **/${commandName}**.`)],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (sub === 'remover') {
      const removed = await commandPermissionRepository.removeRole(guildId, commandName, role.id);
      await interaction.reply({
        embeds: [
          removed
            ? successEmbed(`${role} não pode mais usar **/${commandName}**.`)
            : errorEmbed(`${role} não estava autorizado em **/${commandName}**.`)
        ],
        flags: MessageFlags.Ephemeral
      });
    }
  }
};

export default command;
