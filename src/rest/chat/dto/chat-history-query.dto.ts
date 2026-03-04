import { z } from 'zod';

export const chatPaginationSchema = z.object({
  page: z.string().optional().default('1').transform(Number).pipe(z.number().int().min(1)),
  per_page: z
    .string()
    .optional()
    .default('50')
    .transform(Number)
    .pipe(z.number().int().min(1).max(100)),
});

export type ChatPaginationParams = z.infer<typeof chatPaginationSchema>;
