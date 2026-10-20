/**
 * Automated check of the database security rules in supabase/schema.sql.
 *
 *   npm run test:rls
 *
 * Spins up a throwaway, in-memory PostgreSQL (PGlite: real Postgres compiled to
 * WebAssembly, no install or Docker), recreates the small part of Supabase the
 * schema depends on (the `auth` schema, `auth.uid()` and the API roles), runs
 * schema.sql, and then acts as two different users to prove that Row-Level
 * Security keeps their data apart. Exits with code 1 if any check fails.
 */
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const schema = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
const db = new PGlite();

// What Supabase provides out of the box. auth.uid() reads the user id from the
// request's JWT; here the test sets it directly with set_config().
await db.exec(`
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role anon nologin;
  create role authenticated nologin;
`);
await db.exec(schema);
await db.exec(`
  grant usage on schema public, auth to anon, authenticated;
  grant all on all tables in schema public to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
`);

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const WORKOUT = "33333333-3333-4333-8333-333333333333";
await db.exec(`insert into auth.users values ('${A}'), ('${B}');`);

/** Runs SQL as a given user (or as a signed-out visitor when userId is null). */
async function as(userId, sql) {
  await db.exec(`set role ${userId ? "authenticated" : "anon"};
                 select set_config('request.jwt.claim.sub', '${userId ?? ""}', false);`);
  try {
    return { rows: (await db.query(sql)).rows };
  } catch (error) {
    return { error: error.message };
  } finally {
    await db.exec("reset role;");
  }
}
const count = async (userId, table) => (await as(userId, `select count(*)::int as n from public.${table}`)).rows[0].n;

let failures = 0;
function check(name, ok) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) failures++;
}

const tables = ["profiles", "meals", "favorite_meals", "workouts", "exercise_logs", "sleep_logs", "water_logs"];
const rls = await db.query(`select count(*)::int as n from pg_tables where schemaname = 'public' and rowsecurity`);
check("RLS is enabled on all 7 tables", rls.rows[0].n === tables.length);

// Writes
const meal = (owner) => `insert into public.meals (user_id, meal_category, food_name, calories) values ('${owner}', 'Lunch', 'Chicken rice bowl', 780)`;
check("a user can log their own meal", !(await as(A, meal(A))).error);
check("a user cannot log a meal under someone else's id", /row-level security/.test((await as(A, meal(B))).error ?? ""));
check("a user can create their own profile", !(await as(A, `insert into public.profiles (id) values ('${A}')`)).error);
check("a user cannot create someone else's profile", /row-level security/.test((await as(A, `insert into public.profiles (id) values ('${B}')`)).error ?? ""));

// Reads
check("the owner sees their meal", (await count(A, "meals")) === 1);
check("another user sees none of it", (await count(B, "meals")) === 0);
check("a signed-out visitor sees none of it", (await count(null, "meals")) === 0);
check("another user cannot see the profile", (await count(B, "profiles")) === 0);

// Updates / deletes on someone else's rows silently affect 0 rows
await as(B, `update public.meals set calories = 0`);
await as(B, `delete from public.meals`);
check("another user cannot change or delete the meal", (await as(A, `select calories::int as c from public.meals`)).rows[0]?.c === 780);

// Data rules
check(
  "only one sleep log per user per night",
  /unique/.test((await as(A, `insert into public.sleep_logs (user_id, log_date) values ('${A}', '2026-10-20'), ('${A}', '2026-10-20')`)).error ?? "")
);
await as(A, `insert into public.workouts (id, user_id, workout_type) values ('${WORKOUT}', '${A}', 'Gym')`);
await as(A, `insert into public.exercise_logs (user_id, workout_id, exercise_name, sets, reps, weight_kg) values ('${A}', '${WORKOUT}', 'Bench Press', 4, 6, 65)`);
await as(A, `delete from public.workouts where id = '${WORKOUT}'`);
check("deleting a workout also deletes its sets", (await count(A, "exercise_logs")) === 0);

console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
