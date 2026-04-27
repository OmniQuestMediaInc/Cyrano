// apps/cyrano-standalone/components/AITwinCreator/AITwinCreator.tsx
// CYR: AI Twin Creator wizard — step-by-step creator onboarding for training
//      a Flux LoRA AI twin. This is a client component rendered inside the
//      /ai-twin page route.
'use client';

import React, { useState, useCallback } from 'react';

type WizardStep = 'DETAILS' | 'PHOTOS' | 'REVIEW' | 'TRAINING' | 'DONE';

interface TwinDetails {
  displayName: string;
  personaPrompt: string;
  triggerWord: string;
  visibility: 'PRIVATE' | 'PLATFORM_INTERNAL' | 'SUBSCRIBER';
  isHouseModel: boolean;
}

interface UploadedPhoto {
  photoId: string;
  storageKey: string;
  previewUrl: string;
}

const API_BASE = process.env.NEXT_PUBLIC_CYRANO_API_URL ?? 'http://localhost:3000';

export function AITwinCreator() {
  const [step, setStep] = useState<WizardStep>('DETAILS');
  const [twinId, setTwinId] = useState<string | null>(null);
  const [details, setDetails] = useState<TwinDetails>({
    displayName: '',
    personaPrompt: '',
    triggerWord: '',
    visibility: 'PRIVATE',
    isHouseModel: false,
  });
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [trainingStatus, setTrainingStatus] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // ── Step 1: Submit twin details ──────────────────────────────────────────

  const submitDetails = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const correlationId = `twin-create-${Date.now()}`;
      const res = await fetch(`${API_BASE}/cyrano/ai-twin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creator_id: 'CURRENT_USER', // resolved server-side from session
          display_name: details.displayName,
          persona_prompt: details.personaPrompt,
          trigger_word: details.triggerWord,
          visibility: details.visibility,
          is_house_model: details.isHouseModel,
          correlation_id: correlationId,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { twin_id: string };
      setTwinId(data.twin_id);
      setStep('PHOTOS');
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [details]);

  // ── Step 2: Upload a photo ────────────────────────────────────────────────

  const handlePhotoSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!twinId || !e.target.files?.length) return;
      const file = e.target.files[0];
      setLoading(true);
      setError(null);
      try {
        // In production: get presigned S3 URL, upload directly, then record
        const photoId = `photo-${Date.now()}`;
        const storageKey = `twins/${twinId}/${photoId}.jpg`;
        const previewUrl = URL.createObjectURL(file);

        // Record the upload in the backend
        const res = await fetch(`${API_BASE}/cyrano/ai-twin/${twinId}/photos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ photo_id: photoId, storage_key: storageKey }),
        });
        if (!res.ok) throw new Error(await res.text());

        setPhotos((prev) => [...prev, { photoId, storageKey, previewUrl }]);
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    },
    [twinId],
  );

  // ── Step 3: Start training ────────────────────────────────────────────────

  const startTraining = useCallback(async () => {
    if (!twinId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/cyrano/ai-twin/${twinId}/train`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correlation_id: `train-${twinId}-${Date.now()}` }),
      });
      if (!res.ok) throw new Error(await res.text());
      setTrainingStatus('TRAINING_QUEUED');
      setStep('TRAINING');
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [twinId]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Create Your AI Twin</h1>
      <StepIndicator current={step} />
      {error && <div style={styles.error}>{error}</div>}

      {step === 'DETAILS' && (
        <DetailsForm
          details={details}
          onChange={setDetails}
          onNext={submitDetails}
          loading={loading}
        />
      )}

      {step === 'PHOTOS' && (
        <PhotosStep
          photos={photos}
          onPhotoSelect={handlePhotoSelect}
          onNext={() => setStep('REVIEW')}
          loading={loading}
        />
      )}

      {step === 'REVIEW' && (
        <ReviewStep
          details={details}
          photoCount={photos.length}
          onBack={() => setStep('PHOTOS')}
          onStartTraining={startTraining}
          loading={loading}
        />
      )}

      {step === 'TRAINING' && (
        <div style={styles.card}>
          <h2>Training in Progress</h2>
          <p>Status: <strong>{trainingStatus}</strong></p>
          <p>
            Your AI twin is being trained. This typically takes 15–30 minutes.
            You will receive a notification when it is ready.
          </p>
        </div>
      )}

      {step === 'DONE' && (
        <div style={styles.card}>
          <h2>🎉 AI Twin Ready!</h2>
          <p>Your AI twin is trained and ready for character chat and voice calls.</p>
          <a href="/chat" style={styles.link}>Start Chatting →</a>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: WizardStep }) {
  const steps: WizardStep[] = ['DETAILS', 'PHOTOS', 'REVIEW', 'TRAINING', 'DONE'];
  const labels: Record<WizardStep, string> = {
    DETAILS: '1. Details',
    PHOTOS: '2. Photos',
    REVIEW: '3. Review',
    TRAINING: '4. Training',
    DONE: '5. Done',
  };
  return (
    <div style={styles.stepRow}>
      {steps.map((s) => (
        <span key={s} style={{ ...styles.stepChip, ...(s === current ? styles.stepActive : {}) }}>
          {labels[s]}
        </span>
      ))}
    </div>
  );
}

function DetailsForm({
  details,
  onChange,
  onNext,
  loading,
}: {
  details: TwinDetails;
  onChange: (d: TwinDetails) => void;
  onNext: () => void;
  loading: boolean;
}) {
  const update = (key: keyof TwinDetails, value: string | boolean) =>
    onChange({ ...details, [key]: value });

  return (
    <div style={styles.card}>
      <h2>Twin Details</h2>
      <label style={styles.label}>
        Display Name
        <input
          style={styles.input}
          value={details.displayName}
          onChange={(e) => update('displayName', e.target.value)}
          placeholder="e.g. Scarlett"
        />
      </label>
      <label style={styles.label}>
        Trigger Word (used in image prompts)
        <input
          style={styles.input}
          value={details.triggerWord}
          onChange={(e) => update('triggerWord', e.target.value)}
          placeholder="e.g. ohwx woman"
        />
      </label>
      <label style={styles.label}>
        Persona Prompt (character description for the AI)
        <textarea
          style={{ ...styles.input, height: 80 }}
          value={details.personaPrompt}
          onChange={(e) => update('personaPrompt', e.target.value)}
          placeholder="Describe your character's personality, backstory, and tone…"
        />
      </label>
      <label style={styles.label}>
        Visibility
        <select
          style={styles.input}
          value={details.visibility}
          onChange={(e) => update('visibility', e.target.value as TwinDetails['visibility'])}
        >
          <option value="PRIVATE">Private (only me)</option>
          <option value="PLATFORM_INTERNAL">Platform Internal (house model)</option>
          <option value="SUBSCRIBER">Subscribers</option>
        </select>
      </label>
      <button style={styles.button} onClick={onNext} disabled={loading || !details.displayName}>
        {loading ? 'Saving…' : 'Next: Upload Photos →'}
      </button>
    </div>
  );
}

function PhotosStep({
  photos,
  onPhotoSelect,
  onNext,
  loading,
}: {
  photos: UploadedPhoto[];
  onPhotoSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onNext: () => void;
  loading: boolean;
}) {
  return (
    <div style={styles.card}>
      <h2>Upload Training Photos</h2>
      <p style={styles.hint}>
        Upload at least 5 high-quality photos showing the creator's face from different angles.
        Avoid sunglasses, heavy filters, or group photos.
      </p>
      <div style={styles.photoGrid}>
        {photos.map((p) => (
          <img key={p.photoId} src={p.previewUrl} alt="" style={styles.photoThumb} />
        ))}
        {photos.length < 20 && (
          <label style={styles.uploadBox}>
            <span>+ Add Photo</span>
            <input type="file" accept="image/*" onChange={onPhotoSelect} style={{ display: 'none' }} />
          </label>
        )}
      </div>
      <p>{photos.length} / 5 minimum uploaded</p>
      <button
        style={styles.button}
        onClick={onNext}
        disabled={loading || photos.length < 5}
      >
        {loading ? 'Uploading…' : 'Next: Review →'}
      </button>
    </div>
  );
}

function ReviewStep({
  details,
  photoCount,
  onBack,
  onStartTraining,
  loading,
}: {
  details: TwinDetails;
  photoCount: number;
  onBack: () => void;
  onStartTraining: () => void;
  loading: boolean;
}) {
  return (
    <div style={styles.card}>
      <h2>Review &amp; Start Training</h2>
      <ul style={{ lineHeight: 1.8 }}>
        <li><strong>Name:</strong> {details.displayName}</li>
        <li><strong>Trigger Word:</strong> {details.triggerWord}</li>
        <li><strong>Visibility:</strong> {details.visibility}</li>
        <li><strong>Photos uploaded:</strong> {photoCount}</li>
      </ul>
      <p style={styles.hint}>
        Training a Flux LoRA typically takes 15–30 minutes. You will be notified when ready.
      </p>
      <div style={styles.row}>
        <button style={styles.buttonSecondary} onClick={onBack}>← Back</button>
        <button style={styles.button} onClick={onStartTraining} disabled={loading}>
          {loading ? 'Starting…' : '🚀 Start Training'}
        </button>
      </div>
    </div>
  );
}

// ── Inline styles ─────────────────────────────────────────────────────────────

const styles = {
  container: { maxWidth: 680, margin: '0 auto', padding: 32, fontFamily: 'system-ui, sans-serif' },
  title: { fontSize: 28, marginBottom: 16 },
  card: { background: '#f9f9f9', borderRadius: 8, padding: 24, marginTop: 24 },
  label: { display: 'flex', flexDirection: 'column' as const, gap: 4, marginBottom: 16 },
  input: { padding: '8px 12px', border: '1px solid #ccc', borderRadius: 4, fontSize: 15, width: '100%', boxSizing: 'border-box' as const },
  button: { background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: 6, padding: '10px 24px', fontSize: 15, cursor: 'pointer' },
  buttonSecondary: { background: '#e0e0e0', color: '#333', border: 'none', borderRadius: 6, padding: '10px 24px', fontSize: 15, cursor: 'pointer' },
  stepRow: { display: 'flex', gap: 8, marginBottom: 24 },
  stepChip: { padding: '4px 12px', borderRadius: 16, background: '#eee', fontSize: 13 },
  stepActive: { background: '#1a1a2e', color: '#fff' },
  error: { background: '#fee', border: '1px solid #c00', padding: 12, borderRadius: 4, marginTop: 12, color: '#900' },
  hint: { color: '#666', fontSize: 14 },
  photoGrid: { display: 'flex', flexWrap: 'wrap' as const, gap: 8, marginBottom: 16 },
  photoThumb: { width: 80, height: 80, objectFit: 'cover' as const, borderRadius: 4 },
  uploadBox: { width: 80, height: 80, border: '2px dashed #aaa', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 13, color: '#666' },
  row: { display: 'flex', gap: 12, marginTop: 16 },
  link: { color: '#1a1a2e', fontWeight: 600 },
};
