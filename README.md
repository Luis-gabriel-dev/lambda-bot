# Lambda Bot

🌐 **[English](#english) · [Português](#português)**

A Discord **utility bot** built with **TypeScript** and **discord.js v14**, featuring an interactive embed editor, slash commands and a scalable, layered architecture (commands, events, services, repositories, loaders) backed by **Prisma + SQLite**.

---

## English

### Features

- **`/embed`** — interactive embed editor: edit content and visuals through buttons and forms (modals), with a live preview and a final send/cancel step. Forms come pre-filled; invalid colors/URLs are ignored with a warning instead of breaking.
- **`/ping`** — shows the bot's latency (round-trip and WebSocket).
- More commands (moderation, server info, etc.) are being added one at a time.

### Requirements

- [Node.js](https://nodejs.org/) 18 or higher (tested on 22)
- A bot application in the [Discord Developer Portal](https://discord.com/developers/applications)

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Create the .env (see below)

# 3. Create the SQLite database from the Prisma schema
npm run db:push

# 4. Register the slash commands on your server
npm run deploy

# 5. Run the bot (dev mode, auto-reload)
npm run dev
```

### Configuration (`.env`)

```
DISCORD_TOKEN=your_bot_token
CLIENT_ID=application_id
GUILD_ID=server_id
DATABASE_URL="file:./dev.db"
```

- **DISCORD_TOKEN** — bot token (Developer Portal → your app → *Bot* → *Reset Token*).
- **CLIENT_ID** — *Application ID* (Developer Portal → *General Information*).
- **GUILD_ID** — server ID where commands are registered. Enable *Developer Mode* (Settings → Advanced), right-click the server → *Copy Server ID*.
- **DATABASE_URL** — SQLite file used by Prisma (default is fine).

> The `.env` is in `.gitignore` and must **never** be committed or shared — it contains the bot token.

### Inviting the bot

The bot must be added with both `bot` **and** `applications.commands` scopes, otherwise registering commands fails with `Missing Access (50001)`. Use a URL like this (replace `client_id`):

```
https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&scope=bot%20applications.commands&permissions=2147485696
```

### Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Runs the bot with `tsx` in watch mode (auto-reload). |
| `npm run build` | Compiles TypeScript to `dist/`. |
| `npm start` | Runs the compiled bot (`dist/index.js`). |
| `npm run deploy` | Registers/updates the slash commands on the server. Run after adding or changing a command's definition. |
| `npm run db:push` | Syncs the Prisma schema to the SQLite database. |
| `npm run db:studio` | Opens Prisma Studio to inspect the database. |
| `npm run typecheck` | Type-checks without emitting files. |

### Project structure

```
src/
├── core/            # client, config, logger, database (infra)
├── commands/        # slash commands grouped by domain
│   └── utility/     #   embed.ts, ping.ts
├── events/          # gateway events (ready, interactionCreate)
├── services/        # business logic (added as features land)
├── repositories/    # data access via Prisma (added as features land)
├── interfaces/      # contracts (Command, Event, Component, Config)
├── utils/           # embeds, permissions, time, formatter
├── types/           # discord.js type augmentation
├── loaders/         # commandLoader, eventLoader
├── app.ts           # bootstrap (load + login)
├── index.ts         # entry point
└── deploy.ts        # slash-command registration script
prisma/
└── schema.prisma    # Warning, Mute, GuildConfig models
```

**How it fits together:** `index.ts` calls `app.ts`, which creates the client and runs the loaders. `commandLoader` reads every file under `commands/`, registers each command and its button/modal handlers (components). `interactionCreate` routes slash commands by name and component interactions by the customId prefix (e.g. `embed:send` → the `embed` component handler).

### Troubleshooting

- **`DiscordAPIError[50001]: Missing Access`** — the bot isn't in the server or was invited without the `applications.commands` scope. Re-invite it and check `GUILD_ID`.
- **Commands don't show up** — run `npm run deploy`. Guild commands update instantly.
- **`Esse editor expirou`** — the embed editor state lives in memory and is lost on restart; run `/embed` again.

---

## Português

### Funcionalidades

- **`/embed`** — editor de embed interativo: edite conteúdo e visual por botões e formulários (modais), com pré-visualização ao vivo e etapa final de enviar/cancelar. Os formulários vêm pré-preenchidos; cores/URLs inválidas são ignoradas com aviso, em vez de quebrar.
- **`/ping`** — mostra a latência do bot (ida-e-volta e WebSocket).
- Mais comandos (moderação, info do servidor, etc.) estão sendo adicionados um de cada vez.

### Pré-requisitos

- [Node.js](https://nodejs.org/) 18 ou superior (testado no 22)
- Uma aplicação de bot no [Discord Developer Portal](https://discord.com/developers/applications)

### Instalação

```bash
# 1. Instalar dependências
npm install

# 2. Criar o .env (veja abaixo)

# 3. Criar o banco SQLite a partir do schema do Prisma
npm run db:push

# 4. Registrar os slash commands no seu servidor
npm run deploy

# 5. Rodar o bot (modo dev, com auto-reload)
npm run dev
```

### Configuração (`.env`)

```
DISCORD_TOKEN=seu_token_do_bot
CLIENT_ID=id_da_aplicacao
GUILD_ID=id_do_servidor
DATABASE_URL="file:./dev.db"
```

- **DISCORD_TOKEN** — token do bot (Developer Portal → sua aplicação → *Bot* → *Reset Token*).
- **CLIENT_ID** — *Application ID* (Developer Portal → *General Information*).
- **GUILD_ID** — ID do servidor onde os comandos são registrados. Ative o *Modo Desenvolvedor* (Configurações → Avançado), botão direito no servidor → *Copiar ID do servidor*.
- **DATABASE_URL** — arquivo SQLite usado pelo Prisma (o padrão já serve).

> O `.env` está no `.gitignore` e **nunca** deve ser commitado nem compartilhado — ele contém o token do bot.

### Convidar o bot

O bot precisa ser adicionado com os escopos `bot` **e** `applications.commands`, senão o registro dos comandos falha com `Missing Access (50001)`. Use uma URL como esta (troque o `client_id`):

```
https://discord.com/oauth2/authorize?client_id=SEU_CLIENT_ID&scope=bot%20applications.commands&permissions=2147485696
```

### Scripts

| Script | O que faz |
| --- | --- |
| `npm run dev` | Roda o bot com `tsx` em watch mode (auto-reload). |
| `npm run build` | Compila o TypeScript para `dist/`. |
| `npm start` | Roda o bot compilado (`dist/index.js`). |
| `npm run deploy` | Registra/atualiza os slash commands no servidor. Rode após adicionar ou alterar a definição de um comando. |
| `npm run db:push` | Sincroniza o schema do Prisma com o banco SQLite. |
| `npm run db:studio` | Abre o Prisma Studio para inspecionar o banco. |
| `npm run typecheck` | Faz a checagem de tipos sem gerar arquivos. |

### Estrutura do projeto

```
src/
├── core/            # client, config, logger, database (infra)
├── commands/        # slash commands agrupados por domínio
│   └── utility/     #   embed.ts, ping.ts
├── events/          # eventos do gateway (ready, interactionCreate)
├── services/        # regras de negócio (entram conforme as features)
├── repositories/    # acesso a dados via Prisma (entram conforme as features)
├── interfaces/      # contratos (Command, Event, Component, Config)
├── utils/           # embeds, permissions, time, formatter
├── types/           # augmentation de tipos do discord.js
├── loaders/         # commandLoader, eventLoader
├── app.ts           # bootstrap (carrega + login)
├── index.ts         # ponto de entrada
└── deploy.ts        # script de registro dos slash commands
prisma/
└── schema.prisma    # modelos Warning, Mute, GuildConfig
```

**Como tudo se encaixa:** o `index.ts` chama o `app.ts`, que cria o client e roda os loaders. O `commandLoader` lê todos os arquivos sob `commands/`, registra cada comando e seus handlers de botão/modal (componentes). O `interactionCreate` roteia comandos slash pelo nome e interações de componentes pelo prefixo do customId (ex.: `embed:send` → o handler do componente `embed`).

### Solução de problemas

- **`DiscordAPIError[50001]: Missing Access`** — o bot não está no servidor ou foi convidado sem o escopo `applications.commands`. Reconvide e confira o `GUILD_ID`.
- **Os comandos não aparecem** — rode `npm run deploy`. Comandos de guild atualizam na hora.
- **`Esse editor expirou`** — o estado do editor fica em memória e é perdido ao reiniciar; rode `/embed` de novo.
