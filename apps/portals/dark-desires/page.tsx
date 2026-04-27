import React from 'react';
import { LandingHero } from '../LandingHero';
import { portalConfig } from './portal.config';

export default function DarkDesiresPortalPage(): React.ReactElement {
  return <LandingHero config={portalConfig} />;
}
