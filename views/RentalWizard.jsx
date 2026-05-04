// =============================================================================
// RentalWizard — guided 4-step flow for adding a rental property:
// Property → Financials → Tenants → Review.
// Mutates PROPERTIES and TENANTS in place on submit (mock data layer).
// =============================================================================
import { useState, useEffect } from "react";
import { DollarSign, Home, User, Users } from "lucide-react";
import { fmt, PROP_COLORS } from "../api.js";
import { PROPERTIES, TENANTS } from "../mockData.js";
import { useToast } from "../toast.jsx";
import { WizardShell, WizardNav, WizardField, wizardInput, wizardSelect } from "./wizardPrimitives.jsx";
import { createProperty } from "../db/properties.js";
import { createTenant } from "../db/tenants.js";

export function RentalWizard({ onComplete, onExit }) {
  const { showToast } = useToast();
  const steps = ["Property", "Financials", "Tenants", "Review"];
  const [step, setStep] = useState(0);
  const todayStr = new Date().toISOString().slice(0, 10);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // Step 1: Property basics
  const [basics, setBasics] = useState({ name: "", address: "", type: "Single Family", units: "1", status: "Occupied", purchaseDate: todayStr });
  const sb = k => e => setBasics(f => ({ ...f, [k]: e.target.value }));

  // Step 2: Financials
  const [fin, setFin] = useState({ purchasePrice: "", currentValue: "", closingCosts: "", loanAmount: "", loanRate: "", loanTermYears: "30", loanStartDate: todayStr, monthlyRent: "", monthlyExpenses: "" });
  const sf = k => e => setFin(f => ({ ...f, [k]: e.target.value }));

  // Mortgage calc
  const loanAmt = parseFloat(fin.loanAmount) || 0;
  const loanRate = parseFloat(fin.loanRate) || 0;
  const loanTerm = parseFloat(fin.loanTermYears) || 30;
  const monthlyMortgage = loanAmt > 0 && loanRate > 0
    ? (loanAmt * (loanRate / 100 / 12)) / (1 - Math.pow(1 + loanRate / 100 / 12, -loanTerm * 12))
    : 0;

  // Step 3: Tenants
  const unitCount = parseInt(basics.units) || 1;
  const [tenants, setTenants] = useState([]);
  useEffect(() => {
    setTenants(prev => {
      const arr = [];
      for (let i = 0; i < unitCount; i++) {
        arr.push(prev[i] || { name: "", unit: unitCount === 1 ? "Main" : `Unit ${i + 1}`, rent: fin.monthlyRent && unitCount === 1 ? fin.monthlyRent : "", leaseStart: "", leaseEnd: "", status: "active-lease", vacant: false });
      }
      return arr;
    });
  }, [unitCount]); // eslint-disable-line react-hooks/exhaustive-deps -- only resize on unitCount; rent edits must not clobber user input
  const setTenant = (i, k, v) => setTenants(prev => prev.map((t, j) => j === i ? { ...t, [k]: v } : t));

  const canProceed = [
    basics.name.trim().length > 0,  // step 0
    true,  // step 1 — financials are optional
    true,  // step 2 — tenants optional
    true,  // step 3 — review, always submittable
  ];

  const handleSave = async () => {
    const val = parseFloat(fin.currentValue) || parseFloat(fin.purchasePrice) || 0;
    const usedColors = PROPERTIES.map(p => p.color);
    const color = PROP_COLORS.find(c => !usedColors.includes(c)) || PROP_COLORS[PROPERTIES.length % PROP_COLORS.length];
    try {
      const saved = await createProperty({
        name: basics.name, address: basics.address, type: basics.type,
        units: unitCount,
        purchasePrice: parseFloat(fin.purchasePrice) || 0,
        currentValue: val, valueUpdatedAt: todayStr,
        loanAmount: loanAmt, loanRate, loanTermYears: loanTerm,
        loanStartDate: fin.loanStartDate || null,
        closingCosts: parseFloat(fin.closingCosts) || 0, landValue: null,
        monthlyRent: parseFloat(fin.monthlyRent) || 0,
        monthlyExpenses: parseFloat(fin.monthlyExpenses) || 0,
        purchaseDate: basics.purchaseDate || null,
        status: basics.status,
        image: basics.name.slice(0, 2).toUpperCase(), photo: null,
      });
      PROPERTIES.push({ ...saved, color });
      for (const t of tenants) {
        if (t.vacant) {
          const ten = await createTenant({ propertyId: saved.id, name: "Vacant", unit: t.unit, rent: parseFloat(t.rent) || 0, status: "vacant" });
          TENANTS.push(ten);
        } else if (t.name.trim()) {
          const ten = await createTenant({ propertyId: saved.id, name: t.name, unit: t.unit, rent: parseFloat(t.rent) || 0, leaseStart: t.leaseStart || null, leaseEnd: t.leaseEnd || null, status: t.status || "active-lease" });
          TENANTS.push(ten);
        }
      }
      showToast(`"${basics.name}" added to portfolio with ${tenants.filter(t => !t.vacant && t.name.trim()).length} tenant(s)`);
      onComplete && onComplete();
    } catch (e) {
      console.error("[PropBooks] Save property failed:", e);
      showToast("Couldn't save property — " + (e.message || "unknown error"));
    }
  };

  const handleExit = () => {
    if (basics.name.trim()) { setShowExitConfirm(true); } else { onExit(); }
  };
  const handleSaveAndExit = () => {
    handleSave();
    showToast(`"${basics.name}" saved — you can finish editing from the property detail screen`);
  };

  return (
    <WizardShell steps={steps} currentStep={step} onStepClick={setStep} title="Add Rental Property" subtitle="We'll walk you through setting up your property, financials, and tenants." onExit={handleExit}>
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
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Property Details</h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24 }}>Basic info about the property — you can always edit this later.</p>
          <WizardField label="Property Name" required hint="e.g. 'Maple Street Duplex' or '123 Main St'">
            <input value={basics.name} onChange={sb("name")} style={wizardInput} placeholder="Enter property name" autoFocus />
          </WizardField>
          <WizardField label="Address" hint="Full street address">
            <input value={basics.address} onChange={sb("address")} style={wizardInput} placeholder="123 Main St, City, State ZIP" />
          </WizardField>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <WizardField label="Property Type">
              <select value={basics.type} onChange={sb("type")} style={wizardSelect}>
                {["Single Family", "Duplex", "Triplex", "Fourplex", "Apartment", "Condo", "Townhouse", "Commercial", "Mixed Use"].map(t => <option key={t}>{t}</option>)}
              </select>
            </WizardField>
            <WizardField label="Units" hint="Total rentable units">
              <input type="number" min="1" value={basics.units} onChange={sb("units")} style={wizardInput} />
            </WizardField>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <WizardField label="Purchase Date">
              <input type="date" value={basics.purchaseDate} onChange={sb("purchaseDate")} style={wizardInput} />
            </WizardField>
            <WizardField label="Status">
              <select value={basics.status} onChange={sb("status")} style={wizardSelect}>
                {["Occupied", "Partially Vacant", "Vacant", "Renovating"].map(s => <option key={s}>{s}</option>)}
              </select>
            </WizardField>
          </div>
          <WizardNav onNext={() => setStep(1)} nextDisabled={!canProceed[0]} />
        </div>
      )}

      {step === 1 && (
        <div style={{ background: "var(--surface)", borderRadius: 16, padding: 28, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)" }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Financials</h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24 }}>Purchase details and loan info. Skip anything you don't have yet.</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <WizardField label="Purchase Price">
              <input type="number" value={fin.purchasePrice} onChange={sf("purchasePrice")} style={wizardInput} placeholder="$0" />
            </WizardField>
            <WizardField label="Current Market Value" hint="Zillow, appraisal, or your best estimate">
              <input type="number" value={fin.currentValue} onChange={sf("currentValue")} style={wizardInput} placeholder="$0" />
            </WizardField>
          </div>
          <WizardField label="Closing Costs">
            <input type="number" value={fin.closingCosts} onChange={sf("closingCosts")} style={wizardInput} placeholder="$0" />
          </WizardField>

          <div style={{ borderTop: "1px solid var(--border-subtle)", margin: "20px 0", paddingTop: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>Loan Details</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <WizardField label="Loan Amount">
                <input type="number" value={fin.loanAmount} onChange={sf("loanAmount")} style={wizardInput} placeholder="$0" />
              </WizardField>
              <WizardField label="Interest Rate (%)">
                <input type="number" step="0.01" value={fin.loanRate} onChange={sf("loanRate")} style={wizardInput} placeholder="0.00" />
              </WizardField>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <WizardField label="Loan Term (years)">
                <input type="number" value={fin.loanTermYears} onChange={sf("loanTermYears")} style={wizardInput} placeholder="30" />
              </WizardField>
              <WizardField label="Loan Start Date">
                <input type="date" value={fin.loanStartDate} onChange={sf("loanStartDate")} style={wizardInput} />
              </WizardField>
            </div>
            {monthlyMortgage > 0 && (
              <div style={{ background: "var(--success-tint)", border: "1px solid var(--success-border)", borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
                <DollarSign size={16} color="var(--c-green)" />
                <span style={{ fontSize: 13, color: "#1a7a4a" }}>Estimated monthly payment: <strong>{fmt(Math.round(monthlyMortgage))}</strong></span>
              </div>
            )}
          </div>

          <div style={{ borderTop: "1px solid var(--border-subtle)", margin: "20px 0", paddingTop: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>Monthly Cash Flow</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <WizardField label="Monthly Rent" hint="Total across all units">
                <input type="number" value={fin.monthlyRent} onChange={sf("monthlyRent")} style={wizardInput} placeholder="$0" />
              </WizardField>
              <WizardField label="Monthly Expenses" hint="Taxes, insurance, maintenance, etc.">
                <input type="number" value={fin.monthlyExpenses} onChange={sf("monthlyExpenses")} style={wizardInput} placeholder="$0" />
              </WizardField>
            </div>
          </div>
          <WizardNav onBack={() => setStep(0)} onNext={() => setStep(2)} onSkip={() => setStep(2)} />
        </div>
      )}

      {step === 2 && (
        <div style={{ background: "var(--surface)", borderRadius: 16, padding: 28, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)" }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Tenants</h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24 }}>
            {unitCount === 1 ? "Add your tenant info, or mark as vacant." : `${unitCount} units detected — add tenant info for each, or mark vacant units.`}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {tenants.slice(0, unitCount).map((t, i) => (
              <div key={i} style={{ borderRadius: 12, border: t.vacant ? "1.5px dashed #cbd5e1" : "1px solid var(--border)", padding: 20, background: t.vacant ? "var(--surface-alt)" : "var(--surface)", transition: "all 0.15s" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: t.vacant ? 0 : 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: t.vacant ? "var(--surface-muted)" : "var(--info-tint)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {t.vacant ? <Home size={14} color="#94a3b8" /> : <User size={14} color="var(--c-blue)" />}
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{t.unit}</span>
                  </div>
                  <button onClick={() => setTenant(i, "vacant", !t.vacant)}
                    style={{ fontSize: 12, fontWeight: 600, color: t.vacant ? "var(--c-blue)" : "#94a3b8", background: "none", border: "none", cursor: "pointer" }}>
                    {t.vacant ? "Add Tenant" : "Mark Vacant"}
                  </button>
                </div>
                {!t.vacant && (
                  <div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <WizardField label="Tenant Name">
                        <input value={t.name} onChange={e => setTenant(i, "name", e.target.value)} style={wizardInput} placeholder="Full name" />
                      </WizardField>
                      <WizardField label="Monthly Rent">
                        <input type="number" value={t.rent} onChange={e => setTenant(i, "rent", e.target.value)} style={wizardInput} placeholder="$0" />
                      </WizardField>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                      <WizardField label="Lease Start">
                        <input type="date" value={t.leaseStart} onChange={e => setTenant(i, "leaseStart", e.target.value)} style={wizardInput} />
                      </WizardField>
                      <WizardField label="Lease End">
                        <input type="date" value={t.leaseEnd} onChange={e => setTenant(i, "leaseEnd", e.target.value)} style={wizardInput} />
                      </WizardField>
                      <WizardField label="Status">
                        <select value={t.status} onChange={e => setTenant(i, "status", e.target.value)} style={wizardSelect}>
                          <option value="active-lease">Active Lease</option>
                          <option value="month-to-month">Month-to-Month</option>
                        </select>
                      </WizardField>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          <WizardNav onBack={() => setStep(1)} onNext={() => setStep(3)} onSkip={() => setStep(3)} />
        </div>
      )}

      {step === 3 && (
        <div style={{ background: "var(--surface)", borderRadius: 16, padding: 28, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)" }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Review & Save</h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24 }}>Everything look right? You can always edit details later.</p>

          {/* Property summary */}
          <div style={{ borderRadius: 12, border: "1px solid var(--border)", overflow: "hidden", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--surface-alt)", padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Home size={16} color="var(--c-blue)" />
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>Property</span>
              </div>
              <button onClick={() => setStep(0)} style={{ fontSize: 12, fontWeight: 600, color: "var(--c-blue)", background: "none", border: "none", cursor: "pointer" }}>Edit</button>
            </div>
            <div style={{ padding: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 13 }}>
              <div><span style={{ color: "var(--text-muted)" }}>Name:</span> <strong style={{ color: "var(--text-primary)" }}>{basics.name || "—"}</strong></div>
              <div><span style={{ color: "var(--text-muted)" }}>Type:</span> <strong style={{ color: "var(--text-primary)" }}>{basics.type}</strong></div>
              <div><span style={{ color: "var(--text-muted)" }}>Address:</span> <strong style={{ color: "var(--text-primary)" }}>{basics.address || "—"}</strong></div>
              <div><span style={{ color: "var(--text-muted)" }}>Units:</span> <strong style={{ color: "var(--text-primary)" }}>{unitCount}</strong></div>
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
              <div><span style={{ color: "var(--text-muted)" }}>Purchase:</span> <strong style={{ color: "var(--text-primary)" }}>{fin.purchasePrice ? fmt(parseFloat(fin.purchasePrice)) : "—"}</strong></div>
              <div><span style={{ color: "var(--text-muted)" }}>Value:</span> <strong style={{ color: "var(--text-primary)" }}>{fin.currentValue ? fmt(parseFloat(fin.currentValue)) : "—"}</strong></div>
              <div><span style={{ color: "var(--text-muted)" }}>Loan:</span> <strong style={{ color: "var(--text-primary)" }}>{fin.loanAmount ? fmt(parseFloat(fin.loanAmount)) : "—"}</strong></div>
              <div><span style={{ color: "var(--text-muted)" }}>Mortgage:</span> <strong style={{ color: "var(--text-primary)" }}>{monthlyMortgage > 0 ? `${fmt(Math.round(monthlyMortgage))}/mo` : "—"}</strong></div>
              <div><span style={{ color: "var(--text-muted)" }}>Rent:</span> <strong style={{ color: "var(--c-green)" }}>{fin.monthlyRent ? `${fmt(parseFloat(fin.monthlyRent))}/mo` : "—"}</strong></div>
              <div><span style={{ color: "var(--text-muted)" }}>Expenses:</span> <strong style={{ color: "var(--c-red)" }}>{fin.monthlyExpenses ? `${fmt(parseFloat(fin.monthlyExpenses))}/mo` : "—"}</strong></div>
            </div>
          </div>

          {/* Tenants summary */}
          <div style={{ borderRadius: 12, border: "1px solid var(--border)", overflow: "hidden", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--surface-alt)", padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Users size={16} color="var(--c-purple)" />
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>Tenants ({tenants.filter(t => !t.vacant && t.name.trim()).length})</span>
              </div>
              <button onClick={() => setStep(2)} style={{ fontSize: 12, fontWeight: 600, color: "var(--c-blue)", background: "none", border: "none", cursor: "pointer" }}>Edit</button>
            </div>
            <div style={{ padding: 16 }}>
              {tenants.slice(0, unitCount).map((t, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: i < unitCount - 1 ? "1px solid var(--border-subtle)" : "none", fontSize: 13 }}>
                  <div>
                    <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{t.unit}</span>
                    <span style={{ color: "var(--text-secondary)", marginLeft: 8 }}>{t.vacant ? "Vacant" : t.name || "No tenant"}</span>
                  </div>
                  {!t.vacant && t.rent && <span style={{ fontWeight: 600, color: "var(--c-green)" }}>{fmt(parseFloat(t.rent))}/mo</span>}
                </div>
              ))}
            </div>
          </div>
          <WizardNav onBack={() => setStep(2)} onNext={handleSave} nextLabel="Add to Portfolio" nextDisabled={!basics.name.trim()} />
        </div>
      )}
    </WizardShell>
  );
}
