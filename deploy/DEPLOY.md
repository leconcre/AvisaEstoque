# AvisaEstoque — Runbook de Deploy

VPS Hostinger (template "Ubuntu 24.04 com Coolify") + Coolify + Neon + Evolution API self-hosted.

Este runbook é **executado por você**. O dev/arquiteto que gerou os artefatos não acessa o VPS.
Siga em ordem. Cada seção tem um critério de "feito" antes de prosseguir.

> **Convenções**
> Comandos prefixados com `$` rodam no seu **desktop** (Linux/macOS/WSL).
> Comandos prefixados com `vps#` rodam no **VPS via SSH como root**.
> Trechos `<assim>` são placeholders que você substitui.

---

## 0. Pré-requisitos

- Domínio próprio com DNS gerenciável (Hostinger, Cloudflare, etc.)
- Chave SSH pública (`~/.ssh/id_ed25519.pub` ou similar)
- Conta Neon ativa (já temos — `DATABASE_URL` funcionando em dev)
- WhatsApp dedicado num **chip novo** (NÃO o seu pessoal)
- `openssl`, `curl`, `ssh` instalados no desktop

> **⚠️ Sobre o chip do WhatsApp**
> O Evolution API usa **Baileys** (cliente WhatsApp não-oficial via WebSocket). O WhatsApp pode banir o número, especialmente nos primeiros 1–2 dias de uso. Use um **número dedicado, em chip novo, não o seu pessoal**.
> A migração para a **WhatsApp Cloud API oficial** (Meta) é o caminho quando houver volume de clientes. Por design, só trocamos a implementação de `WhatsAppProvider` — o resto do app não se mexe.

---

## 1. Provisionar o VPS na Hostinger

1. No painel da Hostinger → **VPS → Comprar/Configurar**.
2. Em **Sistema operacional → Aplicações**, escolha **Ubuntu 24.04 com Coolify**.
3. Defina:
   - **Hostname:** `avisaestoque-prod` (ou o que preferir)
   - **Senha root:** gere com `openssl rand -base64 24` e salve no seu gerenciador de senhas
   - **SSH key:** cole sua chave pública (recomendado em vez de senha)
4. Aguarde o provisionamento (~5 min). Anote o **IP público** do VPS.

### Critério de "feito" §1
- Você consegue: `$ ssh root@<ip-do-vps>` (ou com sua chave) e ver o prompt.

---

## 2. DNS

No painel da zona DNS do seu domínio, crie:

| Tipo | Nome | Valor (IP do VPS) | TTL |
|---|---|---|---|
| `A` | `app` (ou `avisaestoque`) | `<ip-do-vps>` | 300 |

Aguarde a propagação (~5 min para 1h).

```bash
$ dig +short app.<seu-dominio>
# deve retornar o IP do VPS
```

### Critério de "feito" §2
- `dig` retorna o IP correto.

---

## 3. Acesso inicial ao Coolify

O template já subiu o Coolify. Acesse:

```
http://<ip-do-vps>:8000
```

(Sim, HTTP nesse primeiro acesso — você ainda não tem domínio configurado pro próprio Coolify; vamos resolver no §3.3.)

### 3.1. Criar conta admin
Primeiro acesso pede criação do admin. Use um email que você acessa.

### 3.2. Configurar Server / SSH key
- Em **Servers → localhost**, confirme que o Coolify está com SSH OK no próprio host (já vem configurado pelo template).

### 3.3. Domínio do Coolify (opcional mas recomendado)
- Em **Settings → Configuration**, configure um subdomínio só pro próprio Coolify (ex: `coolify.<seu-dominio>`) para ter HTTPS no painel.
- Crie um registro DNS `A coolify → <ip>` e siga as instruções da UI.

### Critério de "feito" §3
- Você está logado no Coolify e vê o dashboard vazio.

---

## 4. Deploy do Evolution API (Service)

### 4.1. Gerar segredos

No seu desktop:

```bash
$ openssl rand -hex 32   # → EVOLUTION_API_KEY
$ openssl rand -base64 32 # → EVOLUTION_POSTGRES_PASSWORD
```

Salve ambos no gerenciador de senhas. Eles aparecerão de novo no §6.

### 4.2. Criar o Service no Coolify

