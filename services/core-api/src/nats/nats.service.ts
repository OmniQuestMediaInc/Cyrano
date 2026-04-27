// services/core-api/src/nats/nats.service.ts
// NATS: Core publish/subscribe wrapper. All services use this — never
// import the nats package directly in a feature service.
import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { connect, NatsConnection, StringCodec, Subscription } from 'nats';
import { NatsTopic } from '../../../nats/topics.registry';

const sc = StringCodec();

@Injectable()
export class NatsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NatsService.name);
  private connection: NatsConnection | null = null;

  async onModuleInit(): Promise<void> {
    const url = process.env.NATS_URL ?? 'nats://localhost:4222';
    try {
      this.connection = await connect({ servers: url });
      this.logger.log('NatsService: connected', { url });
    } catch (err) {
      // Log but do not throw — allows app to start without NATS in dev
      this.logger.warn('NatsService: connection failed — running without NATS', {
        url,
        error: String(err),
      });
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.connection) {
      await this.connection.drain();
      this.logger.log('NatsService: connection drained and closed');
    }
  }

  /**
   * Publish a message to a NATS topic.
   * Topic must be from NATS_TOPICS registry.
   * Payload is serialised to JSON automatically.
   */
  publish(topic: NatsTopic | string, payload: Record<string, unknown>): void {
    if (!this.connection) {
      this.logger.warn('NatsService: publish skipped — no connection', { topic });
      return;
    }
    try {
      this.connection.publish(topic, sc.encode(JSON.stringify(payload)));
    } catch (err) {
      this.logger.error('NatsService: publish failed', err, { topic });
    }
  }

  /**
   * Subscribe to a NATS topic.
   * Returns the raw Subscription — caller manages lifecycle.
   */
  subscribe(
    topic: NatsTopic | string,
    handler: (payload: Record<string, unknown>) => void,
  ): Subscription | null {
    if (!this.connection) {
      this.logger.warn('NatsService: subscribe skipped — no connection', { topic });
      return null;
    }
    const sub = this.connection.subscribe(topic);
    (async (): Promise<void> => {
      for await (const msg of sub) {
        try {
          const parsed = JSON.parse(sc.decode(msg.data)) as Record<string, unknown>;
          handler(parsed);
        } catch (err) {
          this.logger.error('NatsService: message parse error', err, { topic });
        }
      }
    })();
    return sub;
  }
}
