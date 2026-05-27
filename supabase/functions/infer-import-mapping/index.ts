// =============================================================================
// infer-import-mapping — given a CSV header + 5 sample rows, asks Claude
// Sonnet 4.6 to (1) decide whether the file is a Properties or Transactions
// import and (2) propose a column mapping. One tool per target; Claude picks
// which to call via tool_choice: { type: "any" } so the user doesn't have
// to pick the target upfront. The browser does the deterministic bulk
// transform after the user confirms — this function makes exactly one
// Claude call per import (or two if the user overrides the inferred target).
// =============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.40.0";

const MONTHLY_CAP = 200;
const MODEL = "claude-sonnet-4-6";

const PRICE_INPUT_PER_M    = 3.00;
const PRICE_OUTPUT_PER_M   = 15.00;
const PRICE_CACHE_WRITE_PER_M = 3.75;
const PRICE_CACHE_READ_PER_M  = 0.30;

type FieldSpec = {
  type: "string" | "number" | "integer" | "date";
  required: boolean;
  description: string;
  enum?: string[];
};

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
    property:    { type: "string",  required: false, description: "Property name, nickname, or address — the client will look up the matching property by this value. If the CSV doesn't have a property column, leave null; the user will pick a default in the UI." },
    category:    { type: "string",  required: false, description: "Category like 'Rent Income', 'Mortgage Payment', 'Plumbing', etc." },
    description: { type: "string",  required: false, description: "Memo / description text" },
    payee:       { type: "string",  required: false, description: "Vendor name (for expenses) or tenant name (for income)" },
  },
};

const TOOL_NAME_BY_TARGET: Record<string, string> = {
  properties:   "propose_properties_mapping",
  transactions: "propose_transactions_mapping",
};

const TARGET_BY_TOOL_NAME: Record<string, string> = {
  propose_properties_mapping:   "properties",
  propose_transactions_mapping: "transactions",
};

