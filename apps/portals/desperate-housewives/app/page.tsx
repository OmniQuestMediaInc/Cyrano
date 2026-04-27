// apps/portals/desperate-housewives/app/page.tsx
// I — Portal landing page: Desperate Housewives — SEO metadata + Hero section.
import type { Metadata } from 'next';
import { getTheme, getPortalDescription, getPortalKeywords } from '@cyrano/shared-ui';

const PORTAL = 'DESPERATE_HOUSEWIVES';
const PORTAL_SLUG = 'desperate-housewives';

export async function generateMetadata(): Promise<Metadata> {
  const theme = getTheme(PORTAL);
  return {
    title: `${theme.name} - AI Companions`,
    description: getPortalDescription(PORTAL_SLUG),
    keywords: getPortalKeywords(PORTAL_SLUG).join(', '),
    openGraph: {
      title: `${theme.name} - AI Companions`,
      description: getPortalDescription(PORTAL_SLUG),
      images: [{ url: `/og-image.jpg` }],
    },
  };
}

export default function DesperateHousewivesPage() {
  const theme = getTheme(PORTAL);
  return (
    <main
      style={{ background: theme.background, minHeight: '100vh' }}
      className="flex flex-col items-center justify-center px-6 text-center"
    >
      <h1 style={{ color: theme.primary }} className="text-5xl font-extrabold mb-4">
        {theme.name}
      </h1>
      <p style={{ color: theme.accent }} className="text-xl mb-8 max-w-xl">
        {theme.tagline}
      </p>
      <a
        href="/signup"
        style={{ background: theme.primary }}
        className="px-8 py-4 rounded-2xl text-white text-lg font-semibold shadow-lg hover:opacity-90 transition-opacity"
      >
        Meet Your Companion
      </a>
    </main>
  );
}
