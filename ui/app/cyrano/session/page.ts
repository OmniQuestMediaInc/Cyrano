// CYR: /cyrano/session — Cyrano Session / Narrative Chat page.
// Character header (with tier badge), live chat window (branching choices),
// memory summary sidebar, voice call button, top-up minutes CTA,
// real-time NATS haptic + session events surface.
//
// Follows the render-plan convention: no JSX, no React runtime —
// structurally-testable RenderElement tree that maps 1:1 to eventual JSX.

import { SEO } from '../../../config/seo';
import { THEME } from '../../../config/theme';
import { el, RenderElement } from '../../../components/render-plan';
import type {
  ActiveBranchCard,
  ChatMessage,
  CyranoSessionPageInputs,
  CyranoSessionView,
  MemorySidebarEntry,
  SessionStatus,
  SessionTier,
  SessionWalletBucket,
  TierBadge,
  TopUpMinutesCta,
  VoiceCallButton,
} from '../../../types/cyrano-session-contracts';

export const CYRANO_SESSION_PAGE_RULE_ID = 'CYRANO_SESSION_PAGE_v1';

const TIER_BADGE_MAP: Record<SessionTier, TierBadge> = {
  SPARK: { tier: 'SPARK', label: 'Spark', css_class: 'cnz-tier-badge--spark' },
  FLAME: { tier: 'FLAME', label: 'Flame', css_class: 'cnz-tier-badge--flame' },
  INFERNO: { tier: 'INFERNO', label: 'Inferno', css_class: 'cnz-tier-badge--inferno' },
};

const TOP_UP_CTA_THRESHOLD_MINUTES = 5;

function buildView(inputs: CyranoSessionPageInputs): CyranoSessionView {
  const tierBadge = TIER_BADGE_MAP[inputs.tier];
  const isExpiring =
    inputs.session_status === 'ACTIVE' &&
    inputs.minutes_remaining <= TOP_UP_CTA_THRESHOLD_MINUTES;
  const effectiveStatus: SessionStatus =
    isExpiring && inputs.session_status === 'ACTIVE' ? 'EXPIRING' : inputs.session_status;

  const topUpCta: TopUpMinutesCta = {
    visible: effectiveStatus === 'EXPIRING' || effectiveStatus === 'EXPIRED',
    minutes_remaining: inputs.minutes_remaining,
    cta_label:
      effectiveStatus === 'EXPIRED'
        ? 'Top Up to Continue'
        : `Top Up — ${inputs.minutes_remaining} min left`,
    cta_disabled: false,
  };

  const voiceCall: VoiceCallButton = {
    available: inputs.voice_call_available ?? false,
    label: 'Voice Call',
    disabled_reason:
      inputs.voice_call_available
        ? null
        : effectiveStatus === 'EXPIRED'
          ? 'Session expired — top up to enable voice'
          : 'Voice call not available for this tier',
  };

  const defaultBuckets: SessionWalletBucket[] = inputs.wallet_buckets ?? [
    { bucket: 'purchased', label: 'Purchased', balance_tokens: '0', spend_priority: 1, will_drain_next: false },
    { bucket: 'membership', label: 'Membership', balance_tokens: '0', spend_priority: 2, will_drain_next: false },
    { bucket: 'bonus', label: 'Bonus', balance_tokens: '0', spend_priority: 3, will_drain_next: false },
  ];

  return {
    session_id: inputs.session_id,
    twin_id: inputs.twin_id,
    user_id: inputs.user_id,
    twin_display_name: inputs.twin_display_name,
    tier_badge: tierBadge,
    session_status: effectiveStatus,
    minutes_remaining: inputs.minutes_remaining,
    messages: inputs.messages ?? [],
    active_branch: inputs.active_branch ?? null,
    memory_sidebar: inputs.memory_sidebar ?? [],
    wallet_buckets: defaultBuckets,
    voice_call: voiceCall,
    top_up_cta: topUpCta,
    generated_at_utc: new Date().toISOString(),
    rule_applied_id: CYRANO_SESSION_PAGE_RULE_ID,
  };
}

export interface CyranoSessionPageRender {
  metadata: typeof SEO.cyrano_session;
  view: CyranoSessionView;
  tree: RenderElement;
  rule_applied_id: string;
}

