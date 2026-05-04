// =============================================================================
// FlipWizard — guided 4-step flow for adding a fix-and-flip deal:
// Deal Info → Financials → Rehab Scope → Review.
// Mutates DEALS in place on submit. Seeds DEFAULT_MILESTONES into
// _LOCAL_FLIP_MILESTONES for the new deal.
// =============================================================================
import { useState, useMemo } from "react";
import { DollarSign, TrendingUp, Hammer, Wrench, Plus, X } from "lucide-react";
import {
  fmt, DEALS, STAGE_ORDER, DEFAULT_MILESTONES,
  REHAB_CATEGORIES, REHAB_CATEGORY_GROUPS, REHAB_TEMPLATES,
  getCanonicalBySlug, getCanonicalByLabel,
} from "../api.js";
import { _LOCAL_FLIP_MILESTONES } from "../mockData.js";
import { useToast } from "../toast.jsx";
import { WizardShell, WizardNav, WizardField, wizardInput, wizardSelect } from "./wizardPrimitives.jsx";
import { createDeal } from "../db/deals.js";
import { createRehabItem } from "../db/dealRehabItems.js";
import { createMilestone } from "../db/dealMilestones.js";

export function FlipWizard({ onComplete, onExit }) {
  const { showToast } = useToast();
  const steps = ["Deal Info", "Financials", "Rehab Scope", "Review"];
  const [step, setStep] = useState(0);
  const todayStr = new Date().toISOString().slice(0, 10);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // Step 1: Deal basics
  const [basics, setBasics] = useState({ name: "", address: "", stage: "Under Contract", acquisitionDate: todayStr, projectedCloseDate: "" });
  const sb = k => e => setBasics(f => ({ ...f, [k]: e.target.value }));

  // Step 2: Financials
  const [fin, setFin] = useState({ purchasePrice: "", arv: "", rehabBudget: "", holdingCostsPerMonth: "" });
  const sf = k => e => setFin(f => ({ ...f, [k]: e.target.value }));

  // Projected profit calc
  const pp = parseFloat(fin.purchasePrice) || 0;
  const arv = parseFloat(fin.arv) || 0;
  const rb = parseFloat(fin.rehabBudget) || 0;
  const hc = parseFloat(fin.holdingCostsPerMonth) || 0;
  const sellingCostPct = 6;
  const projectedProfit = arv > 0 ? arv - pp - rb - (hc * 6) - (arv * sellingCostPct / 100) : 0;

  // Step 3: Rehab scope — uses same canonical category taxonomy as RehabTracker
  const allCategories = useMemo(() => {
    const canonicalLabels = new Set(REHAB_CATEGORIES.map(c => c.label.toLowerCase()));
    const customSet = new Set();
    DEALS.forEach(f => (f.rehabItems || []).forEach(i => {
      if (i.category && !canonicalLabels.has(i.category.toLowerCase())) customSet.add(i.category);
    }));
    return { canonical: REHAB_CATEGORIES, custom: [...customSet].sort() };
  }, []);
  const [rehabItems, setRehabItems] = useState([]);
  const [catFocusIdx, setCatFocusIdx] = useState(-1);
  const setRehab = (i, k, v) => setRehabItems(prev => prev.map((item, j) => j === i ? { ...item, [k]: v } : item));
  const addRehabItem = () => setRehabItems(prev => [...prev, { label: "", budgeted: "", canonicalCategory: null }]);
  const removeRehabItem = (i) => { setRehabItems(prev => prev.filter((_, j) => j !== i)); if (catFocusIdx === i) setCatFocusIdx(-1); };
  const rehabTotal = rehabItems.reduce((s, item) => s + (parseFloat(item.budgeted) || 0), 0);

  const handleSave = async () => {
    const initials = basics.name.split(/\s+/).map(w => w[0]).join("").toUpperCase().slice(0, 2);
    const colors = ["#e95e00", "var(--c-blue)", "var(--c-green)", "var(--c-purple)", "var(--c-red)", "#ec4899"];
    const color = colors[DEALS.length % colors.length];
    const rehabBudgetTotal = rehabTotal || rb;
    const wantedItems = rehabItems
      .filter(item => item.label.trim() && (parseFloat(item.budgeted) || 0) > 0)
      .map((item, sort_order) => ({
        category: item.label,
        slug: item.canonicalCategory || getCanonicalByLabel(item.label)?.slug || null,
        budgeted: parseFloat(item.budgeted) || 0,
        spent: 0,
        status: "pending",
        sortOrder: sort_order,
      }));
    try {
      const savedDeal = await createDeal({
        name: basics.name, address: basics.address || "",
        stage: basics.stage, image: initials,
        purchasePrice: pp, arv, rehabBudget: rehabBudgetTotal, rehabSpent: 0,
        holdingCostsPerMonth: hc, sellingCostPct: 6, daysOwned: 0,
        acquisitionDate: basics.acquisitionDate || null,
        projectedCloseDate: basics.projectedCloseDate || null,
      });
      const savedItems = await Promise.all(
        wantedItems.map(it => createRehabItem({ ...it, dealId: savedDeal.id }))
      );
      await Promise.all(
        DEFAULT_MILESTONES.map((label, idx) =>
          createMilestone({ dealId: savedDeal.id, label, done: false, date: null, sortOrder: idx })
        )
      );
      DEALS.push({ ...savedDeal, color, rehabItems: savedItems });
      showToast(`"${basics.name}" added to pipeline with ${savedItems.length} rehab line items`);
      onComplete && onComplete();
    } catch (e) {
      console.error("[PropBooks] Save deal failed:", e);
      showToast("Couldn't save deal — " + (e.message || "unknown error"));
    }
  };

  const handleExit = () => {
    if (basics.name.trim()) { setShowExitConfirm(true); } else { onExit(); }
  };
  const handleSaveAndExit = () => {
    handleSave();
    showToast(`"${basics.name}" saved — you can finish editing from the deal detail screen`);
  };

  return (
    <WizardShell steps={steps} currentStep={step} onStepClick={setStep} title="Add Fix & Flip Deal" subtitle="We'll walk you through the deal details, financials, and rehab scope." onExit={handleExit}>
      {showExitConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
          <div style={{ background: "var(--surface)", borderRadius: 16, padding: 28, maxWidth: 400, width: "90%", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>Save before leaving?</h3>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 24 }}>
              You've started adding "{basics.name}". Would you like to save what you have so far? You can finish filling in the details later.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={onExit} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-label)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Discard</button>
              <button onClick={handleSaveAndExit} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", background: "#e95e00", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Save & Exit</button>
            </div>
          </div>
        </div>
      )}

      {step === 0 && (
        <div style={{ background: "var(--surface)", borderRadius: 16, padding: 28, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)" }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Deal Information</h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24 }}>Basic info about the deal — name it something memorable.</p>
          <WizardField label="Deal Name" required hint="e.g. '42 Oak Ave Flip' or 'The Blue House'">
            <input value={basics.name} onChange={sb("name")} style={wizardInput} placeholder="Enter deal name" autoFocus />
          </WizardField>
          <WizardField label="Address">
            <input value={basics.address} onChange={sb("address")} style={wizardInput} placeholder="123 Main St, City, State ZIP" />
          </WizardField>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            <WizardField label="Stage">
              <select value={basics.stage} onChange={sb("stage")} style={wizardSelect}>
                {STAGE_ORDER.filter(s => s !== "Sold" && s !== "Converted to Rental").map(s => <option key={s}>{s}</option>)}
              </select>
            </WizardField>
            <WizardField label="Acquisition Date">
              <input type="date" value={basics.acquisitionDate} onChange={sb("acquisitionDate")} style={wizardInput} />
            </WizardField>
            <WizardField label="Projected Close">
              <input type="date" value={basics.projectedCloseDate} onChange={sb("projectedCloseDate")} style={wizardInput} />
            </WizardField>
          </div>
          <WizardNav onNext={() => setStep(1)} nextDisabled={!basics.name.trim()} />
        </div>
      )}

      {step === 1 && (
        <div style={{ background: "var(--surface)", borderRadius: 16, padding: 28, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)" }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Financials</h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24 }}>Purchase price, ARV, and budget. You'll add detailed rehab line items in the next step.</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <WizardField label="Purchase Price" required>
              <input type="number" value={fin.purchasePrice} onChange={sf("purchasePrice")} style={wizardInput} placeholder="$0" />
            </WizardField>
            <WizardField label="After Repair Value (ARV)" hint="What you expect to sell for">
              <input type="number" value={fin.arv} onChange={sf("arv")} style={wizardInput} placeholder="$0" />
            </WizardField>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <WizardField label="Estimated Rehab Budget" hint="Rough total — you'll itemize in the next step">
              <input type="number" value={fin.rehabBudget} onChange={sf("rehabBudget")} style={wizardInput} placeholder="$0" />
            </WizardField>
            <WizardField label="Monthly Holding Costs" hint="Taxes, insurance, utilities, loan payments">
              <input type="number" value={fin.holdingCostsPerMonth} onChange={sf("holdingCostsPerMonth")} style={wizardInput} placeholder="$0" />
            </WizardField>
          </div>
          {projectedProfit !== 0 && (
            <div style={{ background: projectedProfit > 0 ? "var(--success-tint)" : "var(--danger-tint)", border: `1px solid ${projectedProfit > 0 ? "var(--success-border)" : "var(--danger-border)"}`, borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
              <TrendingUp size={16} color={projectedProfit > 0 ? "var(--c-green)" : "var(--c-red)"} />
              <span style={{ fontSize: 13, color: projectedProfit > 0 ? "#1a7a4a" : "#c0392b" }}>
                Projected profit: <strong>{fmt(Math.round(projectedProfit))}</strong>
                <span style={{ color: "var(--text-muted)", marginLeft: 8, fontSize: 11 }}>(assumes 6% selling costs, 6 month hold)</span>
              </span>
            </div>
          )}
          <WizardNav onBack={() => setStep(0)} onNext={() => setStep(2)} onSkip={() => setStep(2)} />
        </div>
      )}

      {step === 2 && (
        <div style={{ background: "var(--surface)", borderRadius: 16, padding: 28, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)" }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Rehab Scope</h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24 }}>
            {rehabItems.length === 0
              ? "Pick a template to pre-populate standard scopes with suggested budgets, or build your own from scratch."
              : "Adjust budgets, remove items you don't need, or add custom line items."}
          </p>

          {/* Template picker — shown when no items yet (mirrors RehabTracker empty state) */}
          {rehabItems.length === 0 && (
            <div>
              <div style={{ textAlign: "center", marginBottom: 20 }}>
                <div style={{ width: 56, height: 56, borderRadius: 14, background: "var(--warning-bg)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                  <Wrench size={24} color="#e95e00" />
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>Start your rehab scope</h3>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", maxWidth: 460, margin: "0 auto" }}>Pick a template to pre-populate standard scopes with suggested budgets, or build your own from scratch.</p>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 12, marginBottom: 14 }}>
                {REHAB_TEMPLATES.map(tpl => {
                  const total = tpl.items.reduce((s, i) => s + (i.budgeted || 0), 0);
                  return (
                    <button key={tpl.id} onClick={() => {
                      const seeded = tpl.items.map(i => {
                        const canon = getCanonicalBySlug(i.slug);
                        return { label: canon?.label || i.slug, canonicalCategory: i.slug, budgeted: String(i.budgeted || 0) };
                      });
                      setRehabItems(seeded);
                    }} style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 14, padding: 18, textAlign: "left", cursor: "pointer", transition: "all 0.15s" }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = "#e95e00"; e.currentTarget.style.background = "var(--warning-bg)"; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "var(--surface)"; }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>{tpl.name}</p>
                      <p style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 10, minHeight: 30 }}>{tpl.description}</p>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 10, borderTop: "1px solid var(--border-subtle)" }}>
                        <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>{tpl.items.length} items</span>
                        <span style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: 700 }}>{fmt(total)}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div style={{ textAlign: "center" }}>
                <button onClick={addRehabItem} style={{ background: "none", border: "none", color: "var(--text-secondary)", fontSize: 13, fontWeight: 600, cursor: "pointer", textDecoration: "underline" }}>or start from scratch</button>
              </div>
            </div>
          )}

          {/* Rehab item list — shown after template selection or manual add */}
          {rehabItems.length > 0 && (
            <div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {rehabItems.map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                    <div style={{ position: "relative", flex: 2 }}>
                      <input value={item.label}
                        onChange={e => { setRehab(i, "label", e.target.value); setRehab(i, "canonicalCategory", null); setCatFocusIdx(i); }}
                        onFocus={() => setCatFocusIdx(i)}
                        onBlur={() => setTimeout(() => setCatFocusIdx(-1), 150)}
                        style={wizardInput} placeholder="Start typing to search categories..." />
                      {catFocusIdx === i && (() => {
                        const q = item.label.toLowerCase().trim();
                        const canonMatches = q ? allCategories.canonical.filter(c => c.label.toLowerCase().includes(q)) : allCategories.canonical;
                        const customMatches = q ? allCategories.custom.filter(c => c.toLowerCase().includes(q)) : allCategories.custom;
                        const alreadyUsed = new Set(rehabItems.map((r, j) => j !== i ? r.label.toLowerCase() : null).filter(Boolean));
                        const filteredCanon = canonMatches.filter(c => !alreadyUsed.has(c.label.toLowerCase()));
                        const filteredCustom = customMatches.filter(c => !alreadyUsed.has(c.toLowerCase()));
                        const exactExists = [...allCategories.canonical.map(c => c.label), ...allCategories.custom].some(c => c.toLowerCase() === q);
                        const showNew = q && !exactExists;
                        if (filteredCanon.length === 0 && filteredCustom.length === 0 && !showNew) return null;
                        const grouped = REHAB_CATEGORY_GROUPS.map(g => ({ group: g, items: filteredCanon.filter(c => c.group === g) })).filter(g => g.items.length > 0);
                        return (
                          <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.10)", zIndex: 200, overflow: "hidden", maxHeight: 280, overflowY: "auto" }}>
                            {grouped.map(({ group, items }) => (
                              <div key={group}>
                                <div style={{ padding: "6px 14px 4px", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", background: "var(--surface-alt)", borderBottom: "1px solid var(--border-subtle)" }}>{group}</div>
                                {items.map(c => (
                                  <button key={c.slug} type="button"
                                    onMouseDown={() => { setRehab(i, "label", c.label); setRehab(i, "canonicalCategory", c.slug); setCatFocusIdx(-1); }}
                                    style={{ width: "100%", padding: "8px 14px", background: "none", border: "none", borderBottom: "1px solid var(--border-subtle)", textAlign: "left", cursor: "pointer", fontSize: 13, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
                                    <Wrench size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                                    <span>{c.label}</span>
                                  </button>
                                ))}
                              </div>
                            ))}
                            {filteredCustom.length > 0 && (
                              <div>
                                <div style={{ padding: "6px 14px 4px", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", background: "var(--surface-alt)", borderBottom: "1px solid var(--border-subtle)" }}>Custom</div>
                                {filteredCustom.map(c => (
                                  <button key={c} type="button"
                                    onMouseDown={() => { setRehab(i, "label", c); setRehab(i, "canonicalCategory", null); setCatFocusIdx(-1); }}
                                    style={{ width: "100%", padding: "8px 14px", background: "none", border: "none", borderBottom: "1px solid var(--border-subtle)", textAlign: "left", cursor: "pointer", fontSize: 13, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
                                    <Wrench size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                                    <span>{c}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                            {showNew && (
                              <button type="button" onMouseDown={() => setCatFocusIdx(-1)}
                                style={{ width: "100%", padding: "10px 14px", display: "flex", alignItems: "center", gap: 8, background: "var(--warning-bg)", border: "none", cursor: "pointer", textAlign: "left" }}>
                                <Plus size={13} style={{ color: "#e95e00", flexShrink: 0 }} />
                                <span style={{ fontSize: 13, color: "#e95e00", fontWeight: 600 }}>Add &ldquo;{item.label}&rdquo; as custom</span>
                              </button>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                    <div style={{ position: "relative", flex: 1 }}>
                      <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", fontSize: 14 }}>$</span>
                      <input type="number" value={item.budgeted} onChange={e => setRehab(i, "budgeted", e.target.value)}
                        style={{ ...wizardInput, paddingLeft: 24 }} placeholder="0" />
                    </div>
                    <button onClick={() => removeRehabItem(i)} style={{ background: "none", border: "none", color: "#cbd5e1", cursor: "pointer", padding: 6, borderRadius: 6, display: "flex", marginTop: 8 }}
                      onMouseEnter={e => e.currentTarget.style.color = "var(--c-red)"}
                      onMouseLeave={e => e.currentTarget.style.color = "#cbd5e1"}>
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
                <button onClick={addRehabItem} style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 16px", borderRadius: 10, border: "none", background: "#e95e00", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  <Plus size={14} /> Add Rehab Item
                </button>
                <button onClick={() => setRehabItems([])} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  <X size={12} style={{ marginRight: 4 }} />Clear all &amp; pick new template
                </button>
              </div>
              {rehabTotal > 0 && (
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16, fontSize: 14 }}>
                  <span style={{ color: "var(--text-secondary)" }}>Total Rehab Budget: </span>
                  <strong style={{ color: "var(--text-primary)", marginLeft: 8 }}>{fmt(rehabTotal)}</strong>
                </div>
              )}
            </div>
          )}
          <WizardNav onBack={() => setStep(1)} onNext={() => setStep(3)} onSkip={() => setStep(3)} />
        </div>
      )}

      {step === 3 && (
        <div style={{ background: "var(--surface)", borderRadius: 16, padding: 28, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)" }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Review & Save</h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24 }}>Everything look right? You can always edit details later.</p>

          {/* Deal summary */}
          <div style={{ borderRadius: 12, border: "1px solid var(--border)", overflow: "hidden", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--surface-alt)", padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Hammer size={16} color="#e95e00" />
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>Deal Info</span>
              </div>
              <button onClick={() => setStep(0)} style={{ fontSize: 12, fontWeight: 600, color: "var(--c-blue)", background: "none", border: "none", cursor: "pointer" }}>Edit</button>
            </div>
            <div style={{ padding: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 13 }}>
              <div><span style={{ color: "var(--text-muted)" }}>Name:</span> <strong style={{ color: "var(--text-primary)" }}>{basics.name || "—"}</strong></div>
              <div><span style={{ color: "var(--text-muted)" }}>Stage:</span> <strong style={{ color: "var(--text-primary)" }}>{basics.stage}</strong></div>
              <div><span style={{ color: "var(--text-muted)" }}>Address:</span> <strong style={{ color: "var(--text-primary)" }}>{basics.address || "—"}</strong></div>
              <div><span style={{ color: "var(--text-muted)" }}>Close:</span> <strong style={{ color: "var(--text-primary)" }}>{basics.projectedCloseDate || "—"}</strong></div>
            </div>
          </div>

          {/* Financials summary */}
          <div style={{ borderRadius: 12, border: "1px solid var(--border)", overflow: "hidden", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--surface-alt)", padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <DollarSign size={16} color="var(--c-green)" />
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>Financials</span>
              </div>
              <button onClick={() => setStep(1)} style={{ fontSize: 12, fontWeight: 600, color: "var(--c-blue)", background: "none", border: "none", cursor: "pointer" }}>Edit</button>
            </div>
            <div style={{ padding: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 13 }}>
              <div><span style={{ color: "var(--text-muted)" }}>Purchase:</span> <strong style={{ color: "var(--text-primary)" }}>{pp > 0 ? fmt(pp) : "—"}</strong></div>
              <div><span style={{ color: "var(--text-muted)" }}>ARV:</span> <strong style={{ color: "var(--text-primary)" }}>{arv > 0 ? fmt(arv) : "—"}</strong></div>
              <div><span style={{ color: "var(--text-muted)" }}>Rehab Budget:</span> <strong style={{ color: "var(--text-primary)" }}>{(rehabTotal || rb) > 0 ? fmt(rehabTotal || rb) : "—"}</strong></div>
              <div><span style={{ color: "var(--text-muted)" }}>Holding:</span> <strong style={{ color: "var(--text-primary)" }}>{hc > 0 ? `${fmt(hc)}/mo` : "—"}</strong></div>
              {projectedProfit !== 0 && (
                <div style={{ gridColumn: "1 / -1" }}><span style={{ color: "var(--text-muted)" }}>Projected Profit:</span> <strong style={{ color: projectedProfit > 0 ? "var(--c-green)" : "var(--c-red)" }}>{fmt(Math.round(projectedProfit))}</strong></div>
              )}
            </div>
          </div>

          {/* Rehab scope summary */}
          <div style={{ borderRadius: 12, border: "1px solid var(--border)", overflow: "hidden", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--surface-alt)", padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Wrench size={16} color="var(--c-purple)" />
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>Rehab Scope ({rehabItems.filter(i => i.label.trim() && (parseFloat(i.budgeted) || 0) > 0).length} items)</span>
              </div>
              <button onClick={() => setStep(2)} style={{ fontSize: 12, fontWeight: 600, color: "var(--c-blue)", background: "none", border: "none", cursor: "pointer" }}>Edit</button>
            </div>
            <div style={{ padding: 16 }}>
              {rehabItems.filter(i => i.label.trim() && (parseFloat(i.budgeted) || 0) > 0).length === 0 ? (
                <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>No line items budgeted</p>
              ) : rehabItems.filter(i => i.label.trim() && (parseFloat(i.budgeted) || 0) > 0).map((item, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f8fafc", fontSize: 13 }}>
                  <span style={{ color: "var(--text-primary)" }}>{item.label}</span>
                  <strong style={{ color: "var(--text-primary)" }}>{fmt(parseFloat(item.budgeted))}</strong>
                </div>
              ))}
              {rehabTotal > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 0", borderTop: "1px solid var(--border)", marginTop: 8, fontSize: 13 }}>
                  <strong style={{ color: "var(--text-secondary)" }}>Total</strong>
                  <strong style={{ color: "var(--text-primary)" }}>{fmt(rehabTotal)}</strong>
                </div>
              )}
            </div>
          </div>
          <WizardNav onBack={() => setStep(2)} onNext={handleSave} nextLabel="Add to Pipeline" nextDisabled={!basics.name.trim()} />
        </div>
      )}
    </WizardShell>
  );
}
