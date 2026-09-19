import path from 'node:path';
import { DomainError } from '@/lib/domain/errors';

export const LOCAL_OWNER = '11111111-1111-4111-8111-111111111111';
export function configuration() {
  const dataBackend = process.env.DATA_BACKEND ?? 'local';
  const aiMode = process.env.AI_MODE ?? 'fixture';
  if (!['local', 'supabase'].includes(dataBackend) || !['fixture', 'live'].includes(aiMode)) throw new DomainError('CONFIGURATION', 503, 'Check DATA_BACKEND and AI_MODE.');
  if (dataBackend === 'local' && (process.env.VERCEL || process.env.APP_DEPLOYMENT === 'hosted')) throw new DomainError('LOCAL_HOSTING', 503, 'Hosted operation requires Supabase authentication and storage.');
  return {
    dataBackend: dataBackend as 'local' | 'supabase', aiMode: aiMode as 'fixture' | 'live',
    localDir: path.resolve(/* turbopackIgnore: true */ process.env.LOCAL_DATA_DIR ?? '.local/classcompass'),
    visionModel: process.env.OPENROUTER_VISION_MODEL ?? 'google/gemma-4-26b-a4b-it:free',
    reasoningModel: process.env.OPENROUTER_REASONING_MODEL ?? 'deepseek/deepseek-v4-flash-0731:free',
    providerTimeout: Math.min(75000, Math.max(1000, Number(process.env.AI_CALL_TIMEOUT_MS) || 75000)),
    maxAttempts: Math.min(3, Math.max(1, Number(process.env.AI_MAX_ATTEMPTS) || 3)),
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '',
  };
}
