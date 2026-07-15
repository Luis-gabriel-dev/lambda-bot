# Lambda Bot

🌐 **[English](#english) · [Português](#português)**

A feature-rich Discord bot built with **TypeScript** and **discord.js v14**: moderation with warn escalation, automod, tickets, server **partnerships**, giveaways, polls, configurable logging, a mini-Instagram (photos & videos), a **kurocoins** economy with a **role shop**, and welcome messages — all on a scalable, layered architecture (commands, events, services, repositories, jobs, loaders) backed by **Prisma + PostgreSQL**. It also ships with a **Next.js web dashboard** ([lambda.adastratech.dev](https://lambda.adastratech.dev)) for configuring every system from the browser.

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

**Automod** (`/automod`) — toggleable modules with exempt roles and per-channel allowlists: anti-spam (flood + repeated text/stickers/attachments), anti-big-message, anti-invite, anti-mass-mention, anti-forward, anti-link, anti-GIF and anti-raid.
- **Anti-link** has two modes (`/links modo`): **whitelist** (block every link, allow only listed ones) or **blacklist** (allow every link, block only listed ones). Manage with `/links permitidos` / `/links bloqueados` (interactive panels), restrict an allowed domain to specific channels with `/links canal`, and grant roles all/specific links with `/links cargo`. Blocking escalates: delete → 3rd warns → 4th warn → 5th+ 1h mute.
- **Anti-GIF** (`/gifs`) — only allowed roles (e.g. Booster) can send GIFs; everyone else's GIFs are deleted.
- **Anti-raid** — if one account posts across **4+ channels within seconds** (compromised account / disguised bot), it's **kicked**, all its messages are **purged**, and both the deleted messages and the punishment are logged.

**Trap** (`/trap`) — a honeypot channel: anyone who posts there is **kicked instantly** (the owner, the bot and exempt roles are spared). Catches spam bots and doubles as a server prank.

**Bump** (`/config bump`) — a channel where members may only run `/bump` (the Disboard command); any other message is deleted. Bots, the owner and configured roles are exempt.

**Tickets** (`/ticket`) — button panels that open private channels, with transcripts on close.

**Partnerships** (`/parceria`) — a dedicated partnership flow on top of tickets: a panel opens a private channel; when the requester posts their server invite, staff get a **confirm / refuse** prompt. On confirm the bot posts the pitch in an announcement channel (stripping `@everyone`/`@here`, pinging a configurable `@parceria` role and the requester) and drops a public *"partnership closed"* embed colored by the closer's avatar, with a **per-admin counter**. Closing the ticket saves a transcript (participants, invite, server name) to the partnership log. Invites a staffer posts straight into the announcement channel are counted too. The opening message text is customizable (`/parceria boasvindas`).

**Giveaways** (`/sorteio`) — timed giveaways with image/color, custom requirements (role/Nitro/activity/free-text) and auto-finalize.

**Polls** (`/enquete`) — button voting with optional auto-close and auto-delete timers.

**Logging** (`/logs`) — per-type log channels: punishments, bans, joins/leaves, messages, calls, tickets, moderation, roles, **server** (emojis, stickers, channels and threads — create/delete, with the executor resolved from the audit log), **Instagram** and **partnership transcripts**. New accounts (**≤ 7 days old**) are flagged in the join log with a yellow embed and a warning.

**Mini Instagram** (`/instagram`) — photo/video channels where each upload becomes a **Components V2 card**: author line, optional title and caption, live like/comment counts (comments via threads), a "who liked" list and a card color taken from the media's dominant color. The info disclaimer supports a custom image and color; deleted posts are logged.

**Economy — kurocoins** (`/economia`)
- Timed money drops in a channel with a **Coletar** button (first click wins); high values are rarer; random GIFs; configurable interval/min-max and auto-delete of drop messages.
- **Casino & games** — **`/slots`** (a slot machine with a deliberately *progressive* win rate: generous for the first few spins, then house-favored; set a GIF and an auto-delete timer with `/economia slotgif` / `/economia slotsautodeletar`) and **`/duelo`** (a 50/50 PvP bet — both players ante the same amount, a coin flip decides, the winner takes the whole pot).
- **`/perfil`**, **`/saldo`**, **`/ranking`** (paginated, one avatar per row) and **`/pagar`** (member-to-member transfer).
- **Role shop** — `/economia cargo` sets which roles are buyable and their price; members browse with **`/loja`** (panel with balance + a buy menu) or buy directly with **`/comprar`**. Purchases debit atomically and **refund** if the role can't be assigned.
- **Mystery** — the bot owner is always pinned at the top of `/ranking` with balance/collects masked as `???`/`?` (also masked in `/saldo` and `/perfil`); **`/kuro`** privately reveals the real numbers.
- Admin: `/economia dar|tirar` (give/take coins), `/economia forcar` (force a drop, optional exact amount).

**Welcome** (`/boasvindas`) — public welcome message on join: avatar (circular + square), name, handle, join time, an optional fixed image/gif and a ping to the new member. The embed color can be fixed or pulled from the member's avatar (random palette fallback), it can cite a rules channel and a profile-color channel, and an optional extra text block (`/boasvindas texto`) is appended to the description.

**Onboarding & roles** — **`/autorole`** (auto role on join), **`/cargo`** (role panels with buttons or a select menu, up to **10 roles**), **`/permissao`** (authorize roles for restricted commands), **`/dm`** (standardize a fixed banner image across every DM the bot sends).

**Web dashboard** — a **Next.js** app (in `web/`) that mirrors the bot's configuration in the browser: log in with Discord, pick a server you administer where the bot is present, and configure Welcome, Auto-roles, DMs, Economy drops, Role shop, Automod, Anti-link, Anti-GIF, Trap, Bump, Permissions, Tickets, Partnerships, Instagram and Logs. Reads run in Server Components and writes go through authenticated Server Actions — every page and action re-checks admin rights server-side, and the bot reads config live, so changes apply instantly. Live at **[lambda.adastratech.dev](https://lambda.adastratech.dev)**.

### Requirements

- [Node.js](https://nodejs.org/) 18 or higher (tested on 22)
- **PostgreSQL** — local dev uses a throwaway instance via Docker (`docker-compose.dev.yml`); see *Setup*
- A bot application in the [Discord Developer Portal](https://discord.com/developers/applications)

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Create the .env (see below)

# 3. Start a local PostgreSQL for dev (Docker)
docker compose -f docker-compose.dev.yml up -d

# 4. Sync the Prisma schema to the database
npm run db:push

# 5. Register the slash commands on your server
npm run deploy

# 6. Run the bot (dev mode, auto-reload)
npm run dev
```

> **Privileged intents:** in the Developer Portal → your app → *Bot* → *Privileged Gateway Intents*, enable **Server Members Intent** and **Message Content Intent**. The bot needs them for join/leave handling, message logging and automod, and won't start without them.

### Configuration (`.env`)

```
DISCORD_TOKEN=your_bot_token
CLIENT_ID=application_id
GUILD_ID=server_id
OWNER_ID=your_user_id
DATABASE_URL="postgresql://lambda:lambda@localhost:5433/lambda?schema=public"
```

- **DISCORD_TOKEN** — bot token (Developer Portal → your app → *Bot* → *Reset Token*).
- **CLIENT_ID** — *Application ID* (Developer Portal → *General Information*).
- **GUILD_ID** — server ID where commands are registered. Enable *Developer Mode* (Settings → Advanced), right-click the server → *Copy Server ID*.
- **OWNER_ID** — your Discord user ID (the bot owner). Bypasses every permission check and unlocks owner-only features like `/kuro`. Right-click your name → *Copy User ID*.
- **DATABASE_URL** — PostgreSQL connection string. The bundled `docker-compose.dev.yml` exposes Postgres on port **5433** (user/password/database all `lambda`), which the default above points to.

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
| `npm run deploy:prod` | Same as `deploy`, but runs the compiled script from `dist/` — for production/VPS (run `npm run build` first). |
| `npm run db:push` | Syncs the Prisma schema to the database (PostgreSQL). |
| `npm run db:studio` | Opens Prisma Studio to inspect the database. |
| `npm run typecheck` | Type-checks without emitting files. |

### Project structure

```
src/
├── core/            # client, config, logger, database (infra)
├── commands/        # slash commands grouped by domain
│   ├── admin/       #   logs, automod, links, gifs, trap, config(bump), ticket, parceria, sorteio, enquete, instagram, painel, dm, boasvindas, autorole, cargo, permissao
│   ├── economy/     #   economia, loja, comprar, perfil, saldo, ranking, kuro, pagar
│   ├── moderation/  #   ban, unban, kick, mute, unmute, warn, clear, grace
│   └── utility/     #   embed, ping, serverinfo, userinfo, avatar
├── events/          # gateway events (interactionCreate, guildMemberAdd, message*, server-log events)
├── jobs/            # scheduled tasks (warn penalties, giveaways, polls, economy drops, log cleanup)
├── services/        # business logic (moderation, automod, log, instagram, economy, shop, welcome, partnership, bump, trap, permission)
├── repositories/    # data access via Prisma
├── interfaces/      # contracts (Command, Event, Component, Config)
├── utils/           # embeds, permissions, time, formatter, auditLog
├── types/           # discord.js type augmentation
├── loaders/         # commandLoader, eventLoader
├── app.ts           # bootstrap (load + login)
├── index.ts         # entry point
└── deploy.ts        # slash-command registration script
prisma/
└── schema.prisma    # all data models (warnings, tickets, partnerships, giveaways, polls, logs, instagram, economy, shop, ...)
web/
└── src/             # Next.js web dashboard (App Router, Auth.js + Discord OAuth, shared Prisma schema)
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

**Automod** (`/automod`) — módulos ligáveis, com cargos isentos e canais liberados: anti-spam (flood + repetição de texto/figurinhas/anexos), anti-mensagem-gigante, anti-convite, anti-menção-em-massa, anti-encaminhamento, anti-link, anti-GIF e anti-raid.
- **Anti-link** tem dois modos (`/links modo`): **whitelist** (bloqueia todo link, libera só os listados) ou **blacklist** (libera todo link, bloqueia só os listados). Gerencie com `/links permitidos` / `/links bloqueados` (painéis interativos), restrinja um domínio liberado a canais com `/links canal`, e libere por cargo (todos ou específicos) com `/links cargo`. O bloqueio escala: apaga → 3ª avisa → 4ª warn → 5ª+ mute de 1h.
- **Anti-GIF** (`/gifs`) — só cargos liberados (ex.: Booster) podem enviar GIFs; os demais têm o GIF apagado.
- **Anti-raid** — se uma conta posta em **4+ canais em segundos** (conta comprometida / bot disfarçado), ela é **expulsa**, todas as mensagens são **apagadas**, e tanto as mensagens apagadas quanto a punição vão para os logs.

**Trap** (`/trap`) — canal-armadilha: quem postar nele leva **kick na hora** (o dono, o bot e cargos isentos são poupados). Pega bots de spam e serve de brincadeira no servidor.

**Bump** (`/config bump`) — canal onde os membros só podem usar `/bump` (o comando do Disboard); qualquer outra mensagem é apagada. Bots, o dono e cargos configurados são liberados.

**Tickets** (`/ticket`) — painéis de botão que abrem canais privados, com transcrição ao fechar.

**Parcerias** (`/parceria`) — fluxo de parceria sobre os tickets: um painel abre um canal privado; quando a pessoa manda o convite do servidor dela, a staff recebe um prompt de **fechar / recusar**. Ao fechar, o bot publica o texto num canal de anúncio (removendo `@everyone`/`@here`, marcando um cargo `@parceria` configurável e quem pediu) e lança um embed público de *"parceria fechada"* colorido pelo avatar de quem fechou, com um **contador por admin**. Ao fechar o ticket, salva um transcript (participantes, convite, nome do servidor) no log de parcerias. Convites que um staffer posta direto no canal de anúncio também contam. O texto da mensagem de abertura é customizável (`/parceria boasvindas`).

**Sorteios** (`/sorteio`) — sorteios com tempo, imagem/cor, requisitos customizados (cargo/Nitro/atividade/texto livre) e finalização automática.

**Enquetes** (`/enquete`) — votação por botões, com auto-encerramento e auto-deleção opcionais.

**Logs** (`/logs`) — canais de log por tipo: punições, bans, entrada/saída, mensagens, calls, tickets, moderação, cargos, **servidor** (emojis, figurinhas, canais e tópicos — criação/exclusão, com o autor vindo do audit log), **Instagram** e **transcripts de parceria**. Contas novas (**≤ 7 dias**) são destacadas no log de entrada com embed amarelo e um aviso.

**Mini Instagram** (`/instagram`) — canais de foto/vídeo onde cada envio vira um **card Components V2**: linha de autor, título e legenda opcionais, contagem de curtidas/comentários ao vivo (comentários por threads), lista de "quem curtiu" e cor do card a partir da cor predominante da mídia. O aviso de informações aceita imagem e cor customizadas; posts apagados vão para o log.

**Economia — kurocoins** (`/economia`)
- Drops de dinheiro num canal com botão **Coletar** (primeiro a clicar leva); valores altos mais raros; GIFs aleatórios; intervalo/mín-máx configuráveis e auto-deleção das mensagens de drop.
- **Cassino & jogos** — **`/slots`** (caça-níquel com chance de vitória *progressiva* de propósito: generosa nas primeiras rodadas e depois favorável à casa; defina um GIF e um tempo de auto-deleção com `/economia slotgif` / `/economia slotsautodeletar`) e **`/duelo`** (aposta PvP 50/50 — os dois apostam o mesmo valor, um cara-ou-coroa decide e o vencedor leva o pote inteiro).
- **`/perfil`**, **`/saldo`**, **`/ranking`** (paginado, um avatar por linha) e **`/pagar`** (transferência entre membros).
- **Loja de cargos** — `/economia cargo` define quais cargos são compráveis e o preço; os membros veem com **`/loja`** (painel com saldo + menu de compra) ou compram direto com **`/comprar`**. A compra debita de forma atômica e **estorna** se o cargo não puder ser entregue.
- **Mistério** — o dono do bot fica sempre fixado no topo do `/ranking` com saldo/coletas mascarados como `???`/`?` (também mascarados em `/saldo` e `/perfil`); **`/kuro`** revela os números reais só pra ele.
- Admin: `/economia dar|tirar` (dar/tirar moedas), `/economia forcar` (soltar drop, com quantia exata opcional).

**Boas-vindas** (`/boasvindas`) — mensagem pública na entrada: avatar (circular + quadrado), nome, usuário, hora de entrada, imagem/gif fixa opcional e marcação do novo membro. A cor do embed pode ser fixa ou vir do avatar do membro (com paleta aleatória de reserva), pode citar um canal de regras e um canal de cor de perfil, e um bloco de texto extra opcional (`/boasvindas texto`) é anexado à descrição.

**Entrada & cargos** — **`/autorole`** (cargo automático ao entrar), **`/cargo`** (painéis de cargo com botões ou menu de seleção, até **10 cargos**), **`/permissao`** (autoriza cargos nos comandos restritos), **`/dm`** (padroniza uma imagem fixa em todas as DMs que o bot envia).

**Dashboard web** — um app **Next.js** (em `web/`) que espelha a configuração do bot no navegador: faça login com o Discord, escolha um servidor que você administra e onde o bot está, e configure Boas-vindas, Auto-cargos, DMs, Drops de economia, Loja de cargos, Automod, Anti-link, Anti-GIF, Trap, Bump, Permissões, Tickets, Parcerias, Instagram e Logs. As leituras rodam em Server Components e as escritas passam por Server Actions autenticadas — toda página e ação revalida o admin no servidor, e o bot lê a config ao vivo, então as mudanças valem na hora. No ar em **[lambda.adastratech.dev](https://lambda.adastratech.dev)**.

### Pré-requisitos

- [Node.js](https://nodejs.org/) 18 ou superior (testado no 22)
- **PostgreSQL** — o dev local usa uma instância descartável via Docker (`docker-compose.dev.yml`); veja *Instalação*
- Uma aplicação de bot no [Discord Developer Portal](https://discord.com/developers/applications)

### Instalação

```bash
# 1. Instalar dependências
npm install

# 2. Criar o .env (veja abaixo)

# 3. Subir um PostgreSQL local para dev (Docker)
docker compose -f docker-compose.dev.yml up -d

# 4. Sincronizar o schema do Prisma com o banco
npm run db:push

# 5. Registrar os slash commands no seu servidor
npm run deploy

# 6. Rodar o bot (modo dev, com auto-reload)
npm run dev
```

> **Intents privilegiadas:** no Developer Portal → sua aplicação → *Bot* → *Privileged Gateway Intents*, ative o **Server Members Intent** e o **Message Content Intent**. O bot precisa deles para entrada/saída de membros, log de mensagens e automod, e não inicia sem eles.

### Configuração (`.env`)

```
DISCORD_TOKEN=seu_token_do_bot
CLIENT_ID=id_da_aplicacao
GUILD_ID=id_do_servidor
OWNER_ID=seu_id_de_usuario
DATABASE_URL="postgresql://lambda:lambda@localhost:5433/lambda?schema=public"
```

- **DISCORD_TOKEN** — token do bot (Developer Portal → sua aplicação → *Bot* → *Reset Token*).
- **CLIENT_ID** — *Application ID* (Developer Portal → *General Information*).
- **GUILD_ID** — ID do servidor onde os comandos são registrados. Ative o *Modo Desenvolvedor* (Configurações → Avançado), botão direito no servidor → *Copiar ID do servidor*.
- **OWNER_ID** — seu ID de usuário do Discord (o dono do bot). Ignora todas as checagens de permissão e libera recursos exclusivos do dono, como o `/kuro`. Botão direito no seu nome → *Copiar ID de usuário*.
- **DATABASE_URL** — string de conexão do PostgreSQL. O `docker-compose.dev.yml` incluso sobe o Postgres na porta **5433** (usuário/senha/banco todos `lambda`), que é pra onde o padrão acima aponta.

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
| `npm run deploy:prod` | Igual ao `deploy`, mas roda o script compilado do `dist/` — para produção/VPS (rode `npm run build` antes). |
| `npm run db:push` | Sincroniza o schema do Prisma com o banco (PostgreSQL). |
| `npm run db:studio` | Abre o Prisma Studio para inspecionar o banco. |
| `npm run typecheck` | Faz a checagem de tipos sem gerar arquivos. |

### Estrutura do projeto

```
src/
├── core/            # client, config, logger, database (infra)
├── commands/        # slash commands agrupados por domínio
│   ├── admin/       #   logs, automod, links, gifs, trap, config(bump), ticket, parceria, sorteio, enquete, instagram, painel, dm, boasvindas, autorole, cargo, permissao
│   ├── economy/     #   economia, loja, comprar, perfil, saldo, ranking, kuro, pagar
│   ├── moderation/  #   ban, unban, kick, mute, unmute, warn, clear, grace
│   └── utility/     #   embed, ping, serverinfo, userinfo, avatar
├── events/          # eventos do gateway (interactionCreate, guildMemberAdd, message*, eventos do log do servidor)
├── jobs/            # tarefas agendadas (penalidades de warn, sorteios, enquetes, drops de economia, limpeza de logs)
├── services/        # regras de negócio (moderation, automod, log, instagram, economy, shop, welcome, partnership, bump, trap, permission)
├── repositories/    # acesso a dados via Prisma
├── interfaces/      # contratos (Command, Event, Component, Config)
├── utils/           # embeds, permissions, time, formatter, auditLog
├── types/           # augmentation de tipos do discord.js
├── loaders/         # commandLoader, eventLoader
├── app.ts           # bootstrap (carrega + login)
├── index.ts         # ponto de entrada
└── deploy.ts        # script de registro dos slash commands
prisma/
└── schema.prisma    # todos os modelos (advertências, tickets, parcerias, sorteios, enquetes, logs, instagram, economia, loja, ...)
web/
└── src/             # dashboard web em Next.js (App Router, Auth.js + Discord OAuth, schema do Prisma compartilhado)
```

**Como tudo se encaixa:** o `index.ts` chama o `app.ts`, que cria o client e roda os loaders. O `commandLoader` lê todos os arquivos sob `commands/`, registra cada comando e seus handlers de botão/modal (componentes). O `interactionCreate` roteia comandos slash pelo nome e interações de componentes pelo prefixo do customId (ex.: `embed:send` → o handler do componente `embed`). Tarefas em segundo plano (sorteios, enquetes, drops de economia, penalidades de warn) rodam em intervalos agendados a partir do evento `ready`.

### Solução de problemas

- **`DiscordAPIError[50001]: Missing Access`** — o bot não está no servidor ou foi convidado sem o escopo `applications.commands`. Reconvide e confira o `GUILD_ID`.
- **`Used disallowed intents`** — ative as intents **Server Members** e **Message Content** no Developer Portal (veja *Instalação*).
- **Os comandos não aparecem** — rode `npm run deploy`. Comandos de guild atualizam na hora.
- **`Esse editor expirou`** — o estado do editor fica em memória e é perdido ao reiniciar; rode `/embed` de novo.