const SYSTEM_PROMPT = `You are an expert at mapping CSV columns from external real estate accounting exports (QuickBooks, Stessa, generic spreadsheets) into the target data model.

WHAT TO DO
You will receive sourceHeaders (the CSV column headers) and sampleRows (five rows of example values). Your job is to:

1. Decide which target the file describes — Properties (rows are real-estate assets the user owns) or Transactions (rows are individual income/expense entries). Inspect both the headers AND the sample values to decide. Signals:
   - Transactions: date column + dollar-amount column + category/memo + income/expense direction. Many rows per property.
   - Properties: name/address + purchase price + loan details + rent/expenses. Usually one row per asset.
2. Call exactly one tool — propose_properties_mapping OR propose_transactions_mapping — based on your decision. The tool you choose IS your decision.
3. Fill in the mapping object: for each target field, pick the best-matching sourceHeader or null if no column matches. Each sourceHeader can only be used for ONE target field — never duplicate.

MAPPING RULES (apply inside the chosen tool)
- Pay attention to sample VALUES, not just header names.
- For enum fields, only map when sample values fit or can be normalized. Flag mismatches in notes.
- Dates: map even if ambiguous; call out ambiguity in notes.
- Amounts: parenthesized negatives, $/commas, "-" prefixes are all dollar amounts — the client strips formatting.

THE TRANSACTIONS \`type\` FIELD IS SPECIAL — READ THIS CAREFULLY
\`type\` only accepts two values: "income" or "expense". ONLY map type to a source column when that column contains exactly two distinct values like:
- "Income"/"Expense"
- "Debit"/"Credit"
- "Deposit"/"Withdrawal"
- "+/-"

If the source has NO clear binary type column, LEAVE type UNMAPPED (null). The client will derive type from the sign of the \`amount\` column at import time (negative = expense, positive = income).

DO NOT MAP type to a category column even if some category values sound income-like (e.g. a "Category" column containing "Rent Income", "Insurance", "Repairs"). Those are categories, not type indicators — they belong in the \`category\` field, not \`type\`. Mapping a polychromatic category column to type will cause most rows to fail the DB check constraint.

OTHER RULES
- confidence is 0-100. ~90+ when every required field has an obvious match and the target is clear; ~50-70 if it's a guess; below 50 if the source doesn't look like either target.
- notes: 1-2 short sentences highlighting unmapped columns, ambiguities, or normalizations the client should expect.

DO NOT
- Do not call both tools.
- Do not return free-text. Always call one of the tools.
- Do not invent target fields that aren't in the schema.

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

function buildTool(target: string) {
  const schema = TARGET_SCHEMAS[target];
  const mappingProperties: Record<string, unknown> = {};
  for (const field of Object.keys(schema)) {
    mappingProperties[field] = {
      type: ["string", "null"],
      description: `sourceHeader to use for ${field}, or null if no column matches`,
    };
  }
  return {
    name: TOOL_NAME_BY_TARGET[target],
    description: `Use this tool when the file describes ${target}. Returns the column mapping from sourceHeaders to ${target} target fields.`,
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        mapping: { type: "object", additionalProperties: false, properties: mappingProperties },
        confidence: { type: "integer", minimum: 0, maximum: 100, description: "Overall confidence in the mapping AND the target choice (0-100)." },
        notes: { type: "string", description: "1-2 short sentences about ambiguities, unmapped columns, or normalizations the client should expect." },
        unmapped_source_headers: { type: "array", items: { type: "string" }, description: "sourceHeaders that couldn't be confidently mapped to any target field." },
      },
      required: ["mapping", "confidence", "notes", "unmapped_source_headers"],
    },
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!supabaseUrl || !supabaseAnonKey) return jsonResponse({ error: "Server is missing Supabase env vars" }, 500);
    if (!anthropicKey) return jsonResponse({ error: "Import service is not yet configured. Contact support." }, 500);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Missing Authorization header" }, 401);

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

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { count: usageCount } = await supabase
      .from("ai_usage")
      .select("id", { count: "exact", head: true })
      .eq("account_id", profile.account_id)
      .gte("created_at", thirtyDaysAgo);
    if ((usageCount ?? 0) >= MONTHLY_CAP) {
      return jsonResponse({ error: `Monthly import quota reached. Try again later or contact support.` }, 429);
    }

    let body: { sourceHeaders?: string[]; sampleRows?: string[][]; targetEntity?: string };
    try { body = await req.json(); }
    catch { return jsonResponse({ error: "Body must be JSON" }, 400); }

    const { sourceHeaders, sampleRows, targetEntity } = body;
    if (!Array.isArray(sourceHeaders) || sourceHeaders.length === 0) return jsonResponse({ error: "sourceHeaders must be a non-empty array" }, 400);
    if (!Array.isArray(sampleRows)) return jsonResponse({ error: "sampleRows must be an array" }, 400);
    // targetEntity is optional now — when omitted, the AI auto-detects which
    // tool to call. When provided, we force that specific tool so the user's
    // override always wins over the model's guess.
    if (targetEntity && !TARGET_SCHEMAS[targetEntity]) {
      return jsonResponse({ error: `Unknown targetEntity. Allowed: ${Object.keys(TARGET_SCHEMAS).join(", ")}` }, 400);
    }

    const tools = Object.keys(TARGET_SCHEMAS).map(buildTool);
    // tool_choice: forced to a specific tool if the caller overrode, else
    // "any" — which forces the model to call exactly one of the tools.
    const tool_choice = targetEntity
      ? { type: "tool" as const, name: TOOL_NAME_BY_TARGET[targetEntity] }
      : { type: "any" as const };

    const userPrompt = `sourceHeaders: ${JSON.stringify(sourceHeaders)}\n\nsampleRows (5):\n${sampleRows.slice(0, 5).map((r, i) => `Row ${i + 1}: ${JSON.stringify(r)}`).join("\n")}\n\nPick the right tool and call it.`;

    const anthropic = new Anthropic({ apiKey: anthropicKey });

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userPrompt }],
      tools,
      tool_choice,
    });

    const toolUse = response.content.find((b: { type: string }) => b.type === "tool_use") as
      | { type: "tool_use"; name: string; input: { mapping: Record<string, string | null>; confidence: number; notes: string; unmapped_source_headers: string[] } }
      | undefined;
    if (!toolUse) {
      return jsonResponse({ error: "Couldn't infer a column mapping. Try again with a clearer header row." }, 502);
    }
    const inferredTarget = TARGET_BY_TOOL_NAME[toolUse.name];
    if (!inferredTarget) {
      return jsonResponse({ error: `Unexpected tool call: ${toolUse.name}` }, 502);
    }

    const inputTokens   = response.usage?.input_tokens                ?? 0;
    const outputTokens  = response.usage?.output_tokens               ?? 0;
    const cacheCreation = response.usage?.cache_creation_input_tokens ?? 0;
    const cacheRead     = response.usage?.cache_read_input_tokens     ?? 0;
    const costCents =
      (inputTokens   * PRICE_INPUT_PER_M       / 1_000_000) * 100 +
      (outputTokens  * PRICE_OUTPUT_PER_M      / 1_000_000) * 100 +
      (cacheCreation * PRICE_CACHE_WRITE_PER_M / 1_000_000) * 100 +
      (cacheRead     * PRICE_CACHE_READ_PER_M  / 1_000_000) * 100;

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
      target_entity: inferredTarget,
      target_schema: TARGET_SCHEMAS[inferredTarget],
      usage: { input_tokens: inputTokens, output_tokens: outputTokens, cache_read_tokens: cacheRead, cache_creation_tokens: cacheCreation },
    });
  } catch (err) {
    console.error("[infer-import-mapping] error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500);
  }
});
