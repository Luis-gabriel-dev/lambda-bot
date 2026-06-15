# ✅ Checklist de configuração do Lambda

O banco de produção começou **zerado**, então nada está configurado. Rode os comandos abaixo
**no seu servidor** (você precisa ser **Administrador**). Marque o `[ ]` conforme for fazendo.

> 💡 Quase todo comando tem um `status` (ou `listar`) pra você conferir como ficou.
> 💡 Em opções de texto, `\n` vira quebra de linha.

---

## 1. Essencial (faça primeiro)

### 📋 Logs — `/logs`
Defina os canais que recebem cada tipo de log (pode mandar todos pro mesmo canal ou separar).
- [ ] `/logs definir tipo:<Tipo> canal:#canal` — repita para cada tipo que quiser
- [ ] Conferir: `/logs listar`

Tipos disponíveis: **Punições, Bans, Entrada de membros, Saída de membros, Mensagens, Calls, Tickets, Auditoria de mensagens, Moderação, Cargos, Servidor, Instagram, Parcerias**.
> A entrada de membros marca em **amarelo** contas com ≤ 7 dias (aviso de conta nova).

### 👋 Boas-vindas — `/boasvindas`
- [ ] `/boasvindas canal canal:#bem-vindo` — ativa e define o canal
- [ ] `/boasvindas regras canal:#regras` — (opcional) cita o canal de regras
- [ ] `/boasvindas cor-canal canal:#cores` — (opcional) cita o canal de cor de perfil
- [ ] `/boasvindas cor-embed cor:#RRGGBB` — (opcional) cor fixa (vazio = cor do avatar)
- [ ] `/boasvindas imagem url:<link>` — (opcional) imagem/gif fixo
- [ ] `/boasvindas texto texto:<texto extra>` — (opcional) bloco extra no fim
- [ ] Testar: `/boasvindas testar` • Conferir: `/boasvindas status`

### 💰 Economia (kurocoins) — `/economia`
- [ ] `/economia canal canal:#economia` — canal onde o dinheiro aparece
- [ ] `/economia intervalo tempo:30m` — de quanto em quanto tempo cai drop
- [ ] `/economia valores minimo:10 maximo:500` — faixa de cada drop
- [ ] `/economia gif acao:adicionar url:<link>` — (opcional) GIFs dos drops
- [ ] `/economia autodeletar tipo:<expirado/coletado> tempo:30s` — (opcional) apagar msgs
- [ ] Conferir: `/economia status` • Testar: `/economia forcar`

### 🧍 Cargos automáticos — `/autorole`
- [ ] `/autorole definir tipo:Membro cargo:@Membro` — cargo dado a humanos ao entrar
- [ ] `/autorole definir tipo:Bot cargo:@Bot` — (opcional) cargo dado a bots
- [ ] Conferir: `/autorole listar`

---

## 2. Moderação & segurança

### 🛡️ Automod — `/automod`
- [ ] `/automod toggle modulo:<módulo> ativo:true` — ligue os que quiser
  - módulos: Spam, Mensagens gigantes, Convites, Menção em massa, Encaminhamento, Links, GIFs, Raid
- [ ] `/automod limite caracteres:600` — (se usar anti-mensagem-gigante)
- [ ] `/automod mencoes quantidade:5` — (se usar anti-menção-em-massa)
- [ ] `/automod isento acao:adicionar cargo:@Staff` — cargos que o automod ignora
- [ ] `/automod permitir modulo:<bigmessage/invite/spam> canal:#canal` — liberar canal de um módulo

### 🔗 Anti-link — `/links`
- [ ] `/links modo modo:<whitelist/blacklist>` — escolhe o modo
- [ ] `/links permitidos` — abre o painel pra adicionar/remover domínios liberados (whitelist)
- [ ] `/links bloqueados` — painel de domínios bloqueados (blacklist)
- [ ] `/links cargo cargo:@Staff acao:adicionar` — (opcional) libera links por cargo
- [ ] `/links canal` — (opcional) restringe um domínio liberado a canais específicos
> Lembre de ligar o módulo de links no automod: `/automod toggle modulo:Links ativo:true`.

