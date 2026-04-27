// services/prisma/prisma.module.ts
// Shared PrismaModule for standalone NestJS services (e.g. zonebot-scheduler).
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
