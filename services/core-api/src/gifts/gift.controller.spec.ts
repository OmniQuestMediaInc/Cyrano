// Payload #13 — GiftController unit tests.
import { BadRequestException, HttpException } from '@nestjs/common';
import { GiftController, SendGiftRequestBody } from './gift.controller';
import { RrrClientError, RrrClientService, RrrRedeemGiftRequest } from './rrr-client.service';
import {
  findMicroGift,
  rrrPointsPriceFor,
  RRR_GIFT_COMMISSION_PCT,
} from '../config/governance.config';

function buildController(stub: Partial<RrrClientService> = {}): {
  controller: GiftController;
  client: RrrClientService;
  calls: RrrRedeemGiftRequest[];
} {
  const calls: RrrRedeemGiftRequest[] = [];
  const client = {
    redeemGift: jest.fn(async (payload: RrrRedeemGiftRequest) => {
      calls.push(payload);
      return {
        status: 'ACCEPTED' as const,
        burn_id: 'burn_xyz',
        rule_applied_id: 'RRR_BURN_GIFT_v1',
      };
    }),
    ...stub,
  } as unknown as RrrClientService;
  return { controller: new GiftController(client), client, calls };
}

const REQ_USER = { user: { creatorId: 'cnz_creator_42' } };

describe('GiftController.sendGift', () => {
  it('forwards a valid catalogue gift to RrrClientService with derived points price', async () => {
    const { controller, calls } = buildController();
    const body: SendGiftRequestBody = {
      giftId: 'rose',
      memberId: 'rrr_member_123',
      paymentMethod: 'TOKENS',
      anonymous: false,
      note: 'thank you!',
    };

    const result = await controller.sendGift(body, REQ_USER);

    const rose = findMicroGift('rose')!;
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      gift_id: 'rose',
      token_value: rose.token_value,
      member_id: 'rrr_member_123',
      creator_id: 'cnz_creator_42',
      payment_method: 'TOKENS',
      rrr_points_price: rrrPointsPriceFor(rose),
      anonymous: false,
      note: 'thank you!',
    });
    expect(calls[0].correlation_id).toMatch(/^CNZ_GIFT:cnz_creator_42:rrr_member_123:rose:/);
    expect(result).toMatchObject({
      status: 'ACCEPTED',
      gift_id: 'rose',
      creator_id: 'cnz_creator_42',
      payment_method: 'TOKENS',
      token_value: rose.token_value,
      rrr_points_price: rrrPointsPriceFor(rose),
      commission_pct: RRR_GIFT_COMMISSION_PCT,
    });
  });

  it('rejects an unknown giftId', async () => {
    const { controller } = buildController();
    await expect(
      controller.sendGift(
        { giftId: 'not_a_gift', memberId: 'm1' } as SendGiftRequestBody,
        REQ_USER,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a tokenValue that does not match the catalogue (tampered modal)', async () => {
    const { controller } = buildController();
    await expect(
      controller.sendGift(
        { giftId: 'rose', memberId: 'm1', tokenValue: 1 } as SendGiftRequestBody,
        REQ_USER,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects when creatorId is missing on the request', async () => {
    const { controller } = buildController();
    await expect(
      controller.sendGift(
        { giftId: 'rose', memberId: 'm1' } as SendGiftRequestBody,
        { user: undefined } as { user?: undefined },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an invalid paymentMethod', async () => {
    const { controller } = buildController();
    await expect(
      controller.sendGift(
        {
          giftId: 'rose',
          memberId: 'm1',
          paymentMethod: 'BITCOIN',
        } as unknown as SendGiftRequestBody,
        REQ_USER,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('translates a RrrClientError 409 into an HttpException with the same status', async () => {
    const stub = {
      redeemGift: jest.fn(async () => {
        throw new RrrClientError('rejected', 409, { reason: 'INSUFFICIENT_POINTS' });
      }),
    } as unknown as RrrClientService;
    const controller = new GiftController(stub);
    await expect(
      controller.sendGift(
        { giftId: 'rose', memberId: 'm1', paymentMethod: 'POINTS' } as SendGiftRequestBody,
        REQ_USER,
      ),
    ).rejects.toMatchObject({
      // HttpException carries `status` via getStatus() — assert via instanceOf below
    });
    try {
      await controller.sendGift(
        { giftId: 'rose', memberId: 'm1', paymentMethod: 'POINTS' } as SendGiftRequestBody,
        REQ_USER,
      );
    } catch (e) {
      expect(e).toBeInstanceOf(HttpException);
      expect((e as HttpException).getStatus()).toBe(409);
    }
  });

  it('honours an explicit correlationId from the client', async () => {
    const { controller, calls } = buildController();
    await controller.sendGift(
      {
        giftId: 'heart',
        memberId: 'rrr_member_9',
        correlationId: 'override-xyz',
      } as SendGiftRequestBody,
      REQ_USER,
    );
    expect(calls[0].correlation_id).toBe('override-xyz');
  });
});
