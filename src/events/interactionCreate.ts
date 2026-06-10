import { Client, Interaction, MessageFlags } from 'discord.js';
import { Event } from '../interfaces/Event';
import { logger } from '../core/logger';
import { errorEmbed } from '../utils/embeds';
import { resolveAccess } from '../services/permission.service';

const event: Event<'interactionCreate'> = {
  name: 'interactionCreate',
  async execute(client: Client, interaction: Interaction) {
    try {
      // -------- Comandos slash --------
      if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        const access = await resolveAccess(interaction, command);
        if (!access.allowed) {
          await interaction.reply({
            embeds: [errorEmbed(access.reason ?? 'Você não pode usar este comando.')],
            flags: MessageFlags.Ephemeral
          });
          return;
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
