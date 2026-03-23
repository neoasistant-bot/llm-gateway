import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LLMService } from './llm.service';
import { OpenAIProvider } from './providers/openai.provider';
import { AnthropicProvider } from './providers/anthropic.provider';
import { GoogleProvider } from './providers/google.provider';

@Module({
  imports: [ConfigModule],
  providers: [OpenAIProvider, AnthropicProvider, GoogleProvider, LLMService],
  exports: [LLMService],
})
export class LLMModule {}
