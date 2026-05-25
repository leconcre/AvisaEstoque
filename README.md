# AvisaEstoque

Micro-SaaS B2B que monitora datas de vencimento de produtos em estoque e dispara
alertas proativos via **WhatsApp** para o gerente da empresa antes que os produtos vençam.

> Sistema **ativo (push)**, não passivo (dashboard). O cliente não precisa abrir o app — o WhatsApp avisa.

---

## Stack

- **Next.js 14** (App Router) + TypeScript strict
- **PostgreSQL 16** + Prisma ORM
- **NextAuth.js v5** (Credentials Provider + bcrypt)
- **Tailwind CSS v3**
- **Zod** para validação
- **node-cron** (MVP — preparado para migrar a BullMQ + Redis no futuro)
- **WhatsApp via Evolution API** (abstraído por interface `WhatsAppProvider`)
- **Vitest + Supertest** para testes

Strings de UI, comentários e mensagens em **pt-BR**. Código (variáveis, tabelas, colunas) em **inglês**.

---

## Setup local — caminho rápido

```bash
# 1. Copie as variáveis de ambiente
cp .env.example .env

# 2. Suba o PostgreSQL (Docker)
docker compose up -d postgres

# 3. Instale dependências e gere o client Prisma
npm install
npm run db:generate

# 4. Rode as migrações e popule com dados de demo
npm run db:migrate
npm run db:seed

# 5. Suba o app em dev
npm run dev
```

App em http://localhost:3000.

**Login demo:** `ebervaldo@santacruz.com.br` / senha: `avisa123`.

---

## Setup com Docker completo (app + db)

```bash
cp .env.example .env
docker compose up --build
# Em outro terminal, na primeira vez:
docker compose exec app npx prisma migrate deploy
docker compose exec app npm run db:seed
```

---

## Variáveis de ambiente

Veja [.env.example](./.env.example) — todas comentadas. Destaques:

| Variável | Default | Função |
|---|---|---|
| `DATABASE_URL` | `postgresql://avisa:avisa@localhost:5432/...` | Connection string Postgres |
| `AUTH_SECRET` | — (obrigatório) | Segredo do NextAuth (gere com `openssl rand -base64 32`) |
| `CRON_SECRET` | — (obrigatório) | Header `X-Cron-Secret` para `POST /api/cron/run` |
| `CRON_ENABLED` | `false` | Liga o scheduler interno `node-cron`. Em dev mantenha `false` e dispare manual. |
| `WHATSAPP_PROVIDER` | `mock` | `mock` (loga no console) ou `evolution` |
| `EVOLUTION_API_URL` / `EVOLUTION_API_KEY` / `EVOLUTION_INSTANCE` | — | Necessárias se provider=`evolution` |
| `TZ` | `America/Sao_Paulo` | Timezone do processo (cron usa pra slot por empresa) |

---

## Cron — escolha por ambiente

O motor de alertas (`check-expirations`) precisa ser disparado periodicamente.
Há **dois caminhos** dependendo de onde a app roda — escolha um e use só ele.

### Caminho A — `node-cron` interno (DEV / VPS)

Para processos persistentes (laptop, EC2, Render, Fly.io, VPS qualquer).
Ligue com:

```bash
CRON_ENABLED=true npm run start
# OU rode o scheduler separado:
npm run cron:start
```

O scheduler bate de 15 em 15 min e dispara só para empresas cujo
`Company.alertTime` bate com o slot atual em America/Sao_Paulo.
Em dev, mantenha `CRON_ENABLED=false` e use o trigger manual abaixo.

### Caminho B — Cron HTTP externo (SERVERLESS)

Vercel, AWS Lambda, Cloud Run — **não** existe processo persistente,
então o `node-cron` interno NÃO roda. Configure um cron externo batendo
em `POST /api/cron/run` com o header `X-Cron-Secret`:

| Plataforma | Configuração |
|---|---|
| Vercel | `vercel.json`: `{ "crons": [{ "path": "/api/cron/run", "schedule": "*/15 * * * *" }] }` (header secret via env) |
| GitHub Actions | `on: schedule: - cron: '*/15 * * * *'` + `curl -X POST $URL -H "X-Cron-Secret: $SECRET"` |
| cron-job.org | Endpoint + custom header `X-Cron-Secret: ...` |

O endpoint aceita query params opcionais para limitar o escopo da varredura:
- `?slot=08:00` — só empresas com `alertTime=08:00` (ideal pro cron externo de 15 em 15 min)
- `?companyId=<id>` — só uma empresa específica

### Trigger manual (qualquer caminho)

```bash
curl -X POST http://localhost:3000/api/cron/run \
  -H "X-Cron-Secret: $CRON_SECRET"
```

**Idempotência diária**: rodar duas vezes no mesmo dia **não duplica** alertas.
O padrão `PENDING-first` (criar Alert com status=PENDING ANTES do envio) faz
a `@@unique([batchId, alertDate])` agir como lock distribuído. A 2ª execução
leva P2002 no `create` e desiste em silêncio antes de qualquer side-effect.

---

## Trocar o provider de WhatsApp

Implemente a interface em `src/lib/whatsapp/provider.ts`:

```ts
export interface WhatsAppProvider {
  send(to: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }>;
}
```

Crie `src/lib/whatsapp/seuprovider.ts` e registre em `src/lib/whatsapp/index.ts`.
Selecione via `WHATSAPP_PROVIDER`.

---

## Testes

```bash
npm test            # roda Vitest once
npm run test:watch  # watch mode
npm run typecheck   # tsc --noEmit
npm run build       # build de produção (deve passar sem warnings TS)
```

