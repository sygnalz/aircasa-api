import Airtable from "airtable";

/**
 * Lists properties from Airtable filtered to the current user.
 * Supports request-time overrides for view/email to diagnose mismatches.
 */
export async function listProperties({
  user,
  debug = false,
  viewOverride,
  bypassEmail = false,
  emailOverride,
}) {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;

  if (!apiKey || !baseId) {
    throw new Error("Missing Airtable env vars (AIRTABLE_API_KEY, AIRTABLE_BASE_ID)");
  }

  const tableName = "Properties";
  const viewName = (viewOverride || process.env.AIRTABLE_VIEW_PROPERTIES || "Grid view").trim();

  const selectedEmail = emailOverride || user?.email || "";
  const emailForFormula = String(selectedEmail).replace(/'/g, "\\'");
  const filterByFormula = bypassEmail
    ? undefined
    : `LOWER({app_email}) = '${emailForFormula.toLowerCase()}'`;

  const fields = [
    "property_id",
    "app_street",
    "app_city",
    "app_state",
    "app_zip_code",
    "property_intake_completed",
    "photos_completed",
    "home_criteria_main_completed",
    "personal_financial_completed",
    "consultation_completed",
    "attom_id",
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
        view: viewName,
        ...(filterByFormula ? { filterByFormula } : {}),
        fields,
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
    const status = err?.statusCode || err?.status || "";
    if (status === 401 || status === 403) {
      throw new Error("Airtable auth failed (check AIRTABLE_API_KEY permissions and base access)");
    }
    if (status === 429) {
      throw new Error("Airtable rate limit hit (429). Try again shortly or reduce page size.");
    }
    throw new Error(err?.message || "Airtable query failed");
  }

  const meta = debug
    ? { baseId, table: tableName, view: viewName, filterByFormula: filterByFormula || "(bypassed)", matchedCount: records.length }
    : undefined;

  return debug ? { items: records, meta } : { items: records };
}
