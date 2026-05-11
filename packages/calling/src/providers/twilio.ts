import type { Provider } from '../Provider';
import type {
  ProviderCallConfig,
  ProviderCallHandle,
  ProviderCallStatusResult,
  ProviderHealthResult,
} from '../types';

export class TwilioProvider implements Provider {
  readonly name = 'twilio';

  startCall(_: ProviderCallConfig): Promise<ProviderCallHandle> {
    throw new Error('TwilioProvider not implemented — Phase 2');
  }

  endCall(_: string): Promise<void> {
    throw new Error('TwilioProvider not implemented — Phase 2');
  }

  getCallStatus(_: string): Promise<ProviderCallStatusResult> {
    throw new Error('TwilioProvider not implemented — Phase 2');
  }

  async healthCheck(): Promise<ProviderHealthResult> {
    return { ok: false, detail: 'not implemented' };
  }
}