---

## Estrutura

```
avisaestoque/
├── prisma/            # schema + migrations + seed
├── src/
│   ├── app/           # rotas Next.js (App Router)
│   │   ├── (auth)/    # login, register
│   │   ├── (dashboard)/  # dashboard, batches, settings
│   │   └── api/       # API routes
│   ├── lib/
│   │   ├── prisma.ts        # singleton client
│   │   ├── auth.ts          # NextAuth config
│   │   ├── logger.ts        # pino (com redact de PII)
│   │   ├── errors.ts        # AppError + handler
│   │   ├── tenant.ts        # getCurrentCompany
│   │   ├── validations/     # schemas Zod
│   │   ├── whatsapp/        # provider abstraction
│   │   ├── jobs/            # scheduler + check-expirations
│   │   └── utils/           # batch-status etc
│   └── components/
└── tests/
```

---

## Decisões arquiteturais

- **Status é derivado**, nunca persistido. `CRITICAL ≤ min(alertDaysBefore, 14)`,
  `WARNING ≤ 30`, `SAFE > 30`, `EXPIRED < 0`. Calculado toda vez que um `Batch` é serializado.
- **Multi-tenancy via `companyId`** em toda entidade. Helper `getCurrentCompany(session)`
  é a única forma autorizada de obter o tenant ativo.
- **Idempotência diária** dos alertas via `@@unique([batchId, alertDate])`.
- **`alertTime` por empresa**: cron roda a cada 15 min e despacha só para empresas
  cujo `alertTime` bate com o slot atual (trade-off: precisão de 15 min em troca
  de previsibilidade e baixo custo, sem Redis/BullMQ no MVP).
- **Métricas "Taxa de resposta" e "Economia (R$)"**: retornam `null` + `preview: true`
  no MVP. Implementação real exige webhook inbound de WhatsApp e custo por lote
  (fora do escopo).

---

## Scanner de código de barras (Fase 7)

O cadastro de lote em `/batches/new` oferece um botão **"Escanear"** que abre a câmera e lê o EAN do produto. Funciona via `BarcodeDetector` nativo (Chrome/Android moderno — zero JS extra) e cai pra `@zxing/browser` em iOS Safari/Firefox via dynamic import. EAN-13 e EAN-8.

> ### ⚠️ HTTPS é obrigatório no celular — leia antes de testar
>
> `navigator.mediaDevices.getUserMedia` (a API que abre a câmera) **só funciona em Secure Context**. Concretamente:
>
> - 💻 **Desktop em `localhost`** — funciona por exceção do navegador (Chrome, Edge, Firefox tratam `127.0.0.1` e `localhost` como seguros mesmo em HTTP).
> - 📱 **Celular** — **NÃO** funciona em HTTP. Mesmo apontando pro IP do seu desktop na LAN. O botão "Escanear" simplesmente não vai abrir a câmera (e o usuário pensa que é bug). Para testar em celular real você precisa de **uma das três opções abaixo**:

### Como testar o scanner no celular

| Opção | Quando usar | Comando |
|---|---|---|
| **A. Deploy real** | Quando o app já está no ar (DEPLOY.md aplicado). | Abra `https://app.<seu-dominio>/batches/new` no celular. SSL pelo Coolify resolve. |
| **B. Cloudflared (recomendado p/ dev)** | Túnel HTTPS gratuito, sem cadastro, em ~10s. Pega o `npm run dev` local e expõe num `*.trycloudflare.com`. | `npm install -g cloudflared` então `cloudflared tunnel --url http://localhost:3000` — abre no celular a URL HTTPS que ele imprimir. |
| **C. ngrok** | Alternativa, mesma ideia. Pede cadastro. | `ngrok http 3000` |

### Comportamento em ambientes sem suporte

- **Sem câmera no dispositivo / sem `getUserMedia`** → botão "Escanear" fica oculto. Campo manual continua plenamente funcional.
- **HTTP em celular** → botão oculto (sem Secure Context). Campo manual funciona.
- **Permissão de câmera negada** → modal mostra mensagem amigável explicando como reabilitar nas configurações do site; campo manual continua disponível.
- **Código ilegível** (luz ruim, embalagem amassada) → hint "Aproxime o código do quadro" e o loop continua tentando, sem travar.

### Liberação de câmera (não-negociável)

O componente para o stream em **TODOS** os caminhos de saída:
- Clique no X, click no backdrop, tecla `Esc`
- Sucesso (EAN válido detectado — para antes de retornar)
- Desmontagem do componente (mudança de rota, navegação)
- Aba some (`visibilitychange === 'hidden'`)

Implementação em [`src/components/scanner/BarcodeScanner.tsx`](src/components/scanner/BarcodeScanner.tsx) (função `cleanup`).

---

## Deploy em produção

Veja [`deploy/DEPLOY.md`](./deploy/DEPLOY.md) — runbook completo para VPS Hostinger + Coolify + Evolution API self-hosted. Inclui:
- `deploy/docker-compose.evolution.yml` — stack do Evolution (Postgres + Redis + volume persistente, sem porta pública)
- `deploy/.env.production.example` — template das envs de produção
- `Dockerfile` da app já roda `prisma migrate deploy` no boot
- `/api/health` é o endpoint usado pelo Coolify para liveness

---

## Roadmap pós-MVP

- BullMQ + Redis (substituir node-cron) para retry/agendamento robusto
- Webhook inbound de WhatsApp → métrica de taxa de resposta real
- Campo `unitCost` em Batch → métrica de economia real
- Importação de planilhas (CSV/XLSX)
- Multi-usuário por empresa com roles (admin/operador)
