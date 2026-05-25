import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

// Importa o ÚNICO "hoje SP" do projeto — mesma fonte que o getBatchStatus usa.
// Se o seed plantar um EXPIRED em -1d e o status calcular contra outro "hoje",
// a UI mentiria. Por isso o helper é compartilhado.
import { todayCivilSP } from '../src/lib/utils/today';

const prisma = new PrismaClient();

function daysFromToday(days: number): Date {
  const d = todayCivilSP();
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

// Distribuição replicada do protótipo (prototype/src/data.jsx) com TODAY=2026-05-20.
// Os offsets em dias preservam a mesma classificação:
//   - 4 × CRITICAL  (diff ∈ [0, max(7, min(alertDaysBefore, 14))])
//   - 2 × WARNING   (diff ∈ (limiar, 30])
//   - 7 × SAFE      (diff > 30)
//   - 2 × EXPIRED   (diff < 0)
// Quando o seed rodar em data ≠ 2026-05-20, a distribuição se mantém.
type Fixture = {
  product: string;
  ean: string;
  lot: string;
  quantity: number;
  daysOffset: number;
  alertDaysBefore: number;
  expectedStatus: 'EXPIRED' | 'CRITICAL' | 'WARNING' | 'SAFE';
};

const FIXTURES: Fixture[] = [
  // --- CRITICAL × 4 ---
  { product: 'Iogurte Grego Natural 170g',        ean: '7891000100103', lot: 'L240815A',   quantity: 24, daysOffset: 2,  alertDaysBefore: 7,  expectedStatus: 'CRITICAL' },
  { product: 'Leite Integral UHT 1L',             ean: '7891000244401', lot: 'LT-26-A12',  quantity: 48, daysOffset: 4,  alertDaysBefore: 7,  expectedStatus: 'CRITICAL' },
  { product: 'Pão de Forma Integral 500g',        ean: '7896005800013', lot: 'PF240910',   quantity: 12, daysOffset: 1,  alertDaysBefore: 7,  expectedStatus: 'CRITICAL' },
  { product: 'Requeijão Cremoso 200g',            ean: '7891025108405', lot: 'RQ-26-04',   quantity: 18, daysOffset: 7,  alertDaysBefore: 7,  expectedStatus: 'CRITICAL' },

  // --- WARNING × 2 ---
  // alertDaysBefore=30 → limiar CRITICAL=14, daysOffset acima de 14 e ≤30 = WARNING
  { product: 'Perfume Eau de Toilette 50ml',      ean: '7896512345678', lot: 'PF-2024-44', quantity: 8,  daysOffset: 26, alertDaysBefore: 30, expectedStatus: 'WARNING' },
  { product: 'Shampoo Hidratante 350ml',          ean: '7894900011517', lot: 'SH-44-260',  quantity: 22, daysOffset: 19, alertDaysBefore: 30, expectedStatus: 'WARNING' },

  // --- SAFE × 7 ---
  { product: 'Protetor Solar FPS 50 120ml',       ean: '7891317200502', lot: 'PS-26-V2',   quantity: 14, daysOffset: 41,  alertDaysBefore: 30, expectedStatus: 'SAFE' },
  { product: 'Dipirona 500mg c/ 20 cp',           ean: '7891058016302', lot: 'DI-A2604',   quantity: 36, daysOffset: 115, alertDaysBefore: 60, expectedStatus: 'SAFE' },
  { product: 'Vitamina C 1g c/ 10 cp eferv.',     ean: '7896004700212', lot: 'VC-2026-09', quantity: 20, daysOffset: 168, alertDaysBefore: 60, expectedStatus: 'SAFE' },
  { product: 'Creme Dental Branqueador 90g',      ean: '7891024113288', lot: 'CD-44-22',   quantity: 30, daysOffset: 275, alertDaysBefore: 30, expectedStatus: 'SAFE' },
  { product: 'Achocolatado em Pó 400g',           ean: '7891024000017', lot: 'AC-26-11',   quantity: 26, daysOffset: 216, alertDaysBefore: 60, expectedStatus: 'SAFE' },
  { product: 'Sabonete em Barra 90g (pack 6)',    ean: '7891150030909', lot: 'SB-44-08',   quantity: 40, daysOffset: 720, alertDaysBefore: 30, expectedStatus: 'SAFE' },
  { product: 'Desodorante Aerossol 150ml',        ean: '7891150036116', lot: 'DA-26-32',   quantity: 16, daysOffset: 33,  alertDaysBefore: 30, expectedStatus: 'SAFE' },

  // --- EXPIRED × 2 ---
  { product: 'Manteiga Sem Sal 200g',             ean: '7896002400107', lot: 'MT-26-117',  quantity: 9,  daysOffset: -1, alertDaysBefore: 7,  expectedStatus: 'EXPIRED' },
  { product: 'Queijo Mussarela Fatiado 150g',     ean: '7896000223456', lot: 'QM-25-09',   quantity: 4,  daysOffset: -5, alertDaysBefore: 7,  expectedStatus: 'EXPIRED' },
];

// Empresa B (enxuta): existe apenas para validar isolamento entre tenants.
// 3 lotes em status variados — suficiente para verificar que logado como A
// não vemos B (e vice-versa) em GET/PATCH/DELETE por ID manipulado.
const FIXTURES_B: Fixture[] = [
  { product: 'Sabonete Líquido 250ml',     ean: '7891150090001', lot: 'SL-B-01', quantity: 10, daysOffset: 3,   alertDaysBefore: 7,  expectedStatus: 'CRITICAL' },
  { product: 'Refrigerante Cola 2L',       ean: '7894900700022', lot: 'RC-B-02', quantity: 30, daysOffset: 22,  alertDaysBefore: 30, expectedStatus: 'WARNING' },
  { product: 'Arroz Tipo 1 - 5kg',         ean: '7896273900015', lot: 'AR-B-03', quantity: 50, daysOffset: 120, alertDaysBefore: 30, expectedStatus: 'SAFE' },
];

async function seedCompany(opts: {
  name: string;
  whatsappPhone: string;
  alertTime: string;
  plan?: 'BASIC' | 'PRO';
  user: { email: string; name: string; password: string };
  fixtures: Fixture[];
}) {
  const company = await prisma.company.create({
    data: {
      name: opts.name,
      whatsappPhone: opts.whatsappPhone,
      alertEnabled: true,
      alertTime: opts.alertTime,
      plan: opts.plan ?? 'BASIC',
    },
  });

  const passwordHash = await bcrypt.hash(opts.user.password, 12);
  await prisma.user.create({
    data: {
      email: opts.user.email,
      name: opts.user.name,
      passwordHash,
      companyId: company.id,
    },
  });

  const tally: Record<string, number> = { CRITICAL: 0, WARNING: 0, SAFE: 0, EXPIRED: 0 };
  for (const f of opts.fixtures) {
    const product = await prisma.product.create({
      data: { companyId: company.id, name: f.product, ean: f.ean },
    });
    await prisma.batch.create({
      data: {
        companyId: company.id,
        productId: product.id,
        lotNumber: f.lot,
        quantity: f.quantity,
        expirationDate: daysFromToday(f.daysOffset),
        alertDaysBefore: f.alertDaysBefore,
      },
    });
    tally[f.expectedStatus] = (tally[f.expectedStatus] ?? 0) + 1;
  }

  return { company, tally };
}

async function main() {
  console.log('[seed] limpando tabelas...');
  await prisma.dailySnapshot.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.batch.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();
  await prisma.company.deleteMany();

  // --- Empresa A: cenário cheio do protótipo. PRO pra testar canal premium. ---
  console.log('[seed] Empresa A: "Mercadinho Santa Cruz" (PRO, 15 lotes)...');
  const a = await seedCompany({
    name: 'Mercadinho Santa Cruz',
    whatsappPhone: '+5581998452210',
    alertTime: '08:00',
    plan: 'PRO',
    user: {
      email: 'ebervaldo@santacruz.com.br',
      name: 'Ebervaldo Silva',
      password: 'avisa123',
    },
    fixtures: FIXTURES,
  });
  console.log('  distribuição:', a.tally);

  // --- Empresa B: BASIC — só in-app. Valida fluxo do plano padrão. ---
  console.log('[seed] Empresa B: "Drogaria Beta" (BASIC, 3 lotes — só pra teste de isolamento)...');
  const b = await seedCompany({
    name: 'Drogaria Beta',
    whatsappPhone: '+5511987654321',
    alertTime: '09:00',
    plan: 'BASIC',
    user: {
      email: 'admin@drogariabeta.com.br',
      name: 'Marina Beta',
      password: 'avisa123',
    },
    fixtures: FIXTURES_B,
  });
  console.log('  distribuição:', b.tally);

  console.log('\n[seed] OK.');
  console.log('  Login Empresa A: ebervaldo@santacruz.com.br / avisa123');
  console.log('  Login Empresa B: admin@drogariabeta.com.br  / avisa123');
  console.log('\n  Teste de isolamento na Fase 2: logado como A, GET /api/batches/<id-de-B>');
  console.log('  deve responder 404 (não 200 com os dados, não 403 vazando existência).');
}

main()
  .catch((err) => {
    console.error('[seed] erro:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
