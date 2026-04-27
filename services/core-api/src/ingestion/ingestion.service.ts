// WO: WO-020
import { logger } from '../logger';

export interface IngestionPayload {
  sourceId: string;
  modelId: string;
  studioId: string;
  eventType: string;
  payload: Record<string, unknown>;
  correlationId: string;
}

export interface IngestionResult {
  correlationId: string;
  accepted: boolean;
  queuedAt: Date;
}

export class IngestionService {
  async ingest(data: IngestionPayload): Promise<IngestionResult> {
    const missing: string[] = [];
    if (!data.sourceId) missing.push('sourceId');
    if (!data.modelId) missing.push('modelId');
    if (!data.studioId) missing.push('studioId');
    if (!data.eventType) missing.push('eventType');
    if (data.payload == null) missing.push('payload');
    if (!data.correlationId) missing.push('correlationId');

    if (missing.length > 0) {
      const message = `ingest: invalid input — missing fields: ${missing.join(', ')}`;
      logger.error(message, undefined, {
        context: 'IngestionService',
        correlationId: data.correlationId,
      });
      throw new Error(message);
    }

    logger.info('ingest: payload accepted for backend processing', {
      context: 'IngestionService',
      correlationId: data.correlationId,
      sourceId: data.sourceId,
      modelId: data.modelId,
      studioId: data.studioId,
      eventType: data.eventType,
    });

    return {
      correlationId: data.correlationId,
      accepted: true,
      queuedAt: new Date(),
    };
  }
}
