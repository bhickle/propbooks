// =============================================================================
// infer-import-mapping — given a CSV header + 5 sample rows + target entity,
// asks Claude Sonnet 4.6 to propose a column mapping. The browser does the
// deterministic bulk transform after the user confirms the mapping; this
// function makes exactly one Claude call per import.
//
// Auth: caller's JWT (RLS-scoped). Logs token usage to ai_usage. Soft-caps at
// 200 calls/account/month. Prompt caching on the system prompt (target schema
// goes in system to keep the cached prefix large enough — Sonnet 4.6 needs
// >=2048 tokens for the cache to actually populate).
// =============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.40.0";

const MONTHLY_CAP = 200;
const MODEL = "claude-sonnet-4-6";

// Per-million-token pricing for Sonnet 4.6 (used to log cost_cents).
// Cache write = 1.25x input, cache read = 0.1x input.
const PRICE_INPUT_PER_M    = 3.00;
const PRICE_OUTPUT_PER_M   = 15.00;
const PRICE_CACHE_WRITE_PER_M = 3.75;
const PRICE_CACHE_READ_PER_M  = 0.30;

// Target schemas. Listed in a stable order with stable JSON formatting so the
// cached system prompt prefix doesn't drift across calls. Keep this file as
// the single source of truth for what the AI can map TO.
const TARGET_SCHEMAS: Record<string, Record<string, FieldSpec>> = {
  properties: {
    name:             { type: "string",  required: true,  description: "Property nickname or short name (e.g. 'Oak Street Duplex')" },
    address:          { type: "string",  required: false, description: "Full street address" },
    type:             { type: "string",  required: false, enum: ["Single Family", "Duplex", "Triplex", "Fourplex", "Apartment", "Condo", "Townhouse", "Multi-Family", "Commercial", "Mixed Use", "Land"], description: "Property type" },
    units:            { type: "integer", required: false, description: "Number of rentable units (default 1)" },
    status:           { type: "string",  required: false, enum: ["Occupied", "Partial Vacancy", "Vacant", "Inactive"], description: "Current occupancy status" },
    purchase_price:   { type: "number",  required: false, description: "Purchase price in dollars (no commas or $)" },
    purchase_date:    { type: "date",    required: false, description: "Date acquired (YYYY-MM-DD)" },
    current_value:    { type: "number",  required: false, description: "Current estimated market value" },
    land_value:       { type: "number",  required: false, description: "Assessor's land value (for depreciation)" },
    monthly_rent:     { type: "number",  required: false, description: "Total monthly rent across all units" },
    monthly_expenses: { type: "number",  required: false, description: "Total monthly operating expenses" },
    loan_amount:      { type: "number",  required: false, description: "Original loan amount" },
    loan_rate:        { type: "number",  required: false, description: "Interest rate as a percentage (e.g. 6.5 for 6.5%)" },
    loan_term_years:  { type: "integer", required: false, description: "Loan term in years" },
    loan_start_date:  { type: "date",    required: false, description: "Loan origination date (YYYY-MM-DD)" },
    closing_costs:    { type: "number",  required: false, description: "Closing costs at purchase" },
  },
  transactions: {
    date:        { type: "date",    required: true,  description: "Transaction date (YYYY-MM-DD)" },
    amount:      { type: "number",  required: true,  description: "Dollar amount (always positive; direction comes from `type`)" },
    type:        { type: "string",  required: true,  enum: ["income", "expense"], description: "Direction of money. If the source has negative amounts for expenses, set this to 'expense' and use the absolute value for amount." },
    category:    { type: "string",  required: false, description: "Category like 'Rent Income', 'Mortgage Payment', 'Plumbing', etc." },
    description: { type: "string",  required: false, description: "Memo / description text" },
    payee:       { type: "string",  required: false, description: "Vendor name (for expenses) or tenant name (for income)" },
  },
};

type FieldSpec = {
  type: "string" | "number" | "integer" | "date";
  required: boolean;
  description: string;
  enum?: string[];
};

