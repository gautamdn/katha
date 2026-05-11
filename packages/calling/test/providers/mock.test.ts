import { describe, it, expect } from 'vitest';
import { MockProvider } from '../../src/providers/mock';
import type { ProviderCallConfig } from '../../src/types';

const baseConfig: ProviderCallConfig = {
  call_id: 'call-1',
  elder_phone_e164: '+919999999999',
  elder_name: 'Susheela',
  language: 'kn',
  country: 'IN',
  is_first_call: true,
  system_prompt: 'You are Susheela...',
  webhook_url: 'https://example.com/hook',
};

describe('MockProvider', () => {
  it('returns a handle with deterministic provider_call_id', async () => {
    const p = new MockProvider();
    const handle = await p.startCall(baseConfig);
    expect(handle.provider_call_id).toBe('mock-call-1');
    expect(handle.started_at).toBeInstanceOf(Date);
  });

  it('records calls in memory', async () => {
    const p = new MockProvider();
    await p.startCall(baseConfig);
    expect(p.getStartedCalls()).toHaveLength(1);
    expect(p.getStartedCalls()[0].call_id).toBe('call-1');
  });

  it('endCall marks the call ended', async () => {
    const p = new MockProvider();
    await p.startCall(baseConfig);
    await p.endCall('mock-call-1');
    expect(p.getEndedCalls()).toContain('mock-call-1');
  });

  it('healthCheck returns ok', async () => {
    const p = new MockProvider();
    expect(await p.healthCheck()).toEqual({ ok: true });
  });
});
