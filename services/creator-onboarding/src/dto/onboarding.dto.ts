// services/creator-onboarding/src/dto/onboarding.dto.ts
// RBAC-STUDIO-001 — onboarding API request/response shapes.

import type { CreatorOnboarding } from '@prisma/client';

export interface StartOnboardingDto {
  creator_id: string;
  /**
   * Either creator-supplied (joining an existing studio)…
   */
  affiliation_number?: string;
  /**
   * …or the studio name to create a new one.
   */
  new_studio_name?: string;
  /** Secondary email used for the verification code step. */
  secondary_email: string;
  organization_id: string;
  tenant_id: string;
  correlation_id?: string;
}

export interface StartOnboardingResponse {
  onboarding: OnboardingPublic;
  studio_id: string | null;
  affiliation_number: string | null;
  email_dispatch_id: string;
  email_blocked: boolean;
  email_block_reason: string | null;
  correlation_id: string;
  rule_applied_id: string;
}

export interface VerifyEmailDto {
  creator_id: string;
  /** 6-digit numeric code delivered by the prior email dispatch. */
  code: string;
  correlation_id?: string;
}

export interface VerifyEmailResponse {
  onboarding: OnboardingPublic;
  verified: boolean;
  reason: string | null;
}

export interface OnboardingPublic {
  id: string;
  creator_id: string;
  studio_id: string | null;
  affiliation_number: string | null;
  status: CreatorOnboarding['status'];
  secondary_email: string | null;
  email_verified_at: string | null;
  email_block_reason: string | null;
  created_at: string;
  updated_at: string;
}

export function toOnboardingPublic(row: CreatorOnboarding): OnboardingPublic {
  return {
    id: row.id,
    creator_id: row.creator_id,
    studio_id: row.studio_id,
    affiliation_number: row.affiliation_number,
    status: row.status,
    secondary_email: row.secondary_email,
    email_verified_at: row.email_verified_at?.toISOString() ?? null,
    email_block_reason: row.email_block_reason,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}
