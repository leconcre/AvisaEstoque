# AvisaEstoque — Handoff para Claude Code

Documento de entrega do protótipo de alta fidelidade. Mapeia tokens de design, componentes-chave, ligações tela → API, decisões de UX e checklist final de QA visual.

---

## 1. Design Tokens

Cole o bloco abaixo em `src/styles/tokens.css` e importe no `globals.css`.

```css
/* tokens.css — pronto para colar */
:root {
  /* Surfaces */
  --background:      oklch(0.99 0.005 95);          /* off-white quente */
  --surface:         oklch(1 0 0);
  --border:          oklch(0.92 0.008 95);
  --border-strong:   oklch(0.86 0.01 95);

  /* Foreground */
  --fg:              oklch(0.18 0.01 260);          /* quase preto frio */
  --fg-2:            oklch(0.32 0.012 260);
  --muted:           oklch(0.55 0.015 260);
  --muted-2:         oklch(0.70 0.012 260);

  /* Brand */
  --brand:           oklch(0.55 0.18 155);          /* verde profundo */
  --brand-hover:     oklch(0.62 0.20 155);
  --brand-soft:      oklch(0.95 0.05 155);
  --brand-fg:        oklch(0.32 0.12 155);

  /* CRITICAL (≤7d) */
  --crit:            oklch(0.60 0.22 25);
  --crit-soft:       oklch(0.96 0.04 25);
  --crit-border:     oklch(0.85 0.10 25);

  /* WARNING (≤30d) */
  --warn:            oklch(0.70 0.17 75);
  --warn-soft:       oklch(0.97 0.05 75);
  --warn-border:     oklch(0.87 0.10 75);

  /* SAFE (>30d) */
  --safe:            oklch(0.60 0.14 155);
  --safe-soft:       oklch(0.96 0.04 155);
  --safe-border:     oklch(0.85 0.08 155);

  /* EXPIRED */
  --exp:             oklch(0.50 0.01 260);
  --exp-soft:        oklch(0.95 0.005 260);
  --exp-border:      oklch(0.88 0.008 260);

  /* Elevation */
  --shadow-sm: 0 1px 2px 0 oklch(0.18 0.01 260 / 0.04);
  --shadow-md: 0 4px 14px -4px oklch(0.18 0.01 260 / 0.08),
               0 1px 2px 0 oklch(0.18 0.01 260 / 0.04);
  --shadow-lg: 0 24px 48px -16px oklch(0.18 0.01 260 / 0.18),
               0 2px 6px -1px oklch(0.18 0.01 260 / 0.06);

  /* Type */
  --font-sans: 'Inter', ui-sans-serif, system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;

  /* Radii */
  --radius-lg:  12px;   /* cards */
  --radius-md:  8px;    /* inputs, buttons */
  --radius-sm:  6px;

  /* Spacing scale: 4 / 8 / 12 / 16 / 24 / 32 / 48 */

  /* Brand hex (para SVGs e fallbacks onde OKLCH não é suportado) */
  --brand-hex-accent:  #18A55F;   /* highlight do gradiente da marca */
  --brand-hex-primary: #11854F;   /* verde principal */
  --brand-hex-deep:    #0B6B3E;   /* base do gradiente */
}

/* Ray-cast borders — aplicar com a classe utilitária .ray */
.ray { position: relative; isolation: isolate; }
.ray::before {
  content: ''; position: absolute; inset: 0;
  border-radius: inherit; pointer-events: none;
  box-shadow:
    inset  0  1px 0 0 oklch(1 0 0 / 0.7),
    inset  0 -1px 0 0 oklch(0 0 0 / 0.06);
}

/* Pulse APENAS no estado CRITICAL */
@keyframes pulse-crit {
  0%, 100% { box-shadow: 0 0 0 0 oklch(0.6 0.22 25 / 0.5); }
  70%      { box-shadow: 0 0 0 6px oklch(0.6 0.22 25 / 0); }
}
.pulse-crit { animation: pulse-crit 1.8s ease-out infinite; }
```

### Hierarquia tipográfica

