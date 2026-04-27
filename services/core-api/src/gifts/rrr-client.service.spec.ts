// Payload #13 — RrrClientService unit tests.
import {
  RRR_BURN_GIFT_RULE_ID,
  RrrClientError,
  RrrClientService,
  RrrRedeemGiftRequest,
} from './rrr-client.service';

function buildRequest(overrides: Partial<RrrRedeemGiftRequest> = {}): RrrRedeemGiftRequest {
  return {
    gift_id: 'rose',
    token_value: 5,
    member_id: 'rrr_member_123',
    creator_id: 'cnz_creator_42',
    payment_method: 'TOKENS',
    rrr_points_price: 50,
    anonymous: false,
    correlation_id: 'CNZ_GIFT:cnz_creator_42:rrr_member_123:rose:1700000000000',
    ...overrides,
  };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('RrrClientService', () => {
  let service: RrrClientService;

  beforeEach(() => {
    service = new RrrClientService();
  });

  it('POSTs to the configured RRR base URL with idempotency + signing headers', async () => {
    const seen: { url: string; init: RequestInit } = { url: '', init: {} };
    service.fetchImpl = async (input, init) => {
      seen.url = String(input);
      seen.init = init ?? {};
      return jsonResponse(200, { status: 'ACCEPTED', burn_id: 'burn_abc' });
    };
    process.env.RRR_API_BASE_URL = 'https://rrr.test.example';
    process.env.RRR_API_KEY = 'test-secret';

    const result = await service.redeemGift(buildRequest());

    expect(seen.url).toBe('https://rrr.test.example/api/v1/burn/gift');
    const headers = seen.init.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('test-secret');
    expect(headers['x-source-system']).toBe('CNZ');
    expect(headers['x-rule-applied-id']).toBe(RRR_BURN_GIFT_RULE_ID);
    expect(headers['x-idempotency-key']).toBe(
      'CNZ_GIFT:cnz_creator_42:rrr_member_123:rose:1700000000000',
    );
    expect(JSON.parse(seen.init.body as string)).toMatchObject({
      gift_id: 'rose',
      member_id: 'rrr_member_123',
      payment_method: 'TOKENS',
      rrr_points_price: 50,
    });
    expect(result.status).toBe('ACCEPTED');
    expect(result.burn_id).toBe('burn_abc');
    expect(result.rule_applied_id).toBe(RRR_BURN_GIFT_RULE_ID);
    delete process.env.RRR_API_BASE_URL;
    delete process.env.RRR_API_KEY;
  });

  it('falls back to the default production URL when env is unset', async () => {
    delete process.env.RRR_API_BASE_URL;
    let seenUrl = '';
    service.fetchImpl = async (input) => {
      seenUrl = String(input);
      return jsonResponse(200, { status: 'ACCEPTED' });
    };
    await service.redeemGift(buildRequest());
    expect(seenUrl).toBe('https://redroomrewards.omniquestmedia.com/api/v1/burn/gift');
  });

  it('throws RrrClientError on non-2xx response with the upstream body attached', async () => {
    service.fetchImpl = async () =>
      jsonResponse(409, { status: 'REJECTED', reason: 'INSUFFICIENT_POINTS' });
    await expect(
      service.redeemGift(buildRequest({ payment_method: 'POINTS' })),
    ).rejects.toMatchObject({
      name: 'RrrClientError',
      status: 409,
      remoteBody: { status: 'REJECTED', reason: 'INSUFFICIENT_POINTS' },
    });
  });

  it('throws RrrClientError on network failure', async () => {
    service.fetchImpl = async () => {
      throw new Error('ECONNRESET');
    };
    await expect(service.redeemGift(buildRequest())).rejects.toBeInstanceOf(RrrClientError);
  });

  it('treats a non-JSON 200 body as ACCEPTED with default rule id', async () => {
    service.fetchImpl = async () => new Response('', { status: 200 });
    const r = await service.redeemGift(buildRequest());
    expect(r.status).toBe('ACCEPTED');
    expect(r.rule_applied_id).toBe(RRR_BURN_GIFT_RULE_ID);
  });
});
