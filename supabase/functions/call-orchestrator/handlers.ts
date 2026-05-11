import { CORS_HEADERS } from '../_shared/cors.ts';
import { getAdminClient } from '../_shared/supabase-admin.ts';
import type { CallBrief, ProviderTurnEvent, ProviderCallEndEvent } from '../_shared/types.ts';

interface StartRequest {
  call_id: string;
  brief: CallBrief;
  system_prompt: string;
}

export async function handleStart(req: Request): Promise<Response> {
  const body = (await req.json()) as StartRequest;
  // Implemented in Task 6.2
  throw new Error('handleStart: not yet implemented (Task 6.2)');
}

export async function handleWebhookCallStart(body: { provider_call_id: string; metadata?: { call_id?: string } }): Promise<Response> {
  // Implemented in Task 6.3
  throw new Error('handleWebhookCallStart: not yet implemented (Task 6.3)');
}

export async function handleWebhookTurn(body: ProviderTurnEvent & { event: 'turn' }): Promise<Response> {
  // Implemented in Task 6.4
  throw new Error('handleWebhookTurn: not yet implemented (Task 6.4)');
}

export async function handleWebhookCallEnd(body: ProviderCallEndEvent & { event: 'call_ended' }): Promise<Response> {
  // Implemented in Task 6.5
  throw new Error('handleWebhookCallEnd: not yet implemented (Task 6.5)');
}
