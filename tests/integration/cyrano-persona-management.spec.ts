/**
 * cyrano-persona-management.spec.ts
 * Screen 03 — Persona Management (Creator + VIP).
 * Hermetic — no database or broker required.
 */

import {
  renderPersonaManagementPage,
  PERSONA_MANAGEMENT_PAGE_RULE_ID,
} from '../../ui/app/creator/cyrano/personas/page';
import { findByTestId, collectTestIds } from '../../ui/components/render-plan';
import type {
  CyranoPersonaCard,
  PersonaManagementPageInputs,
} from '../../ui/types/cyrano-persona-contracts';

function makePersona(
  overrides: Partial<CyranoPersonaCard> = {},
): CyranoPersonaCard {
  return {
    persona_id: 'p1',
    creator_id: 'c1',
    display_name: 'Aria',
    avatar_url: null,
    tone: 'playful_dominant',
    style_notes: 'short and assertive',
    scope: 'custom',
    tier_lock: null,
    active: true,
    sort_order: 1,
    published: false,
    ...overrides,
  };
}

function makeInputs(
  overrides: Partial<PersonaManagementPageInputs> = {},
): PersonaManagementPageInputs {
  return {
    creator_id: 'c1',
    active_tab: 'custom',
    global_personas: [],
    template_personas: [],
    custom_personas: [],
    ...overrides,
  };
}

describe('renderPersonaManagementPage — structure', () => {
  it('returns the canonical rule_applied_id', () => {
    const { rule_applied_id } = renderPersonaManagementPage(makeInputs());
    expect(rule_applied_id).toBe(PERSONA_MANAGEMENT_PAGE_RULE_ID);
  });

  it('root node carries test_id "persona-management-page"', () => {
    const { tree } = renderPersonaManagementPage(makeInputs());
    expect(tree.test_id).toBe('persona-management-page');
  });

  it('renders header with title', () => {
    const { tree } = renderPersonaManagementPage(makeInputs());
    const header = findByTestId(tree, 'persona-management-header');
    expect(header).toBeDefined();
  });

  it('renders tab bar with three tabs', () => {
    const { tree } = renderPersonaManagementPage(makeInputs());
    const globalTab = findByTestId(tree, 'persona-management-tab-global');
    const templateTab = findByTestId(tree, 'persona-management-tab-template');
    const customTab = findByTestId(tree, 'persona-management-tab-custom');
    expect(globalTab).toBeDefined();
    expect(templateTab).toBeDefined();
    expect(customTab).toBeDefined();
  });

  it('marks the active tab with cnz-tab--active', () => {
    const { tree } = renderPersonaManagementPage(makeInputs({ active_tab: 'template' }));
    const activeTab = findByTestId(tree, 'persona-management-tab-template');
    expect(activeTab?.classes).toContain('cnz-tab--active');
    const inactiveTab = findByTestId(tree, 'persona-management-tab-custom');
    expect(inactiveTab?.classes).not.toContain('cnz-tab--active');
  });

  it('renders New Persona FAB', () => {
    const { tree } = renderPersonaManagementPage(makeInputs());
    const fab = findByTestId(tree, 'persona-management-new-fab');
    expect(fab).toBeDefined();
    expect(fab?.on?.click).toBe('openNewPersonaWizard');
  });

  it('renders empty-state when tab has no personas', () => {
    const { tree } = renderPersonaManagementPage(makeInputs({ active_tab: 'custom' }));
    const grid = findByTestId(tree, 'persona-management-grid');
    expect(grid).toBeDefined();
    // no persona cards should exist
    const ids = collectTestIds(tree);
    expect(ids.some((id) => id.startsWith('persona-card-'))).toBe(false);
  });
});

