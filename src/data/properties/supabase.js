import { createClient } from "@supabase/supabase-js";

function getClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Env required:
 * - SUPABASE_TABLE_PROPERTIES (table name)
 * Optional:
 * - PROPERTIES_OWNER_FIELD (column to filter by user id if provided)
 */
export async function listProperties({ ownerField, ownerId }) {
  const table = process.env.SUPABASE_TABLE_PROPERTIES;
  if (!table) throw new Error("Missing SUPABASE_TABLE_PROPERTIES");

  const supabase = getClient();

  let query = supabase.from(table).select("*").limit(100);
  if (ownerField && ownerId) {
    query = query.eq(ownerField, ownerId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message || "Supabase query failed");

  // Return raw rows as-is; the route will shape `{ items: [...] }`
  return Array.isArray(data) ? data : [];
}
