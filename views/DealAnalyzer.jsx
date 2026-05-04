// =============================================================================
// DealAnalyzer — pre-purchase calculator for fix-and-flip projects and
// buy-and-hold rentals. Computes ARV-derived projections, MAO rules, cap
// rate, cash-on-cash, DSCR, and rule-of-thumb checks.
// =============================================================================
import { useState } from "react";
import { Hammer, Building2, X } from "lucide-react";
import { fmt } from "../api.js";

export function DealAnalyzer() {
  const [mode, setMode] = useState("deal");
  const [dealCalc, setDealCalc] = useState({ arv: "", purchase: "", rehab: "", holdMonths: "4", sellingPct: "6" });
  const [rental, setRental] = useState({ price: "", downPct: "20", rate: "7.25", termYears: "30", monthlyRent: "", taxes: "", insurance: "", maintenance: "", vacancy: "5", mgmtPct: "0" });

  // Deal calcs
  const fARV = parseFloat(dealCalc.arv) || 0;
  const fPurchase = parseFloat(dealCalc.purchase) || 0;
  const fRehab = parseFloat(dealCalc.rehab) || 0;
  const fHold = parseFloat(dealCalc.holdMonths) || 0;
  const fSellPct = parseFloat(dealCalc.sellingPct) / 100 || 0.06;
  const mao70 = fARV * 0.70 - fRehab;
  const mao65 = fARV * 0.65 - fRehab;
  const holdingEst = fPurchase * 0.01 * fHold;
  const sellCosts = fARV * fSellPct;
  const totalIn = fPurchase + fRehab + holdingEst + sellCosts;
  const fProfit = fARV - totalIn;
  const fROI = totalIn > 0 ? ((fProfit / (fPurchase + fRehab)) * 100).toFixed(1) : 0;
  const spread = fPurchase > 0 ? mao70 - fPurchase : null;

  // Rental calcs
  const rPrice = parseFloat(rental.price) || 0;
  const rDown = (parseFloat(rental.downPct) / 100) * rPrice;
  const rLoan = rPrice - rDown;
  const rRate = parseFloat(rental.rate) / 100 / 12;
  const rN = parseFloat(rental.termYears) * 12;
  const mortgage = rRate > 0 && rN > 0 ? rLoan * (rRate * Math.pow(1 + rRate, rN)) / (Math.pow(1 + rRate, rN) - 1) : 0;
  const rRent = parseFloat(rental.monthlyRent) || 0;
  const rTaxMo = (parseFloat(rental.taxes) || 0) / 12;
  const rIns = (parseFloat(rental.insurance) || 0) / 12;
  const rMaint = parseFloat(rental.maintenance) || 0;
  const rVac = (parseFloat(rental.vacancy) / 100) * rRent;
  const rMgmt = (parseFloat(rental.mgmtPct) / 100) * rRent;
  const totalExpenses = mortgage + rTaxMo + rIns + rMaint + rVac + rMgmt;
  const noi = (rRent - rVac - rMgmt - rTaxMo - rIns - rMaint) * 12;
  const cashFlow = rRent - totalExpenses;
  const capRate = rPrice > 0 ? ((noi / rPrice) * 100).toFixed(2) : 0;
  const cocReturn = rDown > 0 ? (((cashFlow * 12) / rDown) * 100).toFixed(2) : 0;
  const grm = rRent > 0 ? (rPrice / (rRent * 12)).toFixed(1) : 0;

  const inputStyle = { width: "100%", padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 10, fontSize: 14, color: "var(--text-primary)", background: "var(--surface)", outline: "none", boxSizing: "border-box" };
  const labelStyle = { display: "block", color: "var(--text-label)", fontSize: 12, fontWeight: 600, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ color: "var(--text-primary)", fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Deal Analyzer</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: 15 }}>Run the numbers before you make an offer</p>
      </div>
      <div style={{ display: "flex", background: "var(--surface-alt)", borderRadius: 10, padding: 4, width: "fit-content", marginBottom: 28, border: "1px solid var(--border)" }}>
        {[{ id: "deal", label: "Fix & Flip", icon: Hammer }, { id: "rental", label: "Buy & Hold", icon: Building2 }].map(m => {
          const active = mode === m.id;
          return (
            <button key={m.id} onClick={() => setMode(m.id)} style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 22px", borderRadius: 8, border: "none", background: active ? "#e95e00" : "transparent", color: active ? "#fff" : "var(--text-secondary)", fontWeight: active ? 700 : 500, fontSize: 14, cursor: "pointer", transition: "all 0.15s" }}>
              <m.icon size={15} /> {m.label}
            </button>
          );
        })}
      </div>

      {mode === "deal" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          <div style={{ background: "var(--surface)", borderRadius: 16, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <h3 style={{ color: "var(--text-primary)", fontSize: 16, fontWeight: 700 }}>Deal Inputs</h3>
              {(dealCalc.arv || dealCalc.purchase || dealCalc.rehab) && (
                <button onClick={() => setDealCalc({ arv: "", purchase: "", rehab: "", holdMonths: "4", sellingPct: "6" })} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                  <X size={13} /> Reset
                </button>
              )}
            </div>
            {[
              { label: "After Repair Value (ARV)", key: "arv", placeholder: "310000" },
              { label: "Purchase Price", key: "purchase", placeholder: "195000" },
              { label: "Estimated Rehab", key: "rehab", placeholder: "62000" },
              { label: "Hold Period (months)", key: "holdMonths", placeholder: "4" },
              { label: "Selling Costs (%)", key: "sellingPct", placeholder: "6" },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 14 }}>
                <label style={labelStyle}>{f.label}</label>
                <input type="number" placeholder={f.placeholder} value={dealCalc[f.key]} onChange={e => setDealCalc({ ...dealCalc, [f.key]: e.target.value })} style={inputStyle} />
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ background: fProfit > 0 ? "var(--success-tint)" : "var(--danger-tint)", borderRadius: 16, padding: 24, border: `1px solid ${fProfit > 0 ? "var(--success-border)" : "var(--danger-border)"}` }}>
              <h3 style={{ color: "var(--text-primary)", fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Projected Results</h3>
              {[
                { label: "ARV", value: fmt(fARV), color: "#1a7a4a" },
                { label: "- Purchase Price", value: fmt(fPurchase), color: "#c0392b" },
                { label: "- Rehab Cost", value: fmt(fRehab), color: "#c0392b" },
                { label: "- Est. Holding Costs", value: fmt(holdingEst), color: "#c0392b" },
                { label: "- Selling Costs", value: fmt(sellCosts), color: "#c0392b" },
              ].map((r, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                  <span style={{ fontSize: 13, color: "var(--text-label)" }}>{r.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: r.color }}>{r.value}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 0 4px" }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)" }}>Net Profit</span>
                <span style={{ fontSize: 22, fontWeight: 800, color: fProfit > 0 ? "#1a7a4a" : "#c0392b" }}>{fProfit >= 0 ? "+" : ""}{fmt(fProfit)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>ROI on cash in</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--c-blue)" }}>{fROI}%</span>
              </div>
            </div>
            <div style={{ background: "var(--surface)", borderRadius: 16, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)" }}>
              <h3 style={{ color: "var(--text-primary)", fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Max Allowable Offer</h3>
              {[
                { label: "MAO at 70% Rule", value: fmt(mao70), color: "var(--c-blue)" },
                { label: "MAO at 65% (conservative)", value: fmt(mao65), color: "var(--c-purple)" },
                { label: "Your Offer", value: fPurchase > 0 ? fmt(fPurchase) : "-", color: "var(--text-primary)" },
                { label: "Spread vs. 70% MAO", value: spread !== null ? (spread >= 0 ? `+${fmt(spread)} under` : `${fmt(Math.abs(spread))} over`) : "-", color: spread !== null ? (spread >= 0 ? "#1a7a4a" : "#c0392b") : "#94a3b8" },
              ].map((m, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: i < 3 ? "1px solid #f8fafc" : "none" }}>
                  <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{m.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: m.color }}>{m.value}</span>
                </div>
              ))}
            </div>
            {fARV > 0 && fPurchase > 0 && (
              <div style={{ background: "var(--surface)", borderRadius: 16, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)" }}>
                <h3 style={{ color: "var(--text-primary)", fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Quick Checks</h3>
                {(() => {
                  const purchasePctARV = (fPurchase / fARV * 100).toFixed(0);
                  const rehabPctARV = fARV > 0 ? (fRehab / fARV * 100).toFixed(0) : 0;
                  const profitMargin = fARV > 0 ? (fProfit / fARV * 100).toFixed(1) : 0;
                  const checks = [
                    { label: "Purchase / ARV", value: `${purchasePctARV}%`, pass: purchasePctARV <= 70, tip: "Ideally under 70% of ARV" },
                    { label: "Rehab / ARV", value: `${rehabPctARV}%`, pass: rehabPctARV <= 25, tip: "Keep under 25% of ARV" },
                    { label: "Profit Margin", value: `${profitMargin}%`, pass: profitMargin >= 10, tip: "Target 10%+ of ARV" },
                    { label: "ROI", value: `${fROI}%`, pass: parseFloat(fROI) >= 15, tip: "Target 15%+ return on cash" },
                  ];
                  return checks.map((c, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: i < checks.length - 1 ? "1px solid #f8fafc" : "none" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: c.pass ? "var(--c-green)" : "var(--c-red)" }} />
                        <span style={{ fontSize: 13, color: "var(--text-label)" }}>{c.label}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: c.pass ? "#1a7a4a" : "#c0392b" }}>{c.value}</span>
                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{c.tip}</span>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            )}
          </div>
        </div>
      )}

      {mode === "rental" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          <div style={{ background: "var(--surface)", borderRadius: 16, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <h3 style={{ color: "var(--text-primary)", fontSize: 16, fontWeight: 700 }}>Property Inputs</h3>
              {(rental.price || rental.monthlyRent) && (
                <button onClick={() => setRental({ price: "", downPct: "20", rate: "7.25", termYears: "30", monthlyRent: "", taxes: "", insurance: "", maintenance: "", vacancy: "5", mgmtPct: "0" })} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                  <X size={13} /> Reset
                </button>
              )}
            </div>
            <p style={{ color: "var(--text-muted)", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>Purchase</p>
            {[
              { label: "Purchase Price", key: "price", placeholder: "385000" },
              { label: "Down Payment (%)", key: "downPct", placeholder: "20" },
              { label: "Interest Rate (%)", key: "rate", placeholder: "7.25" },
              { label: "Loan Term (years)", key: "termYears", placeholder: "30" },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 12 }}>
                <label style={labelStyle}>{f.label}</label>
                <input type="number" placeholder={f.placeholder} value={rental[f.key]} onChange={e => setRental({ ...rental, [f.key]: e.target.value })} style={inputStyle} />
              </div>
            ))}
            <p style={{ color: "var(--text-muted)", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", margin: "16px 0 10px" }}>Income &amp; Expenses</p>
            {[
              { label: "Monthly Rent", key: "monthlyRent", placeholder: "2500" },
              { label: "Annual Property Taxes", key: "taxes", placeholder: "4200" },
              { label: "Annual Insurance", key: "insurance", placeholder: "1800" },
              { label: "Monthly Maintenance", key: "maintenance", placeholder: "150" },
              { label: "Vacancy Rate (%)", key: "vacancy", placeholder: "5" },
              { label: "Mgmt Fee (%)", key: "mgmtPct", placeholder: "0" },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 12 }}>
                <label style={labelStyle}>{f.label}</label>
                <input type="number" placeholder={f.placeholder} value={rental[f.key]} onChange={e => setRental({ ...rental, [f.key]: e.target.value })} style={inputStyle} />
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ background: cashFlow > 0 ? "var(--success-tint)" : "var(--danger-tint)", borderRadius: 16, padding: 24, border: `1px solid ${cashFlow > 0 ? "var(--success-border)" : "var(--danger-border)"}` }}>
              <h3 style={{ color: "var(--text-primary)", fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Monthly Cash Flow</h3>
              {[
                { label: "Gross Rent", value: fmt(rRent), color: "#1a7a4a" },
                { label: "- Mortgage (P&I)", value: fmt(mortgage), color: "#c0392b" },
                { label: "- Property Taxes", value: fmt(rTaxMo), color: "#c0392b" },
                { label: "- Insurance", value: fmt(rIns), color: "#c0392b" },
                { label: "- Maintenance", value: fmt(rMaint), color: "#c0392b" },
                { label: "- Vacancy", value: fmt(rVac), color: "#c0392b" },
                { label: "- Mgmt Fee", value: fmt(rMgmt), color: "#c0392b" },
              ].map((r, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                  <span style={{ fontSize: 13, color: "var(--text-label)" }}>{r.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: r.color }}>{r.value}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 0 4px" }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)" }}>Net Cash Flow / mo</span>
                <span style={{ fontSize: 22, fontWeight: 800, color: cashFlow > 0 ? "#1a7a4a" : "#c0392b" }}>{cashFlow >= 0 ? "+" : ""}{fmt(cashFlow)}</span>
              </div>
            </div>
            <div style={{ background: "var(--surface)", borderRadius: 16, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)" }}>
              <h3 style={{ color: "var(--text-primary)", fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Key Metrics</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  { label: "Down Payment", value: fmt(rDown), color: "var(--text-primary)" },
                  { label: "Mortgage Payment", value: fmt(mortgage), color: "var(--text-primary)" },
                  { label: "Annual NOI", value: fmt(noi), color: "var(--c-green)" },
                  { label: "Cap Rate", value: `${capRate}%`, color: "var(--c-blue)" },
                  { label: "Cash-on-Cash Return", value: `${cocReturn}%`, color: "var(--c-purple)" },
                  { label: "Gross Rent Multiplier", value: `${grm}x`, color: "#e95e00" },
                ].map((m, i) => (
                  <div key={i} style={{ background: "var(--surface-alt)", borderRadius: 10, padding: "12px 14px" }}>
                    <p style={{ color: "var(--text-muted)", fontSize: 10, fontWeight: 600, textTransform: "uppercase", marginBottom: 3 }}>{m.label}</p>
                    <p style={{ color: m.color, fontSize: 16, fontWeight: 800 }}>{m.value}</p>
                  </div>
                ))}
              </div>
            </div>
            {rPrice > 0 && rRent > 0 && (
              <div style={{ background: "var(--surface)", borderRadius: 16, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)" }}>
                <h3 style={{ color: "var(--text-primary)", fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Quick Checks</h3>
                {(() => {
                  const onePercent = rRent >= rPrice * 0.01;
                  const onePctVal = (rRent / rPrice * 100).toFixed(2);
                  const fiftyRule = totalExpenses <= rRent * 0.5;
                  const expPct = rRent > 0 ? ((totalExpenses / rRent) * 100).toFixed(0) : 0;
                  const checks = [
                    { label: "1% Rule", value: `${onePctVal}%`, pass: onePercent, tip: "Monthly rent should be ≥ 1% of purchase price" },
                    { label: "50% Rule", value: `${expPct}% of rent`, pass: fiftyRule, tip: "Total expenses should be ≤ 50% of gross rent" },
                    { label: "Cap Rate", value: `${capRate}%`, pass: parseFloat(capRate) >= 5, tip: "Target 5%+ for rentals" },
                    { label: "Cash-on-Cash", value: `${cocReturn}%`, pass: parseFloat(cocReturn) >= 8, tip: "Target 8%+ return on cash invested" },
                    { label: "DSCR", value: mortgage > 0 ? (noi / (mortgage * 12)).toFixed(2) : "N/A", pass: mortgage > 0 && (noi / (mortgage * 12)) >= 1.25, tip: "Lenders want ≥ 1.25" },
                  ];
                  return checks.map((c, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: i < checks.length - 1 ? "1px solid #f8fafc" : "none" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: c.pass ? "var(--c-green)" : "var(--c-red)" }} />
                        <span style={{ fontSize: 13, color: "var(--text-label)" }}>{c.label}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: c.pass ? "#1a7a4a" : "#c0392b" }}>{c.value}</span>
                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{c.tip}</span>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
