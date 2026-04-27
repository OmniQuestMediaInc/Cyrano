// services/studio-affiliation/src/dto/studio.dto.ts
// RBAC-STUDIO-001 — request/response shapes for Studio + Affiliation APIs.

import type { Studio, StudioAffiliation } from '@prisma/client';

/** POST /studios/affiliate body. */
export interface AffiliateRequestDto {
  /** Creator id requesting affiliation. */
  creator_id: string;
  /**
   * Either `studio_name` (creates a new PENDING studio) OR
   * `existing_studio_id` (joins an existing studio as CREATOR role).
   */
  studio_name?: string;
  existing_studio_id?: string;
  /** Multi-tenant scoping (mandatory). */
  organization_id: string;
  tenant_id: string;
  /** Optional caller-supplied correlation_id; service generates one if absent. */
  correlation_id?: string;
}

export interface AffiliateResponseDto {
  studio: StudioPublic;
  affiliation: AffiliationPublic;
  affiliation_number: string;
  correlation_id: string;
  rule_applied_id: string;
}

/** PATCH /studios/:studio_id/activate body. */
export interface ActivateStudioRequestDto {
  /** Acting platform admin (audit). */
  actor_id: string;
  correlation_id?: string;
  reason?: string;
}

/** PATCH /studios/:studio_id/commission body — PLATFORM_ADMIN only. */
export interface SetCommissionRequestDto {
  actor_id: string;
  /** Decimal in [0, 1]; 0.25 == 25 %. */
  commission_rate: number;
  correlation_id?: string;
  reason?: string;
}

/** Public projection — strips audit columns from DB row. */
export interface StudioPublic {
  id: string;
  name: string;
  affiliation_number: string;
  status: Studio['status'];
  commission_rate: string; // Decimal serialised as string for JSON safety
  organization_id: string;
  tenant_id: string;
  created_at: string;
  updated_at: string;
}

export interface AffiliationPublic {
  id: string;
  studio_id: string;
  creator_id: string;
  role: StudioAffiliation['role'];
  status: StudioAffiliation['status'];
  joined_at: string;
}

export function toStudioPublic(row: Studio): StudioPublic {
  return {
    id: row.id,
    name: row.name,
    affiliation_number: row.affiliation_number,
    status: row.status,
    commission_rate: row.commission_rate.toString(),
    organization_id: row.organization_id,
    tenant_id: row.tenant_id,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

export function toAffiliationPublic(row: StudioAffiliation): AffiliationPublic {
  return {
    id: row.id,
    studio_id: row.studio_id,
    creator_id: row.creator_id,
    role: row.role,
    status: row.status,
    joined_at: row.joined_at.toISOString(),
  };
}