| Token       | Tamanho | Peso | Tracking | Uso                                            |
|-------------|---------|------|----------|------------------------------------------------|
| Display     | 28px    | 600  | tight    | títulos de página (Painel, Lotes)             |
| H1          | 20px    | 600  | tight    | títulos de cards/sections                      |
| Body        | 14px    | 400  | normal   | parágrafos, listagens                          |
| Body-strong | 13.5px  | 500  | normal   | linhas da tabela                              |
| Caption     | 12px    | 400  | wide+up  | metadados, labels                              |
| Mono        | 12-14px | 400-600 | normal | lote, EAN, datas, contadores, dias restantes  |
| Hero number | 58-68px | 600  | tight    | número grande do Painel                        |

---

## 2. Componentes-Chave Catalogados

### `<Logo />`
Marca AvisaEstoque — calendário com pulso de batimento (validade + monitoramento ativo).

```tsx
interface LogoProps {
  size?: number;          // px do mark (default 28)
  withWordmark?: boolean; // mostra "AvisaEstoque" ao lado
  withTagline?: boolean;  // mostra "Alertas de validade para PMEs" abaixo do wordmark
  animated?: boolean;     // ativa a animação do batimento (USAR APENAS NO LOGIN)
}
```

- **Estados:** default, `animated`. A animação respeita `prefers-reduced-motion: reduce`.
- **Onde usar `animated`:** somente no login (entrada do app). Em sidebar, topbar, favicon e quaisquer telas internas, deixar estático — evita poluição visual constante.
- **Cores:** gradient brand do SVG (`#18A55F` → `#0B6B3E`). Não recolorir; a marca é o único elemento que mantém valores hex fixos no produto.
- **Arquivos:** SVG canônico em `public/logo.svg` (também serve como `public/favicon.svg`). Bloco SVG no fim deste documento.

### `StatusBadge`
Pílula colorida com bolinha indicadora — opcionalmente com label.

```tsx
type Status = 'CRITICAL' | 'WARNING' | 'SAFE' | 'EXPIRED';

interface StatusBadgeProps {
  status: Status;
  size?: 'sm' | 'md';
  withPulse?: boolean;  // default true; ignorado se status !== CRITICAL
  withLabel?: boolean;  // default true
}
```

- **Estados:** `default`. Sem hover; pulse contínuo apenas se `status === 'CRITICAL'` E `withPulse !== false`.
- **Comportamento crítico:** `StatusBadge` é a única superfície com animação contínua no produto. Não copie esse pulse para outros badges — o efeito perde força.

### `Button`
Primária (gradient + ray-cast inset), secundária (bordada), ghost (sem borda).

```tsx
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;       // ícone à esquerda (lucide stroke 1.75)
  iconRight?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  children: ReactNode;
}
```

- **Estados:** default, hover (filter:brightness +4%, shadow brand), active (translateY 0.5px), disabled (opacity 0.5).
- Em primária, mantenha o gradient `oklch(0.62 0.2 155) → oklch(0.55 0.18 155)`. Não substitua por solid.

### `Field` + `Input`
Wrapper de input com label uppercase + hint + error.

```tsx
interface FieldProps {
  label: string;
  hint?: string;
  error?: string | null;
  kbd?: ReactNode;        // dica de teclado à direita do label
  mono?: boolean;         // aplica font-mono no conteúdo
  children: ReactNode;
}
```

- **Estados:** default, focus-within (ring brand 3px + border brand), error (border crit).
- O ring de foco usa `box-shadow` para não deslocar o layout.

### `StatCard` (Painel)
Card clicável com número grande, ícone do status e descrição.

```tsx
interface StatCardProps {
  status: Status;
  count: number;
  label: string;
  desc: string;
  onClick?: () => void;   // navega para /batches com filter=status
}
```

- **Ícones (lucide-react):**
  - CRITICAL → `AlertTriangle`
  - WARNING  → `Clock`
  - SAFE     → `ShieldCheck`
  - EXPIRED  → `XCircle`
- O swatch é `34×34px`, `rounded-lg`, background na variação **soft** do status, ícone na variação **solid**, borda na **border** do status.
- **Crit badge:** quando `status === 'CRITICAL' && count > 0`, ancorar um dot de 12px no canto superior direito do card com `position: absolute; top: -5px; right: -5px`, `box-shadow: 0 0 0 2px var(--surface), 0 0 0 3px var(--crit-border)` e classe `.pulse-crit`. Nunca deixar solto no fluxo (sem ancoragem ele lê como bug).
- **Estados:** default, hover (`translateY(-1px)` + shadow-md), focus-visible (ring brand).

### `AppShell`
Composto por `Sidebar` (≥1024px), `BottomNav` (<1024px), `TopBar` (sticky).