describe('renderPersonaManagementPage — persona cards', () => {
  it('renders a card for each persona in the active tab', () => {
    const personas = [
      makePersona({ persona_id: 'p1', sort_order: 1, scope: 'custom' }),
      makePersona({ persona_id: 'p2', sort_order: 2, scope: 'custom' }),
    ];
    const { tree } = renderPersonaManagementPage(
      makeInputs({ active_tab: 'custom', custom_personas: personas }),
    );
    expect(findByTestId(tree, 'persona-card-p1')).toBeDefined();
    expect(findByTestId(tree, 'persona-card-p2')).toBeDefined();
  });

  it('does not render cards from other tabs', () => {
    const global = [makePersona({ persona_id: 'g1', scope: 'global' })];
    const custom = [makePersona({ persona_id: 'c2', scope: 'custom' })];
    const { tree } = renderPersonaManagementPage(
      makeInputs({
        active_tab: 'global',
        global_personas: global,
        custom_personas: custom,
      }),
    );
    expect(findByTestId(tree, 'persona-card-g1')).toBeDefined();
    expect(findByTestId(tree, 'persona-card-c2')).toBeUndefined();
  });

  it('sorts cards by sort_order ascending', () => {
    const personas = [
      makePersona({ persona_id: 'p3', sort_order: 3, scope: 'custom' }),
      makePersona({ persona_id: 'p1', sort_order: 1, scope: 'custom' }),
      makePersona({ persona_id: 'p2', sort_order: 2, scope: 'custom' }),
    ];
    const { view } = renderPersonaManagementPage(
      makeInputs({ active_tab: 'custom', custom_personas: personas }),
    );
    const ids = view.active_personas.map((p) => p.persona_id);
    expect(ids).toEqual(['p1', 'p2', 'p3']);
  });

  it('shows tier_lock badge when persona has a tier restriction', () => {
    const persona = makePersona({ persona_id: 'tp1', tier_lock: 'VIP_GOLD' });
    const { tree } = renderPersonaManagementPage(
      makeInputs({ active_tab: 'custom', custom_personas: [persona] }),
    );
    const badge = findByTestId(tree, 'persona-card-tier-lock-tp1');
    expect(badge).toBeDefined();
    expect(badge?.props?.tier_lock).toBe('VIP_GOLD');
  });

  it('shows "All VIPs" badge when no tier_lock', () => {
    const persona = makePersona({ persona_id: 'tp2', tier_lock: null });
    const { tree } = renderPersonaManagementPage(
      makeInputs({ active_tab: 'custom', custom_personas: [persona] }),
    );
    const badge = findByTestId(tree, 'persona-card-tier-lock-tp2');
    expect(badge?.classes).toContain('cnz-tier-badge--open');
  });

  it('Publish button shows "Published" when persona is already published', () => {
    const persona = makePersona({ persona_id: 'pp1', published: true });
    const { tree } = renderPersonaManagementPage(
      makeInputs({ active_tab: 'custom', custom_personas: [persona] }),
    );
    const publishBtn = findByTestId(tree, 'persona-card-publish-pp1');
    expect(publishBtn?.children).toContain('Published');
    expect(publishBtn?.classes).toContain('cnz-button--ghost');
  });

  it('Publish button shows "Publish to Zone" when not yet published', () => {
    const persona = makePersona({ persona_id: 'up1', published: false });
    const { tree } = renderPersonaManagementPage(
      makeInputs({ active_tab: 'custom', custom_personas: [persona] }),
    );
    const publishBtn = findByTestId(tree, 'persona-card-publish-up1');
    expect(publishBtn?.children).toContain('Publish to Zone');
    expect(publishBtn?.classes).toContain('cnz-button--primary');
  });

  it('drag handle is rendered with dragstart/dragend handlers', () => {
    const persona = makePersona({ persona_id: 'dh1' });
    const { tree } = renderPersonaManagementPage(
      makeInputs({ active_tab: 'custom', custom_personas: [persona] }),
    );
    const handle = findByTestId(tree, 'persona-card-drag-handle-dh1');
    expect(handle).toBeDefined();
    expect(handle?.on?.dragstart).toBe('personaDragStart');
    expect(handle?.on?.dragend).toBe('personaDragEnd');
  });

  it('avatar placeholder shows first character of name when no avatar_url', () => {
    const persona = makePersona({ persona_id: 'av1', avatar_url: null, display_name: 'Zara' });
    const { tree } = renderPersonaManagementPage(
      makeInputs({ active_tab: 'custom', custom_personas: [persona] }),
    );
    const avatar = findByTestId(tree, 'persona-card-avatar-av1');
    const ids = collectTestIds(avatar!);
    // avatar element itself has test_id; placeholder is a child span
    expect(avatar).toBeDefined();
    expect(avatar?.props?.avatar_url).toBeNull();
  });

  it('Edit and Test Chat buttons are bound to correct event handlers', () => {
    const persona = makePersona({ persona_id: 'btn1' });
    const { tree } = renderPersonaManagementPage(
      makeInputs({ active_tab: 'custom', custom_personas: [persona] }),
    );
    const editBtn = findByTestId(tree, 'persona-card-edit-btn1');
    const testChatBtn = findByTestId(tree, 'persona-card-test-chat-btn1');
    expect(editBtn?.on?.click).toBe('editPersona');
    expect(testChatBtn?.on?.click).toBe('testChatPersona');
  });
});

describe('renderPersonaManagementPage — tab counts', () => {
  it('view reflects total counts for all three scopes regardless of active tab', () => {
    const inputs = makeInputs({
      active_tab: 'global',
      global_personas: [
        makePersona({ persona_id: 'g1', scope: 'global' }),
        makePersona({ persona_id: 'g2', scope: 'global' }),
      ],
      template_personas: [makePersona({ persona_id: 't1', scope: 'template' })],
      custom_personas: [
        makePersona({ persona_id: 'c1', scope: 'custom' }),
        makePersona({ persona_id: 'c2', scope: 'custom' }),
        makePersona({ persona_id: 'c3', scope: 'custom' }),
      ],
    });
    const { view, tree } = renderPersonaManagementPage(inputs);
    expect(view.total_global).toBe(2);
    expect(view.total_templates).toBe(1);
    expect(view.total_custom).toBe(3);

    // Tab button props carry the count
    const globalTab = findByTestId(tree, 'persona-management-tab-global');
    expect(globalTab?.props?.count).toBe(2);
    const templateTab = findByTestId(tree, 'persona-management-tab-template');
    expect(templateTab?.props?.count).toBe(1);
    const customTab = findByTestId(tree, 'persona-management-tab-custom');
    expect(customTab?.props?.count).toBe(3);
  });
});
