import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { PrismaService } from '../prisma/prisma.service';
import { LLMService } from '../llm/llm.service';
import { AuditService } from '../audit/audit.service';
import { PromptBuilderService } from './prompt-builder.service';
import { ExecutionStatus, AuditAction } from '../generated/prisma/client';

@Processor('execution')
export class ExecutionProcessor {
  constructor(
    private prisma: PrismaService,
    private llmService: LLMService,
    private promptBuilder: PromptBuilderService,
    private auditService: AuditService,
  ) {}

  @Process('execute-method')
  async handleExecution(job: Job) {
    const { executionId, userId, methodId, input } = job.data;

    // Update status to PROCESSING
    await this.prisma.methodExecution.update({
      where: { id: executionId },
      data: { status: ExecutionStatus.PROCESSING },
    });

    const startTime = Date.now();

    try {
      // Fetch method
      const method = await this.prisma.method.findUnique({
        where: { id: methodId },
      });

      if (!method) {
        throw new Error(`Method with id ${methodId} not found`);
      }

      // Get user's schema override
      const userMethod = await this.prisma.userMethod.findUnique({
        where: { userId_methodId: { userId, methodId } },
      });

      const outputSchema = userMethod?.outputSchemaOverride as
        | Record<string, any>
        | undefined;

      // Build prompt
      const prompt = this.promptBuilder.buildPrompt({
        promptTemplate: method.promptTemplate,
        input,
        inputType: method.inputType,
        outputSchema: outputSchema || null,
      });

      // Call LLM
      const response = await this.llmService.generate(
        method.provider,
        prompt,
        method.model,
        method.config as any,
      );

      const latencyMs = Date.now() - startTime;

      // Parse output - handle both JSON and string responses
      let parsedOutput = response.content;
      try {
        parsedOutput = JSON.parse(response.content);
      } catch {
        // If parsing fails, keep original content
        parsedOutput = response.content;
      }

      // Update execution with success
      await this.prisma.methodExecution.update({
        where: { id: executionId },
        data: {
          status: ExecutionStatus.COMPLETED,
          output: parsedOutput,
          promptSent: prompt,
          provider: response.provider,
          model: response.model,
          tokensInput: response.tokensInput,
          tokensOutput: response.tokensOutput,
          latencyMs,
          completedAt: new Date(),
        },
      });

      // Log audit
      await this.auditService.log({
        userId,
        action: AuditAction.EXECUTE_METHOD,
        resource: 'MethodExecution',
        resourceId: executionId,
        details: {
          methodId,
          status: ExecutionStatus.COMPLETED,
          latencyMs,
          tokensUsed: response.tokensInput + response.tokensOutput,
          async: true,
        },
      });

      return { status: 'completed', executionId };
    } catch (error) {
      const latencyMs = Date.now() - startTime;

      await this.prisma.methodExecution.update({
        where: { id: executionId },
        data: {
          status: ExecutionStatus.FAILED,
          error: {
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          },
          latencyMs,
          completedAt: new Date(),
        },
      });

      // Log audit
      await this.auditService.log({
        userId,
        action: AuditAction.EXECUTE_METHOD,
        resource: 'MethodExecution',
        resourceId: executionId,
        details: {
          methodId,
          status: ExecutionStatus.FAILED,
          error: error instanceof Error ? error.message : String(error),
          async: true,
        },
      });

      throw error;
    }
  }
}