1. No Coolify: **+ New → Service → Docker Compose**.
2. Nome: `evolution-stack`.
3. Cole o conteúdo de `deploy/docker-compose.evolution.yml` deste repo no editor.
4. Em **Environment Variables**, adicione:
   ```
   EVOLUTION_API_KEY=<o que você gerou>
   EVOLUTION_POSTGRES_PASSWORD=<o que você gerou>
   EVOLUTION_SERVER_URL=http://evolution-api:8080
   ```
5. **Não** configure domínio público pro Evolution. Ele NÃO deve ficar exposto.
6. **Deploy.**

> **Nota sobre a rede `coolify`**
> O compose declara `networks: coolify: external: true`. Se o Coolify ainda não criou essa rede, o deploy vai falhar. Resolva no terminal do VPS:
> ```
> vps# docker network create coolify
> ```
> Depois redeploy.

### 4.3. Confirmar que subiu

```bash
$ ssh root@<ip-do-vps>
vps# docker ps --format 'table {{.Names}}\t{{.Status}}'
# Esperado:
#   evolution-api        Up X minutes (healthy)
#   evolution-postgres   Up X minutes (healthy)
#   evolution-redis      Up X minutes (healthy)
```

Confirme o volume:

```bash
vps# docker volume ls | grep evolution
# Esperado: três volumes nomeados — instances, postgres_data, redis_data
```

### Critério de "feito" §4
- Os três containers estão `healthy`.
- Volumes `evolution_instances`, `evolution_postgres_data`, `evolution_redis_data` existem.
- A porta 8080 **NÃO** aparece no `nmap` externo do VPS:
  ```
  $ nmap -p 8080 <ip-do-vps>      # deve mostrar "filtered" ou "closed"
  vps# ss -tlnp | grep :8080      # deve listar 127.0.0.1:8080, NÃO 0.0.0.0:8080
  ```

---

## 5. Parear o WhatsApp e validar o Evolution ISOLADAMENTE

Antes de envolver o app, prove que o Evolution sozinho consegue enviar uma mensagem. Se isso falhar, sair caçando bug no app é perda de tempo.

### 5.1. SSH tunnel pro 8080 do VPS

Em uma janela de terminal que você manterá aberta durante o pareamento:

```bash
$ ssh -L 8080:127.0.0.1:8080 root@<ip-do-vps>
```

Enquanto esse SSH estiver aberto, `http://localhost:8080` do **seu desktop** acessa o Evolution dentro do VPS.

### 5.2. Criar a instância

Em **outro terminal** no seu desktop (não no SSH):

```bash
$ export EVO_KEY="<EVOLUTION_API_KEY>"
$ curl -s -X POST http://localhost:8080/instance/create \
    -H "Content-Type: application/json" \
    -H "apikey: $EVO_KEY" \
    -d '{
      "instanceName": "avisaestoque-prod",
      "qrcode": true,
      "integration": "WHATSAPP-BAILEYS"
    }' | jq .
```

Resposta esperada: JSON com `instance.instanceName="avisaestoque-prod"` e um campo `qrcode.base64` (PNG base64) ou `qrcode.code` (string do QR).

### 5.3. Pegar o QR pra escanear

Opção A — abrir no navegador (precisa do tunnel ativo):
```
http://localhost:8080/instance/connect/avisaestoque-prod
```
Adicione header de auth via extensão (Modify Headers) OU use a opção B.

Opção B — via curl + arquivo PNG:
```bash
$ curl -s -H "apikey: $EVO_KEY" \
    http://localhost:8080/instance/connect/avisaestoque-prod \
    | jq -r '.base64 // .qrcode.base64' \
    | sed 's/^data:image\/png;base64,//' \
    | base64 -d > /tmp/qr.png
$ open /tmp/qr.png    # macOS
# ou: xdg-open /tmp/qr.png    # Linux
```

Escaneie com o WhatsApp do chip dedicado: **Configurações → Aparelhos conectados → Conectar aparelho**.

### 5.4. Confirmar conexão

```bash
$ curl -s -H "apikey: $EVO_KEY" \
    http://localhost:8080/instance/connectionState/avisaestoque-prod | jq .
# Esperado: { "instance": { "state": "open" } }
```

### 5.5. Enviar mensagem de teste pro SEU número direto (ainda sem o app)

Substitua `+55XXXXXXXXXXX` pelo seu próprio número (E.164, **sem** o `+` no payload):

