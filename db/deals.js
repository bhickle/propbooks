// =============================================================================
// db/deals.js — Supabase wrapper for the `deals` table.
// =============================================================================
import { supabase } from "../supabase.js";

function fromRow(row) {
  if (!row) return row;
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    stage: row.stage,
    image: row.image,
    purchasePrice: row.purchase_price == null ? null : Number(row.purchase_price),
    arv: row.arv == null ? null : Number(row.arv),
    arvUpdatedAt: row.arv_updated_at,
    listPrice: row.list_price == null ? null : Number(row.list_price),
    salePrice: row.sale_price == null ? null : Number(row.sale_price),
    rehabBudget: row.rehab_budget == null ? null : Number(row.rehab_budget),
    rehabSpent: row.rehab_spent == null ? null : Number(row.rehab_spent),
    holdingCostsPerMonth: row.holding_costs_per_month == null ? null : Number(row.holding_costs_per_month),
    sellingCostPct: row.selling_cost_pct == null ? null : Number(row.selling_cost_pct),
    daysOwned: row.days_owned,
    totalHoldingCosts: row.total_holding_costs == null ? null : Number(row.total_holding_costs),
    sellingCosts: row.selling_costs == null ? null : Number(row.selling_costs),
    netProfit: row.net_profit == null ? null : Number(row.net_profit),
    acquisitionDate: row.acquisition_date,
    rehabStartDate: row.rehab_start_date,
    rehabEndDate: row.rehab_end_date,
    listDate: row.list_date,
    contractDate: row.contract_date,
    closeDate: row.close_date,
    projectedListDate: row.projected_list_date,
    projectedCloseDate: row.projected_close_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toRow(d) {
  const out = {};
  if (d.name !== undefined) out.name = d.name;
  if (d.address !== undefined) out.address = d.address;
  if (d.stage !== undefined) out.stage = d.stage;
  if (d.image !== undefined) out.image = d.image;
  if (d.purchasePrice !== undefined) out.purchase_price = d.purchasePrice;
  if (d.arv !== undefined) out.arv = d.arv;
  if (d.arvUpdatedAt !== undefined) out.arv_updated_at = d.arvUpdatedAt;
  if (d.listPrice !== undefined) out.list_price = d.listPrice;
  if (d.salePrice !== undefined) out.sale_price = d.salePrice;
  if (d.rehabBudget !== undefined) out.rehab_budget = d.rehabBudget;
  if (d.rehabSpent !== undefined) out.rehab_spent = d.rehabSpent;
  if (d.holdingCostsPerMonth !== undefined) out.holding_costs_per_month = d.holdingCostsPerMonth;
  if (d.sellingCostPct !== undefined) out.selling_cost_pct = d.sellingCostPct;
  if (d.daysOwned !== undefined) out.days_owned = d.daysOwned;
  if (d.totalHoldingCosts !== undefined) out.total_holding_costs = d.totalHoldingCosts;
  if (d.sellingCosts !== undefined) out.selling_costs = d.sellingCosts;
  if (d.netProfit !== undefined) out.net_profit = d.netProfit;
  if (d.acquisitionDate !== undefined) out.acquisition_date = d.acquisitionDate;
  if (d.rehabStartDate !== undefined) out.rehab_start_date = d.rehabStartDate;
  if (d.rehabEndDate !== undefined) out.rehab_end_date = d.rehabEndDate;
  if (d.listDate !== undefined) out.list_date = d.listDate;
  if (d.contractDate !== undefined) out.contract_date = d.contractDate;
  if (d.closeDate !== undefined) out.close_date = d.closeDate;
  if (d.projectedListDate !== undefined) out.projected_list_date = d.projectedListDate;
  if (d.projectedCloseDate !== undefined) out.projected_close_date = d.projectedCloseDate;
  return out;
}

export async function listDeals() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("deals")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []).map(fromRow);
}

export async function createDeal(d) {
  if (!supabase) throw new Error("Supabase not configured");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data, error } = await supabase
    .from("deals")
    .insert([{ ...toRow(d), user_id: user.id }])
    .select()
    .single();
  if (error) throw error;
  return fromRow(data);
}

export async function updateDeal(id, updates) {
  if (!supabase) throw new Error("Supabase not configured");
  const { data, error } = await supabase
    .from("deals")
    .update(toRow(updates))
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return fromRow(data);
}

export async function deleteDeal(id) {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase.from("deals").delete().eq("id", id);
  if (error) throw error;
}
