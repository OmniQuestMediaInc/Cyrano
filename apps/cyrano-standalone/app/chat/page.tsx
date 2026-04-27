// apps/cyrano-standalone/app/chat/page.tsx
// CYR: Character Chat page route
import { CharacterChat } from '../../components/CharacterChat/CharacterChat';

export const metadata = {
  title: 'Character Chat — Cyrano™',
  description: 'Persistent narrative conversation with your AI character twin.',
};

export default function ChatPage({
  searchParams,
}: {
  searchParams: { twinId?: string; twinName?: string; userId?: string };
}) {
  const twinId = searchParams.twinId ?? 'demo-twin';
  const twinName = searchParams.twinName ?? 'Scarlett';
  const userId = searchParams.userId ?? 'demo-user';

  return <CharacterChat twinId={twinId} twinName={twinName} userId={userId} />;
}
