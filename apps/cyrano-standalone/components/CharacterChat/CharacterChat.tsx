// apps/cyrano-standalone/components/CharacterChat/CharacterChat.tsx
// CYR: Character Chat — persistent narrative conversation with an AI twin.
//      Pulls narrative context from the memory bank and renders the
//      conversation with the twin's persona.
'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';

interface Message {
  id: string;
  role: 'user' | 'character';
  content: string;
  timestamp: string;
}

interface CharacterChatProps {
  twinId: string;
  twinName: string;
  userId: string;
}

const API_BASE = process.env.NEXT_PUBLIC_CYRANO_API_URL ?? 'http://localhost:3000';

export function CharacterChat({ twinId, twinName, userId }: CharacterChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      // 1. Build narrative context (pulls memory bank + active branch)
      const contextRes = await fetch(`${API_BASE}/cyrano/narrative/context`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          twin_id: twinId,
          user_id: userId,
          current_message: text,
          max_memory_entries: 20,
        }),
      });
      if (!contextRes.ok) throw new Error(await contextRes.text());
      const context = (await contextRes.json()) as { persona_prompt_injection: string };

      // 2. Send to Cyrano layer for AI reply (routes through the existing cyrano service)
      const chatRes = await fetch(`${API_BASE}/cyrano/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          twin_id: twinId,
          user_id: userId,
          message: text,
          system_context: context.persona_prompt_injection,
        }),
      });
      if (!chatRes.ok) throw new Error(await chatRes.text());
      const reply = (await chatRes.json()) as { reply: string; memory_stored?: boolean };

      const charMsg: Message = {
        id: `c-${Date.now()}`,
        role: 'character',
        content: reply.reply,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, charMsg]);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [input, loading, twinId, userId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.avatar}>{twinName[0]}</div>
        <div>
          <div style={styles.twinName}>{twinName}</div>
          <div style={styles.subline}>AI Character · Persistent Memory Active</div>
        </div>
      </div>

      <div style={styles.chatWindow}>
        {messages.length === 0 && (
          <div style={styles.emptyState}>
            Say hello to {twinName}. They remember everything about you.
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              ...styles.bubble,
              ...(m.role === 'user' ? styles.userBubble : styles.charBubble),
            }}
          >
            <div style={styles.bubbleRole}>{m.role === 'user' ? 'You' : twinName}</div>
            <div style={styles.bubbleContent}>{m.content}</div>
          </div>
        ))}
        {loading && (
          <div style={{ ...styles.bubble, ...styles.charBubble }}>
            <div style={styles.bubbleRole}>{twinName}</div>
            <div style={{ ...styles.bubbleContent, color: '#999' }}>Thinking…</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.inputRow}>
        <textarea
          style={styles.textarea}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Message ${twinName}…`}
          rows={2}
          disabled={loading}
        />
        <button style={styles.sendBtn} onClick={sendMessage} disabled={loading || !input.trim()}>
          Send
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: { display: 'flex', flexDirection: 'column' as const, height: '100vh', maxWidth: 720, margin: '0 auto', fontFamily: 'system-ui, sans-serif' },
  header: { display: 'flex', alignItems: 'center', gap: 12, padding: '16px 24px', borderBottom: '1px solid #eee', background: '#fff' },
  avatar: { width: 44, height: 44, borderRadius: '50%', background: '#1a1a2e', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700 },
  twinName: { fontWeight: 700, fontSize: 18 },
  subline: { fontSize: 12, color: '#888', marginTop: 2 },
  chatWindow: { flex: 1, overflowY: 'auto' as const, padding: '24px 16px', display: 'flex', flexDirection: 'column' as const, gap: 16 },
  emptyState: { textAlign: 'center' as const, color: '#999', marginTop: 48, fontSize: 15 },
  bubble: { maxWidth: '75%', padding: '10px 14px', borderRadius: 12 },
  userBubble: { alignSelf: 'flex-end' as const, background: '#1a1a2e', color: '#fff' },
  charBubble: { alignSelf: 'flex-start' as const, background: '#f1f1f1', color: '#111' },
  bubbleRole: { fontSize: 11, fontWeight: 700, marginBottom: 4, opacity: 0.7, textTransform: 'uppercase' as const, letterSpacing: '0.05em' },
  bubbleContent: { fontSize: 15, lineHeight: 1.5 },
  error: { background: '#fee', color: '#900', padding: '8px 16px', fontSize: 13 },
  inputRow: { display: 'flex', gap: 8, padding: '12px 16px', borderTop: '1px solid #eee', background: '#fff' },
  textarea: { flex: 1, padding: '10px 12px', border: '1px solid #ccc', borderRadius: 8, fontSize: 15, resize: 'none' as const, fontFamily: 'inherit' },
  sendBtn: { background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: 8, padding: '0 20px', fontSize: 15, cursor: 'pointer', alignSelf: 'stretch' as const },
};