```bash
$ curl -s -X POST http://localhost:8080/message/sendText/avisaestoque-prod \
    -H "Content-Type: application/json" \
    -H "apikey: $EVO_KEY" \
    -d '{
      "number": "55XXXXXXXXXXX",
      "text": "Teste direto no Evolution — se você está lendo isso, a stack funciona."
    }' | jq .
```

### Critério de "feito" §5
- A mensagem chega no seu WhatsApp **em até 5 segundos**.
- `connectionState` retorna `open`.
- Se NÃO chegar: o problema é Evolution / pareamento, NÃO o app. Resolva aqui antes de prosseguir. Ver §11 Troubleshooting.

> Feche o SSH tunnel quando acabar este passo (`Ctrl+C` na janela). A porta 8080 NÃO deve ficar com tunnel pendurado em background.

---

## 6. Deploy do app AvisaEstoque (Application)

### 6.1. Gerar segredos do app

```bash
$ openssl rand -base64 48   # → AUTH_SECRET
$ openssl rand -hex 32      # → CRON_SECRET
```

### 6.2. Obter as duas URLs do Neon

No console Neon do projeto:
- **Connection string → Prisma → "Connection pooler"** → copie como `DATABASE_URL` (tem `-pooler` no hostname)
- **Connection string → Prisma → "Direct connection"** → copie como `DIRECT_URL` (sem `-pooler`)

### 6.3. Criar a Application no Coolify

1. **+ New → Application → Public Repository** (ou Private se for o seu caso, conectando GitHub/GitLab).
2. **Repository:** URL do repo deste projeto, branch `main`.
3. **Build pack:** `Dockerfile` (Coolify detecta o `Dockerfile` na raiz).
4. **Port:** `3000`.
5. **Healthcheck:** path `/api/health`, port `3000`, interval `30s`. Coolify lê esse endpoint.

### 6.4. Domínio + SSL

- Em **Domains**, adicione `app.<seu-dominio>`.
- Coolify provisiona o cert Let's Encrypt automaticamente (verifique se HTTP-01 challenge passou; pode levar 1–2 min).
- Confirme em `https://app.<seu-dominio>/api/health` — deve voltar `{ "status": "ok", ... }`.

> **⚠️ Cookies Secure**
> `AUTH_URL` precisa ser `https://`. Cookies de sessão são `Secure` por padrão; em HTTP eles não persistem e o login fica em loop.

### 6.5. Environment Variables

Cole no Coolify (todas como runtime, não build-time, **exceto** as marcadas explicitamente):

```
NODE_ENV=production
TZ=America/Sao_Paulo
LOG_LEVEL=info

DATABASE_URL=postgresql://...-pooler...neon.tech/...
DIRECT_URL=postgresql://....neon.tech/...

AUTH_SECRET=<gerado no §6.1>
AUTH_URL=https://app.<seu-dominio>
AUTH_TRUST_HOST=true

CRON_ENABLED=true
CRON_SECRET=<gerado no §6.1>

WHATSAPP_PROVIDER=evolution
EVOLUTION_API_URL=http://evolution-api:8080
EVOLUTION_API_KEY=<a mesma do Evolution §4.1>
EVOLUTION_INSTANCE=avisaestoque-prod
```

> Use o template completo em `deploy/.env.production.example` como guia.

### 6.6. Deploy

Clique **Deploy**. Acompanhe o build no painel de logs. Sequência esperada:

```
=> [deps]    npm install ...                       (~30s)
=> [builder] npx prisma generate                   (~10s)
=> [builder] npm run build                         (~60s)
=> [runner]  COPY ... entrypoint.sh                (instantâneo)
=> push to local registry / start container
[entrypoint] aplicando migrations (prisma migrate deploy)...
   X migrations applied.
[entrypoint] iniciando servidor Next (node server.js)...
   ▲ Next.js 14.x.x
   ✓ Ready on port 3000
```

Se o `migrate deploy` falhar (DIRECT_URL errada, credenciais expiradas), o container morre e o Coolify mostra "unhealthy". Corrigir env e redeploy.

### Critério de "feito" §6
- `https://app.<seu-dominio>` carrega o login do AvisaEstoque.
- `https://app.<seu-dominio>/api/health` → `{ "status": "ok", "uptimeMs": ..., "latencyMs": ... }`.
- Coolify mostra Application como **healthy** (verde).
- Login com o usuário demo (se quiser testar) ou cadastro de uma empresa nova via `/register`.

