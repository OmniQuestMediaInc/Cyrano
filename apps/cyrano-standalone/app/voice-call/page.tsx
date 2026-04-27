// apps/cyrano-standalone/app/voice-call/page.tsx
// CYR: Voice Call page route
import { VoiceCall } from '../../components/VoiceCall/VoiceCall';

export const metadata = {
  title: 'Voice Call — Cyrano™',
  description: 'Call your AI character twin with an ElevenLabs-cloned voice.',
};

export default function VoiceCallPage({
  searchParams,
}: {
  searchParams: { voiceCloneId?: string; characterName?: string };
}) {
  const voiceCloneId = searchParams.voiceCloneId ?? 'demo-voice-clone';
  const characterName = searchParams.characterName ?? 'Scarlett';

  return <VoiceCall voiceCloneId={voiceCloneId} characterName={characterName} />;
}
