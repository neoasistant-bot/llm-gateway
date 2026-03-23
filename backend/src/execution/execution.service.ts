import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../prisma/prisma.service';
import { LLMService } from '../llm/llm.service';
import { AuditService } from '../audit/audit.service';
import { PromptBuilderService } from './prompt-builder.service';
import { ExecuteMethodDto } from './dto/execute-method.dto';
import { QueryExecutionsDto } from './dto/query-executions.dto';
import { ExecutionStatus, AuditAction } from '../generated/prisma/client';

@Injectable()
export class ExecutionService {
  constructor(
    private prisma: PrismaService,
    private llmService: LLMService,
    private auditService: AuditService,
    private promptBuilder: PromptBuilderService,
    @InjectQueue('execution') private executionQueue: Queue,
  ) {}

  async executeSync(
    userId: string,
    methodId: string,
    input: any,
    ip?: string,
  ) {
    // Find the method
    const method = await this.prisma.method.findUnique({
      where: { id: methodId },
    });

    if (!method) {
      throw new NotFoundException(`Method with id ${methodId} not found`);
    }

    if (!method.isActive) {
      throw new BadRequestException('Method is not active');
    }

    // Check user has access
    await this.checkUserAccess(userId, methodId, method.isPublic);

    // Get user's outputSchemaOverride if exists
    const userMethod = await this.prisma.userMethod.findUnique({
      where: { userId_methodId: { userId, methodId } },
    });

    const outputSchema = userMethod?.outputSchemaOverride as
      | Record<string, any>
      | undefined;

    // Validate input
    const validation = this.promptBuilder.validateInput(
      input,
      method.inputType,
    );
    if (!validation.valid) {
      throw new BadRequestException(validation.error);
    }

    // Build prompt
    const prompt = this.promptBuilder.buildPrompt({
      promptTemplate: method.promptTemplate,
      input,
      inputType: method.inputType,
      outputSchema: outputSchema || null,
    });

    // Create execution record
    let execution = await this.prisma.methodExecution.create({
      data: {
        userId,
        methodId,
        input,
        status: ExecutionStatus.PROCESSING,
      },
    });

    const startTime = Date.now();

    try {
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
      execution = await this.prisma.methodExecution.update({
        where: { id: execution.id },
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
        resourceId: execution.id,
        details: {
          methodId,
          status: ExecutionStatus.COMPLETED,
          latencyMs,
          tokensUsed: response.tokensInput + response.tokensOutput,
        },
        ip,
      });

      return execution;
    } catch (error) {
      const latencyMs = Date.now() - startTime;

      // Update execution with error
      execution = await this.prisma.methodExecution.update({
        where: { id: execution.id },
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
        resourceId: execution.id,
        details: {
          methodId,
          status: ExecutionStatus.FAILED,
          error: error instanceof Error ? error.message : String(error),
        },
        ip,
      });

      throw new BadRequestException('Execution failed: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  async executeAsync(
    userId: string,
    methodId: string,
    input: any,
    ip?: string,
  ) {
    // Find the method
    const method = await this.prisma.method.findUnique({
      where: { id: methodId },
    });

    if (!method) {
      throw new NotFoundException(`Method with id ${methodId} not found`);
    }

    if (!method.isActive) {
      throw new BadRequestException('Method is not active');
    }

    // Check user has access
    await this.checkUserAccess(userId, methodId, method.isPublic);

    // Validate input
    const validation = this.promptBuilder.validateInput(
      input,
      method.inputType,
    );
    if (!validation.valid) {
      throw new BadRequestException(validation.error);
    }

    // Create execution record with PENDING status
    const execution = await this.prisma.methodExecution.create({
      data: {
        userId,
        methodId,
        input,
        status: ExecutionStatus.PENDING,
      },
    });

    // Add job to queue
    await this.executionQueue.add(
      'execute-method',
      {
        executionId: execution.id,
        userId,
        methodId,
        input,
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    );

    // Log audit
    await this.auditService.log({
      userId,
      action: AuditAction.EXECUTE_METHOD,
      resource: 'MethodExecution',
      resourceId: execution.id,
      details: {
        methodId,
        status: ExecutionStatus.PENDING,
        async: true,
      },
      ip,
    });

    return {
      executionId: execution.id,
      status: ExecutionStatus.PENDING,
    };
  }

  async findOne(
    executionId: string,
    userId?: string,
    userRole?: string,
  ) {
    const execution = await this.prisma.methodExecution.findUnique({
      where: { id: executionId },
      include: {
        method: {
          select: {
            id: true,
            name: true,
            provider: true,
            model: true,
          },
        },
      },
    });

    if (!execution) {
      throw new NotFoundException(`Execution with id ${executionId} not found`);
    }

    // If CLIENT role, verify execution belongs to user
    if (userRole === 'CLIENT' && execution.userId !== userId) {
      throw new ForbiddenException('You do not have access to this execution');
    }

    return execution;
  }

  async findAll(
    query: QueryExecutionsDto,
    userId?: string,
    userRole?: string,
  ) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    // If CLIENT role, only see own executions
    if (userRole === 'CLIENT') {
      where.userId = userId;
    } else if (query.userId) {
      // ADMIN can filter by specific userId
      where.userId = query.userId;
    }

    // Add optional filters
    if (query.methodId) {
      where.methodId = query.methodId;
    }

    if (query.status) {
      where.status = query.status;
    }

    // Date range filters
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};

      if (query.dateFrom) {
        where.createdAt.gte = new Date(query.dateFrom);
      }

      if (query.dateTo) {
        where.createdAt.lte = new Date(query.dateTo);
      }
    }

    // Get total count for pagination
    const total = await this.prisma.methodExecution.count({ where });

    // Get paginated results
    const executions = await this.prisma.methodExecution.findMany({
      where,
      include: {
        method: {
          select: {
            id: true,
            name: true,
            provider: true,
            model: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });

    return {
      data: executions,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  private async checkUserAccess(
    userId: string,
    methodId: string,
    isPublic: boolean,
  ) {
    if (isPublic) {
      return; // Public methods accessible to all
    }

    // For private methods, check if user has access via UserMethod
    const userMethod = await this.prisma.userMethod.findUnique({
      where: { userId_methodId: { userId, methodId } },
    });

    if (!userMethod || !userMethod.isActive) {
      throw new ForbiddenException(
        'You do not have access to this private method',
      );
    }
  }
}
