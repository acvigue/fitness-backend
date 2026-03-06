import { z } from 'zod';

export const searchMessagesSchema = z.object({
  q: z.string().min(1).max(200),
  limit: z
    .string()
    .optional()
    .default('20')
    .transform(Number)
    .pipe(z.number().int().min(1).max(50)),
  per_page: z
    .string()
    .optional()
    .default('50')
    .transform(Number)
    .pipe(z.number().int().min(1).max(100)),
});

export type SearchMessagesParams = z.infer<typeof searchMessagesSchema>;
