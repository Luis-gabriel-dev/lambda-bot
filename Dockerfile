# Imagem do bot Lambda — Node 22 (Debian slim).
FROM node:22-slim

# OpenSSL é exigido pelo engine do Prisma.
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 1) Dependências primeiro (camada cacheável: só refaz quando package*.json muda).
COPY package.json package-lock.json ./
RUN npm ci

# 2) Código do projeto (o .dockerignore mantém node_modules/.env de fora).
COPY . .

# 3) Gera o Prisma Client (o schema já está em PostgreSQL).
RUN npx prisma generate

# 4) Compila o TypeScript para dist/.
RUN npm run build

# 5) Na subida: sincroniza o schema no Postgres e inicia o bot.
CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/index.js"]
