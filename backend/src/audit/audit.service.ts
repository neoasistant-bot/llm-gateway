import { Injectable } from '@nestjs/common';
import { AuditAction } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(data: {
    userId?: string;
    action: AuditAction;
    resource: string;
    resourceId?: string;
    details?: any;
    ip?: string;
  }): Promise<void> {
    await this.prisma.auditLog.create({ data });
  }

  async findAll(query: QueryAuditLogsDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    // Build where clause dynamically
    const where: any = {};

    if (query.userId) {
      where.userId = query.userId;
    }

    if (query.action) {
      where.action = query.action;
    }

    if (query.resource) {
      where.resource = query.resource;
    }

    // Handle date range filters
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};

      if (query.dateFrom) {
        where.createdAt.gte = new Date(query.dateFrom);
      }

      if (query.dateTo) {
        where.createdAt.lte = new Date(query.dateTo);
      }
    }

    // Fetch paginated data with filters
    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, email: true },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
    };
  }
}
