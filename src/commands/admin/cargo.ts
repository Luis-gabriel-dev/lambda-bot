import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  Role,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction
} from 'discord.js';
import { Command } from '../../interfaces/Command';
import { Component, ComponentInteraction } from '../../interfaces/Component';
import { applyColor, applyUrl, errorEmbed, infoEmbed, Palette, successEmbed } from '../../utils/embeds';
import { isAdminOrOwner } from '../../services/permission.service';
import { truncate } from '../../utils/formatter';

const ROLE_OPTIONS = ['cargo1', 'cargo2', 'cargo3', 'cargo4', 'cargo5'];

// ============ Handlers de componente ============

/** Verifica se o bot consegue gerenciar o cargo (permissão + hierarquia). */
function manageableRole(interaction: ButtonInteraction<'cached'> | StringSelectMenuInteraction<'cached'>, roleId: string): Role | null {
  const me = interaction.guild.members.me;
  const role = interaction.guild.roles.cache.get(roleId);
  if (!role || !me?.permissions.has(PermissionFlagsBits.ManageRoles) || me.roles.highest.comparePositionTo(role) <= 0) {
    return null;
  }
  return role;
}

/** Botão: alterna (pega/remove) um único cargo. */
async function handleToggle(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.inCachedGuild()) return;

  const roleId = interaction.customId.split(':')[1];
  if (!roleId) return;

  const role = manageableRole(interaction, roleId);
  if (!role) {
    await interaction.reply({
      embeds: [errorEmbed('Não consigo gerenciar esse cargo (não existe mais, está acima do meu ou sem permissão).')],
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  try {
    if (interaction.member.roles.cache.has(role.id)) {
      await interaction.member.roles.remove(role);
      await interaction.reply({ embeds: [infoEmbed(`Cargo ${role} **removido**.`)], flags: MessageFlags.Ephemeral });
    } else {
      await interaction.member.roles.add(role);
      await interaction.reply({ embeds: [successEmbed(`Você recebeu o cargo ${role}.`)], flags: MessageFlags.Ephemeral });
    }
  } catch {
    await interaction.reply({ embeds: [errorEmbed('Não foi possível alterar o cargo.')], flags: MessageFlags.Ephemeral });
  }
}

/** Select menu: escolha exclusiva — adiciona o selecionado e remove os outros cargos do painel. */
async function handleSelect(interaction: StringSelectMenuInteraction): Promise<void> {
  if (!interaction.inCachedGuild()) return;
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const member = interaction.member;
  const allRoleIds = interaction.component.options.map((o) => o.value).filter((v) => v !== 'none');
  const selected = new Set(interaction.values.filter((v) => v !== 'none'));

  const isRole = (r: Role | null): r is Role => r !== null;
  const toAdd = allRoleIds
    .filter((id) => selected.has(id) && !member.roles.cache.has(id))
    .map((id) => manageableRole(interaction, id))
    .filter(isRole);
  const toRemove = allRoleIds
    .filter((id) => !selected.has(id) && member.roles.cache.has(id))
    .map((id) => manageableRole(interaction, id))
    .filter(isRole);

  try {
    if (toRemove.length > 0) await member.roles.remove(toRemove);
    if (toAdd.length > 0) await member.roles.add(toAdd);
  } catch {
    await interaction.editReply({ embeds: [errorEmbed('Não foi possível atualizar seus cargos.')] });
    return;
  }

  if (selected.size === 0) {
    await interaction.editReply({ embeds: [infoEmbed('Seus cargos do painel foram removidos.')] });
  } else {
    const chosen = [...selected].map((id) => `<@&${id}>`).join(', ');
    await interaction.editReply({ embeds: [successEmbed(`Pronto! Agora você tem: ${chosen}`)] });
  }
}

const component: Component = {
  id: 'cargo',
  execute(interaction: ComponentInteraction) {
    if (interaction.isButton()) return handleToggle(interaction);
    if (interaction.isStringSelectMenu()) return handleSelect(interaction);
  }
};

// ============ Comando ============

/** Adiciona as opções comuns aos dois subcomandos (obrigatórias antes das opcionais). */
function addPanelOptions(sub: SlashCommandSubcommandBuilder): SlashCommandSubcommandBuilder {
  sub
    .addStringOption((opt) => opt.setName('titulo').setDescription('Título do painel.').setRequired(true))
    .addRoleOption((opt) => opt.setName('cargo1').setDescription('1º cargo.').setRequired(true))
    .addStringOption((opt) => opt.setName('descricao').setDescription('Descrição (use \\n para pular linha).').setRequired(false))
    .addStringOption((opt) => opt.setName('cor').setDescription('Cor do embed (#RRGGBB ou nome, ex.: Red).').setRequired(false))
    .addStringOption((opt) => opt.setName('imagem').setDescription('URL de uma imagem para o painel.').setRequired(false))
    .addStringOption((opt) => opt.setName('rodape').setDescription('Texto do rodapé.').setRequired(false));
  for (const name of ROLE_OPTIONS.slice(1)) {
    sub.addRoleOption((opt) => opt.setName(name).setDescription('Cargo opcional.').setRequired(false));
  }
  return sub;
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('cargo')
    .setDescription('Cria painéis de cargos (botões ou menu de seleção).')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) => addPanelOptions(sub.setName('botoes').setDescription('Painel com botões (pega/remove vários cargos).')))
    .addSubcommand((sub) =>
      addPanelOptions(sub.setName('menu').setDescription('Painel com barra de seleção (escolha exclusiva, ex.: cor do nome).')).addStringOption(
        (opt) => opt.setName('placeholder').setDescription('Texto da barra (ex.: Escolha a cor do seu nome).').setRequired(false)
      )
    ),

  components: [component],

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({ embeds: [errorEmbed('Este comando só pode ser usado em um servidor.')], flags: MessageFlags.Ephemeral });
      return;
    }
    if (!isAdminOrOwner(interaction.user.id, interaction.memberPermissions)) {
      await interaction.reply({ embeds: [errorEmbed('Apenas administradores podem criar painéis de cargos.')], flags: MessageFlags.Ephemeral });
      return;
    }

    const me = interaction.guild.members.me;
    if (!me?.permissions.has(PermissionFlagsBits.ManageRoles)) {
      await interaction.reply({ embeds: [errorEmbed('Eu não tenho a permissão **Gerenciar Cargos** neste servidor.')], flags: MessageFlags.Ephemeral });
      return;
    }
    if (!interaction.channel?.isSendable()) {
      await interaction.reply({ embeds: [errorEmbed('Não consigo enviar mensagens neste canal.')], flags: MessageFlags.Ephemeral });
      return;
    }

    // Coleta e valida os cargos.
    const roles: Role[] = [];
    const seen = new Set<string>();
    for (const optName of ROLE_OPTIONS) {
      const role = interaction.options.getRole(optName);
      if (!role || seen.has(role.id)) continue;
      seen.add(role.id);

      if (role.id === interaction.guildId || role.managed) {
        await interaction.reply({
          embeds: [errorEmbed(`${role} não pode ser usado (\`@everyone\` ou cargo gerenciado).`)],
          flags: MessageFlags.Ephemeral
        });
        return;
      }
      if (me.roles.highest.comparePositionTo(role.id) <= 0) {
        await interaction.reply({
          embeds: [errorEmbed(`O cargo ${role} está acima do meu — mova meu cargo acima dele.`)],
          flags: MessageFlags.Ephemeral
        });
        return;
      }
      roles.push(role as Role);
    }

    // Monta o embed (título, descrição, cor, imagem e rodapé customizáveis).
    const titulo = interaction.options.getString('titulo', true);
    // "\n" digitado no slash vira quebra de linha real.
    const descricao = (interaction.options.getString('descricao') ?? 'Use o painel abaixo para gerenciar seus cargos.').replace(
      /\\n/g,
      '\n'
    );
    const embed = new EmbedBuilder().setColor(Palette.info).setTitle(titulo).setDescription(descricao);

    const cor = interaction.options.getString('cor');
    const corInvalida = cor ? !applyColor(embed, cor) : false;

    const imagem = interaction.options.getString('imagem');
    if (imagem) applyUrl((url) => embed.setImage(url), imagem);
    const rodape = interaction.options.getString('rodape');
    if (rodape) embed.setFooter({ text: rodape });

    // Monta os componentes conforme o subcomando.
    const sub = interaction.options.getSubcommand();
    const components =
      sub === 'menu'
        ? [
            new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
              new StringSelectMenuBuilder()
                .setCustomId('cargo:menu')
                .setPlaceholder(interaction.options.getString('placeholder') ?? 'Escolha um cargo')
                .setMinValues(0)
                .setMaxValues(1)
                .addOptions(roles.map((role) => ({ label: truncate(role.name, 100), value: role.id })))
                .addOptions({ label: 'Remover meu cargo', value: 'none', emoji: '❌' })
            )
          ]
        : [
            new ActionRowBuilder<ButtonBuilder>().addComponents(
              ...roles.map((role) =>
                new ButtonBuilder().setCustomId(`cargo:${role.id}`).setLabel(truncate(role.name, 80)).setStyle(ButtonStyle.Secondary)
              )
            )
          ];

    await interaction.channel.send({ embeds: [embed], components });
    const aviso = corInvalida ? '\n⚠️ Cor inválida — usei a cor padrão.' : '';
    await interaction.reply({
      embeds: [successEmbed(`Painel de cargos criado com **${roles.length}** cargo(s).${aviso}`)],
      flags: MessageFlags.Ephemeral
    });
  }
};

export default command;
