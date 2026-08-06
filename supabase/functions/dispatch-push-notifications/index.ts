// Phase 8: Notifications — OneSignal dispatch.
// No-ops when ONESIGNAL_APP_ID/ONESIGNAL_REST_API_KEY aren't set, the same
// guard-rail pattern _shared/sentry.ts already uses for an optional
// external integration this project doesn't have credentials for yet.
// Real push delivery ("OneSignal integration (both platforms)," MVP Dev
// Roadmap Phase 8) is explicitly deferred until a real OneSignal account
// exists — everything up to "a correct notifications row exists" is
// already real and tested (see phase8-notifications-flow.test.mjs); this
// function is the one remaining, currently-inert step.
//
// Not wired to pg_cron yet — scheduling an HTTP dispatch job (via
// pg_net.http_post, the standard Supabase pattern for cron-triggered Edge
// Functions) is meaningless work against an integration with nowhere to
// actually deliver to. Add that alongside real credentials, not before.
//
// Targets OneSignal's external_user_id — assumes the future client SDK
// integration calls OneSignal.login(supabaseUserId) on sign-in, so a
// notifications.user_id maps directly to a OneSignal recipient with no
// extra device-token bookkeeping in this schema.

import { adminClient } from '../_shared/auth.ts';
import { log } from '../_shared/logger.ts';

const BATCH_SIZE = 50;

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const appId = Deno.env.get('ONESIGNAL_APP_ID');
  const restApiKey = Deno.env.get('ONESIGNAL_REST_API_KEY');

  if (!appId || !restApiKey) {
    console.warn(
      '[dispatch-push-notifications] ONESIGNAL_APP_ID/ONESIGNAL_REST_API_KEY not set — push delivery is disabled. See docs/SETUP.md.',
    );
    return Response.json({ dispatched: 0, disabled: true });
  }

  const admin = adminClient();

  const { data: pending, error: pendingError } = await admin
    .from('notifications')
    .select('id, user_id, event_type, payload')
    .eq('channel', 'realtime')
    .is('sent_at', null)
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE);
  if (pendingError) return Response.json({ error: pendingError.message }, { status: 500 });

  let dispatched = 0;
  for (const notification of pending) {
    const res = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${restApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        app_id: appId,
        include_external_user_ids: [notification.user_id],
        headings: { en: 'ISP' },
        contents: { en: notification.event_type.replaceAll('_', ' ') },
        data: notification.payload,
      }),
    });

    if (!res.ok) {
      log.error('notification.dispatch_failed', {
        context: { notificationId: notification.id, status: res.status },
      });
      continue;
    }

    await admin
      .from('notifications')
      .update({ sent_at: new Date().toISOString() })
      .eq('id', notification.id);
    dispatched += 1;
  }

  log.info('notifications.dispatched', { context: { dispatched, total: pending.length } });

  return Response.json({ dispatched, disabled: false });
});
