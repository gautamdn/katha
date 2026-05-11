import type {
  ProviderCallConfig,
  ProviderCallHandle,
  ProviderCallStatusResult,
  ProviderHealthResult,
} from './types';

export interface Provider {
  readonly name: string;
  startCall(config: ProviderCallConfig): Promise<ProviderCallHandle>;
  endCall(provider_call_id: string): Promise<void>;
  getCallStatus(provider_call_id: string): Promise<ProviderCallStatusResult>;
  healthCheck(): Promise<ProviderHealthResult>;
}
