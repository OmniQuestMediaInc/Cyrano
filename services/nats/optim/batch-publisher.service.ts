// NATS: per-topic micro-batching publisher
// Phase 2.9 — for high-frequency telemetry (FFS_SCORE_UPDATE) we coalesce
// up to N payloads or T milliseconds of writes into one NATS publish using
// a JSON array envelope. Subscribers iterate the envelope and dispatch as
// if each item arrived independently.
//
// The batcher wraps NatsService — concrete services depend on it via DI in
// place of NatsService when they want batching. Best-effort delivery only;
// JetStream subjects must NOT be routed through this publisher.

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { NatsService } from '../../core-api/src/nats/nats.service';
import type { NatsTopic } from '../topics.registry';

export const NATS_BATCH_DEFAULT_INTERVAL_MS = 3_000;
export const NATS_BATCH_DEFAULT_MAX_SIZE = 50;

interface BatchBucket {
  topic: string;
  payloads: Record<string, unknown>[];
  timer: NodeJS.Timeout | null;
}

@Injectable()
export class NatsBatchPublisher implements OnModuleDestroy {
  private readonly logger = new Logger(NatsBatchPublisher.name);
  private readonly buckets = new Map<string, BatchBucket>();

  constructor(
    private readonly nats: NatsService,
    private readonly intervalMs: number = NATS_BATCH_DEFAULT_INTERVAL_MS,
    private readonly maxSize: number = NATS_BATCH_DEFAULT_MAX_SIZE,
  ) {}

  /** Append a payload to the per-topic batch. Flushes immediately if full. */
  enqueue(topic: NatsTopic | string, payload: Record<string, unknown>): void {
    let bucket = this.buckets.get(topic);
    if (!bucket) {
      bucket = { topic, payloads: [], timer: null };
      this.buckets.set(topic, bucket);
    }
    bucket.payloads.push(payload);

    if (bucket.payloads.length >= this.maxSize) {
      this.flushBucket(bucket);
      return;
    }
    if (!bucket.timer) {
      bucket.timer = setTimeout(() => this.flushBucket(bucket!), this.intervalMs);
      if (typeof bucket.timer.unref === 'function') bucket.timer.unref();
    }
  }

  /** Force a flush of every batched topic. Useful at shutdown. */
  flushAll(): void {
    for (const bucket of this.buckets.values()) this.flushBucket(bucket);
  }

  onModuleDestroy(): void {
    this.flushAll();
  }

  private flushBucket(bucket: BatchBucket): void {
    if (bucket.timer) {
      clearTimeout(bucket.timer);
      bucket.timer = null;
    }
    if (bucket.payloads.length === 0) return;
    const envelope = {
      __batched: true,
      count: bucket.payloads.length,
      items: bucket.payloads,
      flushed_at_utc: new Date().toISOString(),
    };
    bucket.payloads = [];
    try {
      this.nats.publish(bucket.topic, envelope);
    } catch (err) {
      this.logger.warn('NatsBatchPublisher: flush failed', {
        topic: bucket.topic,
        error: String(err),
      });
    }
  }
}
