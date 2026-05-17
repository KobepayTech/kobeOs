import { Module, Global } from '@nestjs/common';

/**
 * Placeholder cache module — Redis packages not installed.
 * Swap in @nestjs/cache-manager + cache-manager-redis-yet when Redis is needed.
 */
@Global()
@Module({})
export class RedisCacheModule {}
