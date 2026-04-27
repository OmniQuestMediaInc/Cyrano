// apps/cyrano-standalone/app/ai-twin/page.tsx
// CYR: AI Twin Creator wizard page route
import { AITwinCreator } from '../../components/AITwinCreator/AITwinCreator';

export const metadata = {
  title: 'Create AI Twin — Cyrano™',
  description: 'Upload photos and train your Flux LoRA AI character twin.',
};

export default function AiTwinPage() {
  return <AITwinCreator />;
}
