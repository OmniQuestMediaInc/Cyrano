// apps/cyrano-standalone/components/VoiceCall/VoiceCall.tsx
// CYR: Voice Call — ElevenLabs cloned voice playback for character interactions.
//      Uses the voice-cloning service's TTS endpoint to synthesize character
//      speech and plays it directly in the browser.
'use client';

import React, { useState, useRef, useCallback } from 'react';

interface VoiceCallProps {
  voiceCloneId: string;
  characterName: string;
}

type CallState = 'IDLE' | 'CALLING' | 'CONNECTED' | 'SPEAKING' | 'ENDED';

const API_BASE = process.env.NEXT_PUBLIC_CYRANO_API_URL ?? 'http://localhost:3000';

export function VoiceCall({ voiceCloneId, characterName }: VoiceCallProps) {
  const [callState, setCallState] = useState<CallState>('IDLE');
  const [message, setMessage] = useState('');
  const [transcript, setTranscript] = useState<Array<{ role: string; text: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const startCall = useCallback(() => {
    setCallState('CALLING');
    setTimeout(() => setCallState('CONNECTED'), 1500);
  }, []);

  const endCall = useCallback(() => {
    setCallState('ENDED');
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
  }, []);

  const sendVoiceMessage = useCallback(async () => {
    const text = message.trim();
    if (!text || callState !== 'CONNECTED') return;

    setTranscript((prev) => [...prev, { role: 'You', text }]);
    setMessage('');
    setCallState('SPEAKING');
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/cyrano/voice/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voice_clone_id: voiceCloneId,
          text,
          model: 'eleven_multilingual_v2',
          stability: 0.5,
          similarity_boost: 0.75,
          correlation_id: `tts-${Date.now()}`,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { audio_url: string; characters_used: number };

      if (audioRef.current) {
        audioRef.current.src = data.audio_url;
        await audioRef.current.play();
        audioRef.current.onended = () => setCallState('CONNECTED');
      }

      setTranscript((prev) => [...prev, { role: characterName, text: '(speaking…)' }]);
    } catch (e) {
      setError(String(e));
      setCallState('CONNECTED');
    }
  }, [message, callState, voiceCloneId, characterName]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void sendVoiceMessage();
    }
  };

  return (
    <div style={styles.container}>
      <audio ref={audioRef} style={{ display: 'none' }} />

      <div style={styles.callCard}>
        <div style={styles.avatar}>{characterName[0]}</div>
        <div style={styles.characterName}>{characterName}</div>
        <div style={styles.callStatus}>
          {callState === 'IDLE' && 'Ready to call'}
          {callState === 'CALLING' && 'Calling…'}
          {callState === 'CONNECTED' && '● Connected'}
          {callState === 'SPEAKING' && '🔊 Speaking…'}
          {callState === 'ENDED' && 'Call ended'}
        </div>

        {callState === 'IDLE' && (
          <button style={styles.callBtn} onClick={startCall}>📞 Start Voice Call</button>
        )}

        {(callState === 'CONNECTED' || callState === 'SPEAKING') && (
          <button style={styles.endBtn} onClick={endCall}>🔴 End Call</button>
        )}
      </div>

      {(callState === 'CONNECTED' || callState === 'SPEAKING') && (
        <div style={styles.inputArea}>
          <input
            style={styles.input}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Say something to ${characterName}…`}
            disabled={callState === 'SPEAKING'}
          />
          <button
            style={styles.sendBtn}
            onClick={sendVoiceMessage}
            disabled={callState === 'SPEAKING' || !message.trim()}
          >
            Send
          </button>
        </div>
      )}

      {error && <div style={styles.error}>{error}</div>}

      {transcript.length > 0 && (
        <div style={styles.transcript}>
          <h4 style={{ margin: '0 0 8px' }}>Transcript</h4>
          {transcript.map((t, i) => (
            <div key={i} style={styles.transcriptLine}>
              <strong>{t.role}:</strong> {t.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { maxWidth: 480, margin: '0 auto', padding: 32, fontFamily: 'system-ui, sans-serif' },
  callCard: { background: '#1a1a2e', color: '#fff', borderRadius: 16, padding: 32, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 12 },
  avatar: { width: 72, height: 72, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 },
  characterName: { fontSize: 22, fontWeight: 700 },
  callStatus: { fontSize: 14, opacity: 0.7 },
  callBtn: { background: '#22c55e', color: '#fff', border: 'none', borderRadius: 50, padding: '12px 28px', fontSize: 16, cursor: 'pointer', marginTop: 8 },
  endBtn: { background: '#ef4444', color: '#fff', border: 'none', borderRadius: 50, padding: '12px 28px', fontSize: 16, cursor: 'pointer', marginTop: 8 },
  inputArea: { display: 'flex', gap: 8, marginTop: 20 },
  input: { flex: 1, padding: '10px 14px', border: '1px solid #ccc', borderRadius: 8, fontSize: 15, fontFamily: 'inherit' },
  sendBtn: { background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: 8, padding: '0 18px', fontSize: 15, cursor: 'pointer' },
  error: { background: '#fee', color: '#900', padding: '8px 12px', borderRadius: 4, marginTop: 12, fontSize: 13 },
  transcript: { marginTop: 24, padding: 16, background: '#f5f5f5', borderRadius: 8 },
  transcriptLine: { fontSize: 14, marginBottom: 6, lineHeight: 1.5 },
};
