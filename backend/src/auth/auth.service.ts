import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuthResponseDto } from './dto/auth-response.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async login(email: string, password: string): Promise<AuthResponseDto> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { sub: user.id, email: user.email, role: user.role };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get('JWT_EXPIRATION', '15m'),
    });

    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get('JWT_REFRESH_EXPIRATION', '7d'),
    });

    const expiresAt = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000,
    );
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(refreshToken),
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }

  async refreshToken(
    token: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      this.jwtService.verify(token);

      const tokenHash = this.hashToken(token);
      const storedToken = await this.prisma.refreshToken.findUnique({
        where: { tokenHash },
        include: { user: true },
      });

      if (
        !storedToken ||
        storedToken.revokedAt ||
        storedToken.expiresAt < new Date()
      ) {
        throw new UnauthorizedException('Invalid or expired refresh token');
      }

      if (!storedToken.user.isActive) {
        throw new UnauthorizedException('Account is deactivated');
      }

      // Revoke used token (rotation)
      await this.prisma.refreshToken.update({
        where: { tokenHash },
        data: { revokedAt: new Date() },
      });

      const newPayload = {
        sub: storedToken.user.id,
        email: storedToken.user.email,
        role: storedToken.user.role,
      };

      const accessToken = this.jwtService.sign(newPayload, {
        expiresIn: this.configService.get('JWT_EXPIRATION', '15m'),
      });

      const newRefreshToken = this.jwtService.sign(newPayload, {
        expiresIn: this.configService.get('JWT_REFRESH_EXPIRATION', '7d'),
      });

      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await this.prisma.refreshToken.create({
        data: {
          userId: storedToken.user.id,
          tokenHash: this.hashToken(newRefreshToken),
          expiresAt,
        },
      });

      return { accessToken, refreshToken: newRefreshToken };
    } catch (e) {
      if (e instanceof UnauthorizedException) throw e;
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async logout(userId: string, refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { userId, tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async logoutAll(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async cleanExpiredTokens(): Promise<void> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    await this.prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { revokedAt: { lt: thirtyDaysAgo } },
        ],
      },
    });
  }
}
