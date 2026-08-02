// Phase 1 seed script (MVP Dev Roadmap): fake Lead Pastor, Supervising
// Minister, 2 Builders, 6 Disciples, 1 pathway with 3 modules — enough to
// exercise every flow manually, and what the RLS test suite authenticates
// as.
//
// Auth users are created via the Admin API (auth.admin.createUser), not raw
// SQL — inserting into auth.users directly bypasses invariants Supabase
// manages internally. Creating a user fires the handle_new_user trigger
// (Phase 1 migration 20260802165600), which populates public.users from
// the role/name in user_metadata.
//
// Idempotent by design: safe to re-run against the same project. Users are
// looked up by email before creating; domain rows (pathway/modules/
// builder_disciple pairings) are looked up before inserting. This matters
// because public.users.id -> auth.users.id is ON DELETE RESTRICT
// (soft-delete only, Section E) — there is no "delete and recreate" path,
// so idempotent upsert-or-skip is the only way "seed data loads cleanly"
// stays true on a second run.
//
// Usage: node --env-file=.env supabase/seed/seed.mjs

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_DEV_URL;
const SERVICE_KEY = process.env.SUPABASE_DEV_SECRET_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('SUPABASE_DEV_URL and SUPABASE_DEV_SECRET_KEY must be set (see .env).');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const SEED_PASSWORD = 'Seed-Dev-Only-Password-1!';
const EMAIL_DOMAIN = 'seed.isp-app.test';

const SEED_USERS = [
  { key: 'lead_pastor', role: 'lead_pastor', name: 'Seed Lead Pastor' },
  { key: 'supervising_minister', role: 'supervising_minister', name: 'Seed Supervising Minister' },
  { key: 'builder_1', role: 'builder', name: 'Seed Builder One' },
  { key: 'builder_2', role: 'builder', name: 'Seed Builder Two' },
  { key: 'disciple_1', role: 'disciple', name: 'Seed Disciple One' },
  { key: 'disciple_2', role: 'disciple', name: 'Seed Disciple Two' },
  { key: 'disciple_3', role: 'disciple', name: 'Seed Disciple Three' },
  { key: 'disciple_4', role: 'disciple', name: 'Seed Disciple Four' },
  { key: 'disciple_5', role: 'disciple', name: 'Seed Disciple Five' },
  { key: 'disciple_6', role: 'disciple', name: 'Seed Disciple Six' },
];

function emailFor(key) {
  return `${key.replace(/_/g, '.')}@${EMAIL_DOMAIN}`;
}

async function findExistingUserByEmail(email) {
  // admin.listUsers has no server-side email filter in supabase-js; the
  // seed set is small (10 users) so fetching one page and filtering
  // client-side is fine.
  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  return data.users.find((u) => u.email === email) ?? null;
}

async function ensureUser(seedUser) {
  const email = emailFor(seedUser.key);
  const existing = await findExistingUserByEmail(email);
  if (existing) {
    console.log(`= ${seedUser.key} already exists (${existing.id})`);
    return existing.id;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: SEED_PASSWORD,
    email_confirm: true,
    user_metadata: { role: seedUser.role, name: seedUser.name },
  });
  if (error) throw error;

  console.log(`+ created ${seedUser.key} (${data.user.id})`);
  return data.user.id;
}

async function ensurePathway() {
  const { data: existing, error: selectError } = await supabase
    .from('pathways')
    .select('id')
    .eq('name', 'Seed Pathway: Finance')
    .maybeSingle();
  if (selectError) throw selectError;

  if (existing) {
    console.log(`= pathway already exists (${existing.id})`);
    return existing.id;
  }

  const { data, error } = await supabase
    .from('pathways')
    .insert({
      name: 'Seed Pathway: Finance',
      description: 'Seed data for Phase 1 manual exercise and RLS testing.',
    })
    .select('id')
    .single();
  if (error) throw error;

  console.log(`+ created pathway (${data.id})`);
  return data.id;
}

async function ensureModules(pathwayId) {
  const moduleDefs = [
    { order_index: 1, title: 'Module 1: Biblical Stewardship' },
    { order_index: 2, title: 'Module 2: Budgeting Foundations' },
    { order_index: 3, title: 'Module 3: Giving and Generosity' },
  ];

  const moduleIds = [];
  for (const def of moduleDefs) {
    const { data: existing, error: selectError } = await supabase
      .from('modules')
      .select('id')
      .eq('pathway_id', pathwayId)
      .eq('order_index', def.order_index)
      .maybeSingle();
    if (selectError) throw selectError;

    if (existing) {
      console.log(`= module ${def.order_index} already exists (${existing.id})`);
      moduleIds.push(existing.id);
      continue;
    }

    const { data, error } = await supabase
      .from('modules')
      .insert({ pathway_id: pathwayId, ...def })
      .select('id')
      .single();
    if (error) throw error;

    console.log(`+ created module ${def.order_index} (${data.id})`);
    moduleIds.push(data.id);
  }
  return moduleIds;
}

async function ensureBuilderDisciplePairing(builderId, discipleId, assignedById) {
  const { data: existing, error: selectError } = await supabase
    .from('builder_disciple')
    .select('id')
    .eq('disciple_id', discipleId)
    .eq('status', 'active')
    .maybeSingle();
  if (selectError) throw selectError;

  if (existing) {
    console.log(`= builder_disciple pairing already exists for disciple ${discipleId}`);
    return existing.id;
  }

  const { data, error } = await supabase
    .from('builder_disciple')
    .insert({
      builder_id: builderId,
      disciple_id: discipleId,
      assigned_by: assignedById,
      status: 'active',
    })
    .select('id')
    .single();
  if (error) throw error;

  console.log(`+ paired builder ${builderId} with disciple ${discipleId}`);
  return data.id;
}

async function main() {
  console.log(`Seeding against ${SUPABASE_URL}\n`);

  const userIds = {};
  for (const seedUser of SEED_USERS) {
    userIds[seedUser.key] = await ensureUser(seedUser);
  }

  const pathwayId = await ensurePathway();
  const moduleIds = await ensureModules(pathwayId);

  const discipleKeys = SEED_USERS.filter((u) => u.role === 'disciple').map((u) => u.key);
  const builder1Disciples = discipleKeys.slice(0, 3);
  const builder2Disciples = discipleKeys.slice(3, 6);

  for (const key of builder1Disciples) {
    await ensureBuilderDisciplePairing(userIds.builder_1, userIds[key], userIds.lead_pastor);
  }
  for (const key of builder2Disciples) {
    await ensureBuilderDisciplePairing(userIds.builder_2, userIds[key], userIds.lead_pastor);
  }

  console.log('\nSeed complete.');
  console.log(JSON.stringify({ userIds, pathwayId, moduleIds }, null, 2));
}

main().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
