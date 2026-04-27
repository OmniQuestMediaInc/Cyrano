// Payload #13 — CNZ × RedRoomRewards micro-gift integration
// RrrClientService: thin HTTP client that calls the RedRoomRewards burn-gift
// endpoint when a CNZ user redeems a gift in points (or, via the
// `payment_method` flag, debits CZT tokens with RRR mirroring the burn).
//
// Doctrine notes:
//   • No third-party HTTP library — Node 20+ ships fetch natively, and the
//     repo intentionally avoids @nestjs/axios.
//   • Base URL + signing secret are read from env. Defaults match the
//     production endpoint specified in Payload #13.
//   • Failures bubble up as a typed RrrClientError; callers translate to
//     HTTP status. The controller never swallows a burn failure silently —
//     the user must see the redemption fail.
import { Injectable, Logger } from '@nestjs/common';

export const RRR_BURN_GIFT_RULE_ID = 'RRR_BURN_GIFT_v1';

const DEFAULT_BASE_URL = 'https://redroomrewards.omniquestmedia.com';
const DEFAULT_TIMEOUT_MS = 5_000;

export type RrrPaymentMethod = 'TOKENS' | 'POINTS';

export interface RrrRedeemGiftRequest {
  gift_id: string;
  /** Token cost in CZT (always supplied so RRR can mirror the burn ledger). */
  token_value: number;
  /** RRR member id of the *sender*. */
  member_id: string;
  /** CNZ creator id receiving the gift. */
  creator_id: string;
  /** Currency the sender chose at the modal. */
  payment_method: RrrPaymentMethod;
  /** Quoted RRR point price including the cross-redemption commission. */
  rrr_points_price: number;
  anonymous: boolean;
  note?: string;
  /** Idempotency key — RRR de-dupes burns server-side using this value. */
  correlation_id: string;
}

export interface RrrRedeemGiftResponse {
  status: 'ACCEPTED' | 'REJECTED';
  burn_id?: string;
  reason?: string;
  rule_applied_id: string;
}

export class RrrClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly remoteBody?: unknown,
  ) {
    super(message);
    this.name = 'RrrClientError';
  }
}

@Injectable()
export class RrrClientService {
  private readonly logger = new Logger(RrrClientService.name);

  /** Override hook for tests — defaults to the global `fetch`. */
  public fetchImpl: typeof fetch = (input, init) => fetch(input, init);

  async redeemGift(payload: RrrRedeemGiftRequest): Promise<RrrRedeemGiftResponse> {
    const baseUrl = process.env.RRR_API_BASE_URL ?? DEFAULT_BASE_URL;
    const apiKey = process.env.RRR_API_KEY ?? '';
    const url = `${baseUrl.replace(/\/$/, '')}/api/v1/burn/gift`;
    const timeoutMs =
      Number(process.env.RRR_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    this.logger.log('RrrClientService.redeemGift: dispatching burn', {
      gift_id: payload.gift_id,
      payment_method: payload.payment_method,
      correlation_id: payload.correlation_id,
      rule_applied_id: RRR_BURN_GIFT_RULE_ID,
    });

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'x-idempotency-key': payload.correlation_id,
          'x-source-system': 'CNZ',
          'x-rule-applied-id': RRR_BURN_GIFT_RULE_ID,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (err) {
      const message =
        (err as Error)?.name === 'AbortError'
          ? `RRR burn request timed out after ${timeoutMs}ms`
          : `RRR burn request failed: ${(err as Error)?.message ?? 'unknown'}`;
      this.logger.error(message, { correlation_id: payload.correlation_id });
      throw new RrrClientError(message, 0);
    } finally {
      clearTimeout(timer);
    }

    const text = await response.text();
    let body: unknown;
    try {
      body = text.length === 0 ? null : JSON.parse(text);
    } catch {
      body = text;
    }

    if (!response.ok) {
      this.logger.warn('RrrClientService.redeemGift: non-2xx from RRR', {
        status: response.status,
        correlation_id: payload.correlation_id,
      });
      throw new RrrClientError(
        `RRR burn rejected (HTTP ${response.status})`,
        response.status,
        body,
      );
    }

    const parsed = (body ?? {}) as Partial<RrrRedeemGiftResponse>;
    return {
      status: parsed.status ?? 'ACCEPTED',
      burn_id: parsed.burn_id,
      reason: parsed.reason,
      rule_applied_id: parsed.rule_applied_id ?? RRR_BURN_GIFT_RULE_ID,
    };
  }
}
