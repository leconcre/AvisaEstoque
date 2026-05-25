import { z } from 'zod';

// Aceita string ISO ou Date e retorna Date à meia-noite UTC.
// O frontend manda 'YYYY-MM-DD' (formato do <input type="date">).
const expirationDateSchema = z
  .union([z.string(), z.date()])
  .transform((v, ctx) => {
    const raw = typeof v === 'string' ? v : v.toISOString().slice(0, 10);
    // Espera YYYY-MM-DD; aceita YYYY-MM-DDTHH:mm:ss... e tronca.
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
    if (!m) {
      ctx.addIssue({ code: 'custom', message: 'Data inválida (use formato AAAA-MM-DD).' });
      return z.NEVER;
    }
    const [, yyyy, mm, dd] = m;
    const d = new Date(`${yyyy}-${mm}-${dd}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: 'custom', message: 'Data inválida.' });
      return z.NEVER;
    }
    return d;
  });

// EAN: 8 ou 13 dígitos. Opcional (nem todo produto tem código de barras).
const eanSchema = z
  .string()
  .trim()
  .regex(/^\d{8}$|^\d{13}$/, 'EAN deve ter 8 ou 13 dígitos.')
  .optional()
  .or(z.literal('').transform(() => undefined));

// Cadastro de lote — o flow do protótipo: usuário digita EAN, sistema busca
// produto; se não existe, ele preenche o nome e a gente cria o produto na hora.
// Por isso aceitamos AMBOS productId (se já existe) E productName+ean (cria novo).
export const createBatchSchema = z
  .object({
    productId: z.string().cuid().optional(),
    productName: z.string().min(1).max(120).trim().optional(),
    ean: eanSchema,
    lotNumber: z.string().min(1, 'Informe o número do lote.').max(40).trim(),
    quantity: z
      .number({ invalid_type_error: 'Quantidade deve ser um número.' })
      .int('Quantidade deve ser inteira.')
      .min(0, 'Quantidade não pode ser negativa.')
      .max(1_000_000, 'Quantidade muito alta.'),
    // Passado é aceito — registrar lote vencido (pra histórico ou baixa) é caso real.
    expirationDate: expirationDateSchema,
    alertDaysBefore: z
      .number({ invalid_type_error: 'Dias para alerta deve ser número.' })
      .int()
      .min(1, 'Mínimo 1 dia.')
      .max(90, 'Máximo 90 dias.')
      .default(30),
  })
  .refine((d) => d.productId || d.productName, {
    path: ['productName'],
    message: 'Informe o nome do produto ou selecione um existente.',
  });

export type CreateBatchInput = z.infer<typeof createBatchSchema>;

export const updateBatchSchema = z
  .object({
    quantity: z.number().int().min(0).max(1_000_000).optional(),
    expirationDate: expirationDateSchema.optional(),
    alertDaysBefore: z.number().int().min(1).max(90).optional(),
    lotNumber: z.string().min(1).max(40).trim().optional(),
  })
  .refine(
    (d) =>
      d.quantity !== undefined ||
      d.expirationDate !== undefined ||
      d.alertDaysBefore !== undefined ||
      d.lotNumber !== undefined,
    { message: 'Informe ao menos um campo para atualizar.' },
  );

export type UpdateBatchInput = z.infer<typeof updateBatchSchema>;

// Filtros da listagem (vêm na querystring).
export const listBatchesQuerySchema = z.object({
  status: z.enum(['all', 'CRITICAL', 'WARNING', 'SAFE', 'EXPIRED']).default('all'),
  search: z.string().trim().max(80).optional(),
  sort: z.enum(['expiration', 'created', 'product']).default('expiration'),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});
export type ListBatchesQuery = z.infer<typeof listBatchesQuerySchema>;

export const productsByEanQuerySchema = z.object({
  ean: z
    .string()
    .trim()
    .regex(/^\d{8}$|^\d{13}$/, 'EAN deve ter 8 ou 13 dígitos.'),
});
