// aircasa-api/src/data/properties/airtable.js
import Airtable from "airtable";

/**
 * Lists properties from Airtable filtered to the current user,
 * using the specified Airtable view and an additional email filter
 * for defense-in-depth.
 *
 * Requirements (Render env):
 *   AIRTABLE_API_KEY
 *   AIRTABLE_BASE_ID
 *
 * Uses your mapping:
 *   Table: "Properties"
 *   View:  "attom_sell_property_address_street"
 *   Owner: app_email (matches Supabase JWT email)
 */
export async function listProperties({ user }) {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;

  if (!apiKey || !baseId) {
    throw new Error("Missing Airtable env vars");
  }

  const tableName = "Properties"; // exact table name from your mapping
  const viewName  = "attom_sell_property_address_street"; // exact view name from your mapping

  const userEmail = user?.email;
  if (!userEmail) throw new Error("Missing user email in JWT");

  // Extra safety: filter to current user even within the view
  const filterByFormula = `{app_email} = '${String(userEmail).replace(/'/g, "\\'")}'`;

  // Fields to return (your display + extras)
  const fields = [
    "property_id",
    "app_street",
    "app_city",
    "app_state",
    "app_zip_code",

    // status checkboxes (5 tasks)
    "property_intake_completed",
    "photos_completed",
    "home_criteria_main_completed",
    "personal_financial_completed",
    "consultation_completed",

    // sort/display companion
    "attom_id",

    // extras
    "app_image_url",
    "app_estimated_value",
    "app_property_type",
    "app_bedrooms",
    "app_bathrooms",
    "is_buying_a_home",
  ];

  const base = new Airtable({ apiKey }).base(baseId);
  const records = [];

  await base(tableName)
    .select({
      view: viewName,
      filterByFormula,
      fields,
      pageSize: 100,
    })
    .eachPage((page, next) => {
      records.push(
        ...page.map((r) => ({
          id: r.id,           // Airtable record id (kept for reference)
          ...r.fields,        // your selected fields
        }))
      );
      next();
    });

  return records;
}