export function renderCyranoSessionPage(
  inputs: CyranoSessionPageInputs,
): CyranoSessionPageRender {
  const view = buildView(inputs);

  const tree = el(
    'main',
    {
      test_id: 'cyrano-session-page',
      classes: ['cnz-cyrano-session', 'cnz-theme-dark'],
      props: {
        mode: THEME.default_mode,
        session_id: view.session_id,
        twin_id: view.twin_id,
      },
      aria: { 'aria-label': 'Cyrano Session' },
    },
    [
      renderCharacterHeader(view),
      renderSessionLayout(view),
      renderTopUpCta(view.top_up_cta, view.wallet_buckets),
    ],
  );

  return {
    metadata: SEO.cyrano_session,
    view,
    tree,
    rule_applied_id: CYRANO_SESSION_PAGE_RULE_ID,
  };
}

// ─── Section renderers ────────────────────────────────────────────────────────

function renderCharacterHeader(view: CyranoSessionView): RenderElement {
  const badge = view.tier_badge;
  return el(
    'header',
    {
      test_id: 'cyrano-session-character-header',
      classes: ['cnz-cyrano-session__header'],
    },
    [
      el('h1', { test_id: 'cyrano-session-twin-name' }, [view.twin_display_name]),
      el(
        'span',
        {
          test_id: 'cyrano-session-tier-badge',
          classes: ['cnz-tier-badge', badge.css_class],
          props: { tier: badge.tier },
        },
        [badge.label],
      ),
      el(
        'span',
        {
          test_id: 'cyrano-session-status-chip',
          classes: [
            'cnz-status-chip',
            `cnz-status-chip--session-${view.session_status.toLowerCase()}`,
          ],
          props: { session_status: view.session_status, minutes_remaining: view.minutes_remaining },
        },
        [
          view.session_status === 'EXPIRED'
            ? 'Expired'
            : view.session_status === 'EXPIRING'
              ? `${view.minutes_remaining} min — expiring soon`
              : view.session_status === 'IDLE'
                ? 'Not started'
                : `${view.minutes_remaining} min`,
        ],
      ),
      renderVoiceCallButton(view.voice_call, view.session_id),
    ],
  );
}

function renderVoiceCallButton(voice: VoiceCallButton, sessionId: string): RenderElement {
  return el(
    'button',
    {
      test_id: 'cyrano-session-voice-call-btn',
      classes: [
        'cnz-button',
        voice.available ? 'cnz-button--secondary' : 'cnz-button--disabled',
      ],
      on: { click: 'initiateVoiceCall' },
      props: {
        session_id: sessionId,
        disabled: !voice.available,
        disabled_reason: voice.disabled_reason ?? null,
      },
      aria: {
        'aria-label': voice.available ? 'Start voice call' : (voice.disabled_reason ?? 'Voice call unavailable'),
        'aria-disabled': voice.available ? 'false' : 'true',
      },
    },
    [voice.label],
  );
}

/** Two-column layout: main chat area + memory sidebar. */
function renderSessionLayout(view: CyranoSessionView): RenderElement {
  return el(
    'div',
    {
      test_id: 'cyrano-session-layout',
      classes: ['cnz-cyrano-session__layout'],
    },
    [
      renderChatArea(view),
      renderMemorySidebar(view.memory_sidebar),
    ],
  );
}

function renderChatArea(view: CyranoSessionView): RenderElement {
  return el(
    'section',
    {
      test_id: 'cyrano-session-chat-area',
      classes: ['cnz-cyrano-session__chat'],
      aria: { 'aria-label': 'Narrative chat window', 'aria-live': 'polite' },
    },
    [
      renderChatMessages(view.messages),
      view.active_branch ? renderBranchCard(view.active_branch) : null,
      renderChatInput(view.session_status, view.session_id),
    ].filter(Boolean) as RenderElement[],
  );
}

