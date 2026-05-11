import { describe, it, expect } from 'vitest';
import type { Provider } from '../src/Provider';
import type { ProviderInitResult, ProviderCallHandle } from '../src/types';

// Type-level test — verify Provider interface shape exists.
// Real provider tests are in providers/*.test.ts.
describe('Provider interface', () => {
  it('declares startCall, endCall, getCallStatus, healthCheck', () => {
    const stub: Provider = {
      name: 'stub',
      startCall: async (): Promise<ProviderCallHandle> => ({
        provider_call_id: 'x',
        started_at: new Date(),
      }),
      endCall: async () => {},
      getCallStatus: async () => ({ status: 'completed' }),
      healthCheck: async () => ({ ok: true }),
    };
    expect(stub.name).toBe('stub');
  });
});
