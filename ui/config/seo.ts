// PAYLOAD 7 — SEO + canonical-branding metadata for ChatNow.Zone.
// Used by the Next.js head provider when the UI app bootstraps. Pure data —
// no runtime imports. Governance §12 banned-entity must NEVER appear in any
// of these strings.

export interface SeoMetadata {
  title: string;
  description: string;
  canonical_url: string;
  og_image: string;
  twitter_card: 'summary' | 'summary_large_image';
  robots: 'index,follow' | 'noindex,nofollow';
  keywords: readonly string[];
  jsonld?: Record<string, unknown>;
}

export const PRIMARY_DOMAIN = 'chatnow.zone';
export const COMPANY_NAME = 'OmniQuest Media Inc.';
export const COMPANY_SHORT = 'OQMInc';

const COMMON_KEYWORDS: readonly string[] = [
  'creator economy',
  'live streaming',
  'creator tools',
  'token economy',
  'ChatNow.Zone',
];

export const SEO: Record<string, SeoMetadata> = {
  home: {
    title: 'ChatNow.Zone — Live creator platform',
    description:
      'ChatNow.Zone is the OmniQuest Media Inc. live creator platform — token economy, FairPay payouts, and Black-Glass concierge for premium guests.',
    canonical_url: `https://${PRIMARY_DOMAIN}/`,
    og_image: `https://${PRIMARY_DOMAIN}/og/home.png`,
    twitter_card: 'summary_large_image',
    robots: 'index,follow',
    keywords: [...COMMON_KEYWORDS, 'home'],
  },
  tokens: {
    title: 'Token Bundles · ChatNow.Zone',
    description:
      'REDBOOK-locked token bundles and the Diamond Tier velocity quote — see exact pricing before you purchase.',
    canonical_url: `https://${PRIMARY_DOMAIN}/tokens`,
    og_image: `https://${PRIMARY_DOMAIN}/og/tokens.png`,
    twitter_card: 'summary_large_image',
    robots: 'index,follow',
    keywords: [...COMMON_KEYWORDS, 'tokens', 'pricing', 'bundles'],
  },
  diamond_purchase: {
    title: 'Diamond Tier Purchase · ChatNow.Zone',
    description:
      'Diamond Tier volume + velocity pricing with a $0.077 platform floor — secure, audited, and delivered with concierge support.',
    canonical_url: `https://${PRIMARY_DOMAIN}/diamond/purchase`,
    og_image: `https://${PRIMARY_DOMAIN}/og/diamond.png`,
    twitter_card: 'summary_large_image',
    robots: 'index,follow',
    keywords: [...COMMON_KEYWORDS, 'diamond tier', 'concierge', 'VIP'],
  },
  wallet: {
    title: 'Wallet · ChatNow.Zone',
    description:
      'Three-bucket wallet — purchased, membership, bonus. Spend order is system-enforced; safety-net controls for expiring balances.',
    canonical_url: `https://${PRIMARY_DOMAIN}/wallet`,
    og_image: `https://${PRIMARY_DOMAIN}/og/wallet.png`,
    twitter_card: 'summary',
    robots: 'noindex,nofollow', // authenticated route
    keywords: [...COMMON_KEYWORDS, 'wallet'],
  },
  creator_control: {
    title: 'CreatorControl.Zone · ChatNow.Zone',
    description:
      'CreatorControl single-pane workstation — Broadcast Timing Copilot, Session Monitoring, Cyrano™ whisper panel, Room-Heat meter and live payout indicator.',
    canonical_url: `https://${PRIMARY_DOMAIN}/creator/control`,
    og_image: `https://${PRIMARY_DOMAIN}/og/creator-control.png`,
    twitter_card: 'summary',
    robots: 'noindex,nofollow',
    keywords: [...COMMON_KEYWORDS, 'creator control', 'cyrano', 'broadcast timing'],
  },
  creator_gamification: {
    title: 'Gamification · CreatorControl · ChatNow.Zone',
    description:
      'Configure Wheel of Fortune, Slot Machine, and Dice — manage prize pools, price points, cooldowns, and per-game analytics.',
    canonical_url: `https://${PRIMARY_DOMAIN}/creator/gamification`,
    og_image: `https://${PRIMARY_DOMAIN}/og/creator-gamification.png`,
    twitter_card: 'summary',
    robots: 'noindex,nofollow',
    keywords: [...COMMON_KEYWORDS, 'gamification', 'prize pool', 'wheel of fortune', 'slots', 'dice'],
  },
  admin_diamond: {
    title: 'Diamond Concierge · Admin · ChatNow.Zone',
    description:
      'Diamond Concierge command center — liquidity, recovery flows, GateGuard telemetry, audit chain.',
    canonical_url: `https://${PRIMARY_DOMAIN}/admin/diamond`,
    og_image: `https://${PRIMARY_DOMAIN}/og/admin-diamond.png`,
    twitter_card: 'summary',
    robots: 'noindex,nofollow',
    keywords: [...COMMON_KEYWORDS, 'admin'],
  },
  admin_recovery: {
    title: 'CS Recovery · Admin · ChatNow.Zone',
    description:
      'Unified Customer Service recovery dashboard — Token Bridge, Three-Fifths Exit, expiration distribution, immutable audit.',
    canonical_url: `https://${PRIMARY_DOMAIN}/admin/recovery`,
    og_image: `https://${PRIMARY_DOMAIN}/og/admin-recovery.png`,
    twitter_card: 'summary',
    robots: 'noindex,nofollow',
    keywords: [...COMMON_KEYWORDS, 'admin', 'recovery'],
  },
  rewards_dashboard: {
    title: 'Red Room Rewards · ChatNow.Zone',
    description:
      'Earn points for every action — daily login, messages, voice calls, referrals. Spend them in the Burn Shop for extra images, Inferno access, and custom Twins.',
    canonical_url: `https://${PRIMARY_DOMAIN}/rewards`,
    og_image: `https://${PRIMARY_DOMAIN}/og/rewards.png`,
    twitter_card: 'summary_large_image',
    robots: 'noindex,nofollow', // authenticated route
    keywords: [...COMMON_KEYWORDS, 'rewards', 'points', 'gamification', 'burn shop'],
  },
  diamond_concierge: {
    title: 'Diamond Concierge · ChatNow.Zone',
    description:
      'Your personal Diamond Concierge — request custom experiences, private events, or ultra-personalized AI Twins. Exclusive to Inferno-tier subscribers.',
    canonical_url: `https://${PRIMARY_DOMAIN}/diamond/concierge`,
    og_image: `https://${PRIMARY_DOMAIN}/og/diamond-concierge.png`,
    twitter_card: 'summary',
    robots: 'noindex,nofollow', // authenticated route
    keywords: [...COMMON_KEYWORDS, 'diamond', 'concierge', 'inferno', 'VIP'],
  },
  cyrano_personas: {
    title: 'Persona Management · Cyrano™ · ChatNow.Zone',
    description:
      'Manage global, template, and custom Cyrano™ personas. Drag to reorder priority, publish tier-gated personas to eligible VIPs.',
    canonical_url: `https://${PRIMARY_DOMAIN}/creator/cyrano/personas`,
    og_image: `https://${PRIMARY_DOMAIN}/og/cyrano-personas.png`,
    twitter_card: 'summary',
    robots: 'noindex,nofollow', // authenticated creator route
    keywords: [...COMMON_KEYWORDS, 'cyrano', 'persona', 'creator tools'],
  },
  session_topup: {
    title: 'Session Top-Up · Cyrano™ · ChatNow.Zone',
    description:
      'Your Cyrano™ session has expired. Purchase additional time, voice, or narrative minutes and resume with full context restore.',
    canonical_url: `https://${PRIMARY_DOMAIN}/vip/session/topup`,
    og_image: `https://${PRIMARY_DOMAIN}/og/session-topup.png`,
    twitter_card: 'summary',
    robots: 'noindex,nofollow', // authenticated VIP route
    keywords: [...COMMON_KEYWORDS, 'cyrano', 'session', 'top-up', 'VIP'],
  ai_twin_dashboard: {
    title: 'AI Twin Creator Dashboard · ChatNow.Zone',
    description:
      'Train your photorealistic AI Twin — upload photos, fine-tune LoRA, test generation, and publish to subscribers. Creator-only. Powered by Cyrano™.',
    canonical_url: `https://${PRIMARY_DOMAIN}/ai-twin`,
    og_image: `https://${PRIMARY_DOMAIN}/og/ai-twin.png`,
    twitter_card: 'summary',
    robots: 'noindex,nofollow', // authenticated route
    keywords: [...COMMON_KEYWORDS, 'AI twin', 'LoRA', 'Cyrano', 'creator', 'photo upload'],
  },
  cyrano_session: {
    title: 'Cyrano Session · ChatNow.Zone',
    description:
      'Persistent voice and narrative role-play with your AI companion — memory bank, cinematic branching, and real-time haptic effects. VIP Members only.',
    canonical_url: `https://${PRIMARY_DOMAIN}/cyrano/session`,
    og_image: `https://${PRIMARY_DOMAIN}/og/cyrano-session.png`,
    twitter_card: 'summary',
    robots: 'noindex,nofollow', // authenticated route
    keywords: [...COMMON_KEYWORDS, 'Cyrano', 'AI companion', 'narrative', 'voice', 'VIP'],
  },
};

export function buildJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: COMPANY_NAME,
    legalName: COMPANY_NAME,
    alternateName: [COMPANY_SHORT, 'ChatNow.Zone'],
    url: `https://${PRIMARY_DOMAIN}`,
    foundingDate: '2026',
    sameAs: [`https://${PRIMARY_DOMAIN}`],
  };
}
