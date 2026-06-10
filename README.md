# Lambda Bot

Um bot do Discord com um **editor de embeds interativo**. Em vez de montar embeds escrevendo JSON ou comandos cheios de argumentos, você usa o comando `/embed` e edita tudo por botões e formulários (modais) direto no Discord — com pré-visualização ao vivo antes de enviar.

## Para que serve

O bot expõe o comando slash `/embed`, que abre um editor com:

- **Editar Conteúdo** — título, URL do título, autor e descrição.
- **Editar Visual** — cor (`#RRGGBB`, `RRGGBB` ou nome como `Blurple`), footer, imagem e thumbnail.
- **Enviar** — publica o embed final no canal.
- **Cancelar** — descarta a edição.

Os formulários já vêm **pré-preenchidos** com os valores atuais, então a edição é iterativa. Deixar um campo em branco **remove** aquele atributo. Cores e URLs inválidas são ignoradas com um aviso, em vez de quebrar a interação.

## Pré-requisitos

- [Node.js](https://nodejs.org/) 18 ou superior
- Uma aplicação/bot criada no [Discord Developer Portal](https://discord.com/developers/applications)

## Instalação

```bash
npm install
```

## Configuração

Crie um arquivo `.env` na raiz do projeto com:

```
DISCORD_TOKEN=seu_token_do_bot
CLIENT_ID=id_da_aplicacao
GUILD_ID=id_do_servidor
```

- **DISCORD_TOKEN** — token do bot (Developer Portal → sua aplicação → *Bot* → *Reset Token*).
- **CLIENT_ID** — *Application ID* (Developer Portal → *General Information*).
- **GUILD_ID** — ID do servidor onde os comandos serão registrados. Ative o *Modo Desenvolvedor* no Discord (Configurações → Avançado), clique com o botão direito no servidor → *Copiar ID do servidor*.

> O `.env` está no `.gitignore` e **nunca** deve ser commitado nem compartilhado — ele contém o token do bot.

## Convidar o bot para o servidor

O bot precisa ser adicionado ao servidor com os escopos `bot` **e** `applications.commands`, senão o registro dos comandos slash falha com `Missing Access (50001)`. Use uma URL como esta (troque o `client_id`):

```
https://discord.com/oauth2/authorize?client_id=SEU_CLIENT_ID&scope=bot%20applications.commands&permissions=2147485696
```

## Como rodar

```bash
node lambdabot.js
```

Ao iniciar, o bot registra os comandos slash no servidor (`GUILD_ID`) e fica online. Você deve ver:

```
Atualizando comandos slash...
Comandos slash atualizados!
Bot online como Lambda#0000
```

Depois é só usar `/embed` em qualquer canal do servidor.

## Estrutura do projeto

```
lambdabot.js              # ponto de entrada: registra comandos, carrega eventos e faz login
commands/
  embed.js                # comando /embed e o editor (botões + cache de edição)
events/
  ready.js                # log de quando o bot fica online (evento clientReady)
  interactionCreate.js    # trata botões e modais do editor de embed
.env                      # segredos (não versionado)
```

## Solução de problemas

- **`DiscordAPIError[50001]: Missing Access`** — o bot não está no servidor ou foi convidado sem o escopo `applications.commands`. Reconvide com a URL acima e confira o `GUILD_ID`.
- **Os comandos não aparecem** — confirme que `CLIENT_ID` e `GUILD_ID` estão corretos. Comandos de guild atualizam na hora; comandos globais podem levar até 1 hora.
- **`Esse editor expirou`** — o estado de edição fica em memória e é perdido se o bot reiniciar; rode `/embed` de novo.
