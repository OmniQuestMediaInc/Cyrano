// PAYLOAD 2 — Notification module wiring.
import { Module } from '@nestjs/common';
import { NotificationEngine } from './notification.service';

@Module({
  providers: [NotificationEngine],
  exports: [NotificationEngine],
})
export class NotificationModule {}
