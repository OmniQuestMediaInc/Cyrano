// services/creator-onboarding/src/email-domain.policy.ts
// RBAC-STUDIO-001 — block-list of "studio" email domains that creators
// must NOT use as their primary or secondary email when joining the
// platform as an independent creator. This prevents creators from being
// silently routed to a studio's mailbox for verification.
//
// The list is intentionally code-driven for the MVP; a follow-up will
// move it to a DB table editable by PLATFORM_ADMIN. Today the list
// matches the publicly-known operator domains in the ecosystem.

export const STUDIO_EMAIL_DOMAINS = new Set<string>([
  // Generic studio aggregators / placeholder domains. Extend as needed.
  'studio.example',
  'creator-studio.example',
  'modelhub.example',
]);

export interface DomainCheckResult {
  blocked: boolean;
  domain: string | null;
  reason: 'STUDIO_DOMAIN_BLOCKED' | 'INVALID_EMAIL' | null;
}

/**
 * True if the host part of `email` is in the blocked set. Case-insensitive,
 * trims whitespace. Subdomains of a blocked apex domain are also blocked
 * (e.g. "mail.studio.example" is blocked when "studio.example" is listed).
 */
export function checkEmailDomain(email: string): DomainCheckResult {
  if (typeof email !== 'string' || !email.includes('@')) {
    return { blocked: false, domain: null, reason: 'INVALID_EMAIL' };
  }
  const host = email.split('@')[1].trim().toLowerCase();
  if (!host) {
    return { blocked: false, domain: null, reason: 'INVALID_EMAIL' };
  }
  for (const blocked of STUDIO_EMAIL_DOMAINS) {
    if (host === blocked || host.endsWith(`.${blocked}`)) {
      return { blocked: true, domain: host, reason: 'STUDIO_DOMAIN_BLOCKED' };
    }
  }
  return { blocked: false, domain: host, reason: null };
}
