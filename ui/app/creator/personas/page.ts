// Screen 03 — /creator/personas — Cyrano™ Persona Management (Creator + VIP).
// Role: Creator / VIP Member.
// Purpose: Manage global, template, and per-VIP custom Cyrano personas.
//
// Layout:
//   • Tab bar — Global | Templates | My Custom
//   • Persona card grid — avatar chip + name + tier-lock badge + action row
//     [Edit] [Test Chat] [Publish to Zone]
//   • New Persona FAB — triggers wizard (base + custom traits)
//   • Drag-to-reorder handles on every card (priority order)
//   • Publish → visible to eligible VIPs (tier-gated)
//
// Pure render-plan — no JSX, no React runtime, structurally testable.

import { SEO } from '../../../config/seo';
import { THEME } from '../../../config/theme';
import { el, RenderElement } from '../../../components/render-plan';
import type {
  PersonaCard,
  PersonaManagementTab,
  PersonaManagementView,
  PersonaTierLock,
} from '../../../types/cyrano-persona-contracts';

export const PERSONA_MANAGEMENT_PAGE_RULE_ID = 'CYRANO_PERSONA_MANAGEMENT_PAGE_v1';

export interface PersonaManagementPageInputs {
  creator_id: string;
  active_tab: PersonaManagementTab;
  personas: PersonaCard[];
  generated_at_utc: string;
}

export interface PersonaManagementPageRender {
  metadata: typeof SEO.cyrano_persona_management;
  view: PersonaManagementView;
  tree: RenderElement;
  rule_applied_id: string;
}

export function renderPersonaManagementPage(
  inputs: PersonaManagementPageInputs,
): PersonaManagementPageRender {
  const view: PersonaManagementView = {
    creator_id: inputs.creator_id,
    active_tab: inputs.active_tab,
    personas: [...inputs.personas].sort((a, b) => a.sort_order - b.sort_order),
    generated_at_utc: inputs.generated_at_utc,
    rule_applied_id: PERSONA_MANAGEMENT_PAGE_RULE_ID,
  };

  const tree = el(
    'main',
    {
      test_id: 'persona-management-page',
      classes: ['cnz-creator-personas', 'cnz-theme-dark'],
      props: { mode: THEME.default_mode, creator_id: inputs.creator_id },
      aria: { 'aria-label': 'Cyrano™ persona management' },
    },
    [
      renderHeader(),
      renderTabBar(view.active_tab),
      renderPersonaGrid(view.personas),
      renderNewPersonaFab(),
    ],
  );

  return {
    metadata: SEO.cyrano_persona_management,
    view,
    tree,
    rule_applied_id: PERSONA_MANAGEMENT_PAGE_RULE_ID,
  };
}

function renderHeader(): RenderElement {
  return el(
    'header',
    {
      test_id: 'persona-management-header',
      classes: ['cnz-creator-personas__header'],
    },
    [
      el('h1', {}, ['Cyrano™ Personas']),
      el('p', { classes: ['cnz-creator-personas__subtitle'] }, [
        'Create, edit, and publish personas — each one shapes how Cyrano™ whispers for a session.',
      ]),
    ],
  );
}

const TAB_LABELS: Record<PersonaManagementTab, string> = {
  GLOBAL: 'Global',
  TEMPLATES: 'Templates',
  MY_CUSTOM: 'My Custom',
};

function renderTabBar(activeTab: PersonaManagementTab): RenderElement {
  const tabs: PersonaManagementTab[] = ['GLOBAL', 'TEMPLATES', 'MY_CUSTOM'];
  return el(
    'nav',
    {
      test_id: 'persona-management-tabs',
      classes: ['cnz-tab-bar'],
      aria: { role: 'tablist', 'aria-label': 'Persona scope filter' },
    },
    tabs.map((tab) =>
      el(
        'button',
        {
          test_id: `persona-management-tab-${tab.toLowerCase()}`,
          classes: [
            'cnz-tab',
            tab === activeTab ? 'cnz-tab--active' : '',
          ],
          aria: {
            role: 'tab',
            'aria-selected': String(tab === activeTab),
          },
          on: { click: 'selectTab' },
          props: { tab },
        },
        [TAB_LABELS[tab]],
      ),
    ),
  );
}

function renderPersonaGrid(personas: PersonaCard[]): RenderElement {
  if (personas.length === 0) {
    return el(
      'section',
      {
        test_id: 'persona-management-grid-empty',
        classes: ['cnz-panel', 'cnz-panel--empty'],
        aria: { 'aria-label': 'No personas' },
      },
      [el('p', {}, ['No personas in this scope yet — create one with the + button below.'])],
    );
  }

  return el(
    'section',
    {
      test_id: 'persona-management-grid',
      classes: ['cnz-persona-grid'],
      aria: { 'aria-label': 'Persona cards' },
      props: { draggable_list: true },
    },
    personas.map(renderPersonaCard),
  );
}