---

## 7. Trocar Mock por Evolution na prática

Você já setou `WHATSAPP_PROVIDER=evolution` no §6.5. Agora prove que o app fala com o Evolution:

1. Logue na app: `https://app.<seu-dominio>/login`.
2. Vá em **Configurações**.
3. Confirme que o **WhatsApp do gerente** está no E.164 do seu chip de teste OU do seu pessoal (pra você ver a mensagem chegar).
4. Clique em **Testar envio**.
5. A mensagem deve chegar no WhatsApp configurado em < 5s.

### Critério de "feito" §7
- Mensagem de teste chega no WhatsApp configurado.
- No log do Application (Coolify): `event: alerts.test.ok`.
- No log do Evolution (Coolify): linha com `sendMessage` e código 201/200.

Se algo falhar, ver §11.

---

## 8. Ligar o cron e validar a varredura real

O cron interno já está rodando (`CRON_ENABLED=true`). O scheduler dispara a cada 15 min e só processa empresas cujo `Company.alertTime` bate com o slot atual.

### 8.1. Validar com trigger manual primeiro

Antes de esperar o slot natural, force uma varredura:

```bash
$ curl -X POST https://app.<seu-dominio>/api/cron/run \
    -H "X-Cron-Secret: <CRON_SECRET>"
```

Resposta esperada:
```json
{
  "ok": true,
  "scanned": 1,
  "results": [{
    "companyName": "...",
    "candidates": N,
    "newlyReserved": N,
    "sent": N,
    "failed": 0,
    "messageId": "..."
  }]
}
```

A mensagem chega no WhatsApp do gerente.

### 8.2. Validar idempotência

Rode o `curl` acima **uma segunda vez** imediatamente. Resposta esperada: `newlyReserved: 0, alreadyAlertedToday: N, sent: 0`. **Nenhuma mensagem nova chega no WhatsApp.**

### 8.3. Validar o slot automático

- Em **Configurações** da empresa, ajuste `alertTime` para **um múltiplo de 15 min próximo do horário atual** (ex: se agora é 14:23 SP, configure 14:30).
- Aguarde até o slot.
- A mensagem deve chegar perto do 14:30.
- Confira o log do Application: `event: scheduler.tick slot: "14:30"` seguido de `event: scan.start`, `scan.finish`.

### Critério de "feito" §8
- Trigger manual funciona e o WhatsApp chega.
- 2ª trigger no mesmo dia não dispara mensagem.
- Slot automático dispara perto do `alertTime` configurado.

---

## 9. Hardening (não pule)

### 9.1. Firewall UFW

```bash
vps# ufw default deny incoming
vps# ufw default allow outgoing
vps# ufw allow 22/tcp
vps# ufw allow 80/tcp
vps# ufw allow 443/tcp
# Opcional: 8000 (UI do Coolify) restrito ao SEU IP:
vps# ufw allow from <SEU_IP_DESKTOP> to any port 8000
vps# ufw enable
vps# ufw status verbose
```

Confirme que **NÃO** está aberto:
- 5432 (Postgres do Evolution — está em rede interna)
- 6379 (Redis do Evolution — idem)
- 8080 (API do Evolution — só em 127.0.0.1)

```bash
$ nmap -p 5432,6379,8080 <ip-do-vps>     # tudo "filtered" ou "closed"
```

### 9.2. SSH só por chave

```bash
vps# vim /etc/ssh/sshd_config
# Editar:
#   PasswordAuthentication no
#   PermitRootLogin prohibit-password
vps# systemctl restart sshd
```

**Antes de fechar a sessão** abra uma segunda em outro terminal pra confirmar que a chave ainda funciona. Senão você se tranca fora.

### 9.3. fail2ban

```bash
vps# apt update && apt install -y fail2ban
vps# systemctl enable --now fail2ban
vps# fail2ban-client status sshd
```

### 9.4. Atualizações automáticas

```bash
vps# apt install -y unattended-upgrades
vps# dpkg-reconfigure -plow unattended-upgrades
```

### Critério de "feito" §9
- `nmap` externo só vê 22, 80, 443.
- Login por senha bloqueado.
- `fail2ban-client status sshd` retorna ativo.

---

## 10. Backups

