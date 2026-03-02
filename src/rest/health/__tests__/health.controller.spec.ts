import { Test } from '@nestjs/testing';
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

const mockQueryRaw = vi.fn();

vi.mock('@/shared/utils', () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
  },
  redis: {},
  redisSub: {},
}));

const { HealthController } = await import('../health.controller');

describe('HealthController', () => {
  let controller: InstanceType<typeof HealthController>;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    controller = module.get(HealthController);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return status ok when database is reachable', async () => {
    mockQueryRaw.mockResolvedValue([{ '?column?': 1 }]);

    const result = await controller.getHealth();

    expect(result.status).toBe('ok');
    expect(result.database).toBe('up');
    expect(result.timestamp).toBeDefined();
  });

  it('should return status degraded when database query fails', async () => {
    mockQueryRaw.mockRejectedValue(new Error('Connection refused'));

    const result = await controller.getHealth();

    expect(result.status).toBe('degraded');
    expect(result.database).toBe('error');
    expect(result.timestamp).toBeDefined();
  });

  it('should return a valid ISO timestamp', async () => {
    mockQueryRaw.mockResolvedValue([{ '?column?': 1 }]);

    const result = await controller.getHealth();

    expect(() => new Date(result.timestamp)).not.toThrow();
    expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
  });
});
