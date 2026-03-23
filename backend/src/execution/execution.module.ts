import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { PrismaModule } from '../prisma/prisma.module';
import { LLMModule } from '../llm/llm.module';
import { AuditModule } from '../audit/audit.module';
import { ExecutionService } from './execution.service';
import { ExecutionController } from './execution.controller';
import { ExecutionProcessor } from './execution.processor';
import { PromptBuilderService } from './prompt-builder.service';

@Module({
  imports: [
    PrismaModule,
    LLMModule,
    AuditModule,
    BullModule.registerQueue({ name: 'execution' }),
  ],
  providers: [ExecutionService, PromptBuilderService, ExecutionProcessor],
  controllers: [ExecutionController],
  exports: [ExecutionService],
})
export class ExecutionModule {}
