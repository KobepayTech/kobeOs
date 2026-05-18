import { Global, Module } from '@nestjs/common';
import { CacheService } from './cache.service';

/**
 * Global cache module — currently backed by an in-process LRU map.
 *
 * To switch to Redis: install @nestjs/cache-manager + cache-manager-redis-yet,
 * replace CacheService with CacheModule.registerAsync(...) and update
 * any injected CacheService references to use the CACHE_MANAGER token.
 */
@Global()
@Module({
  providers: [CacheService],
  exports: [CacheService],
})
export class RedisCacheModule {}
