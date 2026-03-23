import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMethodDto } from './dto/create-method.dto';
import { UpdateMethodDto } from './dto/update-method.dto';
import { QueryMethodsDto } from './dto/query-methods.dto';

@Injectable()
export class MethodsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateMethodDto) {
    return this.prisma.method.create({
      data: {
        name: dto.name,
        description: dto.description,
        inputType: dto.inputType || 'TEXT',
        promptTemplate: dto.promptTemplate,
        provider: dto.provider,
        model: dto.model,
        isPublic: dto.isPublic || false,
        config: dto.config || {},
      },
    });
  }

  async findAll(query: QueryMethodsDto, userRole: string, userId?: string) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const whereCondition: any = { isActive: true };

    // Filter by provider if provided
    if (query.provider) {
      whereCondition.provider = query.provider;
    }

    if (userRole === 'ADMIN') {
      // ADMIN: return all active methods with full detail
      const [methods, total] = await Promise.all([
        this.prisma.method.findMany({
          where: whereCondition,
          skip,
          take: limit,
        }),
        this.prisma.method.count({ where: whereCondition }),
      ]);

      return {
        data: methods,
        total,
        page,
        limit,
      };
    } else {
      // CLIENT: return public methods + methods assigned to user
      const [methods, total] = await Promise.all([
        this.prisma.method.findMany({
          where: {
            isActive: true,
            OR: [
              { isPublic: true },
              {
                users: {
                  some: {
                    userId: userId,
                    isActive: true,
                  },
                },
              },
            ],
            ...whereCondition,
          },
          skip,
          take: limit,
          select: {
            id: true,
            name: true,
            description: true,
            inputType: true,
            provider: true,
            model: true,
            isPublic: true,
            config: true,
            isActive: true,
            createdAt: true,
            // Explicitly exclude promptTemplate for CLIENT
          },
        }),
        this.prisma.method.count({
          where: {
            isActive: true,
            OR: [
              { isPublic: true },
              {
                users: {
                  some: {
                    userId: userId,
                    isActive: true,
                  },
                },
              },
            ],
            ...whereCondition,
          },
        }),
      ]);

      return {
        data: methods,
        total,
        page,
        limit,
      };
    }
  }

  async findOne(id: string, userRole: string, userId?: string) {
    const method = await this.prisma.method.findUnique({
      where: { id },
    });

    if (!method) {
      throw new NotFoundException('Method not found');
    }

    if (!method.isActive) {
      throw new NotFoundException('Method not found');
    }

    if (userRole === 'ADMIN') {
      // ADMIN: full detail including promptTemplate
      return method;
    } else {
      // CLIENT: check access (public or assigned)
      const hasAccess =
        method.isPublic ||
        (userId &&
          (await this.prisma.userMethod.findUnique({
            where: {
              userId_methodId: {
                userId: userId,
                methodId: id,
              },
            },
          })));

      if (!hasAccess) {
        throw new NotFoundException('Method not found');
      }

      // Return without promptTemplate for CLIENT
      const { promptTemplate: _, ...result } = method;
      return result;
    }
  }

  async update(id: string, dto: UpdateMethodDto) {
    const method = await this.prisma.method.findUnique({ where: { id } });
    if (!method) {
      throw new NotFoundException('Method not found');
    }

    const updateData: any = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.inputType !== undefined) updateData.inputType = dto.inputType;
    if (dto.promptTemplate !== undefined)
      updateData.promptTemplate = dto.promptTemplate;
    if (dto.provider !== undefined) updateData.provider = dto.provider;
    if (dto.model !== undefined) updateData.model = dto.model;
    if (dto.isPublic !== undefined) updateData.isPublic = dto.isPublic;
    if (dto.config !== undefined) updateData.config = dto.config;

    return this.prisma.method.update({
      where: { id },
      data: updateData,
    });
  }

  async deactivate(id: string) {
    const method = await this.prisma.method.findUnique({ where: { id } });
    if (!method) {
      throw new NotFoundException('Method not found');
    }

    return this.prisma.method.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async assignMethod(userId: string, methodId: string) {
    // Check if user exists
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if method exists
    const method = await this.prisma.method.findUnique({
      where: { id: methodId },
    });
    if (!method) {
      throw new NotFoundException('Method not found');
    }

    // Check if assignment already exists
    const existing = await this.prisma.userMethod.findUnique({
      where: {
        userId_methodId: {
          userId,
          methodId,
        },
      },
    });

    if (existing) {
      if (existing.isActive) {
        throw new BadRequestException('Method already assigned to user');
      } else {
        // Reactivate if was previously deactivated
        return this.prisma.userMethod.update({
          where: {
            userId_methodId: {
              userId,
              methodId,
            },
          },
          data: { isActive: true },
        });
      }
    }

    return this.prisma.userMethod.create({
      data: {
        userId,
        methodId,
      },
    });
  }

  async unassignMethod(userId: string, methodId: string) {
    const userMethod = await this.prisma.userMethod.findUnique({
      where: {
        userId_methodId: {
          userId,
          methodId,
        },
      },
    });

    if (!userMethod) {
      throw new NotFoundException('Method assignment not found');
    }

    return this.prisma.userMethod.update({
      where: {
        userId_methodId: {
          userId,
          methodId,
        },
      },
      data: { isActive: false },
    });
  }

  async updateOutputSchema(userId: string, methodId: string, schema: any) {
    // Validate schema is a valid JSON object
    if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
      throw new BadRequestException('Output schema must be a valid JSON object');
    }

    const userMethod = await this.prisma.userMethod.findUnique({
      where: {
        userId_methodId: {
          userId,
          methodId,
        },
      },
    });

    if (!userMethod) {
      throw new NotFoundException('Method assignment not found');
    }

    return this.prisma.userMethod.update({
      where: {
        userId_methodId: {
          userId,
          methodId,
        },
      },
      data: { outputSchemaOverride: schema },
    });
  }

  async getMyMethods(userId: string) {
    // Get all methods for client (public + assigned) with their schema overrides
    const methods = await this.prisma.method.findMany({
      where: {
        isActive: true,
        OR: [
          { isPublic: true },
          {
            users: {
              some: {
                userId: userId,
                isActive: true,
              },
            },
          },
        ],
      },
      select: {
        id: true,
        name: true,
        description: true,
        inputType: true,
        provider: true,
        model: true,
        isPublic: true,
        config: true,
        createdAt: true,
        users: {
          where: {
            userId: userId,
            isActive: true,
          },
          select: {
            outputSchemaOverride: true,
          },
        },
      },
    });

    // Transform to include outputSchema in the method object
    return methods.map((method) => ({
      ...method,
      outputSchema: method.users[0]?.outputSchemaOverride || null,
      users: undefined, // Remove the users array from response
    }));
  }
}
