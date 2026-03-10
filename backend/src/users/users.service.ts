import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateRateLimitDto } from './dto/update-rate-limit.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

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
