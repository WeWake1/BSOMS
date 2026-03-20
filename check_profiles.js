require('dotenv').config({ path: './.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing URL or Key in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function check() {
  console.log("Checking auth.users...");
  // Note: auth.admin.listUsers() is the right way
  const { data: users, error: usersErr } = await supabase.auth.admin.listUsers();
  if (usersErr) {
    console.error("Auth query failed:", usersErr);
  } else {
    console.log(`Found ${users.users.length} users:`);
    users.users.forEach(u => console.log(` - ID: ${u.id}, Email: ${u.email}`));
  }

  console.log("\nChecking profiles...");
  const { data: profiles, error: profsErr } = await supabase.from('profiles').select('*');
  if (profsErr) {
    console.error("Profile query failed:", profsErr);
  } else {
    console.log(`Found ${profiles.length} profiles:`);
    profiles.forEach(p => console.log(` - Profile ID: ${p.id}, Role: ${p.role}`));
  }
}

check();
