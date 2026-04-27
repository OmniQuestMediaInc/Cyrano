// FIZ: PAYLOAD-012 — RedRoom Rewards client (CNZ → RRR bridge)
// Thin in-process bridge from the CNZ creator dashboard to the RRR
// PointsPurchaseService. In a separated-deployment topology this becomes an
// HTTP/gRPC client; the contract here is identical so callers don't change.

import { Injectable } from '@nestjs/common';
import {
  PointsPurchaseService,
  type PointsPurchaseResult,
} from '../../../rewards-api/src/services/points-purchase.service';
import {
  POINTS_BUNDLES,
  type PointsBundle,
} from '../../../rewards-api/src/interfaces/redroom-rewards';

@Injectable()
export class RrrClientService {
  constructor(private readonly points: PointsPurchaseService) {}

  listBundles(): readonly PointsBundle[] {
    return POINTS_BUNDLES;
  }

  purchaseBundle(
    creatorId: string,
    bundleId: string,
    consentConfirmed: boolean,
    consentIp?: string,
  ): Promise<PointsPurchaseResult> {
    return this.points.purchaseBundle(creatorId, bundleId, consentConfirmed, consentIp);
  }
}