### 10.1. Neon (banco do app)
- No console Neon → **Settings → Branches** → confirme que **PITR** está ativo (free tier: 7 dias). É o backup do dado do cliente — o mais crítico.

### 10.2. Volume do Evolution
A sessão Baileys vive em `evolution_instances` (volume Docker). Se perder, precisa parear o QR de novo (chip pode bloquear pareamentos repetidos em curto intervalo).

Backup diário do volume — adicione no crontab do root no VPS:

```bash
vps# crontab -e
# Adicione (3h da manhã):
0 3 * * * /usr/local/bin/backup-evolution.sh >> /var/log/backup-evolution.log 2>&1
```

E crie o script:

```bash
vps# cat > /usr/local/bin/backup-evolution.sh <<'EOF'
#!/bin/sh
set -e
TS=$(date +%Y%m%d-%H%M)
DEST=/root/backups/evolution
mkdir -p "$DEST"
docker run --rm \
  -v evolution_instances:/src:ro \
  -v "$DEST":/dst \
  alpine \
  tar czf "/dst/instances-${TS}.tar.gz" -C /src .
# Mantém apenas 14 dias
find "$DEST" -name 'instances-*.tar.gz' -mtime +14 -delete
EOF
vps# chmod +x /usr/local/bin/backup-evolution.sh
vps# /usr/local/bin/backup-evolution.sh    # rodar uma vez manualmente pra validar
```

Verifique:
```bash
vps# ls -lh /root/backups/evolution/
# instances-YYYYMMDD-HHMM.tar.gz  ~poucos MB
```

> **Opcional mas recomendado:** copiar esses tar.gz pra fora do VPS (S3, R2, ou seu desktop via `rsync`). Se o VPS evaporar, o backup local some junto.

### Critério de "feito" §10
- Neon PITR ativo.
- Cron de backup do Evolution rodou ao menos uma vez e gerou um `.tar.gz`.

---

## 11. Troubleshooting

### App em loop de redirect pra /login
**Causa típica:** `AUTH_URL` não é HTTPS, ou está com host diferente do que está sendo acessado.
**Fix:** confira no painel do Coolify; deve ser exatamente `https://app.<seu-dominio>` (sem barra no final).

### `/api/health` retorna 503
**Causa:** Prisma não conecta no Neon.
**Diagnóstico:** logs do Application no Coolify, procurar erro de connection refused / SSL / auth.
**Fix mais comum:** `DATABASE_URL` sem `?sslmode=require`. Neon exige.

### Migrate falha no boot
**Causa:** `DIRECT_URL` errada (apontando pro pooler, ou faltando).
**Fix:** confirme que `DIRECT_URL` é o endpoint Neon SEM `-pooler` no hostname. Redeploy.

### App não acha o Evolution (timeout em /api/alerts/test)
**Causa típica:** redes Docker desconectadas.
**Diagnóstico:**
```bash
vps# docker network inspect coolify | grep -E 'Name|Containers' -A 20
# Tem que listar evolution-api E o container do app
```
**Fix:** no Coolify, garantir que ambos (Service do Evolution e Application do app) estão **no mesmo Project**, ou conectados manualmente à network `coolify`.

### Evolution retorna 401 nas chamadas do app
**Causa:** `EVOLUTION_API_KEY` no app diferente da `AUTHENTICATION_API_KEY` do Evolution.
**Fix:** copiar do gerenciador de senhas (são o MESMO valor) e redeploy do Application.

### WhatsApp para de enviar / instância caiu
```bash
$ ssh -L 8080:127.0.0.1:8080 root@<ip>
$ curl -s -H "apikey: $EVO_KEY" \
    http://localhost:8080/instance/connectionState/avisaestoque-prod | jq .
```
Se `state` for `close` ou `connecting`: o chip caiu. Pode ter sido:
- Banimento do WhatsApp (especialmente nas primeiras semanas) — verifique no próprio app WhatsApp.
- Reinstalação no celular, ou logout manual.
**Fix:** parear de novo seguindo §5.

### Coolify reinicia o container em loop
**Causa típica:** healthcheck falhando porque `/api/health` retorna 503 (DB) ou o container morreu no `migrate deploy`.
**Fix:** logs do Application, corrige a env, redeploy.

