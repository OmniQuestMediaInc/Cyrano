/**
 * cyrano-prompt-templates.spec.ts
 * Phase 3.11 — shared prompt-template engine consumed by Layers 1, 3, and 4.
 */
import { resolvePromptTemplate } from '../../services/cyrano/src/cyrano-prompt-templates';

describe('resolvePromptTemplate', () => {
  it('returns an adult template for ADULT_ENTERTAINMENT escalation', () => {
    const tpl = resolvePromptTemplate({
      category: 'CAT_ESCALATION',
      domain: 'ADULT_ENTERTAINMENT',
      tier: 'HOT',
    });
    expect(tpl).not.toBeNull();
    expect(tpl!({ tone: 'playful', tier: 'HOT' })).toMatch(/HOT/);
  });

  it('suppresses escalation in non-adult domains (returns null)', () => {
    const tpl = resolvePromptTemplate({
      category: 'CAT_ESCALATION',
      domain: 'TEACHING',
      tier: 'WARM',
    });
    expect(tpl).toBeNull();
  });

  it('returns a coaching template for CAT_SESSION_OPEN/COACHING', () => {
    const tpl = resolvePromptTemplate({
      category: 'CAT_SESSION_OPEN',
      domain: 'COACHING',
      tier: 'COLD',
    });
    expect(tpl).not.toBeNull();
    expect(tpl!({ tone: 'supportive', tier: 'COLD' })).toMatch(/check-in/);
  });

  it('returns a medical template for CAT_RECOVERY/MEDICAL', () => {
    const tpl = resolvePromptTemplate({
      category: 'CAT_RECOVERY',
      domain: 'MEDICAL',
      tier: 'COLD',
    });
    expect(tpl).not.toBeNull();
    expect(tpl!({ tone: 'clinical', tier: 'COLD' })).toMatch(/Acknowledge/);
  });
});