function renderChatMessages(messages: ChatMessage[]): RenderElement {
  if (messages.length === 0) {
    return el(
      'div',
      {
        test_id: 'cyrano-session-messages-empty',
        classes: ['cnz-chat__messages', 'cnz-chat__messages--empty'],
      },
      [el('p', {}, ['Begin your story…'])],
    );
  }

  return el(
    'div',
    {
      test_id: 'cyrano-session-messages',
      classes: ['cnz-chat__messages'],
      props: { count: messages.length },
    },
    messages.map((m) =>
      el(
        'article',
        {
          test_id: `cyrano-session-msg-${m.message_id}`,
          classes: [
            'cnz-chat__message',
            `cnz-chat__message--${m.role}`,
            m.is_haptic ? 'cnz-chat__message--haptic' : '',
          ].filter(Boolean),
          props: {
            message_id: m.message_id,
            role: m.role,
            is_haptic: m.is_haptic ?? false,
          },
        },
        [
          el('header', { classes: ['cnz-chat__message-header'] }, [
            el('strong', { classes: ['cnz-chat__role'] }, [m.role]),
            m.is_haptic
              ? el(
                  'span',
                  { classes: ['cnz-haptic-indicator'], aria: { 'aria-label': 'Haptic event' } },
                  ['⚡'],
                )
              : null,
            el(
              'time',
              {
                classes: ['cnz-chat__timestamp'],
                props: { datetime: m.timestamp_utc },
              },
              [m.timestamp_utc],
            ),
          ].filter(Boolean) as RenderElement[]),
          el('p', { classes: ['cnz-chat__content'] }, [m.content]),
        ],
      ),
    ),
  );
}

/** Cinematic branch choice card — surfaced in the chat when a branch is active. */
function renderBranchCard(branch: ActiveBranchCard): RenderElement {
  return el(
    'aside',
    {
      test_id: 'cyrano-session-branch-card',
      classes: [
        'cnz-branch-card',
        branch.status === 'RESOLVED' ? 'cnz-branch-card--resolved' : 'cnz-branch-card--pending',
      ],
      props: { branch_id: branch.branch_id, status: branch.status },
      aria: { 'aria-label': `Story branch: ${branch.branch_title}` },
    },
    [
      el('h3', { test_id: 'cyrano-session-branch-title' }, [branch.branch_title]),
      el('p', { test_id: 'cyrano-session-branch-prompt' }, [branch.decision_prompt]),
      branch.status === 'PENDING'
        ? el(
            'div',
            { classes: ['cnz-branch-card__options'] },
            branch.options.map((opt) =>
              el(
                'button',
                {
                  test_id: `cyrano-session-branch-option-${opt.option_key}`,
                  classes: ['cnz-button', 'cnz-button--branch-option'],
                  on: { click: 'resolveBranch' },
                  props: {
                    branch_id: branch.branch_id,
                    option_key: opt.option_key,
                  },
                },
                [
                  el('strong', {}, [opt.label]),
                  el('span', { classes: ['cnz-branch-card__hint'] }, [opt.consequence_hint]),
                ],
              ),
            ),
          )
        : el(
            'p',
            {
              test_id: 'cyrano-session-branch-resolved',
              classes: ['cnz-branch-card__resolved-note'],
            },
            ['Branch resolved — story continues.'],
          ),
    ],
  );
}

function renderChatInput(status: SessionStatus, sessionId: string): RenderElement {
  const inputDisabled = status === 'EXPIRED';
  return el(
    'form',
    {
      test_id: 'cyrano-session-chat-input-form',
      classes: ['cnz-chat__input-row'],
      on: { submit: 'sendMessage' },
      props: { session_id: sessionId },
    },
    [
      el(
        'textarea',
        {
          test_id: 'cyrano-session-chat-input',
          classes: [
            'cnz-chat__input',
            inputDisabled ? 'cnz-chat__input--disabled' : '',
          ].filter(Boolean),
          props: {
            disabled: inputDisabled,
            placeholder: inputDisabled ? 'Session expired — top up to continue' : 'Continue the story…',
          },
          aria: { 'aria-label': 'Message input', 'aria-disabled': inputDisabled ? 'true' : 'false' },
        },
        [],
      ),
      el(
        'button',
        {
          test_id: 'cyrano-session-send-btn',
          classes: [
            'cnz-button',
            inputDisabled ? 'cnz-button--disabled' : 'cnz-button--primary',
          ],
          props: { type: 'submit', disabled: inputDisabled },
        },
        ['Send'],
      ),
    ],
  );
}

