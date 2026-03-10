import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class ClientRateLimitGuard implements CanActivate {
  private rpmLimiters = new Map<string, RateLimiterRedis>();
  private tpdLimiters = new Map<string, RateLimiterRedis>();
  private redisClient: Redis;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.redisClient = new Redis(
      this.config.get('REDIS_URL', 'redis://localhost:6379'),
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || user.role === 'ADMIN') return true;

    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { rateLimitRpm: true, rateLimitTpd: true },
    });

    if (!dbUser) return false;

    // RPM limiter
    if (!this.rpmLimiters.has(user.sub)) {
      this.rpmLimiters.set(
        user.sub,
        new RateLimiterRedis({
          storeClient: this.redisClient,
          keyPrefix: `rpm:${user.sub}`,
          points: dbUser.rateLimitRpm,
          duration: 60,
        }),
      );
    }

    // TPD limiter
    if (!this.tpdLimiters.has(user.sub)) {
      this.tpdLimiters.set(
        user.sub,
        new RateLimiterRedis({
          storeClient: this.redisClient,
          keyPrefix: `tpd:${user.sub}`,
          points: dbUser.rateLimitTpd,
          duration: 86400,
        }),
      );
    }

    try {
      await this.rpmLimiters.get(user.sub)!.consume(user.sub);
    } catch {
      throw new ThrottlerException(
        'Rate limit exceeded: too many requests per minute',
      );
    }

    try {
      await this.tpdLimiters.get(user.sub)!.consume(user.sub);
    } catch {
      throw new ThrottlerException(
        'Rate limit exceeded: daily token limit exceeded',
      );
    }

    return true;
  }
}
