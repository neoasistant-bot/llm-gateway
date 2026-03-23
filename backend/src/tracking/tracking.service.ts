import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QueryUsageDto } from './dto/query-usage.dto';
import { ExecutionStatus } from '../generated/prisma/client';

@Injectable()
export class TrackingService {
  constructor(private prisma: PrismaService) {}

  async getUsage(
    query: QueryUsageDto,
    userId?: string,
    userRole?: string,
  ) {
    // Build where clause for filtering executions
    const where: any = {
      status: ExecutionStatus.COMPLETED, // Only count completed executions
    };

    // If CLIENT role, only see own usage
    if (userRole === 'CLIENT') {
      where.userId = userId;
    } else if (query.userId && userRole === 'ADMIN') {
      // ADMIN can query specific user
      where.userId = query.userId;
    } else if (query.userId && userRole !== 'ADMIN') {
      // Non-admin can only query their own
      throw new ForbiddenException(
        'You can only view your own usage statistics',
      );
    }

    // Add optional filters
    if (query.methodId) {
      where.methodId = query.methodId;
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

    // Get all completed executions matching the criteria
    const executions = await this.prisma.methodExecution.findMany({
      where,
      include: {
        method: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Calculate total stats
    let totalRequests = executions.length;
    let totalTokensInput = 0;
    let totalTokensOutput = 0;

    const byMethodMap = new Map<string, any>();
    const byDateMap = new Map<string, any>();

    // Process each execution
    for (const execution of executions) {
      const tokensIn = execution.tokensInput || 0;
      const tokensOut = execution.tokensOutput || 0;

      totalTokensInput += tokensIn;
      totalTokensOutput += tokensOut;

      // Aggregate by method
      const methodId = execution.methodId;
      const methodName = execution.method?.name || 'Unknown';

      if (!byMethodMap.has(methodId)) {
        byMethodMap.set(methodId, {
          methodId,
          methodName,
          requests: 0,
          tokensInput: 0,
          tokensOutput: 0,
        });
      }

      const methodStats = byMethodMap.get(methodId);
      methodStats.requests += 1;
      methodStats.tokensInput += tokensIn;
      methodStats.tokensOutput += tokensOut;

      // Aggregate by date/week/month
      const dateKey = this.getDateKey(
        execution.createdAt,
        query.groupBy || 'day',
      );

      if (!byDateMap.has(dateKey)) {
        byDateMap.set(dateKey, {
          date: dateKey,
          requests: 0,
          tokensInput: 0,
          tokensOutput: 0,
        });
      }

      const dateStats = byDateMap.get(dateKey);
      dateStats.requests += 1;
      dateStats.tokensInput += tokensIn;
      dateStats.tokensOutput += tokensOut;
    }

    // Convert maps to arrays
    const byMethod = Array.from(byMethodMap.values());
    const byTimeGroup = Array.from(byDateMap.values());
    const timeGroupLabel = `by${query.groupBy?.charAt(0).toUpperCase()}${query.groupBy?.slice(1)}`;

    return {
      totalRequests,
      totalTokensInput,
      totalTokensOutput,
      totalTokens: totalTokensInput + totalTokensOutput,
      byMethod,
      [timeGroupLabel]: byTimeGroup,
    };
  }

  private getDateKey(date: Date, groupBy: 'day' | 'week' | 'month'): string {
    const d = new Date(date);

    if (groupBy === 'day') {
      return d.toISOString().split('T')[0]; // YYYY-MM-DD
    }

    if (groupBy === 'week') {
      const startOfWeek = new Date(d);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
      startOfWeek.setDate(diff);
      return startOfWeek.toISOString().split('T')[0]; // Week start date
    }

    if (groupBy === 'month') {
      return d.toISOString().slice(0, 7); // YYYY-MM
    }

    return d.toISOString().split('T')[0];
  }
}