function renderPersonaCard(persona: PersonaCard): RenderElement {
  return el(
    'article',
    {
      test_id: `persona-card-${persona.persona_id}`,
      classes: [
        'cnz-persona-card',
        persona.active ? 'cnz-persona-card--active' : '',
        persona.published ? 'cnz-persona-card--published' : '',
      ],
      props: {
        persona_id: persona.persona_id,
        scope: persona.scope,
        sort_order: persona.sort_order,
        draggable: true,
      },
      aria: { 'aria-label': `Persona: ${persona.display_name}` },
    },
    [
      renderCardDragHandle(persona),
      renderCardAvatar(persona),
      renderCardBody(persona),
      renderTierLockBadge(persona.tier_lock),
      renderCardActions(persona),
    ],
  );
}

function renderCardDragHandle(persona: PersonaCard): RenderElement {
  return el(
    'div',
    {
      test_id: `persona-card-drag-${persona.persona_id}`,
      classes: ['cnz-persona-card__drag-handle'],
      aria: {
        role: 'button',
        'aria-label': `Drag to reorder ${persona.display_name}`,
      },
      on: { dragstart: 'onDragStart', dragend: 'onDragEnd' },
      props: { persona_id: persona.persona_id },
    },
    ['⠿'],
  );
}

function renderCardAvatar(persona: PersonaCard): RenderElement {
  return el(
    'div',
    {
      test_id: `persona-card-avatar-${persona.persona_id}`,
      classes: ['cnz-persona-card__avatar'],
      aria: { 'aria-hidden': 'true' },
      props: { display_name: persona.display_name },
    },
    [persona.display_name.charAt(0).toUpperCase()],
  );
}

function renderCardBody(persona: PersonaCard): RenderElement {
  return el(
    'div',
    {
      test_id: `persona-card-body-${persona.persona_id}`,
      classes: ['cnz-persona-card__body'],
    },
    [
      el('strong', { test_id: `persona-card-name-${persona.persona_id}` }, [
        persona.display_name,
      ]),
      el('span', { classes: ['cnz-persona-card__tone'] }, [persona.tone]),
      el('p', { classes: ['cnz-persona-card__style-notes'] }, [persona.style_notes]),
      persona.published
        ? el(
            'span',
            {
              test_id: `persona-card-published-badge-${persona.persona_id}`,
              classes: ['cnz-badge', 'cnz-badge--success'],
            },
            ['Published'],
          )
        : el(
            'span',
            {
              test_id: `persona-card-draft-badge-${persona.persona_id}`,
              classes: ['cnz-badge', 'cnz-badge--muted'],
            },
            ['Draft'],
          ),
    ],
  );
}

const TIER_LOCK_LABELS: Record<PersonaTierLock, string> = {
  OPEN: 'All tiers',
  HOT: 'HOT+ required',
  INFERNO: 'Inferno only',
};

function renderTierLockBadge(tierLock: PersonaTierLock): RenderElement {
  return el(
    'span',
    {
      test_id: `persona-card-tier-lock-${tierLock.toLowerCase()}`,
      classes: [
        'cnz-badge',
        tierLock === 'OPEN' ? 'cnz-badge--neutral' : 'cnz-badge--tier-lock',
      ],
      props: { tier_lock: tierLock },
    },
    [TIER_LOCK_LABELS[tierLock]],
  );
}

function renderCardActions(persona: PersonaCard): RenderElement {
  return el(
    'div',
    {
      test_id: `persona-card-actions-${persona.persona_id}`,
      classes: ['cnz-persona-card__actions', 'cnz-cta-row'],
    },
    [
      el(
        'button',
        {
          test_id: `persona-card-edit-${persona.persona_id}`,
          classes: ['cnz-button', 'cnz-button--ghost'],
          on: { click: 'editPersona' },
          props: { persona_id: persona.persona_id },
        },
        ['Edit'],
      ),
      el(
        'button',
        {
          test_id: `persona-card-test-chat-${persona.persona_id}`,
          classes: ['cnz-button', 'cnz-button--ghost'],
          on: { click: 'testChat' },
          props: { persona_id: persona.persona_id },
        },
        ['Test Chat'],
      ),
      el(
        'button',
        {
          test_id: `persona-card-publish-${persona.persona_id}`,
          classes: [
            'cnz-button',
            persona.published ? 'cnz-button--secondary' : 'cnz-button--primary',
          ],
          on: { click: 'publishPersona' },
          props: {
            persona_id: persona.persona_id,
            tier_lock: persona.tier_lock,
            currently_published: persona.published,
          },
        },
        [persona.published ? 'Unpublish' : 'Publish to Zone'],
      ),
    ],
  );
}

function renderNewPersonaFab(): RenderElement {
  return el(
    'button',
    {
      test_id: 'persona-management-fab',
      classes: ['cnz-fab', 'cnz-fab--primary'],
      aria: { 'aria-label': 'Create new persona' },
      on: { click: 'openNewPersonaWizard' },
    },
    ['+'],
  );
}
