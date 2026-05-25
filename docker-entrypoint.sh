#!/bin/sh
# Entrypoint do AvisaEstoque em produção.
#
# Ordem:
#   1. Aplica migrations PENDENTES contra DIRECT_URL (Prisma usa essa env
#      automaticamente quando definida no schema). NUNCA usa `migrate dev`,
#      NUNCA roda seed.
#   2. exec do CMD (node server.js do Next standalone).
#
# Se a migration falhar, o processo morre — o orquestrador reinicia ou marca
# unhealthy. NUNCA continuamos sem o schema atualizado: requests viriam,
# Prisma reclamaria, dados poderiam corromper.
set -e

echo "[entrypoint] aplicando migrations (prisma migrate deploy)..."
# Chamamos o CLI direto pelo JS porque o standalone do Next não inclui o .bin
# do npm. O `node_modules/prisma` foi copiado no Dockerfile.
node ./node_modules/prisma/build/index.js migrate deploy

echo "[entrypoint] iniciando servidor Next (node server.js)..."
exec "$@"
