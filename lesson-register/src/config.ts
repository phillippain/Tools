export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL ?? '').trim();
export const SUPABASE_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '').trim();

/** Demo mode: the preview build, or any build without a database configured. */
export const DEMO = __PREVIEW__ || !SUPABASE_URL || !SUPABASE_KEY;
