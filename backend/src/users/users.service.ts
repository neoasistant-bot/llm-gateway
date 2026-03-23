import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateRateLimitDto } from './dto/update-rate-limit.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateUserDto) {
    // Check if email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        role: dto.role || 'CLIENT',
      },
    });

    // Return without passwordHash
    const { passwordHash: _, ...result } = user;
    return result;
  }

  async findAll(query: QueryUsersDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where: { role: 'CLIENT' },
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
          rateLimitRpm: true,
          rateLimitTpd: true,
          createdAt: true,
        },
      }),
      this.prisma.user.count({ where: { role: 'CLIENT' } }),
    ]);

    return {
      data: users,
      total,
      page,
      limit,
    };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        rateLimitRpm: true,
        rateLimitTpd: true,
        createdAt: true,
        _count: {
          select: {
            methods: true,
            executions: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check for duplicate email if email is being updated
    if (dto.email && dto.email !== user.email) {
      const existingUser = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });
      if (existingUser) {
        throw new ConflictException('Email already exists');
      }
    }

    const updateData: any = {};
    if (dto.email) updateData.email = dto.email;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
    if (dto.password) {
      updateData.passwordHash = await bcrypt.hash(dto.password, 10);
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        rateLimitRpm: true,
        rateLimitTpd: true,
        createdAt: true,
      },
    });

    return updatedUser;
  }

  async deactivate(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role === 'ADMIN') {
      throw new BadRequestException('Cannot deactivate ADMIN users');
    }

    const deactivatedUser = await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    return deactivatedUser;
  }

  async updateRateLimit(userId: string, dto: UpdateRateLimitDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === 'ADMIN')
      throw new BadRequestException('Cannot set rate limit for admin users');

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.rateLimitRpm !== undefined && {
          rateLimitRpm: dto.rateLimitRpm,
        }),
        ...(dto.rateLimitTpd !== undefined && {
          rateLimitTpd: dto.rateLimitTpd,
        }),
      },
      select: {
        id: true,
        email: true,
        rateLimitRpm: true,
        rateLimitTpd: true,
      },
    });
  }

  async getRateLimit(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        rateLimitRpm: true,
        rateLimitTpd: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}
