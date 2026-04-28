// CYR: AI Twin Creator Dashboard page — render-plan test suite.

import {
  renderAiTwinCreatorDashboard,
  AI_TWIN_DASHBOARD_PAGE_RULE_ID,
} from '../../ui/app/ai-twin/page';
import { findByTestId, collectTestIds } from '../../ui/components/render-plan';
import type { AiTwinCreatorDashboardInputs } from '../../ui/types/ai-twin-contracts';

const MINIMAL_INPUTS: AiTwinCreatorDashboardInputs = {
  twin_id: 'twin_001',
  creator_id: 'creator_42',
  display_name: 'Nova',
  training_status: 'PENDING_UPLOAD',
  visibility: 'PRIVATE',
  is_house_model: false,
  session_minutes_remaining: 60,
  photos: [],
};

describe('renderAiTwinCreatorDashboard', () => {
  it('returns the correct rule_applied_id', () => {
    const { rule_applied_id } = renderAiTwinCreatorDashboard(MINIMAL_INPUTS);
    expect(rule_applied_id).toBe(AI_TWIN_DASHBOARD_PAGE_RULE_ID);
  });

  it('renders the main page node with test_id', () => {
    const { tree } = renderAiTwinCreatorDashboard(MINIMAL_INPUTS);
    expect(tree.test_id).toBe('ai-twin-dashboard-page');
    expect(tree.classes).toContain('cnz-ai-twin-dashboard');
    expect(tree.classes).toContain('cnz-theme-dark');
  });

  it('renders the dashboard header with twin name and training status', () => {
    const { tree } = renderAiTwinCreatorDashboard(MINIMAL_INPUTS);
    const header = findByTestId(tree, 'ai-twin-dashboard-header');
    expect(header).toBeDefined();

    const name = findByTestId(tree, 'ai-twin-dashboard-name');
    expect(name).toBeDefined();
    expect(name!.children).toContain('Nova');

    const status = findByTestId(tree, 'ai-twin-dashboard-training-status');
    expect(status).toBeDefined();
    expect(status!.props?.training_status).toBe('PENDING_UPLOAD');
  });

  it('does not render house model badge when is_house_model is false', () => {
    const { tree } = renderAiTwinCreatorDashboard(MINIMAL_INPUTS);
    const badge = findByTestId(tree, 'ai-twin-dashboard-house-model-badge');
    expect(badge).toBeUndefined();
  });

  it('renders house model badge when is_house_model is true', () => {
    const { tree } = renderAiTwinCreatorDashboard({
      ...MINIMAL_INPUTS,
      is_house_model: true,
    });
    const badge = findByTestId(tree, 'ai-twin-dashboard-house-model-badge');
    expect(badge).toBeDefined();
    expect(badge!.classes).toContain('cnz-badge--house-model');
  });

  describe('wizard stepper', () => {
    it('renders a stepper with 4 steps', () => {
      const { tree } = renderAiTwinCreatorDashboard(MINIMAL_INPUTS);
      const stepper = findByTestId(tree, 'ai-twin-wizard-stepper');
      expect(stepper).toBeDefined();
      for (let i = 0; i < 4; i++) {
        expect(findByTestId(tree, `ai-twin-wizard-step-${i}`)).toBeDefined();
      }
    });

    it('marks step 0 (Photos) as active when status is PENDING_UPLOAD', () => {
      const { tree } = renderAiTwinCreatorDashboard(MINIMAL_INPUTS);
      const step0 = findByTestId(tree, 'ai-twin-wizard-step-0');
      expect(step0!.classes).toContain('cnz-wizard-stepper__step--active');
      expect(step0!.props?.active).toBe(true);
    });

    it('marks step 1 (Train LoRA) as active when status is TRAINING_IN_PROGRESS', () => {
      const { tree } = renderAiTwinCreatorDashboard({
        ...MINIMAL_INPUTS,
        training_status: 'TRAINING_IN_PROGRESS',
      });
      const step1 = findByTestId(tree, 'ai-twin-wizard-step-1');
      expect(step1!.classes).toContain('cnz-wizard-stepper__step--active');
    });

    it('marks step 2 (Test Generate) as active when status is TRAINING_COMPLETE', () => {
      const { tree } = renderAiTwinCreatorDashboard({
        ...MINIMAL_INPUTS,
        training_status: 'TRAINING_COMPLETE',
      });
      const step2 = findByTestId(tree, 'ai-twin-wizard-step-2');
      expect(step2!.classes).toContain('cnz-wizard-stepper__step--active');
    });
  });

  describe('Photos step panel', () => {
    it('renders the photos upload step when wizard is on step 0', () => {
      const { tree } = renderAiTwinCreatorDashboard(MINIMAL_INPUTS);
      expect(findByTestId(tree, 'ai-twin-step-photos')).toBeDefined();
    });

    it('renders photo count label', () => {
      const { tree } = renderAiTwinCreatorDashboard({
        ...MINIMAL_INPUTS,
        photos: [{ photo_id: 'p1', storage_key: 'sk1', uploaded_at_utc: '2026-04-28T00:00:00Z' }],
      });
      const countNode = findByTestId(tree, 'ai-twin-photos-count');
      expect(countNode).toBeDefined();
      expect(countNode!.props?.count).toBe(1);
    });

    it('disables upload button when AV not cleared', () => {
      const { tree } = renderAiTwinCreatorDashboard({
        ...MINIMAL_INPUTS,
        av_required: true,
        av_cleared: false,
      });
      const btn = findByTestId(tree, 'ai-twin-photos-upload-btn');
      expect(btn!.props?.disabled).toBe(true);
      expect(btn!.classes).toContain('cnz-button--disabled');
    });

    it('enables upload button when AV is cleared', () => {
      const { tree } = renderAiTwinCreatorDashboard({
        ...MINIMAL_INPUTS,
        av_required: true,
        av_cleared: true,
        clearance_id: 'clr_001',
      });
      const btn = findByTestId(tree, 'ai-twin-photos-upload-btn');
      expect(btn!.props?.disabled).toBe(false);
      expect(btn!.classes).toContain('cnz-button--primary');
    });
  });

  describe('Train LoRA step panel', () => {
    it('renders Train LoRA step when status is UPLOAD_COMPLETE', () => {
      const { tree } = renderAiTwinCreatorDashboard({
        ...MINIMAL_INPUTS,
        training_status: 'UPLOAD_COMPLETE',
      });
      expect(findByTestId(tree, 'ai-twin-step-train-lora')).toBeDefined();
    });

    it('shows training in-progress indicator when TRAINING_IN_PROGRESS', () => {
      const { tree } = renderAiTwinCreatorDashboard({
        ...MINIMAL_INPUTS,
        training_status: 'TRAINING_IN_PROGRESS',
      });
      expect(findByTestId(tree, 'ai-twin-train-progress')).toBeDefined();
    });

    it('shows error alert on TRAINING_FAILED', () => {
      const { tree } = renderAiTwinCreatorDashboard({
        ...MINIMAL_INPUTS,
        training_status: 'TRAINING_FAILED',
      });
      expect(findByTestId(tree, 'ai-twin-train-error')).toBeDefined();
    });
  });

  describe('Test Generate step panel', () => {
    it('renders Bill 149 compliance notice', () => {
      const { tree } = renderAiTwinCreatorDashboard({
        ...MINIMAL_INPUTS,
        training_status: 'TRAINING_COMPLETE',
      });
      const notice = findByTestId(tree, 'ai-twin-bill149-notice');
      expect(notice).toBeDefined();
      expect(notice!.props?.reason_code).toBe('BILL_149_COMPLIANCE');
      expect(notice!.props?.prefix).toBe('AI-GENERATED:');
    });

    it('renders test generate button', () => {
      const { tree } = renderAiTwinCreatorDashboard({
        ...MINIMAL_INPUTS,
        training_status: 'TRAINING_COMPLETE',
      });
      const btn = findByTestId(tree, 'ai-twin-test-generate-btn');
      expect(btn).toBeDefined();
      expect(btn!.on?.click).toBe('testGenerate');
    });
  });

  describe('GateGuard AV overlay', () => {
    it('renders overlay as cleared when av_cleared=true', () => {
      const { tree } = renderAiTwinCreatorDashboard({
        ...MINIMAL_INPUTS,
        av_cleared: true,
        clearance_id: 'clr_abc',
      });
      const overlay = findByTestId(tree, 'ai-twin-gateguard-av-overlay');
      expect(overlay).toBeDefined();
      expect(overlay!.classes).toContain('cnz-compliance-overlay--cleared');
      expect(overlay!.props?.av_cleared).toBe(true);
    });

    it('renders verify age button when av not cleared', () => {
      const { tree } = renderAiTwinCreatorDashboard({ ...MINIMAL_INPUTS, av_cleared: false });
      const cta = findByTestId(tree, 'ai-twin-gateguard-av-cta');
      expect(cta).toBeDefined();
      expect(cta!.on?.click).toBe('initiateAgeVerification');
    });
  });

  describe('memory bank summary', () => {
    it('renders empty state when no memories', () => {
      const { tree } = renderAiTwinCreatorDashboard(MINIMAL_INPUTS);
      const bank = findByTestId(tree, 'ai-twin-memory-bank');
      expect(bank).toBeDefined();
      expect(bank!.classes).toContain('cnz-panel--empty');
    });

    it('renders memory entries when present', () => {
      const { tree } = renderAiTwinCreatorDashboard({
        ...MINIMAL_INPUTS,
        memory_summary: [
          { memory_type: 'FACT', content_preview: 'User prefers coffee', importance_score: 0.7 },
          { memory_type: 'SECRET', content_preview: 'User confessed…', importance_score: 1.0 },
        ],
      });
      expect(findByTestId(tree, 'ai-twin-memory-0')).toBeDefined();
      expect(findByTestId(tree, 'ai-twin-memory-1')).toBeDefined();
    });
  });

  describe('voice clone CTA', () => {
    it('renders voice clone section', () => {
      const { tree } = renderAiTwinCreatorDashboard(MINIMAL_INPUTS);
      expect(findByTestId(tree, 'ai-twin-voice-clone')).toBeDefined();
    });

    it('disables CTA when training not complete', () => {
      const { tree } = renderAiTwinCreatorDashboard({
        ...MINIMAL_INPUTS,
        training_status: 'PENDING_UPLOAD',
      });
      const btn = findByTestId(tree, 'ai-twin-voice-clone-cta');
      expect(btn!.props?.disabled).toBe(true);
      expect(btn!.classes).toContain('cnz-button--disabled');
    });

    it('enables CTA when training complete and voice clone ready', () => {
      const { tree } = renderAiTwinCreatorDashboard({
        ...MINIMAL_INPUTS,
        training_status: 'TRAINING_COMPLETE',
        voice_clone_ready: true,
      });
      const btn = findByTestId(tree, 'ai-twin-voice-clone-cta');
      expect(btn!.props?.disabled).toBe(false);
    });
  });

  describe('chat preview', () => {
    it('renders empty state when no messages', () => {
      const { tree } = renderAiTwinCreatorDashboard(MINIMAL_INPUTS);
      const preview = findByTestId(tree, 'ai-twin-chat-preview');
      expect(preview).toBeDefined();
      expect(preview!.classes).toContain('cnz-panel--empty');
    });

    it('renders chat messages with Bill 149 label', () => {
      const { tree } = renderAiTwinCreatorDashboard({
        ...MINIMAL_INPUTS,
        chat_preview: [
          { role: 'twin', content: 'Hello!', timestamp_utc: '2026-04-28T10:00:00Z' },
          { role: 'user', content: 'Hi there', timestamp_utc: '2026-04-28T10:00:05Z' },
        ],
      });
      expect(findByTestId(tree, 'ai-twin-chat-preview-msg-0')).toBeDefined();
      expect(findByTestId(tree, 'ai-twin-chat-preview-msg-1')).toBeDefined();
      const label = findByTestId(tree, 'ai-twin-chat-preview-bill149-label');
      expect(label).toBeDefined();
      expect(label!.props?.prefix).toBe('AI-GENERATED:');
    });
  });

  it('has a stable set of top-level test_ids across a typical render', () => {
    const { tree } = renderAiTwinCreatorDashboard({
      ...MINIMAL_INPUTS,
      training_status: 'TRAINING_COMPLETE',
      av_cleared: true,
      clearance_id: 'clr_x',
      memory_summary: [{ memory_type: 'FACT', content_preview: 'fact', importance_score: 0.5 }],
      chat_preview: [{ role: 'twin', content: 'hi', timestamp_utc: '2026-04-28T00:00:00Z' }],
    });
    const ids = collectTestIds(tree);
    expect(ids).toContain('ai-twin-dashboard-page');
    expect(ids).toContain('ai-twin-wizard-stepper');
    expect(ids).toContain('ai-twin-gateguard-av-overlay');
    expect(ids).toContain('ai-twin-voice-clone');
    expect(ids).toContain('ai-twin-memory-bank');
    expect(ids).toContain('ai-twin-chat-preview');
    expect(ids.length).toBeGreaterThan(10);
  });
});
