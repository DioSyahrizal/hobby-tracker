import { z } from 'zod';

export const themeSchema = z.enum(['light', 'dark', 'system']);
export type Theme = z.infer<typeof themeSchema>;

export const settingsSchema = z.object({
  id: z.literal(1),
  activeLimitGame: z.number().int().min(0).max(100),
  activeLimitAnime: z.number().int().min(0).max(100),
  activeLimitBook: z.number().int().min(0).max(100),
  activeLimitGunpla: z.number().int().min(0).max(100),
  theme: themeSchema,
  updatedAt: z.iso.datetime(),
});
export type Settings = z.infer<typeof settingsSchema>;

export const settingsUpdateSchema = z
  .object({
    activeLimitGame: z.number().int().min(0).max(100),
    activeLimitAnime: z.number().int().min(0).max(100),
    activeLimitBook: z.number().int().min(0).max(100),
    activeLimitGunpla: z.number().int().min(0).max(100),
    theme: themeSchema,
  })
  .partial();
export type SettingsUpdate = z.infer<typeof settingsUpdateSchema>;
