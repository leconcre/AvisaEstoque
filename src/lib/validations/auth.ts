import { z } from 'zod';

// E.164: + seguido de 8 a 15 dígitos. Aceita máscaras na entrada (espaços, hífens,
// parênteses) e normaliza no transform. Resultado armazenado é apenas +ddd...
const e164Regex = /^\+[1-9]\d{7,14}$/;

export const phoneSchema = z
  .string()
  .min(1, 'Informe o número de WhatsApp.')
  .transform((s) => s.replace(/[\s\-().]/g, ''))
  .refine((s) => e164Regex.test(s), {
    message: 'Telefone inválido. Use formato internacional, ex: +5511987654321.',
  });

export const loginSchema = z.object({
  email: z.string().email('E-mail inválido.').toLowerCase().trim(),
  password: z.string().min(1, 'Informe a senha.'),
});

export const registerSchema = z.object({
  companyName: z
    .string()
    .min(2, 'Nome da empresa muito curto.')
    .max(80, 'Nome da empresa muito longo.')
    .trim(),
  whatsappPhone: phoneSchema,
  alertTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Horário inválido (use HH:mm, 24h).')
    .optional()
    .default('08:00'),
  name: z.string().min(2, 'Nome muito curto.').max(80, 'Nome muito longo.').trim(),
  email: z.string().email('E-mail inválido.').toLowerCase().trim(),
  password: z
    .string()
    .min(8, 'A senha precisa de pelo menos 8 caracteres.')
    .max(72, 'Senha muito longa (máx 72 caracteres — limite do bcrypt).'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