- Sidebar contém: logo, card da empresa, 4 itens de nav, card de dica.
- Item ativo: background `--brand-soft` + texto `--brand-fg` + ícone com stroke 2.0.
- TopBar: avatar (iniciais sobre brand-soft) + sino com dot crítico + título da tela.

### `Toast`
Notificação efêmera no centro-inferior, auto-dismiss em 3.2s.

```tsx
interface Toast {
  kind?: 'success' | 'error';
  message: string;
  sub?: string;
  duration?: number;      // ms, default 3200
}
```

### `FAB`
Botão flutuante primário no canto inferior direito.

- No mobile, fica acima da `BottomNav` (bottom: 80px).
- No desktop, é absoluto ao conteúdo (bottom: 24px right: 20px).

---

## 3. Mapeamento Tela → Rota → Endpoints

| Tela do protótipo       | Rota Next.js              | Endpoints consumidos                                    | Notas                                                                 |
|-------------------------|---------------------------|----------------------------------------------------------|------------------------------------------------------------------------|
| Login                   | `/login`                  | `POST /api/auth/login`                                   | Set-cookie httpOnly. Após sucesso, redirect `/dashboard`.             |
| Painel (Dashboard)      | `/dashboard`              | `GET /api/batches?summary=true`                          | Retorna `counts: {critical, warning, safe, expired}` e top 5.         |
|                         |                           | `GET /api/alerts/latest`                                 | Para o card “Canal de alerta” (último disparo, próximo agendado).     |
|                         |                           | `POST /api/alerts/resend?date=today`                     | Botão “Reenviar alerta de hoje” no hero.                              |
| Lotes                   | `/batches`                | `GET /api/batches?status=&q=&sort=`                      | Filtros são query params; `counts` deve vir em paralelo (header `X-Counts`). |
|                         |                           | `DELETE /api/batches/:id`                                | Confirmação inline (não usar modal nativo).                           |
| Cadastrar lote          | `/batches/new`            | `GET /api/products/by-ean/:ean`                          | Autocomplete do nome do produto.                                      |
|                         |                           | `POST /api/batches`                                      | Retornar objeto completo (ver decisão #2).                            |
| Configurações           | `/settings`               | `GET /api/company`                                       |                                                                        |
|                         |                           | `PATCH /api/company`                                     | Atualiza nome, e-mail, whatsapp, horário, toggle.                    |
|                         |                           | `POST /api/alerts/test`                                  | Botão “Testar envio de alerta”.                                       |

---

## 4. Decisões de UX Não-Óbvias (preservar no backend/front-end)

### Métricas: o que é REAL no MVP vs. PLACEHOLDER/v2

O card **"Canal de alerta"** no Painel mostra três métricas. Trate cada uma como abaixo — não tente inferir taxa de resposta ou economia a partir de dados que o MVP não captura.

| Métrica         | Status MVP   | Fonte de dados sugerida                                    |
|-----------------|--------------|------------------------------------------------------------|
| Alertas (30d)   | ✅ **REAL**   | `COUNT(*)` em `alerts WHERE sent_at > NOW() - 30d`         |
| Resp. taxa      | ⏳ **v2 / prévia** | Requer rastreamento de read-receipts no canal de envio (não implementado). No protótipo aparece com chip `prévia`. |
| Economia (R$)   | ⏳ **v2 / prévia** | Requer baixa contábil dos lotes (acerto do estoque + custo unitário). Renderizar com chip `prévia` enquanto não houver. |

**Regra:** qualquer métrica que não seja calculável a partir de `batches` e `alerts` no MVP deve ganhar o chip `prévia` (`background: oklch(0.95 0.005 95)`, `border: var(--border)`, `color: var(--muted)`) + tooltip `"Estimativa — relatório completo em breve"`. Não simular dados falsos.

---

1. **`Cmd/Ctrl + Enter` no cadastro submete o form.** Registrar listener global enquanto a tela `/batches/new` estiver montada. `Esc` cancela.
2. **Após `POST /api/batches`, o backend deve retornar o objeto completo do lote.** O front usa o `id` para destacar a linha recém-criada (`row-flash` animation, 2s). Retornar só `{ id }` quebra o destaque.
3. **Filtros são chips com contadores.** O endpoint `GET /api/batches` deve retornar contagens agregadas por status (`X-Counts: critical=4,warning=5,safe=4,expired=2`) — sem isso, o front faz 5 requests para preencher os chips.
4. **Status é derivado, não persistido.** `CRITICAL ≤ alertDaysBefore (capado em 14)`, `WARNING ≤ 30`, `SAFE > 30`, `EXPIRED < 0`. Calcule no backend toda vez que retornar um batch — armazenar status no DB causa inconsistência com o avanço do calendário.
5. **Pulse animado APENAS em `StatusBadge` com `status === 'CRITICAL'`.** Não estender para SAFE ou WARNING — perde o sinal.
6. **`alertDaysBefore` define quando o alerta é enviado E quando o status vira CRITICAL** (o limiar é `min(alertDaysBefore, 14)`). Se o usuário escolher 30 dias de aviso prévio, ele recebe a notificação cedo, mas o badge só vira “crítico” aos 14 dias — preserva a semântica visual.
7. **Telefone no formato E.164** com máscara liberal (`+55 81 99845-2210` aceito). Validar no backend antes de salvar.
8. **Tecla `N` global** abre `/batches/new` de qualquer tela (exceto quando o foco está em input/textarea/select). Tecla `/` foca o campo de busca em `/batches`.
9. **Sidebar fica em ≥1024px. BottomNav em <1024px.** Não exibir ambos simultaneamente.
10. **Sem `localStorage` no protótipo.** Implementar persistência via cookies/sessão no backend.
11. **`TODAY` é variável injetada** — o cálculo de dias usa `Date('2026-05-20')` como hoje no protótipo. Substituir por `new Date()` em produção.
12. **Toast tem duração de 3.2s** com micro-animação de entrada (translateY 8px → 0). Não estender — o toast é informativo, não bloqueante.
13. **Indicadores ≠ controles.** Em listas (`Próximas expirações`, `Lotes` mobile), o status à esquerda da linha é uma **barra vertical fina de 3px** na cor sólida do status — NÃO uma pílula com bolinha. Reservar formas de pílula/toggle exclusivamente para elementos interativos.
14. **Crit badge precisa estar ancorado.** O dot vermelho pulsante do `StatCard` crítico fica em `position: absolute; top: -5px; right: -5px` com `box-shadow` duplo (surface + crit-border) servindo de "anel" de separação. Solto no fluxo do card ele lê como bug.
15. **`<Logo />` com IDs únicos.** Múltiplas instâncias do SVG na mesma página exigem IDs únicos por instância (usar `useId()`). O componente já gera; ao implementar do zero no Next, não esquecer.

---

## 5. Checklist de Implementação (QA visual)

### Visual fidelity
- [ ] `:root` contém **todas** as variáveis OKLCH listadas em §1
- [ ] Font `Inter` (400–700) + `JetBrains Mono` (400–600) carregados via Google Fonts
- [ ] Todos os números (lote, EAN, dias, contadores) usam `font-mono`
- [ ] Classe `.ray` aplicada em: botões primários/secundários, badges, cards, sidebar/topbar
- [ ] `pulse-crit` ativo APENAS em CRITICAL `StatusBadge` e nos dots críticos
- [ ] Cards: `border-radius: 12px`, border `--border`, shadow `--shadow-sm`
- [ ] Botões e inputs: `border-radius: 8px`, transição 150ms ease-out
- [ ] Sidebar: 232px de largura, item ativo com `background: var(--brand-soft)` e `font-weight: 600`

### Comportamento
- [ ] Login → após submit, loading 600ms → redirect para Painel
- [ ] Painel: hero number em escala 58-68px font-mono, delta com seta ↑/↓
- [ ] Painel: 4 `StatCard` (CRITICAL, WARNING, SAFE, EXPIRED) clicáveis → `/batches?filter=…`
- [ ] Lotes: chips de filtro com contadores; chip ativo herda cor do status
- [ ] Lotes: busca por produto/lote/EAN; ordenação por proximidade default
- [ ] Cadastrar lote: autofocus em EAN; Enter avança; Cmd/Ctrl+Enter submete
- [ ] Cadastrar lote: lote recém-criado recebe `row-flash` por 2s
- [ ] Cadastrar lote: preview lateral atualiza em tempo real (status badge + dias)
- [ ] Cadastrar lote: presets 7/15/30/60 + slider 1–90
- [ ] Configurações: toggle de alertas ativos / E.164 validation visual no telefone
- [ ] Configurações: botão “Testar envio” dispara toast `Mensagem de teste enviada ✓`
- [ ] Toast: posicionado centro-inferior, animação `toast-in`, dismiss em 3.2s

### Responsive
- [ ] 375px: stack vertical, BottomNav visível, FAB acima da nav
- [ ] 768px: tabela vira lista de cards no `/batches`
- [ ] 1024px+: Sidebar visível, layout 2 colunas no Login e no Painel
- [ ] 1280px: padding lateral `px-8`, max-width `1280px` nos containers

### Acessibilidade mínima
- [ ] Foco visível em todos os inputs e botões (ring brand 3px)
- [ ] `kbd` legível, contraste AA
- [ ] Contraste do texto sobre `--brand-soft`: AA garantido (`--brand-fg`)
- [ ] Status reflete também no ícone (não só na cor) — `StatusBadge` traz dot + label

---

## Mock Data Inicial

```ts
// src/lib/mock-batches.ts  (apagar após plugar o backend)
export const MOCK_BATCHES = [
  { id: '1',  product: 'Iogurte Grego Natural 170g',  ean: '7891000100103', lot: 'L240815A',  quantity: 24, expirationDate: '2026-05-22', alertDaysBefore: 7  },
  // ... (15 itens cobrindo CRITICAL/WARNING/SAFE/EXPIRED — ver src/data.jsx do protótipo)
];

export const COMPANY = {
  name: 'Mercadinho Santa Cruz',
  managerName: 'Ebervaldo Silva',
  whatsapp: '+55 81 99845-2210',
  email: 'ebervaldo@santacruz.com.br',
  alertsActive: true,
  alertTime: '08:00',
};
```

---

## Encerramento

O protótipo está em `index.html` (entry point) + `src/*.jsx` (componentes/screens).
Use o protótipo como **referência de verdade visual e de interação** — se algo divergir, abra um issue antes de implementar diferente.

---

## Anexo A — SVG da Marca (canônico)

Salvar em `public/logo.svg` e também referenciar como `public/favicon.svg` (mesmo arquivo serve para favicon).

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96" role="img" aria-label="AvisaEstoque">
  <defs>
    <linearGradient id="ae-validade-bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#18A55F"/><stop offset="1" stop-color="#0B6B3E"/>
    </linearGradient>
    <linearGradient id="ae-validade-hl" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity="0.28"/><stop offset="0.5" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <path d="M48,2 C28,2 2,28 2,48 C2,68 28,94 48,94 C68,94 94,68 94,48 C94,28 68,2 48,2 Z" fill="url(#ae-validade-bg)"/>
  <path d="M48,2 C28,2 2,28 2,48 C2,68 28,94 48,94 C68,94 94,68 94,48 C94,28 68,2 48,2 Z" fill="url(#ae-validade-hl)"/>
  <g fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">
    <rect x="26" y="30" width="44" height="40" rx="7"/>
    <path d="M 26 43 L 70 43"/>
    <path d="M 37 24 L 37 33"/><path d="M 59 24 L 59 33"/>
    <path d="M 33 58 L 41 58 L 45 50 L 51 64 L 55 58 L 63 58" stroke-width="5"/>
  </g>
</svg>
```

**Importante:** ao inserir o SVG inline em mais de um lugar na página, gerar IDs únicos por instância (ex: prefixar com um `useId()` do React). IDs colidentes quebram os gradientes na segunda renderização. O componente `<Logo />` do protótipo já faz isso automaticamente.

### Animação do batimento

A linha de batimento (`stroke-width="5"`) recebe animação via `stroke-dasharray` / `stroke-dashoffset` em loop suave (~3s). **Ativar somente no Login** (prop `animated`). Em todas as outras telas a marca fica estática para não competir por atenção. Respeitar `prefers-reduced-motion: reduce`.

```css
.ae-heartbeat {
  stroke-dasharray: 38 38;
  stroke-dashoffset: 38;
  animation: ae-heartbeat 3s cubic-bezier(0.4, 0, 0.2, 1) infinite;
}
@keyframes ae-heartbeat {
  0%   { stroke-dashoffset:  38; opacity: 0.35; }
  18%  { stroke-dashoffset:   0; opacity: 1; }
  40%  { stroke-dashoffset:   0; opacity: 1; }
  55%  { stroke-dashoffset: -38; opacity: 0; }
  100% { stroke-dashoffset: -38; opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .ae-heartbeat { animation: none; stroke-dashoffset: 0; opacity: 1; }
}
```
