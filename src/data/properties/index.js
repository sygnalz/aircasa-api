// Select a properties provider at runtime without assuming schema.
// PROPERTIES_PROVIDER: "supabase" | "airtable"
import { listProperties as listFromSupabase } from "./supabase.js";
import { listProperties as listFromAirtable } from "./airtable.js";

const PROVIDER = (process.env.PROPERTIES_PROVIDER || "").toLowerCase();

export async function listProperties({ user }) {
  // Optional user filtering: if you want to filter by owner field,
  // set PROPERTIES_OWNER_FIELD=<columnName> and we'll pass it along.
  const ownerField = process.env.PROPERTIES_OWNER_FIELD || null;
  const ownerId = user?.sub || user?.user_id || null; // Supabase JWT commonly uses sub

  switch (PROVIDER) {
    case "supabase":
      return listFromSupabase({ ownerField, ownerId });
    case "airtable":
      return listFromAirtable({ ownerField, ownerId });
    default:
      throw new Error(
        'Set PROPERTIES_PROVIDER to "supabase" or "airtable" in your backend env'
      );
  }
}
