import { ChannelType, ChatInputCommandInteraction, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../interfaces/Command';
import { errorEmbed, infoEmbed, successEmbed } from '../../utils/embeds';
import { isAdminOrOwner } from '../../services/permission.service';
import { guildConfigRepository } from '../../repositories/guildConfig.repository';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configurações gerais do servidor.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommandGroup((group) =>
      group
        .setName('bump')
        .setDescription('Canal exclusivo de /bump.')
        .addSubcommand((sub) =>
          sub
            .setName('canal')
            .setDescription('Define o canal onde só vale /bump.')
            .addChannelOption((opt) =>
              opt.setName('canal').setDescription('Canal do bump.').addChannelTypes(ChannelType.GuildText).setRequired(true)
            )
        )
        .addSubcommand((sub) => sub.setName('desativar').setDescription('Desativa o canal exclusivo de /bump.'))
        .addSubcommand((sub) =>
          sub
            .setName('cargo')
            .setDescription('Cargos que podem mandar outras coisas no canal de bump.')
            .addStringOption((opt) =>
              opt
                .setName('acao')
                .setDescription('Ação.')
                .setRequired(true)
                .addChoices({ name: 'Adicionar', value: 'adicionar' }, { name: 'Remover', value: 'remover' }, { name: 'Listar', value: 'listar' })
            )
            .addRoleOption((opt) => opt.setName('cargo').setDescription('Cargo (para adicionar/remover).').setRequired(false))
        )
        .addSubcommand((sub) => sub.setName('status').setDescription('Mostra a configuração do canal de bump.'))
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({ embeds: [errorEmbed('Este comando só pode ser usado em um servidor.')], flags: MessageFlags.Ephemeral });
      return;
    }
    if (!isAdminOrOwner(interaction.user.id, interaction.memberPermissions)) {
      await interaction.reply({ embeds: [errorEmbed('Apenas administradores podem configurar.')], flags: MessageFlags.Ephemeral });
      return;
    }

    const guildId = interaction.guildId;
    const group = interaction.options.getSubcommandGroup();
    const sub = interaction.options.getSubcommand();

    if (group !== 'bump') return;

    if (sub === 'canal') {
      const canal = interaction.options.getChannel('canal', true);
      await guildConfigRepository.setBumpChannel(guildId, canal.id);
      await interaction.reply({
        embeds: [
          successEmbed(
            `Canal de bump definido para <#${canal.id}>. Só **/bump** é permitido lá — qualquer outra mensagem é apagada ` +
              `(bots, você e cargos liberados passam livres).`
          )
        ],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (sub === 'desativar') {
      await guildConfigRepository.setBumpChannel(guildId, null);
      await interaction.reply({ embeds: [successEmbed('Canal exclusivo de /bump desativado.')], flags: MessageFlags.Ephemeral });
      return;
    }

    if (sub === 'cargo') {
      const acao = interaction.options.getString('acao', true);
      if (acao === 'listar') {
        const ids = await guildConfigRepository.getBumpExemptRoleIds(guildId);
        const value = ids.length > 0 ? ids.map((id) => `<@&${id}>`).join(', ') : '*nenhum*';
        await interaction.reply({ embeds: [infoEmbed(`**Cargos liberados no canal de bump:** ${value}`)], flags: MessageFlags.Ephemeral });
        return;
      }
      const cargo = interaction.options.getRole('cargo');
      if (!cargo) {
        await interaction.reply({ embeds: [errorEmbed('Informe o `cargo` para adicionar/remover.')], flags: MessageFlags.Ephemeral });
        return;
      }
      if (acao === 'adicionar') {
        const added = await guildConfigRepository.addBumpExemptRole(guildId, cargo.id);
        await interaction.reply({
          embeds: [added ? successEmbed(`${cargo} agora pode mandar qualquer coisa no canal de bump.`) : infoEmbed(`${cargo} já estava liberado.`)],
          flags: MessageFlags.Ephemeral
        });
      } else {
        const removed = await guildConfigRepository.removeBumpExemptRole(guildId, cargo.id);
        await interaction.reply({
          embeds: [removed ? successEmbed(`${cargo} não está mais liberado no canal de bump.`) : errorEmbed(`${cargo} não estava na lista.`)],
          flags: MessageFlags.Ephemeral
        });
      }
      return;
    }

    // status
    const config = await guildConfigRepository.get(guildId);
    const roles = await guildConfigRepository.getBumpExemptRoleIds(guildId);
    const canal = config?.bumpChannelId ? `<#${config.bumpChannelId}>` : '*não definido*';
    const value = roles.length > 0 ? roles.map((id) => `<@&${id}>`).join(', ') : '*nenhum*';
    await interaction.reply({
      embeds: [infoEmbed(`**Canal de bump**\nCanal: ${canal}\nCargos liberados: ${value}\n\n*Bots e você (dono) são sempre liberados.*`)],
      flags: MessageFlags.Ephemeral
    });
  }
};

export default command;
