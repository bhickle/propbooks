// =============================================================================
// wizardPrimitives — shared chrome for the rental + flip onboarding wizards.
// WizardShell wraps the steps with a top bar, progress bar, and step content.
// WizardNav renders the Back/Skip/Continue buttons consistently.
// WizardField is a labeled form field with optional hint and required marker.
// =============================================================================
import React from "react";
import { X, CheckCircle, ArrowLeft, ArrowRight } from "lucide-react";
import { sectionS as sharedSectionS } from "../shared.jsx";

// Shared wizard shell: progress bar + step navigation + layout
export function WizardShell({ steps, currentStep, onStepClick, title, subtitle, onExit, children }) {
  const sectionS = sharedSectionS;
  return (
    <div style={{ minHeight: "100vh", background: "var(--surface-alt)" }}>
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 32px", background: "var(--surface)", borderBottom: "1px solid var(--border-subtle)" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{title}</h1>
          {subtitle && <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "2px 0 0" }}>{subtitle}</p>}
        </div>
        <button onClick={onExit} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-secondary)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          <X size={14} /> Exit
        </button>
      </div>

      {/* Progress bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0, padding: "24px 32px 0" }}>
        {steps.map((step, i) => {
          const done = i < currentStep;
          const active = i === currentStep;
          return (
            <React.Fragment key={i}>
              <div onClick={() => i < currentStep && onStepClick(i)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, cursor: i < currentStep ? "pointer" : "default", minWidth: 100 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: done ? "var(--c-green)" : active ? "#e95e00" : "var(--surface-muted)", color: done || active ? "#fff" : "#94a3b8", fontSize: 14, fontWeight: 700, transition: "all 0.2s" }}>
                  {done ? <CheckCircle size={18} /> : i + 1}
                </div>
                <span style={{ fontSize: 12, fontWeight: active ? 700 : 500, color: active ? "var(--text-primary)" : done ? "var(--c-green)" : "var(--text-muted)", textAlign: "center" }}>{step}</span>
              </div>
              {i < steps.length - 1 && (
                <div style={{ height: 2, width: 60, background: done ? "var(--c-green)" : "var(--border)", marginBottom: 20, transition: "background 0.2s" }} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Step content */}
      <div style={{ maxWidth: 700, margin: "28px auto 0", padding: "0 32px 60px" }}>
        {children}
      </div>
    </div>
  );
}

// Shared wizard step navigation buttons
export function WizardNav({ onBack, onNext, onSkip, nextLabel, backLabel, nextDisabled }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 32, paddingTop: 20, borderTop: "1px solid var(--border-subtle)" }}>
      {onBack ? (
        <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 20px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-label)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
          <ArrowLeft size={16} /> {backLabel || "Back"}
        </button>
      ) : <div />}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {onSkip && (
          <button onClick={onSkip} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: "10px 4px" }}
            onMouseEnter={e => e.currentTarget.style.color = "var(--text-secondary)"}
            onMouseLeave={e => e.currentTarget.style.color = "var(--text-muted)"}>
            Skip this step
          </button>
        )}
        <button onClick={onNext} disabled={nextDisabled}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 24px", borderRadius: 10, border: "none", background: nextDisabled ? "var(--border-strong)" : "#e95e00", color: "#fff", fontSize: 14, fontWeight: 700, cursor: nextDisabled ? "not-allowed" : "pointer", transition: "background 0.15s" }}>
          {nextLabel || "Continue"} {nextLabel !== "Add to Portfolio" && nextLabel !== "Add to Pipeline" && <ArrowRight size={16} />}
        </button>
      </div>
    </div>
  );
}

// Shared form field component for wizard steps
export function WizardField({ label, hint, required, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>
        {label} {required && <span style={{ color: "var(--c-red)" }}>*</span>}
      </label>
      {children}
      {hint && <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "4px 0 0" }}>{hint}</p>}
    </div>
  );
}

export const wizardInput = { padding: "10px 14px", borderRadius: 10, border: "1.5px solid var(--border)", fontSize: 14, color: "var(--text-primary)", background: "var(--surface)", outline: "none", width: "100%", boxSizing: "border-box" };
export const wizardSelect = { ...wizardInput, appearance: "none", backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center" };
