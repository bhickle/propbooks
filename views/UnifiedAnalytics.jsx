// =============================================================================
// UnifiedAnalytics — single nav entry hosting both rental and deal analytics
// behind a tab toggle. Same wrapper-pattern as UnifiedReports.
// =============================================================================
import { useState } from "react";
import { Home, Hammer } from "lucide-react";
import { Analytics as RentalAnalytics } from "./Analytics.jsx";
import { DealAnalytics } from "../deals.jsx";

export function UnifiedAnalytics() {
  const [tab, setTab] = useState("rentals");
  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 24, background: "var(--surface-alt)", borderRadius: 10, padding: 4, border: "1px solid var(--border)", width: "fit-content" }}>
        <AnalyticsTab id="rentals" label="Rentals" Icon={Home}    active={tab === "rentals"} onClick={() => setTab("rentals")} />
        <AnalyticsTab id="deals"   label="Rehabs"   Icon={Hammer}  active={tab === "deals"}   onClick={() => setTab("deals")} />
      </div>
      {tab === "rentals" ? <RentalAnalytics /> : <DealAnalytics />}
    </div>
  );
}

function AnalyticsTab({ label, Icon, active, onClick }) {
  return (
    <button onClick={onClick}
      style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: active ? "#e95e00" : "transparent", color: active ? "#fff" : "var(--text-secondary)", fontWeight: active ? 700 : 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, transition: "all 0.15s" }}>
      <Icon size={14} />
      {label}
    </button>
  );
}
