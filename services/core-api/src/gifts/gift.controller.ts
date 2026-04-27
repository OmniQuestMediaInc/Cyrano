// Payload #13 — CNZ × RedRoomRewards micro-gift integration
// GiftController: accepts a /gifts/send POST from a creator-room client,
// validates the catalogue entry, and forwards the burn to RRR via
// RrrClientService.
//
// Auth:
//   • Inherits the global request shape — req.user.creatorId is populated
//     by upstream auth middleware (mirrors the pattern already used in
//     ZoneAccessGuard).
//   • The body's `member_id` identifies the sender's RRR account.
//
// Doctrine:
//   • The controller never invents prices; it always re-derives the RRR
//     points cost from the canonical MICRO_GIFTS catalogue + commission.
//     A client-supplied `tokenValue` that doesn't match the catalogue is
//     rejected (defence against a tampered modal).
import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  HttpException,
  Logger,
  Post,
  Req,
} from '@nestjs/common';
import {
  findMicroGift,
  rrrPointsPriceFor,
  RRR_GIFT_COMMISSION_PCT,
} from '../config/governance.config';
import {
  RrrClientError,
  RrrClientService,
  RrrPaymentMethod,
  RrrRedeemGiftResponse,
} from './rrr-client.service';

export interface SendGiftRequestBody {
  giftId: string;
  /** Sanity-check echo from the client — must match the catalogue. */
  tokenValue?: number;
  memberId: string;
  paymentMethod?: RrrPaymentMethod;
  anonymous?: boolean;
  note?: string;
  /** Optional override; otherwise we synthesise one. */
  correlationId?: string;
}

export interface SendGiftResponse extends RrrRedeemGiftResponse {
  gift_id: string;
  creator_id: string;
  payment_method: RrrPaymentMethod;
  token_value: number;
  rrr_points_price: number;
  commission_pct: number;
  correlation_id: string;
}

const SEND_GIFT_RULE_ID = 'CNZ_GIFT_SEND_v1';

@Controller('gifts')
export class GiftController {
  private readonly logger = new Logger(GiftController.name);

  constructor(private readonly rrrClient: RrrClientService) {}

  @Post('send')
  @HttpCode(HttpStatus.OK)
  async sendGift(
    @Body() body: SendGiftRequestBody,
    @Req() req: { user?: { creatorId?: string; id?: string } },
  ): Promise<SendGiftResponse> {
    const creatorId = req.user?.creatorId ?? req.user?.id;
    if (!creatorId) {
      throw new BadRequestException('AUTH_REQUIRED: creatorId missing on request');
    }
    if (!body || typeof body.giftId !== 'string' || body.giftId.trim().length === 0) {
      throw new BadRequestException('giftId is required');
    }
    if (typeof body.memberId !== 'string' || body.memberId.trim().length === 0) {
      throw new BadRequestException('memberId is required');
    }

    const gift = findMicroGift(body.giftId);
    if (!gift) {
      throw new BadRequestException(`Unknown giftId: ${body.giftId}`);
    }

    if (typeof body.tokenValue === 'number' && body.tokenValue !== gift.token_value) {
      throw new BadRequestException(
        `tokenValue mismatch for giftId=${gift.gift_id}: expected ${gift.token_value}`,
      );
    }

    const paymentMethod: RrrPaymentMethod = body.paymentMethod ?? 'TOKENS';
    if (paymentMethod !== 'TOKENS' && paymentMethod !== 'POINTS') {
      throw new BadRequestException(`Invalid paymentMethod: ${String(paymentMethod)}`);
    }

    const rrrPointsPrice = rrrPointsPriceFor(gift);
    const correlationId =
      body.correlationId?.trim() ||
      `CNZ_GIFT:${creatorId}:${body.memberId}:${gift.gift_id}:${Date.now()}`;

    this.logger.log('GiftController.sendGift: forwarding to RRR', {
      creator_id: creatorId,
      member_id: body.memberId,
      gift_id: gift.gift_id,
      payment_method: paymentMethod,
      token_value: gift.token_value,
      rrr_points_price: rrrPointsPrice,
      correlation_id: correlationId,
      rule_applied_id: SEND_GIFT_RULE_ID,
    });

    let result: RrrRedeemGiftResponse;
    try {
      result = await this.rrrClient.redeemGift({
        gift_id: gift.gift_id,
        token_value: gift.token_value,
        member_id: body.memberId,
        creator_id: creatorId,
        payment_method: paymentMethod,
        rrr_points_price: rrrPointsPrice,
        anonymous: body.anonymous ?? false,
        note: body.note,
        correlation_id: correlationId,
      });
    } catch (err) {
      if (err instanceof RrrClientError) {
        const status = err.status >= 400 && err.status < 600 ? err.status : HttpStatus.BAD_GATEWAY;
        throw new HttpException({ message: err.message, remote: err.remoteBody ?? null }, status);
      }
      throw err;
    }

    return {
      ...result,
      gift_id: gift.gift_id,
      creator_id: creatorId,
      payment_method: paymentMethod,
      token_value: gift.token_value,
      rrr_points_price: rrrPointsPrice,
      commission_pct: RRR_GIFT_COMMISSION_PCT,
      correlation_id: correlationId,
    };
  }
}
