// FIZ: PAYLOAD-012 — Creator Points Bundles controller (CNZ dashboard)
// Surfaces the RRR bundle catalog + purchase action to the creator panel.
// Authorization: req.user.creatorId is set by the upstream auth middleware;
// consentConfirmed must be supplied by the dashboard's explicit-consent UI.

import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { RrrClientService } from './rrr-client.service';

interface AuthenticatedRequest {
  ip?: string;
  user?: { creatorId?: string };
}

interface PurchaseBundleBody {
  bundleId: string;
  consentConfirmed: boolean;
}

@Controller('points')
export class PointsController {
  constructor(private readonly rrrClient: RrrClientService) {}

  @Get('bundles')
  listBundles() {
    return { bundles: this.rrrClient.listBundles() };
  }

  @Post('purchase-bundle')
  async purchaseBundle(@Body() body: PurchaseBundleBody, @Req() req: AuthenticatedRequest) {
    const creatorId = req.user?.creatorId;
    if (!creatorId) {
      throw new Error('UNAUTHENTICATED: missing creator context');
    }
    return this.rrrClient.purchaseBundle(creatorId, body.bundleId, body.consentConfirmed, req.ip);
  }
}
