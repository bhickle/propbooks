// =============================================================================
// WelcomeScreen — first-time empty-state view, prompts the user to add a
// rental property or a flip deal via the guided setup wizards.
// =============================================================================
import { Building2, Home, Hammer } from "lucide-react";

export function WelcomeScreen({ onStartRental, onStartFlip }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "70vh", padding: 40 }}>
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <div style={{ width: 64, height: 64, borderRadius: 16, background: "linear-gradient(135deg, #e95e00 0%, #f59e0b 100%)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", boxShadow: "0 4px 12px rgba(233,94,0,0.25)" }}>
          <Building2 size={32} color="#fff" />
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 8px" }}>Welcome to PROPBOOKS</h1>
        <p style={{ fontSize: 16, color: "var(--text-secondary)", maxWidth: 500, margin: "0 auto", lineHeight: 1.6 }}>
          Let's get your first property or deal set up. The guided setup will walk you through everything step by step.
        </p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, maxWidth: 600, width: "100%" }}>
        <button onClick={onStartRental}
          style={{ background: "var(--surface)", border: "2px solid var(--border)", borderRadius: 16, padding: "32px 24px", cursor: "pointer", textAlign: "center", transition: "all 0.2s" }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--c-blue)"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(59,130,246,0.12)"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "none"; }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--info-tint)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <Home size={24} color="var(--c-blue)" />
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 6px" }}>Add Rental Property</h3>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>Buy & hold — track rent, tenants, leases, and cash flow.</p>
        </button>
        <button onClick={onStartFlip}
          style={{ background: "var(--surface)", border: "2px solid var(--border)", borderRadius: 16, padding: "32px 24px", cursor: "pointer", textAlign: "center", transition: "all 0.2s" }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = "#e95e00"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(233,94,0,0.12)"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "none"; }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--warning-bg)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <Hammer size={24} color="#e95e00" />
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 6px" }}>Add Fix & Flip Deal</h3>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>Track rehab budget, contractors, milestones, and profit.</p>
        </button>
      </div>
    </div>
  );
}
