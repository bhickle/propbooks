// =============================================================================
// propose-import-clarifications — second-pass review after the column mapping
// is set. Asks Claude Sonnet 4.6 to look at the FULL row data (not just a
// 5-row sample) and flag patterns that need a human judgment call before
// import. Returns 0-3 multiple-choice questions. The wizard renders them
// chat-style; the user picks one option per question and the wizard
// translates the chosen effects into edits to the row data at import time.
//
// Designed to be cheap: one Claude call per import (only when there's
// something genuinely ambiguous), structured-output via a single forced
// tool, capped at 200 calls per account per 30 days (shared cap with
// infer-import-mapping).
// =============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.40.0";

const MONTHLY_CAP = 200;
const MODEL = "claude-sonnet-4-6";

const PRICE_INPUT_PER_M       = 3.00;
const PRICE_OUTPUT_PER_M      = 15.00;
const PRICE_CACHE_WRITE_PER_M = 3.75;
const PRICE_CACHE_READ_PER_M  = 0.30;

const TOOL = {
  name: "propose_clarifications",
  description: "Return 0-3 clarifying questions about patterns in the row data that need a human judgment call before import.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      clarifications: {
        type: "array",
        maxItems: 3,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            id: { type: "string", description: "Stable short identifier for this question (kebab-case)" },
            kind: { type: "string", enum: ["shared_expense", "potential_duplicate_property", "ambiguous_category"], description: "Pattern type" },
            summary: { type: "string", description: "1-3 plain-language sentences explaining the pattern you noticed and why it needs a judgment call. Speak directly to the user." },
            row_count: { type: "integer", description: "How many rows this clarification affects" },
            example_payees: { type: "array", items: { type: "string" }, maxItems: 3, description: "Up to 3 representative payee/name values from the affected rows" },
            options: {
              type: "array",
              minItems: 2,
              maxItems: 6,
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  id: { type: "string", description: "Short identifier for this option (kebab-case)" },
                  label: { type: "string", description: "The choice text shown to the user — should read like a complete sentence answer" },
                  effect: {
                    type: "object",
                    additionalProperties: false,
                    description: "What the wizard should do when this option is chosen. Only these effect types are supported.",
                    properties: {
                      type: { type: "string", enum: ["skip_blank_property_rows", "attach_blank_property_rows_to_value", "no_op"] },
                      value: { type: ["string", "null"], description: "For attach_blank_property_rows_to_value: the property name/address to attach the blank rows to. Use a value from existing_properties or pending_properties; the wizard will auto-create if pending." },
                    },
                    required: ["type"],
                  },
                },
                required: ["id", "label", "effect"],
              },
            },
          },
          required: ["id", "kind", "summary", "row_count", "options"],
        },
      },
    },
    required: ["clarifications"],
  },
};

