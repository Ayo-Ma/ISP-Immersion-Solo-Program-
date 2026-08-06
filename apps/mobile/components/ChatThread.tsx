import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';

import { useTheme } from '../theme';
import { useAuth } from '../lib/AuthContext';
import {
  listMessages,
  sendMessage,
  subscribeToMessages,
  unsubscribe,
  type ChatMessageRow,
} from '../lib/queries/chat';
import {
  getMyActivePrayerSession,
  startPrayerSession,
  getTodayChecklist,
  createTodayChecklist,
  type PrayerSessionRow,
} from '../lib/queries/disciple';
import { clockOutPrayer, EdgeFunctionError } from '../lib/edgeFunctions';
import { Card } from './Card';
import { Badge } from './Badge';
import { Button } from './Button';
import { Input } from './Input';
import { LoadingState } from './LoadingState';
import { ErrorState } from './ErrorState';

/**
 * Shared between the Disciple and Builder chat screens — same 1:1 thread,
 * scoped by chat_messages RLS (Phase 1) regardless of which side is
 * viewing. Prayer clock-in/out (Phase 7: PRD Section C.7 — "embedded
 * inside the chat feature itself") only renders for the disciple; the
 * Builder sees the same thread without those controls.
 */
export function ChatThread({
  builderId,
  discipleId,
  partnerName,
  showPrayerControls,
}: {
  builderId: string;
  discipleId: string;
  partnerName: string;
  showPrayerControls: boolean;
}) {
  const theme = useTheme();
  const { profile } = useAuth();
  const [messages, setMessages] = useState<ChatMessageRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setMessages(await listMessages(builderId, discipleId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    }
  }, [builderId, discipleId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const channel = subscribeToMessages(discipleId, (message) => {
      setMessages((prev) => (prev ? [...prev, message] : [message]));
    });
    return () => unsubscribe(channel);
  }, [discipleId]);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  const handleSend = async () => {
    const body = draft.trim();
    if (!body || !profile) return;
    setDraft('');
    setSending(true);
    try {
      await sendMessage({ builderId, discipleId, senderId: profile.id, body });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSending(false);
    }
  };

  if (error) return <ErrorState onRetry={load} />;
  if (!messages) return <LoadingState />;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.surfaceCanvas }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {showPrayerControls ? <PrayerControls /> : null}

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ padding: theme.space.lg, gap: theme.space.sm, flexGrow: 1 }}
      >
        {messages.length === 0 ? (
          <Text
            style={{
              fontFamily: theme.font.text,
              fontSize: theme.type.bodySm.fontSize,
              color: theme.colors.textSubtle,
              textAlign: 'center',
              marginTop: theme.space.xl,
            }}
          >
            No messages yet — say hello to {partnerName}.
          </Text>
        ) : (
          messages.map((message) => {
            const mine = message.sender_id === profile?.id;
            return (
              <View
                key={message.id}
                style={{
                  alignSelf: mine ? 'flex-end' : 'flex-start',
                  maxWidth: '80%',
                  backgroundColor: mine ? theme.colors.actionPrimary : theme.colors.surfaceCard,
                  borderWidth: 1,
                  borderColor: theme.colors.borderHairline,
                  borderRadius: theme.radius.md,
                  padding: theme.space.sm,
                }}
              >
                <Text
                  style={{
                    fontFamily: theme.font.text,
                    fontSize: theme.type.bodySm.fontSize,
                    color: mine ? theme.colors.textOnPrimary : theme.colors.textBody,
                  }}
                >
                  {message.body}
                </Text>
              </View>
            );
          })
        )}
      </ScrollView>

      <View
        style={{
          flexDirection: 'row',
          gap: theme.space.sm,
          padding: theme.space.md,
          borderTopWidth: 1,
          borderTopColor: theme.colors.borderHairline,
        }}
      >
        <View style={{ flex: 1 }}>
          <Input placeholder="Message" value={draft} onChangeText={setDraft} />
        </View>
        <Button
          variant="primary"
          status={sending ? 'loading' : 'idle'}
          disabled={!draft.trim()}
          onPress={handleSend}
        >
          Send
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
}

function PrayerControls() {
  const theme = useTheme();
  const [session, setSession] = useState<PrayerSessionRow | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setSession(await getMyActivePrayerSession());
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Something went wrong.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleClockIn = async () => {
    setActionError(null);
    setBusy(true);
    try {
      setSession(await startPrayerSession());
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const handleClockOut = async () => {
    if (!session) return;
    setActionError(null);
    setBusy(true);
    try {
      const checklist = (await getTodayChecklist()) ?? (await createTodayChecklist());
      await clockOutPrayer({ sessionId: session.id, checklistId: checklist.id });
      setSession(null);
    } catch (err) {
      setActionError(err instanceof EdgeFunctionError ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  if (session === undefined) return null;

  return (
    <Card
      padding="compact"
      eyebrow="Prayer regimen"
      title={session ? 'In progress' : 'Not started'}
    >
      {actionError ? (
        <Text
          style={{
            fontFamily: theme.font.text,
            fontSize: theme.type.caption.fontSize,
            color: theme.colors.textAttention,
          }}
        >
          {actionError}
        </Text>
      ) : null}
      <View style={{ marginTop: theme.space.xs, flexDirection: 'row', gap: theme.space.sm }}>
        {session ? (
          <>
            <Badge tone="signal">Since {new Date(session.clock_in_at).toLocaleTimeString()}</Badge>
            <Button
              variant="secondary"
              size="sm"
              status={busy ? 'loading' : 'idle'}
              onPress={handleClockOut}
            >
              Clock out
            </Button>
          </>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            status={busy ? 'loading' : 'idle'}
            onPress={handleClockIn}
          >
            Clock in
          </Button>
        )}
      </View>
    </Card>
  );
}
