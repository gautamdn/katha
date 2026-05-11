import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { CORS_HEADERS, handleCorsPreflight } from '../_shared/cors.ts';
import {
  handleStart,
  handleWebhookCallStart,
  handleWebhookTurn,
  handleWebhookCallEnd,
} from './handlers.ts';

Deno.serve(async (req) => {
  const cors = handleCorsPreflight(req);
  if (cors) return cors;

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/call-orchestrator/, '');

  try {
    if (req.method === 'POST' && path === '/start') {
      return await handleStart(req);
    }
    if (req.method === 'POST' && path === '/webhook') {
      const body = await req.json();
      switch (body.event) {
        case 'call_started': return await handleWebhookCallStart(body);
        case 'turn':         return await handleWebhookTurn(body);
        case 'call_ended':   return await handleWebhookCallEnd(body);
        default:
          return new Response(`Unknown event: ${body.event}`, {
            status: 400, headers: CORS_HEADERS,
          });
      }
    }
    return new Response('Not found', { status: 404, headers: CORS_HEADERS });
  } catch (e) {
    return new Response(`Error: ${(e as Error).message}`, {
      status: 500, headers: CORS_HEADERS,
    });
  }
});
