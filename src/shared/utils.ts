import { PrismaClient } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import Redis from 'ioredis';
import { LoggerService } from '@/shared/logger';

const logger = new LoggerService();
logger.setContext('Database');

const redisLogger = new LoggerService();
redisLogger.setContext('Redis');

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

export const prisma = new PrismaClient({
  adapter,
});

export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => Math.min(times * 100, 3000),
});

export const redisSub = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => Math.min(times * 100, 3000),
});

// Log Redis connection events for debugging
redis.on('error', (err) => redisLogger.error(`Redis error: ${err.message}`));
redis.on('connect', () => redisLogger.log('Redis connected'));
redis.on('reconnecting', () => redisLogger.warn('Redis reconnecting...'));

redisSub.on('error', (err) => redisLogger.error(`Redis sub error: ${err.message}`));
redisSub.on('connect', () => redisLogger.log('Redis sub connected'));
redisSub.on('reconnecting', () => redisLogger.warn('Redis sub reconnecting...'));
