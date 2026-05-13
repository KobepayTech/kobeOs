import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';

@Global()
@Module({
  imports: [
    CacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const redisUrl = config.get('REDIS_URL');
        if (!redisUrl) {
          return { ttl: 60_000, max: 100 };
        }
        const store = await redisStore({
          url: redisUrl,
          ttl: 300_000,
        });
        return { store, ttl: 300_000 };
      },
    }),
  ],
  exports: [CacheModule],
})
export class RedisCacheModule {}
