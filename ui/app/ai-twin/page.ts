// CYR: /ai-twin — AI Twin Creator Dashboard page.
// Wizard stepper (Photos → Train LoRA → Test Generate → Publish),
// memory bank summary, voice clone CTA, persistent chat preview,
// GateGuard AV compliance overlay, Bill 149 output prefix.
//
// Follows the render-plan convention: no JSX, no React runtime —
// structurally-testable RenderElement tree that maps 1:1 to eventual JSX.

import { SEO } from '../../config/seo';
import { THEME } from '../../config/theme';
import { el, RenderElement } from '../../components/render-plan';
import type {
  AiTwinCreatorDashboardInputs,
  AiTwinCreatorDashboardView,
  Bill149ComplianceTag,
  ChatPreviewMessage,
  GateGuardAvStatus,
  TwinMemorySummaryEntry,
  TwinPhotoUploadRow,
  TwinSessionState,
  TwinTrainingStatus,
  VoiceCloneCtaState,
  WizardStep,
} from '../../types/ai-twin-contracts';

export const AI_TWIN_DASHBOARD_PAGE_RULE_ID = 'AI_TWIN_DASHBOARD_PAGE_v1';

const WIZARD_STEPS: readonly string[] = ['Photos', 'Train LoRA', 'Test Generate', 'Publish'];

const TRAINING_STATUS_TO_WIZARD_STEP: Record<TwinTrainingStatus, WizardStep> = {
  PENDING_UPLOAD: 0,
  UPLOAD_COMPLETE: 1,
  TRAINING_QUEUED: 1,
  TRAINING_IN_PROGRESS: 1,
  TRAINING_COMPLETE: 2,
  TRAINING_FAILED: 1,
  RETIRED: 3,
};

const SESSION_STATE_FOR_STATUS = (
  status: TwinTrainingStatus,
  minutesRemaining: number,
): TwinSessionState => {
  if (status !== 'TRAINING_COMPLETE') return 'GRANTED';
  if (minutesRemaining > 0) return 'GRANTED';
  return 'EXPIRED';
};

export interface AiTwinDashboardPageRender {
  metadata: typeof SEO.ai_twin_dashboard;
  view: AiTwinCreatorDashboardView;
  tree: RenderElement;
  rule_applied_id: string;
}

/** Build the canonical view model from raw inputs. */
function buildView(inputs: AiTwinCreatorDashboardInputs): AiTwinCreatorDashboardView {
  const wizardStep = TRAINING_STATUS_TO_WIZARD_STEP[inputs.training_status];
  const sessionState = SESSION_STATE_FOR_STATUS(
    inputs.training_status,
    inputs.session_minutes_remaining,
  );

  const bill149: Bill149ComplianceTag = {
    prefix: 'AI-GENERATED:',
    required: true,
    reason_code: 'BILL_149_COMPLIANCE',
  };

  const gateguardAv: GateGuardAvStatus = {
    av_required: inputs.av_required ?? true,
    av_cleared: inputs.av_cleared ?? false,
    clearance_id: inputs.clearance_id ?? null,
  };

  const voiceClone: VoiceCloneCtaState = {
    voice_clone_ready: inputs.voice_clone_ready ?? false,
    cta_label: inputs.voice_clone_ready ? 'Manage Voice Clone' : 'Set Up Voice Clone',
    cta_disabled: inputs.training_status !== 'TRAINING_COMPLETE',
  };

  return {
    twin_id: inputs.twin_id,
    creator_id: inputs.creator_id,
    display_name: inputs.display_name,
    training_status: inputs.training_status,
    visibility: inputs.visibility,
    is_house_model: inputs.is_house_model,
    current_wizard_step: wizardStep,
    session_state: sessionState,
    session_minutes_remaining: inputs.session_minutes_remaining,
    photos: inputs.photos,
    photos_required_min: inputs.photos_required_min ?? 5,
    memory_summary: inputs.memory_summary ?? [],
    voice_clone: voiceClone,
    chat_preview: inputs.chat_preview ?? [],
    compliance: {
      bill_149: bill149,
      gateguard_av: gateguardAv,
    },
    generated_at_utc: new Date().toISOString(),
    rule_applied_id: AI_TWIN_DASHBOARD_PAGE_RULE_ID,
  };
}

