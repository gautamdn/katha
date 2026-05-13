import type { Provider } from '../Provider';
import type {
  ProviderCallConfig,
  ProviderCallHandle,
  ProviderCallStatusResult,
  ProviderHealthResult,
} from '../types';

export class MockProvider implements Provider {
  readonly name = 'mock';
  private started: ProviderCallConfig[] = [];
  private ended = new Set<string>();

  async startCall(config: ProviderCallConfig): Promise<ProviderCallHandle> {
    this.started.push(config);
    return {
      provider_call_id: `mock-${config.call_id}`,
      started_at: new Date(),
    };
  }

  async endCall(provider_call_id: string): Promise<void> {
    this.ended.add(provider_call_id);
  }

  async getCallStatus(provider_call_id: string): Promise<ProviderCallStatusResult> {
    return {
      status: this.ended.has(provider_call_id) ? 'completed' : 'in_progress',
    };
  }

  async healthCheck(): Promise<ProviderHealthResult> {
    return { ok: true };
  }

  getStartedCalls(): ProviderCallConfig[] {
    return [...this.started];
  }

  getEndedCalls(): string[] {
    return [...this.ended];
  }
}
