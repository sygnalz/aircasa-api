// aircasa-api/src/data/properties/airtable.js
import Airtable from "airtable";

/**
 * Lists properties from Airtable filtered to the current user,
 * using a specific Airtable view (default "Grid view") and an additional
 * email filter for defense-in-depth.
 *
 * Required env (Render):
 *   AIRTABLE_API_KEY
 *   AIRTABLE_BASE_ID
 *
 * Optional env:
 *   AIRTABLE_VIEW_PROPERTIES    // overrides the view name (default: "Grid view")
 *
 * Mapping you provided:
 *   Table: "Properties"
 *   Owner: app_email (matches Supabase JWT email)
 */
export async function listProperties({ user }) {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;

  if (!apiKey || !baseId) {
    throw new Error("Missing Airtable env vars (AIRTABLE_API_KEY, AIRTABLE_BASE_ID)");
  }

  const tableName = "Properties";
  // Allow overriding the Airtable view by env; default to "Grid view"
  const viewName = (process.env.AIRTABLE_VIEW_PROPERTIES || "Grid view").trim();

  const userEmail = user?.email;
  if (!userEmail) throw new Error("Missing user email in JWT (cannot filter records)");

  // Case-insensitive match using LOWER() to avoid casing mismatches.
  // Also escape single quotes in the email to be safe.
  const emailForFormula = String(userEmail).replace(/'/g, "\\'");
  const filterByFormula = `LOWER({app_email}) = '${emailForFormula.toLowerCase()}'`;

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

  try {
    await base(tableName)
      .select({
        view: viewName,      // the exact view your API should read
        filterByFormula,     // defense-in-depth: still filter by current user
        fields,              // keep payload small and predictable
        pageSize: 100,
      })
      .eachPage(
        (page, next) => {
          records.push(...page.map((r) => ({ id: r.id, ...r.fields })));
          next();
        },
        (err) => {
          if (err) throw err;
        }
      );
  } catch (err) {
    // Friendlier error surface for common cases
    const status = err?.statusCode || err?.status || "";
    if (status === 401 || status === 403) {
      throw new Error("Airtable auth failed (check AIRTABLE_API_KEY permissions and base access)");
    }
    if (status === 429) {
      throw new Error("Airtable rate limit hit (429). Try again shortly or reduce page size.");
    }
    throw new Error(err?.message || "Airtable query failed");
  }

  return records;
}