export function renderAiTwinCreatorDashboard(
  inputs: AiTwinCreatorDashboardInputs,
): AiTwinDashboardPageRender {
  const view = buildView(inputs);

  const tree = el(
    'main',
    {
      test_id: 'ai-twin-dashboard-page',
      classes: ['cnz-ai-twin-dashboard', 'cnz-theme-dark'],
      props: { mode: THEME.default_mode, twin_id: view.twin_id },
      aria: { 'aria-label': 'AI Twin Creator Dashboard' },
    },
    [
      renderComplianceOverlay(view.compliance.gateguard_av),
      renderHeader(view),
      renderWizardStepper(view.current_wizard_step),
      renderStepPanel(view),
      renderMemoryBankSummary(view.memory_summary),
      renderVoiceCloneCta(view.voice_clone, view.twin_id),
      renderChatPreview(view.chat_preview, view.compliance.bill_149),
    ],
  );

  return {
    metadata: SEO.ai_twin_dashboard,
    view,
    tree,
    rule_applied_id: AI_TWIN_DASHBOARD_PAGE_RULE_ID,
  };
}

// ─── Section renderers ────────────────────────────────────────────────────────

/** GateGuard AV compliance overlay — blocks high-value actions when not cleared. */
function renderComplianceOverlay(av: GateGuardAvStatus): RenderElement {
  return el(
    'aside',
    {
      test_id: 'ai-twin-gateguard-av-overlay',
      classes: [
        'cnz-compliance-overlay',
        av.av_cleared ? 'cnz-compliance-overlay--cleared' : 'cnz-compliance-overlay--required',
      ],
      props: {
        av_required: av.av_required,
        av_cleared: av.av_cleared,
        clearance_id: av.clearance_id ?? null,
      },
      aria: {
        'aria-label': av.av_cleared
          ? 'GateGuard AV cleared'
          : 'GateGuard AV verification required',
        'aria-live': 'polite',
      },
    },
    [
      el(
        'p',
        { test_id: 'ai-twin-gateguard-av-status' },
        [
          av.av_cleared
            ? `AV cleared — ID: ${av.clearance_id ?? 'n/a'}`
            : 'Age verification required before uploading photos or generating content.',
        ],
      ),
      av.av_cleared
        ? null
        : el(
            'button',
            {
              test_id: 'ai-twin-gateguard-av-cta',
              classes: ['cnz-button', 'cnz-button--primary'],
              on: { click: 'initiateAgeVerification' },
            },
            ['Verify Age'],
          ),
    ].filter(Boolean) as RenderElement[],
  );
}

function renderHeader(view: AiTwinCreatorDashboardView): RenderElement {
  return el(
    'header',
    {
      test_id: 'ai-twin-dashboard-header',
      classes: ['cnz-ai-twin-dashboard__header'],
    },
    [
      el('h1', { test_id: 'ai-twin-dashboard-name' }, [view.display_name]),
      el(
        'span',
        {
          test_id: 'ai-twin-dashboard-training-status',
          classes: [
            `cnz-status-chip`,
            `cnz-status-chip--${view.training_status.toLowerCase().replace(/_/g, '-')}`,
          ],
          props: { training_status: view.training_status },
        },
        [view.training_status.replace(/_/g, ' ')],
      ),
      view.is_house_model
        ? el(
            'span',
            {
              test_id: 'ai-twin-dashboard-house-model-badge',
              classes: ['cnz-badge', 'cnz-badge--house-model'],
            },
            ['House Model'],
          )
        : null,
      el(
        'span',
        {
          test_id: 'ai-twin-dashboard-session-minutes',
          classes: ['cnz-session-minutes-chip'],
          props: {
            session_state: view.session_state,
            minutes_remaining: view.session_minutes_remaining,
          },
        },
        [
          view.session_state === 'EXPIRED'
            ? 'Session expired — top up to continue'
            : `${view.session_minutes_remaining} min remaining`,
        ],
      ),
    ].filter(Boolean) as RenderElement[],
  );
}

