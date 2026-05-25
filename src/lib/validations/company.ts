import { z } from 'zod';
import { phoneSchema } from './auth';

export const updateCompanySchema = z
  .object({
    name: z.string().min(2, 'Nome muito curto.').max(80, 'Nome muito longo.').trim().optional(),
    whatsappPhone: phoneSchema.optional(),
    alertEnabled: z.boolean().optional(),
    alertTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Horário inválido (HH:mm, 24h).')
      .optional(),
  })
  .refine(
    (d) =>
      d.name !== undefined ||
      d.whatsappPhone !== undefined ||
      d.alertEnabled !== undefined ||
      d.alertTime !== undefined,
    { message: 'Informe ao menos um campo.' },
  );

export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;
