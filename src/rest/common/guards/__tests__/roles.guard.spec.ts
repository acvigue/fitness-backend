import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUser = { findUnique: vi.fn() };

vi.mock('@/shared/utils', () => ({
  prisma: { user: mockUser },
  redis: {},
  redisSub: {},
}));

const { RolesGuard } = await import('../roles.guard');
const { ROLES_KEY } = await import('@/rest/common/decorators/roles.decorator');

function makeContext(userSub: string | undefined): ExecutionContext {
  return {
    getHandler: () => 'handler',
    getClass: () => 'class',
    switchToHttp: () => ({
      getRequest: () => ({ user: userSub ? { sub: userSub } : undefined }),
    }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  let reflector: Reflector;
  let guard: InstanceType<typeof RolesGuard>;

  beforeEach(() => {
    vi.clearAllMocks();
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it('allows access when no @Roles() applied (undefined metadata)', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const ok = await guard.canActivate(makeContext('u-1'));
    expect(ok).toBe(true);
    expect(mockUser.findUnique).not.toHaveBeenCalled();
  });

  it('allows access when @Roles() empty', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([]);
    const ok = await guard.canActivate(makeContext('u-1'));
    expect(ok).toBe(true);
  });

  it('throws ForbiddenException when unauthenticated', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN']);
    await expect(guard.canActivate(makeContext(undefined))).rejects.toThrow(ForbiddenException);
  });

  it('denies when user role is not in required list', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN', 'DEPT_MANAGER']);
    mockUser.findUnique.mockResolvedValue({ role: 'STUDENT' });

    await expect(guard.canActivate(makeContext('u-1'))).rejects.toThrow(ForbiddenException);
  });

  it('allows when user role is in required list', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['DEPT_MANAGER']);
    mockUser.findUnique.mockResolvedValue({ role: 'DEPT_MANAGER' });

    const ok = await guard.canActivate(makeContext('u-1'));
    expect(ok).toBe(true);
  });

  it('exposes a well-known metadata key', () => {
    expect(ROLES_KEY).toBe('roles');
  });
});