/** Four-step wizard stepper: Photos → Train LoRA → Test Generate → Publish */
function renderWizardStepper(currentStep: WizardStep): RenderElement {
  return el(
    'nav',
    {
      test_id: 'ai-twin-wizard-stepper',
      classes: ['cnz-wizard-stepper'],
      aria: { 'aria-label': 'Training wizard' },
    },
    [
      el(
        'ol',
        { classes: ['cnz-wizard-stepper__steps'] },
        WIZARD_STEPS.map((label, index) =>
          el(
            'li',
            {
              test_id: `ai-twin-wizard-step-${index}`,
              classes: [
                'cnz-wizard-stepper__step',
                index === currentStep ? 'cnz-wizard-stepper__step--active' : '',
                index < currentStep ? 'cnz-wizard-stepper__step--complete' : '',
              ].filter(Boolean),
              props: { step_index: index, active: index === currentStep },
            },
            [
              el(
                'span',
                { classes: ['cnz-wizard-stepper__step-number'] },
                [String(index + 1)],
              ),
              el('span', { classes: ['cnz-wizard-stepper__step-label'] }, [label]),
            ],
          ),
        ),
      ),
    ],
  );
}

/** Content panel corresponding to the active wizard step. */
function renderStepPanel(view: AiTwinCreatorDashboardView): RenderElement {
  switch (view.current_wizard_step) {
    case 0:
      return renderPhotosStep(view.photos, view.photos_required_min, view.compliance.gateguard_av);
    case 1:
      return renderTrainLoraStep(view.training_status, view.twin_id);
    case 2:
      return renderTestGenerateStep(view.twin_id, view.compliance.bill_149);
    case 3:
      return renderPublishStep(view.twin_id, view.visibility);
    default:
      return renderPhotosStep(view.photos, view.photos_required_min, view.compliance.gateguard_av);
  }
}

function renderPhotosStep(
  photos: TwinPhotoUploadRow[],
  minPhotos: number,
  av: GateGuardAvStatus,
): RenderElement {
  const uploadDisabled = av.av_required && !av.av_cleared;
  return el(
    'section',
    {
      test_id: 'ai-twin-step-photos',
      classes: ['cnz-panel', 'cnz-panel--wizard-step'],
      aria: { 'aria-label': 'Step 1: Upload photos' },
    },
    [
      el('h2', {}, ['Step 1 — Upload Photos']),
      el('p', {}, [
        `Upload at least ${minPhotos} high-quality, front-facing photos to train your twin. ` +
          'GateGuard AV verification is required before uploading.',
      ]),
      el(
        'button',
        {
          test_id: 'ai-twin-photos-upload-btn',
          classes: [
            'cnz-button',
            uploadDisabled ? 'cnz-button--disabled' : 'cnz-button--primary',
          ],
          on: { click: 'openPhotoUpload' },
          props: { disabled: uploadDisabled },
        },
        [uploadDisabled ? 'AV required to upload' : 'Upload Photos'],
      ),
      el(
        'ul',
        {
          test_id: 'ai-twin-photos-list',
          classes: ['cnz-photo-list'],
          props: { count: photos.length, min_required: minPhotos },
        },
        photos.map((p) =>
          el(
            'li',
            {
              test_id: `ai-twin-photo-${p.photo_id}`,
              classes: ['cnz-photo-list__item'],
              props: { photo_id: p.photo_id, storage_key: p.storage_key },
            },
            [
              el('span', {}, [p.photo_id]),
              el('time', { props: { datetime: p.uploaded_at_utc } }, [p.uploaded_at_utc]),
            ],
          ),
        ),
      ),
      el(
        'p',
        {
          test_id: 'ai-twin-photos-count',
          classes: ['cnz-helper-text'],
          props: { count: photos.length, min_required: minPhotos },
        },
        [`${photos.length} / ${minPhotos} photos uploaded`],
      ),
    ],
  );
}

