import { Injectable, BadRequestException } from '@nestjs/common';
import { LLMProvider, LLMResponse, LLMConfig } from './interfaces/llm-provider.interface';
import { OpenAIProvider } from './providers/openai.provider';
import { AnthropicProvider } from './providers/anthropic.provider';
import { GoogleProvider } from './providers/google.provider';

@Injectable()
export class LLMService {
  private providers: Map<string, LLMProvider>;

  constructor(
    private openaiProvider: OpenAIProvider,
    private anthropicProvider: AnthropicProvider,
    private googleProvider: GoogleProvider,
  ) {
    this.providers = new Map<string, LLMProvider>([
      ['OPENAI', openaiProvider],
      ['ANTHROPIC', anthropicProvider],
      ['GOOGLE', googleProvider],
    ]);
  }

  async generate(
    provider: string,
    prompt: string,
    model: string,
    config?: LLMConfig,
  ): Promise<LLMResponse> {
    const llmProvider = this.providers.get(provider.toUpperCase());

    if (!llmProvider) {
      throw new BadRequestException(
        `Unsupported LLM provider: ${provider}. Supported providers: ${this.getSupportedProviders().join(', ')}`,
      );
    }

    return llmProvider.generate(prompt, model, config);
  }

  getSupportedProviders(): string[] {
    return Array.from(this.providers.keys());
  }
}
