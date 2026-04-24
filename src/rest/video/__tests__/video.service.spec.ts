import { Test } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mockVideo = {
  create: vi.fn(),
  findUnique: vi.fn(),
  findMany: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  count: vi.fn(),
};

const mockVideoProgress = {
  upsert: vi.fn(),
  findUnique: vi.fn(),
};

vi.mock('@/shared/utils', () => ({
  prisma: {
    video: mockVideo,
    videoProgress: mockVideoProgress,
  },
  redis: {},
  redisSub: {},
}));

const { VideoService } = await import('../video.service');

const NOW = new Date('2026-01-01T00:00:00Z');

function mockVideoRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'v-1',
    name: 'Basketball Fundamentals',
    description: 'Intro to basketball',
    uploaderId: 'u-1',
    sportId: 'sport-1',
    url: 'https://cdn.example/v-1.mp4',
    mimeType: 'video/mp4',
    size: 1000,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe('VideoService', () => {
  let service: InstanceType<typeof VideoService>;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [
        VideoService,
        { provide: 'NotificationService', useValue: {} },
        { provide: 'UserService', useValue: {} },
        { provide: 'AchievementService', useValue: {} },
      ],
    })
      .overrideProvider(VideoService)
      .useFactory({
        factory: () => new VideoService({} as never, {} as never, {} as never),
      })
      .compile();

    service = module.get(VideoService);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('findAll', () => {
    it('lists videos with pagination', async () => {
      mockVideo.count.mockResolvedValue(2);
      mockVideo.findMany.mockResolvedValue([mockVideoRecord(), mockVideoRecord({ id: 'v-2' })]);

      const result = await service.findAll({ page: 1, per_page: 20 });

      expect(result.meta.total).toBe(2);
      expect(result.data).toHaveLength(2);
      expect(mockVideo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20, where: {} })
      );
    });

    it('applies sportId filter', async () => {
      mockVideo.count.mockResolvedValue(1);
      mockVideo.findMany.mockResolvedValue([mockVideoRecord()]);

      await service.findAll({ page: 1, per_page: 10 }, { sportId: 'sport-1' });

      expect(mockVideo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { sportId: 'sport-1' } })
      );
    });
  });

  describe('findOne', () => {
    it('returns the video when found', async () => {
      mockVideo.findUnique.mockResolvedValue(mockVideoRecord());
      const result = await service.findOne('v-1');
      expect(result.id).toBe('v-1');
    });

    it('throws NotFoundException when missing', async () => {
      mockVideo.findUnique.mockResolvedValue(null);
      await expect(service.findOne('nope')).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('rejects non-uploader with ForbiddenException', async () => {
      mockVideo.findUnique.mockResolvedValue(mockVideoRecord({ uploaderId: 'u-other' }));
      await expect(service.delete('v-1', 'u-1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateProgress', () => {
    it('upserts progress for the video', async () => {
      mockVideo.findUnique.mockResolvedValue(mockVideoRecord());
      mockVideoProgress.upsert.mockResolvedValue({
        videoId: 'v-1',
        positionSeconds: 30,
        completed: false,
        updatedAt: NOW,
      });

      const result = await service.updateProgress('v-1', 'u-1', { positionSeconds: 30 });

      expect(mockVideoProgress.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_videoId: { userId: 'u-1', videoId: 'v-1' } },
          create: expect.objectContaining({ positionSeconds: 30, completed: false }),
          update: expect.objectContaining({ positionSeconds: 30 }),
        })
      );
      expect(result.positionSeconds).toBe(30);
      expect(result.completed).toBe(false);
    });

    it('marks completed when provided', async () => {
      mockVideo.findUnique.mockResolvedValue(mockVideoRecord());
      mockVideoProgress.upsert.mockResolvedValue({
        videoId: 'v-1',
        positionSeconds: 500,
        completed: true,
        updatedAt: NOW,
      });

      const result = await service.updateProgress('v-1', 'u-1', {
        positionSeconds: 500,
        completed: true,
      });

      expect(result.completed).toBe(true);
    });

    it('throws NotFoundException when video missing', async () => {
      mockVideo.findUnique.mockResolvedValue(null);
      await expect(service.updateProgress('v-1', 'u-1', { positionSeconds: 0 })).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('getProgress', () => {
    it('returns zero progress when no record exists', async () => {
      mockVideoProgress.findUnique.mockResolvedValue(null);
      const result = await service.getProgress('v-1', 'u-1');
      expect(result.positionSeconds).toBe(0);
      expect(result.completed).toBe(false);
    });

    it('returns stored progress when present', async () => {
      mockVideoProgress.findUnique.mockResolvedValue({
        videoId: 'v-1',
        positionSeconds: 120,
        completed: false,
        updatedAt: NOW,
      });
      const result = await service.getProgress('v-1', 'u-1');
      expect(result.positionSeconds).toBe(120);
    });
  });
});