function renderTrainLoraStep(status: TwinTrainingStatus, twinId: string): RenderElement {
  const canTrain = status === 'UPLOAD_COMPLETE';
  const inProgress =
    status === 'TRAINING_QUEUED' || status === 'TRAINING_IN_PROGRESS';
  const failed = status === 'TRAINING_FAILED';

  return el(
    'section',
    {
      test_id: 'ai-twin-step-train-lora',
      classes: ['cnz-panel', 'cnz-panel--wizard-step'],
      aria: { 'aria-label': 'Step 2: Train LoRA model' },
    },
    [
      el('h2', {}, ['Step 2 — Train LoRA']),
      el('p', {}, [
        'Fine-tune a Flux-1-dev LoRA model on your uploaded photos. ' +
          'Training typically takes 15–30 minutes.',
      ]),
      failed
        ? el(
            'p',
            {
              test_id: 'ai-twin-train-error',
              classes: ['cnz-alert', 'cnz-alert--danger'],
            },
            ['Training failed. Review photos and retry.'],
          )
        : null,
      inProgress
        ? el(
            'div',
            {
              test_id: 'ai-twin-train-progress',
              classes: ['cnz-progress-indicator'],
              aria: { 'aria-label': 'Training in progress', 'aria-busy': 'true' },
            },
            [el('span', {}, ['Training in progress…'])],
          )
        : null,
      el(
        'button',
        {
          test_id: 'ai-twin-train-btn',
          classes: [
            'cnz-button',
            canTrain || failed ? 'cnz-button--primary' : 'cnz-button--disabled',
          ],
          on: { click: 'startTraining' },
          props: { twin_id: twinId, disabled: !canTrain && !failed },
        },
        [inProgress ? 'Training…' : failed ? 'Retry Training' : 'Start Training'],
      ),
    ].filter(Boolean) as RenderElement[],
  );
}

function renderTestGenerateStep(
  twinId: string,
  bill149: Bill149ComplianceTag,
): RenderElement {
  return el(
    'section',
    {
      test_id: 'ai-twin-step-test-generate',
      classes: ['cnz-panel', 'cnz-panel--wizard-step'],
      aria: { 'aria-label': 'Step 3: Test generate' },
    },
    [
      el('h2', {}, ['Step 3 — Test Generate']),
      el('p', {}, [
        'Generate a sample image using your trained LoRA to verify likeness before publishing.',
      ]),
      el(
        'div',
        {
          test_id: 'ai-twin-bill149-notice',
          classes: ['cnz-compliance-notice'],
          props: {
            prefix: bill149.prefix,
            reason_code: bill149.reason_code,
          },
        },
        [
          el('strong', {}, [bill149.prefix]),
          el('span', {}, [' All generated outputs carry this prefix per Bill 149 compliance.']),
        ],
      ),
      el(
        'button',
        {
          test_id: 'ai-twin-test-generate-btn',
          classes: ['cnz-button', 'cnz-button--primary'],
          on: { click: 'testGenerate' },
          props: { twin_id: twinId },
        },
        ['Generate Test Image'],
      ),
      el(
        'div',
        {
          test_id: 'ai-twin-test-generate-output',
          classes: ['cnz-generated-output-preview'],
          aria: { 'aria-label': 'Generated image preview', 'aria-live': 'polite' },
        },
        [],
      ),
    ],
  );
}

function renderPublishStep(twinId: string, visibility: string): RenderElement {
  return el(
    'section',
    {
      test_id: 'ai-twin-step-publish',
      classes: ['cnz-panel', 'cnz-panel--wizard-step'],
      aria: { 'aria-label': 'Step 4: Publish twin' },
    },
    [
      el('h2', {}, ['Step 4 — Publish']),
      el('p', {}, ['Set visibility and publish your twin to your subscriber audience.']),
      el(
        'div',
        {
          test_id: 'ai-twin-publish-visibility',
          classes: ['cnz-field'],
        },
        [
          el('label', { props: { for: 'visibility-select' } }, ['Visibility']),
          el(
            'select',
            {
              test_id: 'ai-twin-visibility-select',
              on: { change: 'setVisibility' },
              props: { value: visibility },
            },
            [
              el('option', { props: { value: 'PRIVATE' } }, ['Private']),
              el('option', { props: { value: 'PLATFORM_INTERNAL' } }, ['Platform Internal']),
              el('option', { props: { value: 'SUBSCRIBER' } }, ['Subscriber']),
            ],
          ),
        ],
      ),
      el(
        'button',
        {
          test_id: 'ai-twin-publish-btn',
          classes: ['cnz-button', 'cnz-button--primary'],
          on: { click: 'publishTwin' },
          props: { twin_id: twinId },
        },
        ['Publish Twin'],
      ),
    ],
  );
}

