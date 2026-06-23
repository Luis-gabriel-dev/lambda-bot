import {
  ChannelType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder
} from 'discord.js';
import { Command } from '../../interfaces/Command';
import { Component, ComponentInteraction } from '../../interfaces/Component';
import { applyUrl, errorEmbed, infoEmbed, successEmbed } from '../../utils/embeds';
import { isAdminOrOwner } from '../../services/permission.service';
import { formatDuration, parseDuration } from '../../utils/time';
import { discordTimestamp } from '../../utils/formatter';
import { economyRepository } from '../../repositories/economy.repository';
import { shopRepository } from '../../repositories/shop.repository';
import { CURRENCY, handleCollect, postDrop } from '../../services/economy.service';

const component: Component = {
  id: 'eco',
  execute(interaction: ComponentInteraction) {
    if (!interaction.isButton()) return;
    if (interaction.customId === 'eco:collect') return handleCollect(interaction);
  }
};

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('economia')
    .setDescription('Configura o sistema de economia (kurocoins).')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName('canal')
        .setDescription('Define o canal onde o dinheiro aparece.')
        .addChannelOption((opt) =>
          opt.setName('canal').setDescription('Canal dos drops.').addChannelTypes(ChannelType.GuildText).setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('intervalo')
        .setDescription('Define de quanto em quanto tempo o dinheiro aparece (ex.: 30m, 2h).')
        .addStringOption((opt) => opt.setName('tempo').setDescription('Ex.: 45m, 1h, 6h.').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('valores')
        .setDescription('Define o mínimo e o máximo de kurocoins por drop.')
        .addIntegerOption((opt) => opt.setName('minimo').setDescription('Valor mínimo.').setMinValue(1).setRequired(true))
        .addIntegerOption((opt) => opt.setName('maximo').setDescription('Valor máximo.').setMinValue(1).setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('gif')
        .setDescription('Gerencia os GIFs exibidos nos drops.')
        .addStringOption((opt) =>
          opt
            .setName('acao')
            .setDescription('O que fazer.')
            .setRequired(true)
            .addChoices(
              { name: 'adicionar', value: 'adicionar' },
              { name: 'remover', value: 'remover' },
              { name: 'listar', value: 'listar' }
            )
        )
        .addStringOption((opt) => opt.setName('url').setDescription('URL do GIF (para adicionar/remover).').setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName('autodeletar')
        .setDescription('Tempo para apagar as mensagens de drop (use 0m para desativar).')
        .addStringOption((opt) =>
          opt
            .setName('tipo')
            .setDescription('Qual mensagem apagar.')
            .setRequired(true)
            .addChoices(
              { name: 'expirado (ninguém coletou)', value: 'expirado' },
              { name: 'coletado (alguém pegou)', value: 'coletado' }
            )
        )
        .addStringOption((opt) => opt.setName('tempo').setDescription('Ex.: 30s, 5m. Use 0m para desativar.').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('slotgif')
        .setDescription('Gerencia os GIFs exibidos no embed da caça-níquel (/slots).')
        .addStringOption((opt) =>
          opt
            .setName('acao')
            .setDescription('O que fazer.')
            .setRequired(true)
            .addChoices(
              { name: 'adicionar', value: 'adicionar' },
              { name: 'remover', value: 'remover' },
              { name: 'listar', value: 'listar' }
            )
        )
        .addStringOption((opt) => opt.setName('url').setDescription('URL do GIF (para adicionar/remover).').setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName('slotsautodeletar')
        .setDescription('Apaga a mensagem da caça-níquel após um tempo (use 0m para desativar).')
        .addStringOption((opt) => opt.setName('tempo').setDescription('Ex.: 15s, 1m. Use 0m para desativar.').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('dar')
        .setDescription('Dá kurocoins direto para um membro.')
        .addUserOption((opt) => opt.setName('usuario').setDescription('Quem recebe.').setRequired(true))
        .addIntegerOption((opt) => opt.setName('quantia').setDescription('Quantos kurocoins dar.').setMinValue(1).setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('tirar')
        .setDescription('Remove kurocoins de um membro.')
        .addUserOption((opt) => opt.setName('usuario').setDescription('De quem remover.').setRequired(true))
        .addIntegerOption((opt) => opt.setName('quantia').setDescription('Quantos kurocoins remover.').setMinValue(1).setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('cargo')
        .setDescription('Gerencia os cargos vendidos na loja (/loja, /comprar).')
        .addStringOption((opt) =>
          opt
            .setName('acao')
            .setDescription('O que fazer.')
            .setRequired(true)
            .addChoices(
              { name: 'adicionar', value: 'adicionar' },
              { name: 'remover', value: 'remover' },
              { name: 'listar', value: 'listar' }
            )
        )
        .addRoleOption((opt) => opt.setName('cargo').setDescription('Cargo (para adicionar/remover).').setRequired(false))
        .addIntegerOption((opt) => opt.setName('preco').setDescription('Preço em kurocoins (para adicionar).').setMinValue(1).setRequired(false))
        .addStringOption((opt) => opt.setName('descricao').setDescription('Descrição opcional exibida na loja.').setRequired(false))
    )
    .addSubcommand((sub) => sub.setName('status').setDescription('Mostra a configuração atual da economia.'))
    .addSubcommand((sub) =>
      sub
        .setName('forcar')
        .setDescription('Solta um drop agora (aleatório, ou com quantia exata).')
        .addIntegerOption((opt) => opt.setName('quantia').setDescription('Quantia exata (vazio = aleatório).').setMinValue(1).setRequired(false))
    ),

  components: [component],

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({ embeds: [errorEmbed('Este comando só pode ser usado em um servidor.')], flags: MessageFlags.Ephemeral });
      return;
    }
    if (!isAdminOrOwner(interaction.user.id, interaction.memberPermissions)) {
      await interaction.reply({ embeds: [errorEmbed('Apenas administradores podem configurar a economia.')], flags: MessageFlags.Ephemeral });
      return;
    }

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (sub === 'canal') {
      const canal = interaction.options.getChannel('canal', true);
      await economyRepository.setChannel(guildId, canal.id);
      await interaction.reply({
        embeds: [successEmbed(`Canal dos drops definido para <#${canal.id}>. Configure o intervalo com **/economia intervalo**.`)],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (sub === 'intervalo') {
      const ms = parseDuration(interaction.options.getString('tempo', true));
      if (ms === null) {
        await interaction.reply({ embeds: [errorEmbed('Tempo inválido. Use formatos como `45m`, `1h` ou `6h`.')], flags: MessageFlags.Ephemeral });
        return;
      }
      const minutes = Math.max(1, Math.round(ms / 60_000));
      await economyRepository.setInterval(guildId, minutes);
      await interaction.reply({
        embeds: [successEmbed(`O dinheiro vai aparecer a cada **${minutes}** minuto(s).`)],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (sub === 'valores') {
      const min = interaction.options.getInteger('minimo', true);
      const max = interaction.options.getInteger('maximo', true);
      if (max < min) {
        await interaction.reply({ embeds: [errorEmbed('O valor máximo precisa ser maior ou igual ao mínimo.')], flags: MessageFlags.Ephemeral });
        return;
      }
      await economyRepository.setValues(guildId, min, max);
      await interaction.reply({
        embeds: [successEmbed(`Cada drop agora vale entre **${min}** e **${max}** ${CURRENCY}.`)],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (sub === 'gif') {
      const acao = interaction.options.getString('acao', true);

      if (acao === 'listar') {
        const gifs = await economyRepository.listGifs(guildId);
        const value = gifs.length > 0 ? gifs.map((url, i) => `**${i + 1}.** ${url}`).join('\n') : '*nenhum GIF cadastrado*';
        await interaction.reply({ embeds: [infoEmbed(`**GIFs dos drops:**\n${value}`)], flags: MessageFlags.Ephemeral });
        return;
      }

      const url = interaction.options.getString('url');
      if (!url) {
        await interaction.reply({ embeds: [errorEmbed('Informe a `url` do GIF para essa ação.')], flags: MessageFlags.Ephemeral });
        return;
      }

      if (acao === 'adicionar') {
        const tmp = new EmbedBuilder();
        if (!applyUrl((u) => tmp.setImage(u), url)) {
          await interaction.reply({ embeds: [errorEmbed('URL inválida.')], flags: MessageFlags.Ephemeral });
          return;
        }
        await economyRepository.addGif(guildId, url.trim());
        await interaction.reply({ embeds: [successEmbed('GIF adicionado aos drops.')], flags: MessageFlags.Ephemeral });
        return;
      }

      // remover
      const removed = await economyRepository.removeGif(guildId, url.trim());
      await interaction.reply({
        embeds: [removed ? successEmbed('GIF removido.') : errorEmbed('Esse GIF não estava na lista.')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (sub === 'autodeletar') {
      const tipo = interaction.options.getString('tipo', true);
      const ms = parseDuration(interaction.options.getString('tempo', true));
      if (ms === null) {
        await interaction.reply({ embeds: [errorEmbed('Tempo inválido. Use formatos como `30s`, `5m` ou `0m` para desativar.')], flags: MessageFlags.Ephemeral });
        return;
      }

      const value = ms > 0 ? ms : null;
      const rotulo = tipo === 'coletado' ? 'coletado por alguém' : 'ninguém coletou';
      if (tipo === 'coletado') await economyRepository.setClaimedDelete(guildId, value);
      else await economyRepository.setExpireDelete(guildId, value);

      await interaction.reply({
        embeds: [
          successEmbed(
            value
              ? `A mensagem de "${rotulo}" será apagada após **${formatDuration(value)}**.`
              : `Auto-deleção da mensagem de "${rotulo}" **desativada**.`
          )
        ],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (sub === 'slotgif') {
      const acao = interaction.options.getString('acao', true);

      if (acao === 'listar') {
        const gifs = await economyRepository.listSlotGifs(guildId);
        const value = gifs.length > 0 ? gifs.map((url, i) => `**${i + 1}.** ${url}`).join('\n') : '*nenhum GIF cadastrado*';
        await interaction.reply({ embeds: [infoEmbed(`**GIFs da caça-níquel:**\n${value}`)], flags: MessageFlags.Ephemeral });
        return;
      }

      const url = interaction.options.getString('url');
      if (!url) {
        await interaction.reply({ embeds: [errorEmbed('Informe a `url` do GIF para essa ação.')], flags: MessageFlags.Ephemeral });
        return;
      }

      if (acao === 'adicionar') {
        const tmp = new EmbedBuilder();
        if (!applyUrl((u) => tmp.setImage(u), url)) {
          await interaction.reply({ embeds: [errorEmbed('URL inválida.')], flags: MessageFlags.Ephemeral });
          return;
        }
        await economyRepository.addSlotGif(guildId, url.trim());
        await interaction.reply({ embeds: [successEmbed('GIF adicionado à caça-níquel.')], flags: MessageFlags.Ephemeral });
        return;
      }

      const removed = await economyRepository.removeSlotGif(guildId, url.trim());
      await interaction.reply({
        embeds: [removed ? successEmbed('GIF removido.') : errorEmbed('Esse GIF não estava na lista.')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (sub === 'slotsautodeletar') {
      const ms = parseDuration(interaction.options.getString('tempo', true));
      if (ms === null) {
        await interaction.reply({ embeds: [errorEmbed('Tempo inválido. Use formatos como `15s`, `1m` ou `0m` para desativar.')], flags: MessageFlags.Ephemeral });
        return;
      }
      const value = ms > 0 ? ms : null;
      await economyRepository.setSlotsDelete(guildId, value);
      await interaction.reply({
        embeds: [
          successEmbed(
            value
              ? `A mensagem da caça-níquel será apagada após **${formatDuration(value)}**.`
              : 'Auto-deleção da mensagem da caça-níquel **desativada**.'
          )
        ],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (sub === 'dar') {
      const user = interaction.options.getUser('usuario', true);
      const quantia = interaction.options.getInteger('quantia', true);
      if (user.bot) {
        await interaction.reply({ embeds: [errorEmbed('Não dá pra dar kurocoins para bots.')], flags: MessageFlags.Ephemeral });
        return;
      }
      const wallet = await economyRepository.giveBalance(guildId, user.id, quantia);
      // Mensagem pública (sem flag efêmera).
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x2ecc71)
            .setDescription(
              `💰 ${user} recebeu **${quantia.toLocaleString('pt-BR')}** ${CURRENCY}!\nNovo saldo: **${wallet.balance.toLocaleString('pt-BR')}** ${CURRENCY}.`
            )
        ]
      });
      return;
    }

    if (sub === 'tirar') {
      const user = interaction.options.getUser('usuario', true);
      const quantia = interaction.options.getInteger('quantia', true);
      if (user.bot) {
        await interaction.reply({ embeds: [errorEmbed('Bots não têm carteira de kurocoins.')], flags: MessageFlags.Ephemeral });
        return;
      }
      const { wallet, removed } = await economyRepository.takeBalance(guildId, user.id, quantia);
      const aviso = removed < quantia ? ` *(só tinha ${removed.toLocaleString('pt-BR')})*` : '';
      // Mensagem pública (sem flag efêmera).
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xe67e22)
            .setDescription(
              `➖ Removido **${removed.toLocaleString('pt-BR')}** ${CURRENCY} de ${user}${aviso}.\nNovo saldo: **${wallet.balance.toLocaleString('pt-BR')}** ${CURRENCY}.`
            )
        ]
      });
      return;
    }

    if (sub === 'cargo') {
      const acao = interaction.options.getString('acao', true);

      if (acao === 'listar') {
        const roles = await shopRepository.listRoles(guildId);
        const value =
          roles.length > 0
            ? roles.map((r) => `<@&${r.roleId}> — **${r.price.toLocaleString('pt-BR')}** ${CURRENCY}${r.description ? ` (${r.description})` : ''}`).join('\n')
            : '*nenhum cargo à venda*';
        await interaction.reply({ embeds: [infoEmbed(`🛒 **Loja de cargos:**\n${value}`)], flags: MessageFlags.Ephemeral });
        return;
      }

      const cargo = interaction.options.getRole('cargo');
      if (!cargo) {
        await interaction.reply({ embeds: [errorEmbed('Informe o `cargo` para essa ação.')], flags: MessageFlags.Ephemeral });
        return;
      }

      if (acao === 'remover') {
        const removed = await shopRepository.removeRole(guildId, cargo.id);
        await interaction.reply({
          embeds: [removed ? successEmbed(`${cargo} foi removido da loja.`) : errorEmbed(`${cargo} não estava à venda.`)],
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      // adicionar
      const preco = interaction.options.getInteger('preco');
      if (!preco) {
        await interaction.reply({ embeds: [errorEmbed('Informe o `preco` (em kurocoins) para adicionar o cargo.')], flags: MessageFlags.Ephemeral });
        return;
      }
      if (cargo.id === guildId) {
        await interaction.reply({ embeds: [errorEmbed('Não dá para vender o cargo `@everyone`.')], flags: MessageFlags.Ephemeral });
        return;
      }

      const descricao = interaction.options.getString('descricao')?.trim() || null;
      await shopRepository.addRole(guildId, cargo.id, preco, descricao);

      // Aviso se o bot não conseguirá entregar o cargo (hierarquia/permissão).
      const me = interaction.guild.members.me;
      const role = interaction.guild.roles.cache.get(cargo.id);
      const semPermissao = !me?.permissions.has(PermissionFlagsBits.ManageRoles);
      const acimaDoBot = me && role ? role.position >= me.roles.highest.position : false;
      const aviso = semPermissao
        ? '\n⚠️ Eu não tenho a permissão **Gerenciar Cargos** — não vou conseguir entregar a compra.'
        : acimaDoBot
          ? '\n⚠️ Esse cargo está **acima do meu** na hierarquia — mova meu cargo acima dele para eu conseguir entregá-lo.'
          : '';
      await interaction.reply({
        embeds: [successEmbed(`${cargo} está à venda por **${preco.toLocaleString('pt-BR')}** ${CURRENCY}.${aviso}`)],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (sub === 'status') {
      const config = await economyRepository.getConfig(guildId);
      const gifCount = (await economyRepository.listGifs(guildId)).length;
      const canal = config?.dropChannelId ? `<#${config.dropChannelId}>` : '*não definido*';
      const intervalo = config?.dropIntervalMinutes ? `${config.dropIntervalMinutes} min` : '*não definido*';
      const valores = `${config?.dropMin ?? 10} – ${config?.dropMax ?? 500} ${CURRENCY}`;
      const autoDelExp = config?.expireDeleteMs ? formatDuration(config.expireDeleteMs) : '*desativado*';
      const autoDelCol = config?.claimedDeleteMs ? formatDuration(config.claimedDeleteMs) : '*desativado*';
      const ultimo = config?.lastDropAt ? discordTimestamp(config.lastDropAt, 'R') : '*nunca*';
      const ativo = config?.dropChannelId && config?.dropIntervalMinutes ? '🟢 ativo' : '🔴 inativo (defina canal e intervalo)';

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xf1c40f)
            .setTitle('💰 Economia — configuração')
            .addFields(
              { name: 'Status', value: ativo, inline: false },
              { name: 'Canal', value: canal, inline: true },
              { name: 'Intervalo', value: intervalo, inline: true },
              { name: 'Valores', value: valores, inline: true },
              { name: 'GIFs', value: `${gifCount}`, inline: true },
              { name: 'Apagar expirado', value: autoDelExp, inline: true },
              { name: 'Apagar coletado', value: autoDelCol, inline: true },
              { name: 'Último drop', value: ultimo, inline: true }
            )
        ],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    // forcar
    const config = await economyRepository.getConfig(guildId);
    if (!config?.dropChannelId) {
      await interaction.reply({ embeds: [errorEmbed('Defina o canal dos drops antes com **/economia canal**.')], flags: MessageFlags.Ephemeral });
      return;
    }
    const quantia = interaction.options.getInteger('quantia') ?? undefined;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const ok = await postDrop(interaction.client, config, quantia);
    const detalhe = quantia ? ` de **${quantia.toLocaleString('pt-BR')}** ${CURRENCY}` : '';
    await interaction.editReply({
      embeds: [ok ? successEmbed(`Drop${detalhe} solto em <#${config.dropChannelId}>! 💸`) : errorEmbed('Não consegui soltar o drop (verifique as permissões no canal).')]
    });
  }
};

export default command;
