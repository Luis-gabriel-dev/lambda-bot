# Lambda Bot

🌐 **[English](#english) · [Português](#português)**

A feature-rich Discord bot built with **TypeScript** and **discord.js v14**: moderation with warn escalation, automod, tickets, giveaways, polls, configurable logging, a mini-Instagram, a **kurocoins** economy and welcome messages — all on a scalable, layered architecture (commands, events, services, repositories, jobs, loaders) backed by **Prisma + SQLite**.

---

## English

### Features

All **admin** commands require the *Administrator* permission; **moderation** commands are *restricted* (only the bot owner or roles authorized via `/permissao`).

**Utility**
- **`/embed`** — interactive embed editor through buttons and modals, with live preview and a send/cancel step (restricted).
- **`/ping`** — bot latency (round-trip and WebSocket).
- **`/serverinfo`**, **`/userinfo`**, **`/avatar`** — server, member and avatar info.
- **`/painel`** — central hub linking the main configuration commands.

**Moderation** — restricted, with warn-based escalation (4 warns → 1-day mute, 8 → ban).
- **`/ban`**, **`/unban`**, **`/kick`**, **`/mute`**, **`/unmute`**, **`/clear`**.
- **`/warn`** applies a warning; **`/grace`** forgives all warnings and resets the penalty cycle.

**Automod** (`/automod`) — 5 toggleable modules: anti-spam (flood + repeated text/stickers/attachments), anti-big-message, anti-invite, anti-mass-mention and anti-forward, with exempt roles and per-channel allowlists.

**Tickets** (`/ticket`) — button panels that open private channels, with transcripts on close.

**Giveaways** (`/sorteio`) — timed giveaways with image/color, custom requirements (role/Nitro/activity/free-text) and auto-finalize.

**Polls** (`/enquete`) — button voting with optional auto-close and auto-delete timers.

**Logging** (`/logs`) — per-type log channels: punishments, bans, joins/leaves, messages, calls, tickets, moderation, roles, and **server** (emojis, stickers, channels and threads — create/delete, with the executor resolved from the audit log).

**Mini Instagram** (`/instagram`) — photo channels where each image becomes a post with likes, comments (threads), a "who liked" list and a custom disclaimer.

**Economy — kurocoins** (`/economia`)
- Timed money drops in a channel with a **Coletar** button (first click wins); high values are rarer; random GIFs; configurable interval/min-max and auto-delete of drop messages.
- **`/perfil`**, **`/saldo`**, **`/ranking`** (paginated, one avatar per row) and **`/pagar`** (member-to-member transfer).
- Admin: `/economia dar|tirar` (give/take coins), `/economia forcar` (force a drop, optional exact amount).

**Welcome** (`/boasvindas`) — public welcome message on join: avatar (circular + square), name, handle, join time, an optional fixed image/gif, and a ping to the new member.

**Onboarding & roles** — **`/autorole`** (auto role on join), **`/cargo`** (role management), **`/permissao`** (authorize roles for restricted commands).

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

> **Privileged intents:** in the Developer Portal → your app → *Bot* → *Privileged Gateway Intents*, enable **Server Members Intent** and **Message Content Intent**. The bot needs them for join/leave handling, message logging and automod, and won't start without them.

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
│   ├── admin/       #   logs, automod, ticket, sorteio, enquete, instagram, painel, boasvindas, autorole, cargo, permissao
│   ├── economy/     #   economia, perfil, saldo, ranking, pagar
│   ├── moderation/  #   ban, unban, kick, mute, unmute, warn, clear, grace
│   └── utility/     #   embed, ping, serverinfo, userinfo, avatar
├── events/          # gateway events (interactionCreate, guildMemberAdd, message*, server-log events)
├── jobs/            # scheduled tasks (warn penalties, giveaways, polls, economy drops, log cleanup)
├── services/        # business logic (moderation, automod, log, instagram, economy, welcome, permission)
├── repositories/    # data access via Prisma
├── interfaces/      # contracts (Command, Event, Component, Config)
├── utils/           # embeds, permissions, time, formatter, auditLog
├── types/           # discord.js type augmentation
├── loaders/         # commandLoader, eventLoader
├── app.ts           # bootstrap (load + login)
├── index.ts         # entry point
└── deploy.ts        # slash-command registration script
prisma/
└── schema.prisma    # all data models (warnings, tickets, giveaways, polls, logs, instagram, economy, ...)
```

**How it fits together:** `index.ts` calls `app.ts`, which creates the client and runs the loaders. `commandLoader` reads every file under `commands/`, registers each command and its button/modal handlers (components). `interactionCreate` routes slash commands by name and component interactions by the customId prefix (e.g. `embed:send` → the `embed` component handler). Background work (giveaways, polls, economy drops, warn penalties) runs on intervals scheduled from the `ready` event.

### Troubleshooting

- **`DiscordAPIError[50001]: Missing Access`** — the bot isn't in the server or was invited without the `applications.commands` scope. Re-invite it and check `GUILD_ID`.
- **`Used disallowed intents`** — enable the **Server Members** and **Message Content** intents in the Developer Portal (see *Setup*).
- **Commands don't show up** — run `npm run deploy`. Guild commands update instantly.
- **`Esse editor expirou`** — the embed editor state lives in memory and is lost on restart; run `/embed` again.

---

## Português

### Funcionalidades

Todos os comandos de **admin** exigem a permissão *Administrador*; os de **moderação** são *restritos* (só o dono do bot ou cargos autorizados via `/permissao`).

**Utilidades**
- **`/embed`** — editor de embed interativo por botões e modais, com pré-visualização ao vivo e etapa de enviar/cancelar (restrito).
- **`/ping`** — latência do bot (ida-e-volta e WebSocket).
- **`/serverinfo`**, **`/userinfo`**, **`/avatar`** — informações do servidor, membro e avatar.
- **`/painel`** — hub central com atalhos para os principais comandos de configuração.

**Moderação** — restrita, com escalada por advertências (4 warns → mute de 1 dia, 8 → ban).
- **`/ban`**, **`/unban`**, **`/kick`**, **`/mute`**, **`/unmute`**, **`/clear`**.
- **`/warn`** aplica uma advertência; **`/grace`** perdoa todas e zera o ciclo de punição.

**Automod** (`/automod`) — 5 módulos ligáveis: anti-spam (flood + repetição de texto/figurinhas/anexos), anti-mensagem-gigante, anti-convite, anti-menção-em-massa e anti-encaminhamento, com cargos isentos e canais liberados.

**Tickets** (`/ticket`) — painéis de botão que abrem canais privados, com transcrição ao fechar.

**Sorteios** (`/sorteio`) — sorteios com tempo, imagem/cor, requisitos customizados (cargo/Nitro/atividade/texto livre) e finalização automática.

**Enquetes** (`/enquete`) — votação por botões, com auto-encerramento e auto-deleção opcionais.

**Logs** (`/logs`) — canais de log por tipo: punições, bans, entrada/saída, mensagens, calls, tickets, moderação, cargos e **servidor** (emojis, figurinhas, canais e tópicos — criação/exclusão, com o autor vindo do audit log).

**Mini Instagram** (`/instagram`) — canais de foto onde cada imagem vira um post com curtidas, comentários (threads), lista de "quem curtiu" e um aviso customizável.

**Economia — kurocoins** (`/economia`)
- Drops de dinheiro num canal com botão **Coletar** (primeiro a clicar leva); valores altos mais raros; GIFs aleatórios; intervalo/mín-máx configuráveis e auto-deleção das mensagens de drop.
- **`/perfil`**, **`/saldo`**, **`/ranking`** (paginado, um avatar por linha) e **`/pagar`** (transferência entre membros).
- Admin: `/economia dar|tirar` (dar/tirar moedas), `/economia forcar` (soltar drop, com quantia exata opcional).

**Boas-vindas** (`/boasvindas`) — mensagem pública na entrada: avatar (circular + quadrado), nome, usuário, hora de entrada, imagem/gif fixa opcional e marcação do novo membro.

**Entrada & cargos** — **`/autorole`** (cargo automático ao entrar), **`/cargo`** (gestão de cargos), **`/permissao`** (autoriza cargos nos comandos restritos).

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

> **Intents privilegiadas:** no Developer Portal → sua aplicação → *Bot* → *Privileged Gateway Intents*, ative o **Server Members Intent** e o **Message Content Intent**. O bot precisa deles para entrada/saída de membros, log de mensagens e automod, e não inicia sem eles.

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
│   ├── admin/       #   logs, automod, ticket, sorteio, enquete, instagram, painel, boasvindas, autorole, cargo, permissao
│   ├── economy/     #   economia, perfil, saldo, ranking, pagar
│   ├── moderation/  #   ban, unban, kick, mute, unmute, warn, clear, grace
│   └── utility/     #   embed, ping, serverinfo, userinfo, avatar
├── events/          # eventos do gateway (interactionCreate, guildMemberAdd, message*, eventos do log do servidor)
├── jobs/            # tarefas agendadas (penalidades de warn, sorteios, enquetes, drops de economia, limpeza de logs)
├── services/        # regras de negócio (moderation, automod, log, instagram, economy, welcome, permission)
├── repositories/    # acesso a dados via Prisma
├── interfaces/      # contratos (Command, Event, Component, Config)
├── utils/           # embeds, permissions, time, formatter, auditLog
├── types/           # augmentation de tipos do discord.js
├── loaders/         # commandLoader, eventLoader
├── app.ts           # bootstrap (carrega + login)
├── index.ts         # ponto de entrada
└── deploy.ts        # script de registro dos slash commands
prisma/
└── schema.prisma    # todos os modelos (advertências, tickets, sorteios, enquetes, logs, instagram, economia, ...)
```

**Como tudo se encaixa:** o `index.ts` chama o `app.ts`, que cria o client e roda os loaders. O `commandLoader` lê todos os arquivos sob `commands/`, registra cada comando e seus handlers de botão/modal (componentes). O `interactionCreate` roteia comandos slash pelo nome e interações de componentes pelo prefixo do customId (ex.: `embed:send` → o handler do componente `embed`). Tarefas em segundo plano (sorteios, enquetes, drops de economia, penalidades de warn) rodam em intervalos agendados a partir do evento `ready`.

### Solução de problemas

- **`DiscordAPIError[50001]: Missing Access`** — o bot não está no servidor ou foi convidado sem o escopo `applications.commands`. Reconvide e confira o `GUILD_ID`.
- **`Used disallowed intents`** — ative as intents **Server Members** e **Message Content** no Developer Portal (veja *Instalação*).
- **Os comandos não aparecem** — rode `npm run deploy`. Comandos de guild atualizam na hora.
- **`Esse editor expirou`** — o estado do editor fica em memória e é perdido ao reiniciar; rode `/embed` de novo.
