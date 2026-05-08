// =============================================================================
// UnifiedDashboard — single nav entry replacing the prior trio of Portfolio
// + Rentals→Dashboard + Rehabs→Dashboard. Tab toggle inside renders the
// existing components (PortfolioDashboard / Dashboard / DealDashboard) so
// no widget logic was rewritten — this is purely an IA wrapper.
// =============================================================================
import { useState } from "react";
import { PieChartIcon, Home, Hammer } from "lucide-react";
import { PortfolioDashboard } from "./PortfolioDashboard.jsx";
import { Dashboard as RentalDashboard } from "./Dashboard.jsx";
import { DealDashboard } from "../deals.jsx";

export function UnifiedDashboard(props) {
  const [tab, setTab] = useState("portfolio");
  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 24, background: "var(--surface-alt)", borderRadius: 10, padding: 4, border: "1px solid var(--border)", width: "fit-content" }}>
        <DashTab id="portfolio" label="Portfolio" Icon={PieChartIcon} active={tab === "portfolio"} onClick={() => setTab("portfolio")} />
        <DashTab id="rentals"   label="Rentals"   Icon={Home}         active={tab === "rentals"}   onClick={() => setTab("rentals")} />
        <DashTab id="rehabs"  label="Rehabs"  Icon={Hammer}       active={tab === "rehabs"}  onClick={() => setTab("rehabs")} />
      </div>
      {tab === "portfolio" && <PortfolioDashboard {...props.portfolioProps} />}
      {tab === "rentals"   && <RentalDashboard   {...props.rentalProps} />}
      {tab === "rehabs"  && <DealDashboard     {...props.projectProps} />}
    </div>
  );
}

function DashTab({ label, Icon, active, onClick }) {
  return (
    <button onClick={onClick}
      style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: active ? "#e95e00" : "transparent", color: active ? "#fff" : "var(--text-secondary)", fontWeight: active ? 700 : 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, transition: "all 0.15s" }}>
      <Icon size={14} />
      {label}
    </button>
  );
}
