import { ChatInputCommandInteraction, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../interfaces/Command';
import { errorEmbed, infoEmbed, successEmbed } from '../../utils/embeds';
import { isAdminOrOwner } from '../../services/permission.service';
import { automodRepository } from '../../repositories/automod.repository';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('gifs')
    .setDescription('Restringe o envio de GIFs a cargos específicos (ex.: booster).')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) => sub.setName('ativar').setDescription('Ativa o bloqueio de GIFs (só cargos liberados podem enviar).'))
    .addSubcommand((sub) => sub.setName('desativar').setDescription('Desativa o bloqueio de GIFs.'))
    .addSubcommand((sub) =>
      sub
        .setName('cargo')
        .setDescription('Gerencia os cargos que podem enviar GIFs.')
        .addStringOption((opt) =>
          opt
            .setName('acao')
            .setDescription('Ação.')
            .setRequired(true)
            .addChoices({ name: 'Adicionar', value: 'adicionar' }, { name: 'Remover', value: 'remover' }, { name: 'Listar', value: 'listar' })
        )
        .addRoleOption((opt) => opt.setName('cargo').setDescription('Cargo (para adicionar/remover).').setRequired(false))
    )
    .addSubcommand((sub) => sub.setName('status').setDescription('Mostra a configuração de GIFs.')),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({ embeds: [errorEmbed('Este comando só pode ser usado em um servidor.')], flags: MessageFlags.Ephemeral });
      return;
    }
    if (!isAdminOrOwner(interaction.user.id, interaction.memberPermissions)) {
      await interaction.reply({ embeds: [errorEmbed('Apenas administradores podem configurar os GIFs.')], flags: MessageFlags.Ephemeral });
      return;
    }

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (sub === 'ativar' || sub === 'desativar') {
      const ativo = sub === 'ativar';
      await automodRepository.toggle(guildId, 'gif', ativo);
      await interaction.reply({
        embeds: [
          successEmbed(
            ativo
              ? 'Bloqueio de GIFs **ativado**. Só cargos liberados (`/gifs cargo`) podem enviar GIFs.'
              : 'Bloqueio de GIFs **desativado**.'
          )
        ],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (sub === 'cargo') {
      const acao = interaction.options.getString('acao', true);

      if (acao === 'listar') {
        const ids = await automodRepository.getGifRoleIds(guildId);
        const value = ids.length > 0 ? ids.map((id) => `<@&${id}>`).join(', ') : '*nenhum*';
        await interaction.reply({ embeds: [infoEmbed(`**Cargos que podem enviar GIFs:** ${value}`)], flags: MessageFlags.Ephemeral });
        return;
      }

      const cargo = interaction.options.getRole('cargo');
      if (!cargo) {
        await interaction.reply({ embeds: [errorEmbed('Informe o `cargo` para adicionar/remover.')], flags: MessageFlags.Ephemeral });
        return;
      }

      if (acao === 'adicionar') {
        const added = await automodRepository.addGifRole(guildId, cargo.id);
        await interaction.reply({
          embeds: [added ? successEmbed(`${cargo} agora pode enviar GIFs.`) : infoEmbed(`${cargo} já podia enviar GIFs.`)],
          flags: MessageFlags.Ephemeral
        });
      } else {
        const removed = await automodRepository.removeGifRole(guildId, cargo.id);
        await interaction.reply({
          embeds: [removed ? successEmbed(`${cargo} não pode mais enviar GIFs.`) : errorEmbed(`${cargo} não estava na lista.`)],
          flags: MessageFlags.Ephemeral
        });
      }
      return;
    }

    // status
    const config = await automodRepository.getConfig(guildId);
    const roles = await automodRepository.getGifRoleIds(guildId);
    const allowedChannels = await automodRepository.getAllowedChannels(guildId, 'gif');
    const fmt = (ids: string[], prefix: string) => (ids.length > 0 ? ids.map((id) => `${prefix}${id}>`).join(', ') : '*nenhum*');
    await interaction.reply({
      embeds: [
        infoEmbed(
          `**Bloqueio de GIFs:** ${config?.antiGif ? '🟢 ativo' : '🔴 inativo'}\n` +
            `**Cargos liberados:** ${fmt(roles, '<@&')}\n` +
            `**Canais liberados (todos podem):** ${fmt(allowedChannels, '<#')}`
        )
      ],
      flags: MessageFlags.Ephemeral
    });
  }
};

export default command;
