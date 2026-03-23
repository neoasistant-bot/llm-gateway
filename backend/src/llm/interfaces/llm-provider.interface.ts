export interface LLMResponse {
  content: string;
  tokensInput: number;
  tokensOutput: number;
  model: string;
  provider: string;
  rawResponse?: any;
}

export interface LLMConfig {
  temperature?: number;
  maxTokens?: number;
  [key: string]: any;
}

export interface LLMProvider {
  readonly providerName: string;
  generate(prompt: string, model: string, config?: LLMConfig): Promise<LLMResponse>;
}
