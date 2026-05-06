// =============================================================================
// UnifiedReports — single nav entry that hosts both rental and deal reports
// behind a tab toggle. The underlying report logic stays in views/Reports.jsx
// (rentals) and dealReports.jsx (deals) — this is just an IA wrapper so the
// sidebar has one "Reports" entry instead of two parallel ones.
// =============================================================================
import { useState } from "react";
import { Home, Hammer } from "lucide-react";
import { Reports as RentalReports } from "./Reports.jsx";
import { DealReports } from "../dealReports.jsx";

export function UnifiedReports() {
  const [tab, setTab] = useState("rentals"); // "rentals" | "deals"
  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 24, background: "var(--surface-alt)", borderRadius: 10, padding: 4, border: "1px solid var(--border)", width: "fit-content" }}>
        <ReportTab id="rentals" label="Rentals" Icon={Home}    active={tab === "rentals"} onClick={() => setTab("rentals")} />
        <ReportTab id="deals"   label="Projects"   Icon={Hammer}  active={tab === "deals"}   onClick={() => setTab("deals")} />
      </div>
      {tab === "rentals" ? <RentalReports /> : <DealReports />}
    </div>
  );
}

function ReportTab({ label, Icon, active, onClick }) {
  return (
    <button onClick={onClick}
      style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: active ? "#e95e00" : "transparent", color: active ? "#fff" : "var(--text-secondary)", fontWeight: active ? 700 : 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, transition: "all 0.15s" }}>
      <Icon size={14} />
      {label}
    </button>
  );
}
