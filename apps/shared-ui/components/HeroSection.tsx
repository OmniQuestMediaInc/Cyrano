// shared-ui/components/HeroSection.tsx
// I — Reusable Hero Section for portal landing pages.
import React from 'react';
import { PortalTheme } from '../themes';

export interface HeroSectionProps {
  theme: PortalTheme;
  ctaLabel?: string;
  onCtaClick?: () => void;
}

export function HeroSection({
  theme,
  ctaLabel = 'Meet Your Companion',
  onCtaClick,
}: HeroSectionProps): React.ReactElement {
  return (
    <section
      style={{ background: theme.background }}
      className="flex flex-col items-center justify-center min-h-screen px-6 text-center"
    >
      <h1
        style={{ color: theme.primary }}
        className="text-5xl font-extrabold tracking-tight mb-4"
      >
        {theme.name}
      </h1>
      <p
        style={{ color: theme.accent }}
        className="text-xl mb-8 max-w-xl"
      >
        {theme.tagline}
      </p>
      <button
        onClick={onCtaClick}
        style={{ background: theme.primary }}
        className="px-8 py-4 rounded-2xl text-white text-lg font-semibold shadow-lg hover:opacity-90 transition-opacity"
      >
        {ctaLabel}
      </button>
    </section>
  );
}