const SYSTEM_PROMPT = `You are PROPBOOKS's import assistant. The user just uploaded a transactions file. The column mapping is done; your job is to look at the FULL row data and flag patterns that need a human judgment call before import.

WHAT TO ASK ABOUT (always ask if you see these)
- Shared/umbrella expenses: 3+ rows missing a property value that share a payee or category. On Schedule E these usually get attached to one property — the user has to decide which. Examples that ALWAYS need a question: umbrella insurance, liability insurance, accountant fees, bookkeeping software, owner draws/distributions, business bank fees that aren't property-specific.

  Concrete pattern: if you see 5+ rows for the same payee (e.g. "State Farm Umbrella") with no property column value, surface a shared_expense clarification. This is THE primary case you exist to handle — do not skip it.

WHAT TO ASK ABOUT (ask if confident)
- Potential duplicate properties: two property values in the file that look like the same property with different spelling/formatting ("431 Jackson St" vs "431 Jackson Street").
- Ambiguous category mappings where one source category clearly contains very different kinds of expenses.

DO NOT ASK ABOUT
- Things the mapping already resolved
- Single outlier rows (1-2 rows of anything)
- Format/parsing issues
- Decisions the user can fix later by editing individual transactions
- Anything where the answer is obvious

RULES
- Be conversational in the summary. Speak to the user directly ("I noticed…", "These look like…"). 1-3 sentences.
- For shared_expense clarifications, ALWAYS include these options:
  1. One option per item in existing_properties (label: "Attach all to <name>")
  2. One option per item in pending_properties, suffixed with "(will be created)"
  3. "Skip them — I'll handle this separately" as a final option
- Each option's label should read like a complete answer the user would say back to you.
- Only use the effect types in the tool schema. Do not invent new ones.
- For shared_expense options that attach to a property, ALWAYS use effect type "attach_blank_property_rows_to_value" with the property's display name as the value. Use "skip_blank_property_rows" for the skip option.
- Return AT MOST 3 clarifications total.
- An empty array is correct ONLY when the file has zero blank-property rows AND zero potential duplicates AND zero ambiguous categories. If there are 3+ blank-property rows sharing a payee, that is NOT a case to skip.

INPUT FORMAT
You receive: the column mapping, the full list of normalized rows, the list of properties already in PROPBOOKS, and the list of properties the wizard will auto-create from this file. Use all of it.`;

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
      return jsonResponse({ error: "Monthly import quota reached. Try again later or contact support." }, 429);
    }

    let body: {
      mapping?: Record<string, string | null>;
      rows?: Record<string, unknown>[];
      existingProperties?: string[];
      pendingProperties?: string[];
    };
    try { body = await req.json(); }
    catch { return jsonResponse({ error: "Body must be JSON" }, 400); }

    const { mapping, rows, existingProperties, pendingProperties } = body;
    if (!mapping || typeof mapping !== "object") return jsonResponse({ error: "mapping must be an object" }, 400);
    if (!Array.isArray(rows)) return jsonResponse({ error: "rows must be an array" }, 400);
    // Cap the row payload to keep token costs predictable. The clarifications
    // we want surface from clusters of >=3 rows, so 500 is plenty of context.
    const cappedRows = rows.slice(0, 500);

    const userPrompt = [
      `mapping: ${JSON.stringify(mapping)}`,
      `existing_properties: ${JSON.stringify(existingProperties ?? [])}`,
      `pending_properties (will be auto-created from this file): ${JSON.stringify(pendingProperties ?? [])}`,
      `rows (${cappedRows.length}${rows.length > cappedRows.length ? ` of ${rows.length}` : ""}):`,
      JSON.stringify(cappedRows, null, 2),
      ``,
      `Look for patterns that need a human judgment call. Return 0-3 clarifications via the propose_clarifications tool.`,
    ].join("\n");

    const anthropic = new Anthropic({ apiKey: anthropicKey });

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userPrompt }],
      tools: [TOOL],
      tool_choice: { type: "tool", name: "propose_clarifications" },
    });

    const toolUse = response.content.find((b: { type: string }) => b.type === "tool_use") as
      | { type: "tool_use"; name: string; input: { clarifications: unknown[] } }
      | undefined;
    if (!toolUse) {
      // Treat a no-tool-use response as "no clarifications" — never block the import.
      return jsonResponse({ clarifications: [] });
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
        feature: "import_clarifications",
        model: MODEL,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cache_creation_tokens: cacheCreation,
        cache_read_tokens: cacheRead,
        cost_cents: Number(costCents.toFixed(4)),
      });
    } else {
      console.warn("[propose-import-clarifications] SUPABASE_SERVICE_ROLE_KEY not set — skipping ai_usage log.");
    }

    return jsonResponse({
      clarifications: toolUse.input.clarifications ?? [],
      usage: { input_tokens: inputTokens, output_tokens: outputTokens, cache_read_tokens: cacheRead, cache_creation_tokens: cacheCreation },
    });
  } catch (err) {
    console.error("[propose-import-clarifications] error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500);
  }
});