function renderMemorySidebar(entries: MemorySidebarEntry[]): RenderElement {
  if (entries.length === 0) {
    return el(
      'aside',
      {
        test_id: 'cyrano-session-memory-sidebar',
        classes: ['cnz-cyrano-session__sidebar', 'cnz-cyrano-session__sidebar--empty'],
        aria: { 'aria-label': 'Memory summary sidebar' },
      },
      [el('p', {}, ['No memories yet.'])],
    );
  }

  return el(
    'aside',
    {
      test_id: 'cyrano-session-memory-sidebar',
      classes: ['cnz-cyrano-session__sidebar'],
      aria: { 'aria-label': 'Memory summary sidebar' },
    },
    [
      el('h2', {}, [`Memories (${entries.length})`]),
      el(
        'ul',
        { classes: ['cnz-memory-sidebar__list'] },
        entries.map((e) =>
          el(
            'li',
            {
              test_id: `cyrano-session-memory-${e.memory_id}`,
              classes: ['cnz-memory-sidebar__item'],
              props: {
                memory_id: e.memory_id,
                memory_type: e.memory_type,
                importance_score: e.importance_score,
              },
            },
            [
              el(
                'span',
                { classes: ['cnz-memory-sidebar__type-chip'] },
                [e.memory_type],
              ),
              el('p', { classes: ['cnz-memory-sidebar__preview'] }, [e.content_preview]),
            ],
          ),
        ),
      ),
    ],
  );
}

/** Top-up CTA with three-bucket wallet breakdown. Surfaces when expiring or expired. */
function renderTopUpCta(cta: TopUpMinutesCta, buckets: SessionWalletBucket[]): RenderElement {
  if (!cta.visible) {
    return el(
      'div',
      {
        test_id: 'cyrano-session-topup-cta',
        classes: ['cnz-topup-cta', 'cnz-topup-cta--hidden'],
        aria: { 'aria-hidden': 'true' },
      },
      [],
    );
  }

  return el(
    'section',
    {
      test_id: 'cyrano-session-topup-cta',
      classes: ['cnz-topup-cta', 'cnz-topup-cta--visible'],
      aria: { 'aria-label': 'Top up session minutes', 'aria-live': 'assertive' },
    },
    [
      el('h2', {}, ['Top Up Minutes']),
      el(
        'p',
        {
          test_id: 'cyrano-session-topup-minutes-label',
          props: { minutes_remaining: cta.minutes_remaining },
        },
        [
          cta.minutes_remaining === 0
            ? 'Session has ended. Top up to continue the story.'
            : `${cta.minutes_remaining} minute${cta.minutes_remaining === 1 ? '' : 's'} remaining.`,
        ],
      ),
      el(
        'div',
        {
          test_id: 'cyrano-session-wallet-buckets',
          classes: ['cnz-wallet-buckets'],
          aria: { 'aria-label': 'Wallet buckets' },
        },
        buckets.map((b) =>
          el(
            'div',
            {
              test_id: `cyrano-session-wallet-bucket-${b.bucket}`,
              classes: [
                'cnz-wallet-buckets__item',
                b.will_drain_next ? 'cnz-wallet-buckets__item--draining' : '',
              ].filter(Boolean),
              props: {
                bucket: b.bucket,
                spend_priority: b.spend_priority,
                will_drain_next: b.will_drain_next,
              },
            },
            [
              el('span', { classes: ['cnz-wallet-buckets__label'] }, [b.label]),
              el('span', { classes: ['cnz-wallet-buckets__balance'] }, [`${b.balance_tokens} CZT`]),
            ],
          ),
        ),
      ),
      el(
        'button',
        {
          test_id: 'cyrano-session-topup-btn',
          classes: [
            'cnz-button',
            cta.cta_disabled ? 'cnz-button--disabled' : 'cnz-button--primary',
          ],
          on: { click: 'openTopUp' },
          props: { disabled: cta.cta_disabled },
        },
        [cta.cta_label],
      ),
    ],
  );
}
