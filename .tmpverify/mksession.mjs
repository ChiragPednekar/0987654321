import fs from "node:fs";
for (const line of fs.readFileSync(".env.local","utf8").split("\n")) {
  const i = line.indexOf("="); if (i>0) process.env[line.slice(0,i)] = line.slice(i+1);
}
const { createClient } = await import("@supabase/supabase-js");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession:false }});

const email = "proctor-verify@example.com";
const password = "Verify-" + Math.random().toString(36).slice(2) + "!A9";

// Remove any leftover from a previous run so this is repeatable.
const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
const old = list.users.find(u => u.email === email);
if (old) await admin.auth.admin.deleteUser(old.id);

const { data: created, error } = await admin.auth.admin.createUser({
  email, password, email_confirm: true,
});
if (error) { console.error("create failed", error.message); process.exit(1); }
console.log("USER_ID=" + created.user.id);

const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession:false }});
const { data: signIn, error: signErr } = await anon.auth.signInWithPassword({ email, password });
if (signErr) { console.error("signin failed", signErr.message); process.exit(1); }

const ref = url.match(/https:\/\/([a-z0-9]+)\./)[1];
const cookieName = `sb-${ref}-auth-token`;
const value = "base64-" + Buffer.from(JSON.stringify(signIn.session)).toString("base64");
fs.writeFileSync("/tmp/session.json", JSON.stringify({ cookieName, value, userId: created.user.id, email }));
console.log("COOKIE_NAME=" + cookieName);
console.log("COOKIE_BYTES=" + value.length);
