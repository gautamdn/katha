/**
 * Debug logger — gated behind __DEV__.
 *
 * All logging is silenced in production builds automatically.
 * In dev, provides namespaced, structured logging for every subsystem.
 *
 * Usage:
 *   import { debug } from '@/lib/debug';
 *   debug.log('api.signUp', 'attempting signup for:', email);
 *   debug.warn('publish', 'polish failed, using raw text');
 *   debug.error('api.polishText', 'edge function error:', err);
 */

function log(tag: string, ...args: any[]) {
  if (__DEV__) console.log(`[${tag}]`, ...args);
}

function warn(tag: string, ...args: any[]) {
  if (__DEV__) console.warn(`[${tag}]`, ...args);
}

function error(tag: string, ...args: any[]) {
  if (__DEV__) console.error(`[${tag}]`, ...args);
}

/** Extract detailed info from Supabase FunctionsHttpError (response body isn't in JSON.stringify). */
async function edgeFunctionError(tag: string, err: any): Promise<void> {
  if (!__DEV__) return;

  console.error(`[${tag}] FAILED:`, err.message);
  console.error(`[${tag}] error name:`, err.name);

  if (err.context && typeof err.context.json === 'function') {
    try {
      const body = await err.context.json();
      console.error(`[${tag}] response body:`, JSON.stringify(body));
    } catch {
      try {
        const text = await err.context.text();
        console.error(`[${tag}] response text:`, text);
      } catch {
        console.error(`[${tag}] could not read response body`);
      }
    }
  }

  if (err.context?.status) {
    console.error(`[${tag}] HTTP status:`, err.context.status);
  }
}

export const debug = { log, warn, error, edgeFunctionError };