function renderMemoryBankSummary(memories: TwinMemorySummaryEntry[]): RenderElement {
  if (memories.length === 0) {
    return el(
      'section',
      {
        test_id: 'ai-twin-memory-bank',
        classes: ['cnz-panel', 'cnz-panel--memory-bank', 'cnz-panel--empty'],
        aria: { 'aria-label': 'Memory bank summary' },
      },
      [el('p', {}, ['No memories yet — memories are built during Cyrano sessions.'])],
    );
  }

  return el(
    'section',
    {
      test_id: 'ai-twin-memory-bank',
      classes: ['cnz-panel', 'cnz-panel--memory-bank'],
      aria: { 'aria-label': 'Memory bank summary' },
    },
    [
      el('h2', {}, [`Memory Bank (${memories.length})`]),
      el(
        'ul',
        { classes: ['cnz-memory-list'] },
        memories.map((m, i) =>
          el(
            'li',
            {
              test_id: `ai-twin-memory-${i}`,
              classes: ['cnz-memory-list__item'],
              props: { memory_type: m.memory_type, importance_score: m.importance_score },
            },
            [
              el(
                'span',
                { classes: ['cnz-memory-list__type-chip'] },
                [m.memory_type],
              ),
              el('span', { classes: ['cnz-memory-list__preview'] }, [m.content_preview]),
            ],
          ),
        ),
      ),
    ],
  );
}

function renderVoiceCloneCta(voice: VoiceCloneCtaState, twinId: string): RenderElement {
  return el(
    'section',
    {
      test_id: 'ai-twin-voice-clone',
      classes: ['cnz-panel', 'cnz-panel--voice-clone'],
      aria: { 'aria-label': 'Voice clone' },
    },
    [
      el('h2', {}, ['Voice Clone']),
      el('p', {}, [
        voice.voice_clone_ready
          ? 'Your voice clone is active. Subscribers hear your voice in Cyrano sessions.'
          : 'Add a voice clone to make Cyrano sessions immersive. ' +
              'Available after training completes.',
      ]),
      el(
        'button',
        {
          test_id: 'ai-twin-voice-clone-cta',
          classes: [
            'cnz-button',
            voice.cta_disabled ? 'cnz-button--disabled' : 'cnz-button--secondary',
          ],
          on: { click: 'openVoiceClone' },
          props: { twin_id: twinId, disabled: voice.cta_disabled },
        },
        [voice.cta_label],
      ),
    ],
  );
}

function renderChatPreview(
  messages: ChatPreviewMessage[],
  bill149: Bill149ComplianceTag,
): RenderElement {
  if (messages.length === 0) {
    return el(
      'section',
      {
        test_id: 'ai-twin-chat-preview',
        classes: ['cnz-panel', 'cnz-panel--chat-preview', 'cnz-panel--empty'],
        aria: { 'aria-label': 'Persistent chat preview' },
      },
      [el('p', {}, ['Chat preview appears here once your twin is published.'])],
    );
  }

  return el(
    'section',
    {
      test_id: 'ai-twin-chat-preview',
      classes: ['cnz-panel', 'cnz-panel--chat-preview'],
      aria: { 'aria-label': 'Persistent chat preview' },
    },
    [
      el('h2', {}, ['Chat Preview']),
      el(
        'div',
        {
          test_id: 'ai-twin-chat-preview-bill149-label',
          classes: ['cnz-compliance-label'],
          props: { prefix: bill149.prefix, reason_code: bill149.reason_code },
        },
        [bill149.prefix],
      ),
      el(
        'ol',
        { classes: ['cnz-chat-preview__messages'] },
        messages.map((m, i) =>
          el(
            'li',
            {
              test_id: `ai-twin-chat-preview-msg-${i}`,
              classes: ['cnz-chat-preview__message', `cnz-chat-preview__message--${m.role}`],
              props: { role: m.role },
            },
            [
              el('span', { classes: ['cnz-chat-preview__role'] }, [m.role]),
              el('p', { classes: ['cnz-chat-preview__content'] }, [m.content]),
              el(
                'time',
                {
                  classes: ['cnz-chat-preview__time'],
                  props: { datetime: m.timestamp_utc },
                },
                [m.timestamp_utc],
              ),
            ],
          ),
        ),
      ),
    ],
  );
}