### Cron não dispara no `alertTime`
**Diagnóstico:** logs do Application, procurar `event: scheduler.tick`. Aparece a cada 15 min.
- Se não aparece: `CRON_ENABLED` não está `true`. Confira a env e redeploy.
- Se aparece mas não há `event: scan.start`: nenhum `alertTime` da empresa bate com o slot. Confira em **Configurações → Horário do disparo**.

---

## 12. Quando migrar o banco do Neon pro Coolify

Não faça agora. Mas saiba o caminho:

1. Subir um Service Postgres dedicado no Coolify (template oficial).
2. `pg_dump` do Neon → `pg_restore` no novo banco.
3. Atualizar `DATABASE_URL` e `DIRECT_URL` no Application.
4. Redeploy. O entrypoint roda `migrate deploy` — nenhuma migration nova vai aplicar (estado igual), só valida.
5. Validar dashboard e endpoints.
6. Manter o Neon como fallback por algumas semanas (continua aceitando queries; só não recebe escritas).
7. Quando confiante, desativar o projeto Neon.

Trade-off: você ganha custo (Neon free tem limites) e perde os backups PITR gerenciados. Faça só com backup próprio bem configurado.

---

## 13. Checklist final (marque cada um após executar)

- [ ] **§1** SSH no VPS funciona.
- [ ] **§2** DNS de `app.<dominio>` aponta pro VPS.
- [ ] **§3** Coolify acessível, conta admin criada.
- [ ] **§4** Stack `evolution-stack` com 3 containers `healthy`.
- [ ] **§4** Porta 8080 NÃO exposta publicamente (`nmap` confirma).
- [ ] **§5** `curl` direto no Evolution entrega WhatsApp ao seu número.
- [ ] **§5** SSH tunnel fechado após pareamento.
- [ ] **§6** `https://app.<dominio>` carrega e tem SSL válido.
- [ ] **§6** `https://app.<dominio>/api/health` → `200 {status:ok}`.
- [ ] **§6** Login na app funciona; pode cadastrar empresa nova.
- [ ] **§7** `/api/alerts/test` da UI faz chegar WhatsApp.
- [ ] **§8** Trigger manual `/api/cron/run` dispara varredura e entrega WhatsApp.
- [ ] **§8** 2ª trigger no mesmo dia: `sent: 0` (idempotência).
- [ ] **§8** Scheduler automático dispara perto do `alertTime`.
- [ ] **§9** `nmap` externo só vê 22, 80, 443.
- [ ] **§9** SSH por senha bloqueado; chave funciona.
- [ ] **§9** `fail2ban` rodando.
- [ ] **§10** Neon PITR confirmado ativo.
- [ ] **§10** Cron de backup do Evolution rodou e gerou tar.gz.
- [ ] Chip do WhatsApp **não é o pessoal** — é dedicado, em SIM novo.

---

## Apêndice — Comandos úteis de operação

### Logs ao vivo de qualquer container

```bash
vps# docker logs -f --tail=200 avisaestoque-app-xxxxxx   # container do app (nome varia)
vps# docker logs -f --tail=200 evolution-api
vps# docker logs -f --tail=200 evolution-postgres
```

### Trigger manual de varredura (debug)

```bash
$ curl -X POST https://app.<dominio>/api/cron/run \
    -H "X-Cron-Secret: <CRON_SECRET>" | jq .
```

### Restaurar volume do Evolution a partir de backup

```bash
vps# docker stop evolution-api
vps# docker run --rm \
  -v evolution_instances:/dst \
  -v /root/backups/evolution:/src:ro \
  alpine \
  sh -c 'cd /dst && tar xzf /src/instances-YYYYMMDD-HHMM.tar.gz'
vps# docker start evolution-api
```

### Forçar redeploy do app no Coolify
- **Application → Deploy → Redeploy** (sem mudar nada). Útil quando você só editou envs.

### Verificar que migrations foram aplicadas

```bash
vps# docker exec -it avisaestoque-app-xxxxxx \
  node ./node_modules/prisma/build/index.js migrate status
```

### Rotacionar AUTH_SECRET (invalidate all sessions)

1. Gere novo: `$ openssl rand -base64 48`.
2. Coolify → Application → Env → atualize `AUTH_SECRET`.
3. Redeploy. Todos os usuários logados precisarão entrar de novo.

---

**Fim do runbook.** Em caso de erro fora dos cenários cobertos em §11, capture logs do Application + Evolution e ajuste antes de propagar mudança.
