# Lambda Bot

🌐 **[English](#english) · [Português](#português)**

---

## English

A Discord bot with an **interactive embed editor**. Instead of building embeds by writing JSON or commands full of arguments, you use the `/embed` command and edit everything through buttons and forms (modals) right inside Discord — with a live preview before sending.

### What it does

The bot exposes the `/embed` slash command, which opens an editor with:

- **Edit Content** — title, title URL, author and description.
- **Edit Visual** — color (`#RRGGBB`, `RRGGBB` or a name like `Blurple`), footer, image and thumbnail.
- **Send** — publishes the final embed to the channel.
- **Cancel** — discards the edit.

The forms come **pre-filled** with the current values, so editing is iterative. Leaving a field blank **removes** that attribute. Invalid colors and URLs are ignored with a warning instead of breaking the interaction.

### Requirements

- [Node.js](https://nodejs.org/) 18 or higher
- A bot application created in the [Discord Developer Portal](https://discord.com/developers/applications)

### Installation

```bash
npm install
```

### Configuration

Create a `.env` file in the project root with:

```
DISCORD_TOKEN=your_bot_token
CLIENT_ID=application_id
GUILD_ID=server_id
```

- **DISCORD_TOKEN** — the bot token (Developer Portal → your application → *Bot* → *Reset Token*).
- **CLIENT_ID** — the *Application ID* (Developer Portal → *General Information*).
- **GUILD_ID** — the ID of the server where commands will be registered. Enable *Developer Mode* in Discord (Settings → Advanced), right-click the server → *Copy Server ID*.

> The `.env` is in `.gitignore` and should **never** be committed or shared — it contains the bot token.

### Inviting the bot to the server

The bot must be added to the server with both the `bot` **and** `applications.commands` scopes, otherwise registering the slash commands fails with `Missing Access (50001)`. Use a URL like this (replace `client_id`):

```
https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&scope=bot%20applications.commands&permissions=2147485696
```

### How to run

```bash
node lambdabot.js
```

On startup, the bot registers the slash commands on the server (`GUILD_ID`) and comes online. You should see:

```
Atualizando comandos slash...
Comandos slash atualizados!
Bot online como Lambda#0000
```

Then just use `/embed` in any channel on the server.

### Project structure

```
lambdabot.js              # entry point: registers commands, loads events and logs in
commands/
  embed.js                # the /embed command and the editor (buttons + edit cache)
events/
  ready.js                # logs when the bot comes online (clientReady event)
  interactionCreate.js    # handles the embed editor's buttons and modals
.env                      # secrets (not versioned)
```

### Troubleshooting

- **`DiscordAPIError[50001]: Missing Access`** — the bot isn't in the server or was invited without the `applications.commands` scope. Re-invite it with the URL above and check the `GUILD_ID`.
- **Commands don't show up** — confirm `CLIENT_ID` and `GUILD_ID` are correct. Guild commands update instantly; global commands can take up to 1 hour.
- **`Esse editor expirou` ("This editor expired")** — the edit state lives in memory and is lost if the bot restarts; run `/embed` again.

---

## Português

Um bot do Discord com um **editor de embeds interativo**. Em vez de montar embeds escrevendo JSON ou comandos cheios de argumentos, você usa o comando `/embed` e edita tudo por botões e formulários (modais) direto no Discord — com pré-visualização ao vivo antes de enviar.

### Para que serve

O bot expõe o comando slash `/embed`, que abre um editor com:

- **Editar Conteúdo** — título, URL do título, autor e descrição.
- **Editar Visual** — cor (`#RRGGBB`, `RRGGBB` ou nome como `Blurple`), footer, imagem e thumbnail.
- **Enviar** — publica o embed final no canal.
- **Cancelar** — descarta a edição.

Os formulários já vêm **pré-preenchidos** com os valores atuais, então a edição é iterativa. Deixar um campo em branco **remove** aquele atributo. Cores e URLs inválidas são ignoradas com um aviso, em vez de quebrar a interação.

### Pré-requisitos

- [Node.js](https://nodejs.org/) 18 ou superior
- Uma aplicação/bot criada no [Discord Developer Portal](https://discord.com/developers/applications)

### Instalação

```bash
npm install
```

### Configuração

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

### Convidar o bot para o servidor

O bot precisa ser adicionado ao servidor com os escopos `bot` **e** `applications.commands`, senão o registro dos comandos slash falha com `Missing Access (50001)`. Use uma URL como esta (troque o `client_id`):

```
https://discord.com/oauth2/authorize?client_id=SEU_CLIENT_ID&scope=bot%20applications.commands&permissions=2147485696
```

### Como rodar

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

### Estrutura do projeto

```
lambdabot.js              # ponto de entrada: registra comandos, carrega eventos e faz login
commands/
  embed.js                # comando /embed e o editor (botões + cache de edição)
events/
  ready.js                # log de quando o bot fica online (evento clientReady)
  interactionCreate.js    # trata botões e modais do editor de embed
.env                      # segredos (não versionado)
```

### Solução de problemas

- **`DiscordAPIError[50001]: Missing Access`** — o bot não está no servidor ou foi convidado sem o escopo `applications.commands`. Reconvide com a URL acima e confira o `GUILD_ID`.
- **Os comandos não aparecem** — confirme que `CLIENT_ID` e `GUILD_ID` estão corretos. Comandos de guild atualizam na hora; comandos globais podem levar até 1 hora.
- **`Esse editor expirou`** — o estado de edição fica em memória e é perdido se o bot reiniciar; rode `/embed` de novo.
