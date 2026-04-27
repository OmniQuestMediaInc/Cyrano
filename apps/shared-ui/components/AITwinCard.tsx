// AITwinCard — displays an AI Twin character with optional portal theme support.
import React from 'react';

export interface AiTwin {
  id: string;
  name: string;
  persona: string;
  avatarUrl?: string;
}

export interface Theme {
  primaryColor?: string;
  accentColor?: string;
}

interface AITwinCardProps {
  twin: AiTwin;
  theme?: Theme;
  onSelect?: (twin: AiTwin) => void;
}

export function AITwinCard({ twin, theme, onSelect }: AITwinCardProps): React.ReactElement {
  const accent = theme?.accentColor ?? '#e94560';
  const bg = theme?.primaryColor ?? '#1a1a2e';

  return (
    <div
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onClick={() => onSelect?.(twin)}
      onKeyDown={(e) => {
        if (onSelect && (e.key === 'Enter' || e.key === ' ')) {
          onSelect(twin);
        }
      }}
      style={{
        backgroundColor: bg,
        border: `2px solid ${accent}33`,
        borderRadius: '12px',
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.75rem',
        cursor: onSelect ? 'pointer' : 'default',
        transition: 'border-color 0.2s',
        minWidth: '160px',
      }}
    >
      {twin.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={twin.avatarUrl}
          alt={twin.name}
          style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            objectFit: 'cover',
            border: `2px solid ${accent}`,
          }}
        />
      ) : (
        <div
          aria-hidden="true"
          style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            backgroundColor: `${accent}22`,
            border: `2px solid ${accent}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2rem',
          }}
        >
          {twin.name.charAt(0)}
        </div>
      )}

      <p style={{ fontWeight: 700, color: '#fff', margin: 0, textAlign: 'center' }}>
        {twin.name}
      </p>
      <p
        style={{
          fontSize: '0.8rem',
          color: '#aaa',
          margin: 0,
          textAlign: 'center',
          textTransform: 'capitalize',
        }}
      >
        {twin.persona}
      </p>
    </div>
  );
}
