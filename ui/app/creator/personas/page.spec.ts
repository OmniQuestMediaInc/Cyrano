// Screen 03 — Persona Management page spec.
import {
  renderPersonaManagementPage,
  PERSONA_MANAGEMENT_PAGE_RULE_ID,
  type PersonaManagementPageInputs,
} from './page';
import { findByTestId, collectTestIds } from '../../../components/render-plan';
import type { PersonaCard } from '../../../types/cyrano-persona-contracts';

function makePersona(overrides: Partial<PersonaCard> = {}): PersonaCard {
  return {
    persona_id: 'p1',
    creator_id: 'creator_42',
    display_name: 'Aria',
    tone: 'playful_dominant',
    style_notes: 'Warm, witty, suggestive.',
    scope: 'CUSTOM',
    tier_lock: 'OPEN',
    active: true,
    sort_order: 1,
    published: false,
    ...overrides,
  };
}

const BASE_INPUTS: PersonaManagementPageInputs = {
  creator_id: 'creator_42',
  active_tab: 'MY_CUSTOM',
  personas: [
    makePersona({ persona_id: 'p1', display_name: 'Aria', sort_order: 2 }),
    makePersona({ persona_id: 'p2', display_name: 'Zara', sort_order: 1, published: true, tier_lock: 'HOT' }),
  ],
  generated_at_utc: '2026-04-28T00:00:00Z',
};

describe('renderPersonaManagementPage', () => {
  it('returns the canonical rule_applied_id', () => {
    const { rule_applied_id } = renderPersonaManagementPage(BASE_INPUTS);
    expect(rule_applied_id).toBe(PERSONA_MANAGEMENT_PAGE_RULE_ID);
  });

  it('renders the page root with correct test_id', () => {
    const { tree } = renderPersonaManagementPage(BASE_INPUTS);
    expect(findByTestId(tree, 'persona-management-page')).toBeDefined();
  });

  it('renders the header', () => {
    const { tree } = renderPersonaManagementPage(BASE_INPUTS);
    expect(findByTestId(tree, 'persona-management-header')).toBeDefined();
  });

  it('renders tab bar with all three tabs', () => {
    const { tree } = renderPersonaManagementPage(BASE_INPUTS);
    expect(findByTestId(tree, 'persona-management-tabs')).toBeDefined();
    expect(findByTestId(tree, 'persona-management-tab-global')).toBeDefined();
    expect(findByTestId(tree, 'persona-management-tab-templates')).toBeDefined();
    expect(findByTestId(tree, 'persona-management-tab-my_custom')).toBeDefined();
  });

  it('marks the active tab with cnz-tab--active class', () => {
    const { tree } = renderPersonaManagementPage({ ...BASE_INPUTS, active_tab: 'TEMPLATES' });
    const tab = findByTestId(tree, 'persona-management-tab-templates');
    expect(tab?.classes).toContain('cnz-tab--active');
    const otherTab = findByTestId(tree, 'persona-management-tab-global');
    expect(otherTab?.classes).not.toContain('cnz-tab--active');
  });

  it('renders a card for every persona', () => {
    const { tree } = renderPersonaManagementPage(BASE_INPUTS);
    expect(findByTestId(tree, 'persona-card-p1')).toBeDefined();
    expect(findByTestId(tree, 'persona-card-p2')).toBeDefined();
  });

  it('sorts personas by sort_order ascending in the view', () => {
    const { view } = renderPersonaManagementPage(BASE_INPUTS);
    expect(view.personas[0].persona_id).toBe('p2'); // sort_order 1
    expect(view.personas[1].persona_id).toBe('p1'); // sort_order 2
  });

  it('renders Edit, Test Chat, and Publish buttons on each card', () => {
    const { tree } = renderPersonaManagementPage(BASE_INPUTS);
    expect(findByTestId(tree, 'persona-card-edit-p1')).toBeDefined();
    expect(findByTestId(tree, 'persona-card-test-chat-p1')).toBeDefined();
    expect(findByTestId(tree, 'persona-card-publish-p1')).toBeDefined();
  });

  it('shows Unpublish label for already-published persona', () => {
    const { tree } = renderPersonaManagementPage(BASE_INPUTS);
    const publishBtn = findByTestId(tree, 'persona-card-publish-p2');
    expect(publishBtn?.children).toContain('Unpublish');
  });

  it('shows "Publish to Zone" label for unpublished persona', () => {
    const { tree } = renderPersonaManagementPage(BASE_INPUTS);
    const publishBtn = findByTestId(tree, 'persona-card-publish-p1');
    expect(publishBtn?.children).toContain('Publish to Zone');
  });

  it('renders tier-lock badges', () => {
    const { tree } = renderPersonaManagementPage(BASE_INPUTS);
    // p1 has tier_lock OPEN, p2 has tier_lock HOT
    expect(findByTestId(tree, 'persona-card-tier-lock-open')).toBeDefined();
    expect(findByTestId(tree, 'persona-card-tier-lock-hot')).toBeDefined();
  });

  it('renders drag handles for all cards', () => {
    const { tree } = renderPersonaManagementPage(BASE_INPUTS);
    expect(findByTestId(tree, 'persona-card-drag-p1')).toBeDefined();
    expect(findByTestId(tree, 'persona-card-drag-p2')).toBeDefined();
  });

  it('publishes tier_lock on the publish button props', () => {
    const { tree } = renderPersonaManagementPage(BASE_INPUTS);
    const btn = findByTestId(tree, 'persona-card-publish-p2');
    expect(btn?.props?.tier_lock).toBe('HOT');
  });

  it('renders FAB for creating a new persona', () => {
    const { tree } = renderPersonaManagementPage(BASE_INPUTS);
    expect(findByTestId(tree, 'persona-management-fab')).toBeDefined();
  });

  it('renders empty state when personas list is empty', () => {
    const { tree } = renderPersonaManagementPage({ ...BASE_INPUTS, personas: [] });
    expect(findByTestId(tree, 'persona-management-grid-empty')).toBeDefined();
    expect(findByTestId(tree, 'persona-management-grid')).toBeUndefined();
  });

  it('attaches creator_id to page root props', () => {
    const { tree } = renderPersonaManagementPage(BASE_INPUTS);
    const page = findByTestId(tree, 'persona-management-page');
    expect(page?.props?.creator_id).toBe('creator_42');
  });

  it('exposes cyrano_persona_management SEO metadata', () => {
    const { metadata } = renderPersonaManagementPage(BASE_INPUTS);
    expect(metadata.canonical_url).toContain('/creator/personas');
    expect(metadata.robots).toBe('noindex,nofollow');
  });

  it('collectTestIds covers a reasonable surface area', () => {
    const { tree } = renderPersonaManagementPage(BASE_INPUTS);
    const ids = collectTestIds(tree);
    // header, tabs (4), grid, 2 cards × (card + avatar + body + drag + actions×3) + fab + badges
    expect(ids.length).toBeGreaterThan(20);
  });
});
