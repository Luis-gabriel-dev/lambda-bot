import { Client, Interaction, MessageFlags } from 'discord.js';
import { Event } from '../interfaces/Event';
import { logger } from '../core/logger';
import { errorEmbed } from '../utils/embeds';
import { missingPermissionNames } from '../utils/permissions';

const event: Event<'interactionCreate'> = {
  name: 'interactionCreate',
  async execute(client: Client, interaction: Interaction) {
    try {
      // -------- Comandos slash --------
      if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        if (command.permissions?.length) {
          if (!interaction.inGuild() || !interaction.memberPermissions?.has(command.permissions)) {
            const missing = missingPermissionNames(interaction.memberPermissions, command.permissions);
            await interaction.reply({
              embeds: [errorEmbed(`Você não tem permissão para usar este comando.\nNecessário: \`${missing.join('`, `')}\``)],
              flags: MessageFlags.Ephemeral
            });
            return;
          }
        }

        await command.execute(interaction);
        return;
      }

      // -------- Botões / menus / modais (roteados por prefixo do customId) --------
      if (interaction.isButton() || interaction.isAnySelectMenu() || interaction.isModalSubmit()) {
        const prefix = interaction.customId.split(':')[0]!;
        const component = client.components.get(prefix);
        if (!component) return;
        await component.execute(interaction);
      }
    } catch (err) {
      logger.error('Erro ao processar interação:', err);
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        await interaction
          .reply({ embeds: [errorEmbed('Ocorreu um erro ao processar essa ação.')], flags: MessageFlags.Ephemeral })
          .catch(() => undefined);
      }
    }
  }
};

export default event;
