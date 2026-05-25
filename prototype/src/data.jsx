// === MOCK DATA ===
// Today is fixed for deterministic status rendering.
// (Spec date is May 20, 2026 — use that as "today".)
const TODAY = new Date('2026-05-20T09:00:00');

const ddays = (date) => {
  const d = new Date(date + 'T00:00:00');
  const diff = Math.round((d - TODAY) / (1000 * 60 * 60 * 24));
  return diff;
};

const statusOf = (date, alertDaysBefore = 7) => {
  const diff = ddays(date);
  if (diff < 0) return 'EXPIRED';
  if (diff <= Math.max(7, Math.min(alertDaysBefore, 14))) return 'CRITICAL';
  if (diff <= 30) return 'WARNING';
  return 'SAFE';
};

const fmtDate = (date) => {
  const d = new Date(date + 'T00:00:00');
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '');
};
const fmtDateShort = (date) => {
  const d = new Date(date + 'T00:00:00');
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
};

const dayLabel = (n) => {
  if (n < 0) return `${Math.abs(n)} d. vencido`;
  if (n === 0) return 'vence hoje';
  if (n === 1) return 'em 1 dia';
  return `em ${n} dias`;
};

const MOCK_BATCHES = [
  { id: '1',  product: 'Iogurte Grego Natural 170g',          ean: '7891000100103', lot: 'L240815A',  quantity: 24, expirationDate: '2026-05-22', alertDaysBefore: 7  },
  { id: '2',  product: 'Leite Integral UHT 1L',                ean: '7891000244401', lot: 'LT-26-A12', quantity: 48, expirationDate: '2026-05-24', alertDaysBefore: 7  },
  { id: '3',  product: 'Pão de Forma Integral 500g',           ean: '7896005800013', lot: 'PF240910',  quantity: 12, expirationDate: '2026-05-21', alertDaysBefore: 7  },
  { id: '4',  product: 'Requeijão Cremoso 200g',               ean: '7891025108405', lot: 'RQ-26-04',  quantity: 18, expirationDate: '2026-05-27', alertDaysBefore: 7  },
  { id: '5',  product: 'Perfume Eau de Toilette 50ml',         ean: '7896512345678', lot: 'PF-2024-44',quantity: 8,  expirationDate: '2026-06-15', alertDaysBefore: 30 },
  { id: '6',  product: 'Shampoo Hidratante 350ml',             ean: '7894900011517', lot: 'SH-44-260', quantity: 22, expirationDate: '2026-06-08', alertDaysBefore: 30 },
  { id: '7',  product: 'Protetor Solar FPS 50 120ml',          ean: '7891317200502', lot: 'PS-26-V2',  quantity: 14, expirationDate: '2026-06-30', alertDaysBefore: 30 },
  { id: '8',  product: 'Dipirona 500mg c/ 20 cp',              ean: '7891058016302', lot: 'DI-A2604',  quantity: 36, expirationDate: '2026-09-12', alertDaysBefore: 60 },
  { id: '9',  product: 'Vitamina C 1g c/ 10 cp efervescente',  ean: '7896004700212', lot: 'VC-2026-09',quantity: 20, expirationDate: '2026-11-04', alertDaysBefore: 60 },
  { id: '10', product: 'Creme Dental Branqueador 90g',         ean: '7891024113288', lot: 'CD-44-22',  quantity: 30, expirationDate: '2027-02-18', alertDaysBefore: 30 },
  { id: '11', product: 'Manteiga Sem Sal 200g',                ean: '7896002400107', lot: 'MT-26-117', quantity: 9,  expirationDate: '2026-05-19', alertDaysBefore: 7  },
  { id: '12', product: 'Queijo Mussarela Fatiado 150g',        ean: '7896000223456', lot: 'QM-25-09',  quantity: 4,  expirationDate: '2026-05-15', alertDaysBefore: 7  },
  { id: '13', product: 'Achocolatado em Pó 400g',              ean: '7891024000017', lot: 'AC-26-11',  quantity: 26, expirationDate: '2026-12-22', alertDaysBefore: 60 },
  { id: '14', product: 'Sabonete em Barra 90g (pack 6)',       ean: '7891150030909', lot: 'SB-44-08',  quantity: 40, expirationDate: '2027-05-10', alertDaysBefore: 30 },
  { id: '15', product: 'Desodorante Aerossol 150ml',           ean: '7891150036116', lot: 'DA-26-32',  quantity: 16, expirationDate: '2026-06-22', alertDaysBefore: 30 },
];

const COMPANY = {
  name: 'Mercadinho Santa Cruz',
  managerName: 'Ebervaldo Silva',
  whatsapp: '+55 81 99845-2210',
  email: 'ebervaldo@santacruz.com.br',
  alertsActive: true,
  alertTime: '08:00',
};

window.MOCK_BATCHES = MOCK_BATCHES;
window.COMPANY = COMPANY;
window.TODAY = TODAY;
window.ddays = ddays;
window.statusOf = statusOf;
window.fmtDate = fmtDate;
window.fmtDateShort = fmtDateShort;
window.dayLabel = dayLabel;