const SYSTEM_PROMPT = `You are an expert at mapping CSV columns from external real estate accounting exports (QuickBooks, Stessa, generic spreadsheets) to the PropBooks data model.

INPUTS YOU RECEIVE
- targetEntity: which PropBooks table the user is importing into.
- sourceHeaders: the column headers from the user's CSV.
- sampleRows: five rows of sample values (string-typed, matched positionally to sourceHeaders).

YOU MUST CALL THE propose_mapping TOOL with your inferred mapping.

MAPPING RULES
1. For each target field in the schema, pick ONE sourceHeader that best fits, or null if no column matches.
2. Each sourceHeader can only be used for ONE target field — never duplicate.
3. Pay attention to SAMPLE VALUES, not just header names. A column called "Amount" that contains "Income" / "Expense" is actually the type column. A column called "Date" containing free-text descriptions is not a date column.
4. For enum fields, only suggest mappings when sample values look like they fit the enum (or can be normalized to fit). If the column contains values outside the enum (e.g. property type "Duplex" when the enum has only "Single Family" / "Multi-Family"), still map the column — the client transform will normalize. But flag it in notes.
5. For dates: if the sample format is unambiguous (YYYY-MM-DD, or US MM/DD/YYYY in a US context), map the column. If the date column is ambiguous (e.g. "1/2/24" — could be Jan 2 or Feb 1), still map it and call out the ambiguity in notes.
6. For amount/dollar columns: look at the sample values, not just the header. Columns with parenthesized negatives ("(1,234.56)") or leading "-" are dollar amounts; the client will strip formatting.
7. confidence is 0-100 — a single number representing your overall confidence in the mapping. Use ~90+ when every required field has a clear, obvious match; ~50-70 when several fields are guesses; below 50 when the source schema doesn't look like the target entity at all.
8. notes: one or two short sentences. Mention any columns you couldn't map, any ambiguities the user should resolve, or any normalizations the client should expect.

DO NOT
- Do not invent target fields that aren't in the schema.
- Do not return free-text — always call propose_mapping.
- Do not explain your reasoning outside the tool call.

TARGET SCHEMAS (frozen, do not deviate):
${JSON.stringify(TARGET_SCHEMAS, null, 2)}`;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!supabaseUrl || !supabaseAnonKey) return jsonResponse({ error: "Server is missing Supabase env vars" }, 500);
    if (!anthropicKey) return jsonResponse({ error: "ANTHROPIC_API_KEY is not configured on this Edge Function. Set it in Supabase → Project Settings → Edge Functions → Secrets." }, 500);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Missing Authorization header" }, 401);

    // RLS-scoped client (uses caller's JWT). All reads/writes below are
    // automatically constrained to the caller's account.
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes?.user) return jsonResponse({ error: "Unauthorized" }, 401);
    const user = userRes.user;

    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select("account_id")
      .eq("id", user.id)
      .maybeSingle();
    if (profErr || !profile?.account_id) return jsonResponse({ error: "No account found for user" }, 400);

    // Fair-use gate. Count AI calls this account has made in the last 30 days.
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { count: usageCount } = await supabase
      .from("ai_usage")
      .select("id", { count: "exact", head: true })
      .eq("account_id", profile.account_id)
      .gte("created_at", thirtyDaysAgo);
    if ((usageCount ?? 0) >= MONTHLY_CAP) {
      return jsonResponse({ error: `Monthly AI quota reached (${MONTHLY_CAP} actions / 30 days). Try again later or contact support.` }, 429);
    }

    // Parse + validate request body.
    let body: { sourceHeaders?: string[]; sampleRows?: string[][]; targetEntity?: string };
    try { body = await req.json(); }
    catch { return jsonResponse({ error: "Body must be JSON" }, 400); }

    const { sourceHeaders, sampleRows, targetEntity } = body;
    if (!Array.isArray(sourceHeaders) || sourceHeaders.length === 0) return jsonResponse({ error: "sourceHeaders must be a non-empty array" }, 400);
    if (!Array.isArray(sampleRows)) return jsonResponse({ error: "sampleRows must be an array" }, 400);
    if (!targetEntity || !TARGET_SCHEMAS[targetEntity]) return jsonResponse({ error: `Unknown targetEntity. Allowed: ${Object.keys(TARGET_SCHEMAS).join(", ")}` }, 400);

    const targetSchema = TARGET_SCHEMAS[targetEntity];

    // Build the propose_mapping tool. The mapping object has one nullable
    // string property per target field — strict object so the model can't
    // invent extras.
    const mappingProperties: Record<string, unknown> = {};
    for (const field of Object.keys(targetSchema)) {
      mappingProperties[field] = {
        type: ["string", "null"],
        description: `sourceHeader to use for ${field}, or null if no column matches`,
      };
    }

    const tools = [{
      name: "propose_mapping",
      description: "Return the proposed column mapping from sourceHeaders to PropBooks target fields.",
      input_schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          mapping: {
            type: "object",
            additionalProperties: false,
            properties: mappingProperties,
          },
          confidence: {
            type: "integer",
            minimum: 0,
            maximum: 100,
            description: "Overall confidence in the mapping (0-100).",
          },
          notes: {
            type: "string",
            description: "1-2 short sentences highlighting ambiguities, unmapped columns, or normalizations the client should expect.",
          },
          unmapped_source_headers: {
            type: "array",
            items: { type: "string" },
            description: "sourceHeaders that you couldn't confidently map to any target field.",
          },
        },
        required: ["mapping", "confidence", "notes", "unmapped_source_headers"],
      },
    }];

    const userPrompt = `targetEntity: ${targetEntity}

sourceHeaders: ${JSON.stringify(sourceHeaders)}

sampleRows (5):
${sampleRows.slice(0, 5).map((r, i) => `Row ${i + 1}: ${JSON.stringify(r)}`).join("\n")}

Call propose_mapping now.`;

    const anthropic = new Anthropic({ apiKey: anthropicKey });

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: [{
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      }],
      messages: [{ role: "user", content: userPrompt }],
      tools,
      tool_choice: { type: "tool", name: "propose_mapping" },
    });

    const toolUse = response.content.find((b: { type: string }) => b.type === "tool_use") as
      | { type: "tool_use"; input: { mapping: Record<string, string | null>; confidence: number; notes: string; unmapped_source_headers: string[] } }
      | undefined;
    if (!toolUse) {
      return jsonResponse({ error: "Claude did not return a mapping. Try again with a clearer header row." }, 502);
    }

    // Log usage. usage fields come straight off response.usage.
    const inputTokens   = response.usage?.input_tokens                ?? 0;
    const outputTokens  = response.usage?.output_tokens               ?? 0;
    const cacheCreation = response.usage?.cache_creation_input_tokens ?? 0;
    const cacheRead     = response.usage?.cache_read_input_tokens     ?? 0;
    const costCents =
      (inputTokens   * PRICE_INPUT_PER_M       / 1_000_000) * 100 +
      (outputTokens  * PRICE_OUTPUT_PER_M      / 1_000_000) * 100 +
      (cacheCreation * PRICE_CACHE_WRITE_PER_M / 1_000_000) * 100 +
      (cacheRead     * PRICE_CACHE_READ_PER_M  / 1_000_000) * 100;

    // Service-role write so the row gets inserted even though there's no
    // authenticated-insert RLS policy. account_id is taken from the trusted
    // profile lookup, not the request body.
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (serviceRole) {
      const admin = createClient(supabaseUrl, serviceRole);
      await admin.from("ai_usage").insert({
        user_id: user.id,
        account_id: profile.account_id,
        feature: "import_mapping",
        model: MODEL,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cache_creation_tokens: cacheCreation,
        cache_read_tokens: cacheRead,
        cost_cents: Number(costCents.toFixed(4)),
      });
    } else {
      console.warn("[infer-import-mapping] SUPABASE_SERVICE_ROLE_KEY not set — skipping ai_usage log.");
    }

    return jsonResponse({
      ...toolUse.input,
      target_schema: targetSchema,
      usage: { input_tokens: inputTokens, output_tokens: outputTokens, cache_read_tokens: cacheRead, cache_creation_tokens: cacheCreation },
    });
  } catch (err) {
    console.error("[infer-import-mapping] error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500);
  }
});
