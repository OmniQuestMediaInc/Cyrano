// Shared Landing Hero component — used by all 6 portal landing pages.
// Apply portal theme via CSS custom properties or className overrides.
import React from 'react';
import type { PortalConfig } from '../portal.types';

interface LandingHeroProps {
  config: PortalConfig;
}

export function LandingHero({ config }: LandingHeroProps): React.ReactElement {
  return (
    <section
      style={{
        backgroundColor: config.theme.primaryColor,
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        fontFamily: 'sans-serif',
        color: '#fff',
        textAlign: 'center',
      }}
    >
      <h1
        style={{
          fontSize: 'clamp(2rem, 5vw, 4rem)',
          fontWeight: 700,
          marginBottom: '1rem',
          color: config.theme.accentColor,
        }}
      >
        {config.name}
      </h1>

      <p
        style={{
          fontSize: 'clamp(1rem, 2.5vw, 1.5rem)',
          maxWidth: '600px',
          opacity: 0.9,
          marginBottom: '2.5rem',
          lineHeight: 1.6,
        }}
      >
        {config.tagline}
      </p>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1rem',
          justifyContent: 'center',
          marginBottom: '3rem',
        }}
      >
        {config.defaultCharacterPacks.map((pack) => (
          <div
            key={pack.name}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: `1px solid ${config.theme.accentColor}44`,
              borderRadius: '12px',
              padding: '1rem 1.5rem',
              minWidth: '140px',
            }}
          >
            <p style={{ fontWeight: 600, margin: 0 }}>{pack.name}</p>
            <p
              style={{
                fontSize: '0.8rem',
                opacity: 0.7,
                margin: '0.25rem 0 0',
                textTransform: 'capitalize',
              }}
            >
              {pack.persona}
            </p>
          </div>
        ))}
      </div>

      <a
        href={process.env.NEXT_PUBLIC_API_URL ? '/signup' : '#'}
        style={{
          backgroundColor: config.theme.accentColor,
          color: '#fff',
          padding: '1rem 2.5rem',
          borderRadius: '8px',
          fontWeight: 700,
          fontSize: '1.1rem',
          textDecoration: 'none',
          display: 'inline-block',
        }}
      >
        Get Started
      </a>

      <p
        style={{
          marginTop: '2rem',
          fontSize: '0.75rem',
          opacity: 0.5,
        }}
      >
        18+ only. All AI companions are fictional adults.
      </p>
    </section>
  );
}
