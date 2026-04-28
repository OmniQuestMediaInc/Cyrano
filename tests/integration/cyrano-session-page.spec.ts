// CYR: Cyrano Session / Narrative Chat page — render-plan test suite.

import {
  renderCyranoSessionPage,
  CYRANO_SESSION_PAGE_RULE_ID,
} from '../../ui/app/cyrano/session/page';
import { findByTestId, collectTestIds } from '../../ui/components/render-plan';
import type { CyranoSessionPageInputs } from '../../ui/types/cyrano-session-contracts';

const MINIMAL_INPUTS: CyranoSessionPageInputs = {
  session_id: 'sess_001',
  twin_id: 'twin_001',
  user_id: 'user_42',
  twin_display_name: 'Nova',
  tier: 'FLAME',
  session_status: 'ACTIVE',
  minutes_remaining: 30,
};

describe('renderCyranoSessionPage', () => {
  it('returns the correct rule_applied_id', () => {
    const { rule_applied_id } = renderCyranoSessionPage(MINIMAL_INPUTS);
    expect(rule_applied_id).toBe(CYRANO_SESSION_PAGE_RULE_ID);
  });

  it('renders the main page node with test_id', () => {
    const { tree } = renderCyranoSessionPage(MINIMAL_INPUTS);
    expect(tree.test_id).toBe('cyrano-session-page');
    expect(tree.classes).toContain('cnz-cyrano-session');
    expect(tree.classes).toContain('cnz-theme-dark');
    expect(tree.props?.session_id).toBe('sess_001');
  });

  describe('character header', () => {
    it('renders twin name', () => {
      const { tree } = renderCyranoSessionPage(MINIMAL_INPUTS);
      const name = findByTestId(tree, 'cyrano-session-twin-name');
      expect(name).toBeDefined();
      expect(name!.children).toContain('Nova');
    });

    it('renders the tier badge with correct class for FLAME', () => {
      const { tree } = renderCyranoSessionPage(MINIMAL_INPUTS);
      const badge = findByTestId(tree, 'cyrano-session-tier-badge');
      expect(badge).toBeDefined();
      expect(badge!.classes).toContain('cnz-tier-badge--flame');
      expect(badge!.props?.tier).toBe('FLAME');
    });

    it('renders INFERNO tier badge', () => {
      const { tree } = renderCyranoSessionPage({ ...MINIMAL_INPUTS, tier: 'INFERNO' });
      const badge = findByTestId(tree, 'cyrano-session-tier-badge');
      expect(badge!.classes).toContain('cnz-tier-badge--inferno');
    });

    it('renders SPARK tier badge', () => {
      const { tree } = renderCyranoSessionPage({ ...MINIMAL_INPUTS, tier: 'SPARK' });
      const badge = findByTestId(tree, 'cyrano-session-tier-badge');
      expect(badge!.classes).toContain('cnz-tier-badge--spark');
    });

    it('renders session status chip with minutes', () => {
      const { tree } = renderCyranoSessionPage(MINIMAL_INPUTS);
      const chip = findByTestId(tree, 'cyrano-session-status-chip');
      expect(chip).toBeDefined();
      expect(chip!.props?.minutes_remaining).toBe(30);
    });

    it('renders voice call button', () => {
      const { tree } = renderCyranoSessionPage(MINIMAL_INPUTS);
      const btn = findByTestId(tree, 'cyrano-session-voice-call-btn');
      expect(btn).toBeDefined();
    });

    it('marks voice call disabled when voice_call_available=false', () => {
      const { tree } = renderCyranoSessionPage({
        ...MINIMAL_INPUTS,
        voice_call_available: false,
      });
      const btn = findByTestId(tree, 'cyrano-session-voice-call-btn');
      expect(btn!.props?.disabled).toBe(true);
      expect(btn!.classes).toContain('cnz-button--disabled');
    });

    it('marks voice call enabled when voice_call_available=true', () => {
      const { tree } = renderCyranoSessionPage({
        ...MINIMAL_INPUTS,
        voice_call_available: true,
      });
      const btn = findByTestId(tree, 'cyrano-session-voice-call-btn');
      expect(btn!.props?.disabled).toBe(false);
      expect(btn!.classes).toContain('cnz-button--secondary');
    });
  });

  describe('chat area', () => {
    it('renders empty state when no messages', () => {
      const { tree } = renderCyranoSessionPage(MINIMAL_INPUTS);
      const empty = findByTestId(tree, 'cyrano-session-messages-empty');
      expect(empty).toBeDefined();
    });

    it('renders messages when provided', () => {
      const { tree } = renderCyranoSessionPage({
        ...MINIMAL_INPUTS,
        messages: [
          { message_id: 'msg_1', role: 'twin', content: 'Hello!', timestamp_utc: '2026-04-28T10:00:00Z' },
          { message_id: 'msg_2', role: 'user', content: 'Hi there', timestamp_utc: '2026-04-28T10:00:05Z' },
        ],
      });
      expect(findByTestId(tree, 'cyrano-session-msg-msg_1')).toBeDefined();
      expect(findByTestId(tree, 'cyrano-session-msg-msg_2')).toBeDefined();
      expect(findByTestId(tree, 'cyrano-session-messages-empty')).toBeUndefined();
    });

    it('applies haptic indicator class for haptic messages', () => {
      const { tree } = renderCyranoSessionPage({
        ...MINIMAL_INPUTS,
        messages: [
          {
            message_id: 'msg_haptic',
            role: 'twin',
            content: 'Heat!',
            timestamp_utc: '2026-04-28T10:00:00Z',
            is_haptic: true,
          },
        ],
      });
      const msg = findByTestId(tree, 'cyrano-session-msg-msg_haptic');
      expect(msg!.classes).toContain('cnz-chat__message--haptic');
      expect(msg!.props?.is_haptic).toBe(true);
    });

    it('renders chat input form', () => {
      const { tree } = renderCyranoSessionPage(MINIMAL_INPUTS);
      const form = findByTestId(tree, 'cyrano-session-chat-input-form');
      expect(form).toBeDefined();
      expect(form!.props?.session_id).toBe('sess_001');
    });

    it('disables chat input when session is EXPIRED', () => {
      const { tree } = renderCyranoSessionPage({
        ...MINIMAL_INPUTS,
        session_status: 'EXPIRED',
        minutes_remaining: 0,
      });
      const input = findByTestId(tree, 'cyrano-session-chat-input');
      expect(input!.props?.disabled).toBe(true);

      const sendBtn = findByTestId(tree, 'cyrano-session-send-btn');
      expect(sendBtn!.classes).toContain('cnz-button--disabled');
    });
  });

  describe('active branch card', () => {
    it('does not render branch card when no active branch', () => {
      const { tree } = renderCyranoSessionPage(MINIMAL_INPUTS);
      expect(findByTestId(tree, 'cyrano-session-branch-card')).toBeUndefined();
    });

    it('renders branch card with options when branch is pending', () => {
      const { tree } = renderCyranoSessionPage({
        ...MINIMAL_INPUTS,
        active_branch: {
          branch_id: 'branch_001',
          branch_title: 'The Crossroads',
          decision_prompt: 'What do you choose?',
          options: [
            { option_key: 'A', label: 'Go left', consequence_hint: 'Into the unknown…' },
            { option_key: 'B', label: 'Go right', consequence_hint: 'Familiar territory…' },
          ],
          status: 'PENDING',
        },
      });
      const card = findByTestId(tree, 'cyrano-session-branch-card');
      expect(card).toBeDefined();
      expect(card!.classes).toContain('cnz-branch-card--pending');
      expect(card!.props?.branch_id).toBe('branch_001');

      const title = findByTestId(tree, 'cyrano-session-branch-title');
      expect(title!.children).toContain('The Crossroads');

      expect(findByTestId(tree, 'cyrano-session-branch-option-A')).toBeDefined();
      expect(findByTestId(tree, 'cyrano-session-branch-option-B')).toBeDefined();
    });

    it('renders resolved note when branch is resolved', () => {
      const { tree } = renderCyranoSessionPage({
        ...MINIMAL_INPUTS,
        active_branch: {
          branch_id: 'branch_002',
          branch_title: 'The Offer',
          decision_prompt: 'Accept?',
          options: [],
          status: 'RESOLVED',
        },
      });
      const card = findByTestId(tree, 'cyrano-session-branch-card');
      expect(card!.classes).toContain('cnz-branch-card--resolved');
      expect(findByTestId(tree, 'cyrano-session-branch-resolved')).toBeDefined();
      expect(findByTestId(tree, 'cyrano-session-branch-option-A')).toBeUndefined();
    });
  });

  describe('memory sidebar', () => {
    it('renders empty sidebar when no memories', () => {
      const { tree } = renderCyranoSessionPage(MINIMAL_INPUTS);
      const sidebar = findByTestId(tree, 'cyrano-session-memory-sidebar');
      expect(sidebar).toBeDefined();
      expect(sidebar!.classes).toContain('cnz-cyrano-session__sidebar--empty');
    });

    it('renders memory entries when present', () => {
      const { tree } = renderCyranoSessionPage({
        ...MINIMAL_INPUTS,
        memory_sidebar: [
          { memory_id: 'mem_1', memory_type: 'FACT', content_preview: 'Coffee lover', importance_score: 0.7 },
          { memory_id: 'mem_2', memory_type: 'SECRET', content_preview: 'A confession…', importance_score: 1.0 },
        ],
      });
      const sidebar = findByTestId(tree, 'cyrano-session-memory-sidebar');
      expect(sidebar!.classes).not.toContain('cnz-cyrano-session__sidebar--empty');
      expect(findByTestId(tree, 'cyrano-session-memory-mem_1')).toBeDefined();
      expect(findByTestId(tree, 'cyrano-session-memory-mem_2')).toBeDefined();
    });
  });

  describe('top-up CTA', () => {
    it('hides top-up CTA when session is ACTIVE with plenty of time', () => {
      const { tree } = renderCyranoSessionPage({ ...MINIMAL_INPUTS, minutes_remaining: 30 });
      const cta = findByTestId(tree, 'cyrano-session-topup-cta');
      expect(cta).toBeDefined();
      expect(cta!.classes).toContain('cnz-topup-cta--hidden');
    });

    it('shows top-up CTA when session is EXPIRING (≤5 min)', () => {
      const { tree } = renderCyranoSessionPage({
        ...MINIMAL_INPUTS,
        session_status: 'ACTIVE',
        minutes_remaining: 3,
      });
      const { view } = renderCyranoSessionPage({
        ...MINIMAL_INPUTS,
        session_status: 'ACTIVE',
        minutes_remaining: 3,
      });
      expect(view.session_status).toBe('EXPIRING');
      const cta = findByTestId(tree, 'cyrano-session-topup-cta');
      expect(cta!.classes).toContain('cnz-topup-cta--visible');
    });

    it('shows top-up CTA when session is EXPIRED', () => {
      const { tree } = renderCyranoSessionPage({
        ...MINIMAL_INPUTS,
        session_status: 'EXPIRED',
        minutes_remaining: 0,
      });
      const cta = findByTestId(tree, 'cyrano-session-topup-cta');
      expect(cta!.classes).toContain('cnz-topup-cta--visible');
      const btn = findByTestId(tree, 'cyrano-session-topup-btn');
      expect(btn).toBeDefined();
      expect(btn!.on?.click).toBe('openTopUp');
    });

    it('renders wallet buckets in the top-up CTA when visible', () => {
      const { tree } = renderCyranoSessionPage({
        ...MINIMAL_INPUTS,
        session_status: 'EXPIRED',
        minutes_remaining: 0,
        wallet_buckets: [
          { bucket: 'purchased', label: 'Purchased', balance_tokens: '500', spend_priority: 1, will_drain_next: true },
          { bucket: 'membership', label: 'Membership', balance_tokens: '0', spend_priority: 2, will_drain_next: false },
          { bucket: 'bonus', label: 'Bonus', balance_tokens: '0', spend_priority: 3, will_drain_next: false },
        ],
      });
      expect(findByTestId(tree, 'cyrano-session-wallet-bucket-purchased')).toBeDefined();
      expect(findByTestId(tree, 'cyrano-session-wallet-bucket-membership')).toBeDefined();
      expect(findByTestId(tree, 'cyrano-session-wallet-bucket-bonus')).toBeDefined();

      const purchased = findByTestId(tree, 'cyrano-session-wallet-bucket-purchased');
      expect(purchased!.classes).toContain('cnz-wallet-buckets__item--draining');
    });
  });

  it('has a stable set of top-level test_ids on a full render', () => {
    const { tree } = renderCyranoSessionPage({
      ...MINIMAL_INPUTS,
      voice_call_available: true,
      messages: [
        { message_id: 'm1', role: 'twin', content: 'Hi', timestamp_utc: '2026-04-28T10:00:00Z' },
      ],
      memory_sidebar: [
        { memory_id: 'x1', memory_type: 'FACT', content_preview: 'likes cats', importance_score: 0.6 },
      ],
    });
    const ids = collectTestIds(tree);
    expect(ids).toContain('cyrano-session-page');
    expect(ids).toContain('cyrano-session-character-header');
    expect(ids).toContain('cyrano-session-tier-badge');
    expect(ids).toContain('cyrano-session-voice-call-btn');
    expect(ids).toContain('cyrano-session-chat-area');
    expect(ids).toContain('cyrano-session-memory-sidebar');
    expect(ids).toContain('cyrano-session-topup-cta');
    expect(ids.length).toBeGreaterThan(10);
  });
});
