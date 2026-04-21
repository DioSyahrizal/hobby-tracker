import { z } from 'zod';

export const moodTagSchema = z.object({
  id: z.number().int(),
  name: z.string().min(1).max(50),
});
export type MoodTag = z.infer<typeof moodTagSchema>;

export const moodTagsResponseSchema = z.object({
  tags: z.array(moodTagSchema),
});
export type MoodTagsResponse = z.infer<typeof moodTagsResponseSchema>;

export const createMoodTagSchema = z.object({
  name: z.string().min(1).max(50).trim(),
});
export type CreateMoodTag = z.infer<typeof createMoodTagSchema>;
