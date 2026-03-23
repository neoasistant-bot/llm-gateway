import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  function createMockContext(userRole?: string): ExecutionContext {
    return {
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({
          user: userRole ? { role: userRole } : undefined,
        }),
      }),
    } as unknown as ExecutionContext;
  }

  it('should allow ADMIN to access ADMIN route', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN']);
    const context = createMockContext('ADMIN');

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should deny CLIENT access to ADMIN route', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN']);
    const context = createMockContext('CLIENT');

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should allow CLIENT to access CLIENT route', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['CLIENT']);
    const context = createMockContext('CLIENT');

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow any authenticated user when no roles required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const context = createMockContext('CLIENT');

    expect(guard.canActivate(context)).toBe(true);
  });
});