### 🎞️ Anti-GIF — `/gifs`
- [ ] `/gifs ativar` — só cargos liberados podem mandar GIF
- [ ] `/gifs cargo acao:adicionar cargo:@Booster` — quem pode mandar GIF
- [ ] Conferir: `/gifs status`

### 🪤 Trap (canal-armadilha) — `/trap`
- [ ] `/trap definir canal:#não-entre` — quem postar leva kick
- [ ] `/trap cargo acao:adicionar cargo:@Staff` — cargos isentos (e bots)
- [ ] Conferir: `/trap status`

### 🚀 Bump — `/config bump`
- [ ] `/config bump canal canal:#bump` — só `/bump` é permitido lá
- [ ] `/config bump cargo acao:adicionar cargo:@Staff` — quem pode mandar outras coisas
- [ ] Conferir: `/config bump status`

### 🔐 Permissões de comandos restritos — `/permissao`
Comandos de moderação (ban, kick, mute, clear, warn, etc.) só o dono usa até você liberar.
- [ ] `/permissao add comando:clear cargo:@Staff` — repita para cada comando/cargo
- [ ] Conferir: `/permissao listar`

---

## 3. Recursos extras

### 🛒 Loja de cargos — `/economia cargo`
- [ ] `/economia cargo acao:adicionar cargo:@VIP preco:5000 descricao:<opcional>`
- [ ] Conferir: `/economia cargo acao:listar`
> Os membros usam `/loja` e `/comprar`. ⚠️ Meu cargo precisa estar **acima** do cargo vendido.

### 📸 Mini Instagram — `/instagram`
- [ ] `/instagram ativar canal:#fotos` — transforma o canal em mural
- [ ] `/instagram info canal:#fotos imagem:<link> cor:#RRGGBB` — (opcional) personaliza o aviso
- [ ] Conferir: `/instagram listar`

### 🤝 Parcerias — `/parceria`
- [ ] `/parceria cargo acao:adicionar cargo:@Staff` — quem confirma parcerias
- [ ] `/parceria categoria categoria:<categoria>` — onde abrem os tickets
- [ ] `/parceria anuncio canal:#divulgação` — onde o anúncio é postado
- [ ] `/parceria notificar cargo:@parceria` — cargo marcado no anúncio
- [ ] `/parceria publico canal:#parcerias` — log público "fez parceria"
- [ ] `/parceria imagem url:<link>` — (opcional) imagem do embed público
- [ ] `/parceria boasvindas texto:<texto>` — (opcional) muda a mensagem de abertura
- [ ] `/logs definir tipo:Parcerias canal:#log-parcerias` — transcript ao fechar
- [ ] `/parceria painel titulo:<título>` — posta o painel no canal atual
- [ ] Conferir: `/parceria status`

### 🎫 Tickets — `/ticket`
- [ ] `/ticket suporte acao:adicionar cargo:@Staff` — quem atende
- [ ] `/ticket categoria categoria:<categoria>` — onde abrem os tickets
- [ ] `/ticket painel titulo:<título> tipo1:<tipo>` — posta o painel
- [ ] `/logs definir tipo:Tickets canal:#log-tickets` — transcript ao fechar

### 🎭 Painéis de cargo — `/cargo`
- [ ] `/cargo botoes titulo:<título> cargo1:@x [cargo2..cargo10]` — painel de botões
- [ ] `/cargo menu titulo:<título> cargo1:@x ...` — painel de menu (escolha única)

### ✉️ DM padronizada — `/dm`
- [ ] `/dm imagem url:<link>` — imagem fixa nas DMs que o bot manda (avisos, punições)
- [ ] Testar: `/dm testar` • Conferir: `/dm status`

---

## Pronto!
Depois de configurar o essencial (seções 1 e 2), o bot já está redondo no servidor.
As seções 3 você ativa conforme for usando. Em caso de dúvida, o `/painel` reúne atalhos
para os principais comandos de configuração.
