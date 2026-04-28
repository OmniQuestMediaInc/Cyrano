// Screen 03 — /creator/cyrano/personas  Persona Management page.
// Role: Creator / VIP Member.
// Purpose: Manage global, template, and custom Cyrano personas.
//
// Tabs: Global | Templates | My Custom
// Card grid: persona avatar + name + tier lock + [Edit] [Test Chat] [Publish to Zone]
// New Persona FAB → wizard (base + custom traits)
// Drag-to-reorder priority within each tab.
// Publish → visible to eligible VIPs (tier-gated).
//
// Follows the render-plan convention: no JSX, no React runtime — returns a
// structurally-testable RenderElement tree.

import { SEO } from '../../../../config/seo';
import { THEME } from '../../../../config/theme';
import { el, RenderElement } from '../../../../components/render-plan';
import type {
  CyranoPersonaCard,
  PersonaManagementPageInputs,
  PersonaManagementPageView,
  PersonaManagementTab,
} from '../../../../types/cyrano-persona-contracts';

export const PERSONA_MANAGEMENT_PAGE_RULE_ID = 'PERSONA_MANAGEMENT_PAGE_v1';

const TAB_LABELS: Record<PersonaManagementTab, string> = {
  global: 'Global',
  template: 'Templates',
  custom: 'My Custom',
};

export interface PersonaManagementPageRender {
  metadata: typeof SEO.cyrano_personas;
  view: PersonaManagementPageView;
  tree: RenderElement;
  rule_applied_id: string;
}

