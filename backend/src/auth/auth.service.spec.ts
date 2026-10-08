import {
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import type { PublicUser } from '../users/user.select';
import { AuthService, hashToken, mapUniqueViolation } from './auth.service';

const user: PublicUser = {
  id: 1,
  email: 'user@example.com',
  phone: '0911111111',
  fullName: 'Người Dùng',
  role: UserRole.CUSTOMER,
  status: UserStatus.ACTIVE,
  mustChangePassword: false,
  createdAt: new Date(),
};

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: { findUnique: jest.Mock };
    refreshToken: {
      findUnique: jest.Mock;
      updateMany: jest.Mock;
      create: jest.Mock;
    };
  };

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn() },
      refreshToken: {
        findUnique: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn().mockResolvedValue({}),
      },
    };
    const config = {
      getOrThrow: (key: string) =>
        ({ 'auth.bcryptRounds': 4, 'auth.refreshTokenTtlDays': 7 })[key],
    } as unknown as ConfigService;
    const jwt = {
      signAsync: jest.fn().mockResolvedValue('access-token'),
    } as unknown as JwtService;
    service = new AuthService(prisma as unknown as PrismaService, jwt, config);
  });

  describe('login', () => {
    it('đúng mật khẩu: trả token, không kèm passwordHash', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...user,
        passwordHash: await bcrypt.hash('matkhau123', 4),
      });
      const result = await service.login({
        email: user.email,
        password: 'matkhau123',
      });
      expect(result.accessToken).toBe('access-token');
      expect(result.user).not.toHaveProperty('passwordHash');
      expect(prisma.refreshToken.create).toHaveBeenCalledTimes(1);
    });

    it('email không tồn tại → 401', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.login({ email: 'x@example.com', password: 'matkhau123' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('tài khoản khóa → 403, không cấp token', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...user,
        status: UserStatus.LOCKED,
        passwordHash: await bcrypt.hash('matkhau123', 4),
      });
      await expect(
        service.login({ email: user.email, password: 'matkhau123' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    const stored = (overrides: object = {}) => ({
      id: 10,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      user,
      ...overrides,
    });

    it('tra cứu theo hash, thu hồi token cũ rồi cấp cặp mới', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(stored());
      const result = await service.refresh('raw-token');

      expect(prisma.refreshToken.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tokenHash: hashToken('raw-token') },
        }),
      );
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { id: 10, revokedAt: null },
        data: { revokedAt: expect.any(Date) as Date },
      });
      expect(result.refreshToken).not.toBe('raw-token');
    });

    it.each([
      ['không tồn tại', null],
      ['đã thu hồi', stored({ revokedAt: new Date() })],
      ['hết hạn', stored({ expiresAt: new Date(Date.now() - 1) })],
    ])('token %s → 401', async (_label, row) => {
      prisma.refreshToken.findUnique.mockResolvedValue(row);
      await expect(service.refresh('raw-token')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('hai request dùng cùng token: request thua (count = 0) → 401', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(stored());
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.refresh('raw-token')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it('user bị khóa → 403', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(
        stored({ user: { ...user, status: UserStatus.LOCKED } }),
      );
      await expect(service.refresh('raw-token')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe('hashToken', () => {
    it('SHA-256 hex 64 ký tự, cố định theo input', () => {
      expect(hashToken('abc')).toHaveLength(64);
      expect(hashToken('abc')).toBe(hashToken('abc'));
      expect(hashToken('abc')).not.toBe(hashToken('abd'));
    });
  });

  describe('mapUniqueViolation', () => {
    const p2002 = (target: string) =>
      new Prisma.PrismaClientKnownRequestError('Unique', {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target },
      });

    it('P2002 → 409 theo field', () => {
      const phone = mapUniqueViolation(p2002('users_phone_key'));
      expect(phone).toBeInstanceOf(ConflictException);
      expect((phone as ConflictException).message).toMatch(/Số điện thoại/);
      expect(
        (mapUniqueViolation(p2002('users_email_key')) as Error).message,
      ).toMatch(/Email/);
    });

    it('lỗi khác giữ nguyên', () => {
      const error = new Error('khác');
      expect(mapUniqueViolation(error)).toBe(error);
    });
  });
});
