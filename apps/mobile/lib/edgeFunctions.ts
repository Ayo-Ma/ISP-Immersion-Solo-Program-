import type {
  CreatePathwayRequestInput,
  CreatePathwayRequestOutput,
  RecordTestAttemptInput,
  RecordTestAttemptOutput,
  ReviewChecklistInput,
  ReviewChecklistOutput,
  SelectCheckinTimeInput,
  SelectCheckinTimeOutput,
  ReassignBuilderInput,
  ReassignBuilderOutput,
} from '@isp-app/shared-types';

import { supabase } from './supabase';

/**
 * Thin wrapper around the Phase 2 Edge Functions. Deliberately not using
 * supabase-js's `functions.invoke()` — that helper doesn't give a clean
 * way to distinguish "network/auth failure" from "the function returned a
 * structured { error } body" (409 already-pending, 403 wrong role, etc.),
 * and callers here need to show the disciple THAT specific message, not a
 * generic failure.
 */
export class EdgeFunctionError extends Error {}

async function callEdgeFunction<TOutput>(name: string, body: unknown): Promise<TOutput> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new EdgeFunctionError('You are not signed in.');
  }

  const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/${name}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const json = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      json && typeof json.error === 'string' ? json.error : `${name} failed (${response.status}).`;
    throw new EdgeFunctionError(message);
  }

  return json as TOutput;
}

export function createPathwayRequest(
  input: CreatePathwayRequestInput,
): Promise<CreatePathwayRequestOutput> {
  return callEdgeFunction('create-pathway-request', input);
}

export function recordTestAttempt(input: RecordTestAttemptInput): Promise<RecordTestAttemptOutput> {
  return callEdgeFunction('record-test-attempt', input);
}

export function reviewChecklist(input: ReviewChecklistInput): Promise<ReviewChecklistOutput> {
  return callEdgeFunction('review-checklist', input);
}

export function selectCheckinTime(input: SelectCheckinTimeInput): Promise<SelectCheckinTimeOutput> {
  return callEdgeFunction('select-checkin-time', input);
}

export function reassignBuilder(input: ReassignBuilderInput): Promise<ReassignBuilderOutput> {
  return callEdgeFunction('reassign-builder', input);
}