export function renderPersonaManagementPage(
  inputs: PersonaManagementPageInputs,
): PersonaManagementPageRender {
  const active_personas = personasForTab(inputs);

  const view: PersonaManagementPageView = {
    creator_id: inputs.creator_id,
    active_tab: inputs.active_tab,
    active_personas,
    total_global: inputs.global_personas.length,
    total_templates: inputs.template_personas.length,
    total_custom: inputs.custom_personas.length,
  };

  const tree = el(
    'main',
    {
      test_id: 'persona-management-page',
      classes: ['cnz-persona-management', 'cnz-theme-dark'],
      props: { mode: THEME.default_mode, creator_id: inputs.creator_id },
      aria: { 'aria-label': 'Cyrano Persona Management' },
    },
    [
      renderHeader(),
      renderTabs(inputs.active_tab, view),
      renderPersonaGrid(active_personas),
      renderNewPersonaFab(),
    ],
  );

  return {
    metadata: SEO.cyrano_personas,
    view,
    tree,
    rule_applied_id: PERSONA_MANAGEMENT_PAGE_RULE_ID,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function personasForTab(inputs: PersonaManagementPageInputs): CyranoPersonaCard[] {
  switch (inputs.active_tab) {
    case 'global':
      return [...inputs.global_personas].sort((a, b) => a.sort_order - b.sort_order);
    case 'template':
      return [...inputs.template_personas].sort((a, b) => a.sort_order - b.sort_order);
    case 'custom':
      return [...inputs.custom_personas].sort((a, b) => a.sort_order - b.sort_order);
    default:
      return [];
  }
}

// ── Section renderers ─────────────────────────────────────────────────────────

function renderHeader(): RenderElement {
  return el(
    'header',
    {
      test_id: 'persona-management-header',
      classes: ['cnz-pm__header'],
    },
    [
      el('h1', {}, ['Cyrano™ Persona Management']),
      el('p', { classes: ['cnz-pm__subtitle'] }, [
        'Create and manage personas across global, template, and custom scopes.',
      ]),
    ],
  );
}

function renderTabs(activeTab: PersonaManagementTab, view: PersonaManagementPageView): RenderElement {
  const tabs: PersonaManagementTab[] = ['global', 'template', 'custom'];
  return el(
    'nav',
    {
      test_id: 'persona-management-tabs',
      classes: ['cnz-tab-bar'],
      aria: { role: 'tablist', 'aria-label': 'Persona scopes' },
    },
    tabs.map((tab) =>
      el(
        'button',
        {
          test_id: `persona-management-tab-${tab}`,
          classes: [
            'cnz-tab',
            tab === activeTab ? 'cnz-tab--active' : '',
          ],
          aria: {
            role: 'tab',
            'aria-selected': String(tab === activeTab),
          },
          on: { click: 'switchPersonaTab' },
          props: {
            tab,
            count: tabCount(tab, view),
          },
        },
        [`${TAB_LABELS[tab]} (${tabCount(tab, view)})`],
      ),
    ),
  );
}

function tabCount(tab: PersonaManagementTab, view: PersonaManagementPageView): number {
  switch (tab) {
    case 'global':
      return view.total_global;
    case 'template':
      return view.total_templates;
    case 'custom':
      return view.total_custom;
    default:
      return 0;
  }
}

function renderPersonaGrid(personas: CyranoPersonaCard[]): RenderElement {
  return el(
    'section',
    {
      test_id: 'persona-management-grid',
      classes: ['cnz-panel', 'cnz-panel--persona-grid'],
      aria: { 'aria-label': 'Persona cards' },
    },
    [
      personas.length === 0
        ? el('p', { classes: ['cnz-panel--empty'] }, [
            'No personas in this scope. Use the + button to create one.',
          ])
        : el(
            'div',
            { classes: ['cnz-persona-grid'] },
            personas.map(renderPersonaCard),
          ),
    ],
  );
}

function renderPersonaCard(persona: CyranoPersonaCard): RenderElement {
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
        tier_lock: persona.tier_lock,
        sort_order: persona.sort_order,
      },
      aria: { draggable: 'true', 'aria-label': `Persona: ${persona.display_name}` },
    },
    [
      el(
        'div',
        {
          test_id: `persona-card-drag-handle-${persona.persona_id}`,
          classes: ['cnz-persona-card__drag-handle'],
          aria: { 'aria-label': 'Drag to reorder' },
          props: { persona_id: persona.persona_id },
          on: { dragstart: 'personaDragStart', dragend: 'personaDragEnd' },
        },
        ['⠿'],
      ),
      renderPersonaAvatar(persona),
      el(
        'div',
        { classes: ['cnz-persona-card__body'] },
        [
          el('strong', { test_id: `persona-card-name-${persona.persona_id}` }, [
            persona.display_name,
          ]),
          el('span', { classes: ['cnz-persona-card__tone'] }, [persona.tone]),
          persona.tier_lock
            ? el(
                'span',
                {
                  test_id: `persona-card-tier-lock-${persona.persona_id}`,
                  classes: ['cnz-persona-card__tier-lock', 'cnz-tier-badge'],
                  props: { tier_lock: persona.tier_lock },
                },
                [`Requires ${persona.tier_lock}`],
              )
            : el(
                'span',
                {
                  test_id: `persona-card-tier-lock-${persona.persona_id}`,
                  classes: ['cnz-persona-card__tier-lock', 'cnz-tier-badge--open'],
                },
                ['All VIPs'],
              ),
        ],
      ),
      el(
        'footer',
        { classes: ['cnz-persona-card__actions'] },
        [
          el(
            'button',
            {
              test_id: `persona-card-edit-${persona.persona_id}`,
              classes: ['cnz-button'],
              on: { click: 'editPersona' },
              props: { persona_id: persona.persona_id },
            },
            ['Edit'],
          ),
          el(
            'button',
            {
              test_id: `persona-card-test-chat-${persona.persona_id}`,
              classes: ['cnz-button'],
              on: { click: 'testChatPersona' },
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
                persona.published ? 'cnz-button--ghost' : 'cnz-button--primary',
              ],
              on: { click: 'publishPersona' },
              props: {
                persona_id: persona.persona_id,
                tier_lock: persona.tier_lock,
                published: persona.published,
              },
            },
            [persona.published ? 'Published' : 'Publish to Zone'],
          ),
        ],
      ),
    ],
  );
}

function renderPersonaAvatar(persona: CyranoPersonaCard): RenderElement {
  return el(
    'div',
    {
      test_id: `persona-card-avatar-${persona.persona_id}`,
      classes: ['cnz-persona-card__avatar'],
      props: {
        avatar_url: persona.avatar_url,
        display_name: persona.display_name,
      },
    },
    [
      persona.avatar_url
        ? el('img', {
            props: { src: persona.avatar_url, alt: persona.display_name },
          })
        : el('span', { classes: ['cnz-persona-card__avatar-placeholder'] }, [
            persona.display_name.charAt(0).toUpperCase(),
          ]),
    ],
  );
}

function renderNewPersonaFab(): RenderElement {
  return el(
    'button',
    {
      test_id: 'persona-management-new-fab',
      classes: ['cnz-fab', 'cnz-fab--primary'],
      aria: { 'aria-label': 'Create new persona' },
      on: { click: 'openNewPersonaWizard' },
    },
    ['+'],
  );
}
