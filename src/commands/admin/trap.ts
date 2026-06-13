import { ChannelType, ChatInputCommandInteraction, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../interfaces/Command';
import { errorEmbed, infoEmbed, successEmbed } from '../../utils/embeds';
import { isAdminOrOwner } from '../../services/permission.service';
import { guildConfigRepository } from '../../repositories/guildConfig.repository';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('trap')
    .setDescription('Canal-armadilha: quem mandar mensagem nele leva kick na hora.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName('definir')
        .setDescription('Define o canal-armadilha.')
        .addChannelOption((opt) =>
          opt.setName('canal').setDescription('Canal que vira armadilha.').addChannelTypes(ChannelType.GuildText).setRequired(true)
        )
    )
    .addSubcommand((sub) => sub.setName('remover').setDescription('Desativa o canal-armadilha.'))
    .addSubcommand((sub) =>
      sub
        .setName('cargo')
        .setDescription('Gerencia os cargos que NÃO levam kick na armadilha.')
        .addStringOption((opt) =>
          opt
            .setName('acao')
            .setDescription('Ação.')
            .setRequired(true)
            .addChoices({ name: 'Adicionar', value: 'adicionar' }, { name: 'Remover', value: 'remover' }, { name: 'Listar', value: 'listar' })
        )
        .addRoleOption((opt) => opt.setName('cargo').setDescription('Cargo (para adicionar/remover).').setRequired(false))
    )
    .addSubcommand((sub) => sub.setName('status').setDescription('Mostra a configuração da armadilha.')),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({ embeds: [errorEmbed('Este comando só pode ser usado em um servidor.')], flags: MessageFlags.Ephemeral });
      return;
    }
    if (!isAdminOrOwner(interaction.user.id, interaction.memberPermissions)) {
      await interaction.reply({ embeds: [errorEmbed('Apenas administradores podem configurar a armadilha.')], flags: MessageFlags.Ephemeral });
      return;
    }

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (sub === 'definir') {
      const canal = interaction.options.getChannel('canal', true);
      await guildConfigRepository.setTrapChannel(guildId, canal.id);
      await interaction.reply({
        embeds: [
          successEmbed(
            `🪤 Armadilha ativada em <#${canal.id}>. Quem mandar mensagem lá leva **kick** na hora (menos você, o bot e os cargos isentos).`
          )
        ],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (sub === 'remover') {
      await guildConfigRepository.setTrapChannel(guildId, null);
      await interaction.reply({ embeds: [successEmbed('Armadilha desativada.')], flags: MessageFlags.Ephemeral });
      return;
    }

    if (sub === 'cargo') {
      const acao = interaction.options.getString('acao', true);
      if (acao === 'listar') {
        const ids = await guildConfigRepository.getTrapExemptRoleIds(guildId);
        const value = ids.length > 0 ? ids.map((id) => `<@&${id}>`).join(', ') : '*nenhum*';
        await interaction.reply({ embeds: [infoEmbed(`**Cargos isentos da armadilha:** ${value}`)], flags: MessageFlags.Ephemeral });
        return;
      }
      const cargo = interaction.options.getRole('cargo');
      if (!cargo) {
        await interaction.reply({ embeds: [errorEmbed('Informe o `cargo` para adicionar/remover.')], flags: MessageFlags.Ephemeral });
        return;
      }
      if (acao === 'adicionar') {
        const added = await guildConfigRepository.addTrapExemptRole(guildId, cargo.id);
        await interaction.reply({
          embeds: [added ? successEmbed(`${cargo} agora é isento da armadilha.`) : infoEmbed(`${cargo} já era isento.`)],
          flags: MessageFlags.Ephemeral
        });
      } else {
        const removed = await guildConfigRepository.removeTrapExemptRole(guildId, cargo.id);
        await interaction.reply({
          embeds: [removed ? successEmbed(`${cargo} não é mais isento.`) : errorEmbed(`${cargo} não estava na lista.`)],
          flags: MessageFlags.Ephemeral
        });
      }
      return;
    }

    // status
    const config = await guildConfigRepository.get(guildId);
    const roles = await guildConfigRepository.getTrapExemptRoleIds(guildId);
    const canal = config?.trapChannelId ? `<#${config.trapChannelId}>` : '*não definido*';
    const value = roles.length > 0 ? roles.map((id) => `<@&${id}>`).join(', ') : '*nenhum*';
    await interaction.reply({
      embeds: [infoEmbed(`**Armadilha (/trap)**\nCanal: ${canal}\nCargos isentos: ${value}\n\n*Você (dono) e o bot são sempre isentos.*`)],
      flags: MessageFlags.Ephemeral
    });
  }
};

export default command;
