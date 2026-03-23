import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

// Mock PrismaService to avoid importing the generated Prisma client (ESM)
jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => ({
    user: { findUnique: jest.fn() },
  })),
}));

import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let jwtService: JwtService;

  const mockUser = {
    id: 'user-1',
    email: 'admin@llmgateway.com',
    passwordHash: '',
    role: 'ADMIN',
    isActive: true,
    outputSchema: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    mockUser.passwordHash = await bcrypt.hash('admin123', 10);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
            },
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock-token'),
            verify: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('15m'),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
  });

  describe('login', () => {
    it('should return tokens for valid credentials', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser as any);

      const result = await service.login('admin@llmgateway.com', 'admin123');

      expect(result.accessToken).toBe('mock-token');
      expect(result.refreshToken).toBe('mock-token');
      expect(result.user.email).toBe('admin@llmgateway.com');
      expect(result.user.role).toBe('ADMIN');
    });

    it('should throw for invalid email', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);

      await expect(service.login('wrong@email.com', 'admin123'))
        .rejects.toThrow(UnauthorizedException);
    });

    it('should throw for wrong password', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser as any);

      await expect(service.login('admin@llmgateway.com', 'wrongpass'))
        .rejects.toThrow(UnauthorizedException);
    });

    it('should throw for inactive user', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        ...mockUser,
        isActive: false,
      } as any);

      await expect(service.login('admin@llmgateway.com', 'admin123'))
        .rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refreshToken', () => {
    it('should return new access token for valid refresh token', async () => {
      jest.spyOn(jwtService, 'verify').mockReturnValue({ sub: 'user-1' });
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser as any);

      const result = await service.refreshToken('valid-refresh-token');

      expect(result.accessToken).toBe('mock-token');
    });

    it('should throw for expired refresh token', async () => {
      jest.spyOn(jwtService, 'verify').mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await expect(service.refreshToken('expired-token'))
        .rejects.toThrow(UnauthorizedException);
    });
  });
});
