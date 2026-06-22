// Copia o schema do bot (fonte única) para o site, sem editar nada.
// O bot é dono do schema; o site só gera o Prisma Client a partir dele.
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, '..', '..', 'prisma', 'schema.prisma'); // raiz do projeto
const destDir = resolve(here, '..', 'prisma');
const dest = resolve(destDir, 'schema.prisma');

mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);
console.log('[sync-schema] prisma/schema.prisma (raiz) -> web/prisma/schema.prisma');
