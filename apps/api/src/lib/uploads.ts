import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * Absolute path to the `uploads/` directory at the monorepo root.
 * Computed from this file's location so it's correct for both
 * `tsx` dev (source path) and compiled `dist/` output.
 *
 * apps/api/src/lib/uploads.ts
 *   ↑ lib/ → src/ → api/ → apps/ → project root
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOADS_DIR = path.resolve(__dirname, '..', '..', '..', '..', 'uploads');

/** URL prefix used in cover_url values for locally-stored images. */
export const UPLOADS_URL_PREFIX = '/uploads/';
