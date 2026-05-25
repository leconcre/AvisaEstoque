import { z } from 'zod';

export const askAssistantSchema = z.object({
  message: z
    .string()
    .min(1, 'Mensagem vazia.')
    .max(500, 'Mensagem muito longa (máx 500 caracteres).')
    .trim(),
});

export type AskAssistantInput = z.infer<typeof askAssistantSchema>;
