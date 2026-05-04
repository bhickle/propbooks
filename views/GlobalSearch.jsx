// =============================================================================
// GlobalSearch — header search box with Cmd/Ctrl+K shortcut.
// Searches across properties, tenants, deals, transactions, contractors,
// notes, and deal expenses. Results grouped by entity type.
// =============================================================================
import { useState, useEffect, useRef, useMemo } from "react";
import {
  Building2, User, Hammer, ArrowUpDown, UserCheck, MessageSquare,
  Receipt, Search, X, ChevronRight,
} from "lucide-react";
import { fmt, DEALS, CONTRACTORS, DEAL_NOTES, DEAL_EXPENSES, RENTAL_NOTES } from "../api.js";
import { PROPERTIES, TENANTS, TRANSACTIONS } from "../mockData.js";

export function GlobalSearch({ onNavigate }) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const ref = useRef(null);
  const inputRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setFocused(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Keyboard shortcut: Cmd/Ctrl+K to focus
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); inputRef.current?.focus(); setFocused(true); }
      if (e.key === "Escape") { setFocused(false); setQuery(""); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const q = query.toLowerCase().trim();
  const results = useMemo(() => {
    if (!q) return [];
    const r = [];
    const MAX_PER = 4;

    // Properties
    const props = PROPERTIES.filter(p => p.name.toLowerCase().includes(q) || p.address.toLowerCase().includes(q) || p.type.toLowerCase().includes(q));
    props.slice(0, MAX_PER).forEach(p => r.push({ type: "property", id: p.id, title: p.name, sub: p.address, icon: Building2, color: "#1e3a5f", image: p.image, data: p }));

    // Tenants
    const tenants = TENANTS.filter(t => t.name.toLowerCase().includes(q) || (t.email && t.email.toLowerCase().includes(q)) || (t.phone && t.phone.includes(q)));
    tenants.slice(0, MAX_PER).forEach(t => {
      const prop = PROPERTIES.find(p => p.id === t.propertyId);
      r.push({ type: "tenant", id: t.id, title: t.name, sub: `${prop?.name || ""} · ${t.unit}`, icon: User, color: "var(--c-blue)", data: t });
    });

    // Deals (Flips)
    const deals = DEALS.filter(f => f.name.toLowerCase().includes(q) || f.address.toLowerCase().includes(q) || f.stage.toLowerCase().includes(q));
    deals.slice(0, MAX_PER).forEach(f => r.push({ type: "deal", id: f.id, title: f.name, sub: `${f.stage} · ${f.address.split(",")[1]?.trim() || f.address}`, icon: Hammer, color: "#1e3a5f", image: f.image, data: f }));

    // Transactions
    const txs = TRANSACTIONS.filter(t => {
      const propName = PROPERTIES.find(p => p.id === t.propertyId)?.name || "";
      return t.description.toLowerCase().includes(q) || propName.toLowerCase().includes(q) || t.category.toLowerCase().includes(q) || (t.payee && t.payee.toLowerCase().includes(q));
    });
    txs.slice(0, MAX_PER).forEach(t => {
      const propName = PROPERTIES.find(p => p.id === t.propertyId)?.name || "Unknown";
      r.push({ type: "transaction", id: t.id, title: t.description, sub: `${propName} · ${t.date} · ${fmt(Math.abs(t.amount))}`, icon: ArrowUpDown, color: t.type === "income" ? "var(--c-green)" : "var(--c-red)", data: t });
    });

    // Contractors
    const cons = CONTRACTORS.filter(c => c.name.toLowerCase().includes(q) || c.trade.toLowerCase().includes(q) || (c.email && c.email.toLowerCase().includes(q)));
    cons.slice(0, MAX_PER).forEach(c => r.push({ type: "contractor", id: c.id, title: c.name, sub: c.trade, icon: UserCheck, color: "var(--c-purple)", data: c }));

    // Rental Notes
    RENTAL_NOTES.forEach(n => {
      if (n.text.toLowerCase().includes(q)) {
        const prop = PROPERTIES.find(p => p.id === n.propertyId);
        r.push({ type: "rental-note", id: n.id, title: n.text.length > 60 ? n.text.slice(0, 60) + "…" : n.text, sub: `${prop?.name || "Property"} · ${n.date}`, icon: MessageSquare, color: "#1e3a5f", data: { ...n, propId: n.propertyId } });
      }
    });

    // Deal Notes
    DEAL_NOTES.forEach(n => {
      if (n.text.toLowerCase().includes(q)) {
        const deal = DEALS.find(f => f.id === n.dealId);
        r.push({ type: "deal-note", id: n.id, title: n.text.length > 60 ? n.text.slice(0, 60) + "…" : n.text, sub: `${deal?.name || "Deal"} · ${n.date}`, icon: MessageSquare, color: "#1e3a5f", data: { ...n, dealId: n.dealId } });
      }
    });

    // Deal Expenses
    DEAL_EXPENSES.filter(e => e.description.toLowerCase().includes(q) || (e.vendor && e.vendor.toLowerCase().includes(q)))
      .slice(0, MAX_PER).forEach(e => {
        const deal = DEALS.find(f => f.id === e.dealId);
        r.push({ type: "deal-expense", id: e.id, title: e.description, sub: `${deal?.name || "Deal"} · ${e.vendor} · ${fmt(e.amount)}`, icon: Receipt, color: "var(--c-red)", data: e });
      });

    return r.slice(0, 12); // Cap total results
  }, [q]);

  // Group results by type for display
  const grouped = useMemo(() => {
    const map = new Map();
    const labels = { property: "Properties", tenant: "Tenants", deal: "Deals", transaction: "Transactions", contractor: "Contractors", "rental-note": "Rental Notes", "deal-note": "Flip Notes", "deal-expense": "Flip Expenses" };
    results.forEach(r => {
      const label = labels[r.type] || r.type;
      if (!map.has(label)) map.set(label, []);
      map.get(label).push(r);
    });
    return map;
  }, [results]);

  const handleSelect = (item) => {
    setQuery("");
    setFocused(false);
    if (onNavigate) onNavigate(item);
  };

  const show = focused && q.length > 0;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div style={{ background: focused ? "var(--surface)" : "var(--surface-muted)", borderRadius: 10, padding: "8px 14px", display: "flex", alignItems: "center", gap: 8, border: focused ? "1px solid var(--border)" : "1px solid transparent", boxShadow: focused ? "0 4px 16px rgba(0,0,0,0.08)" : "none", transition: "all 0.15s" }}>
        <Search size={14} color="#94a3b8" />
        <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} onFocus={() => setFocused(true)} placeholder="Search everything…" style={{ border: "none", background: "transparent", fontSize: 14, color: "var(--text-primary)", outline: "none", width: 200 }} />
        {!query && <kbd style={{ fontSize: 10, color: "var(--text-muted)", background: "var(--surface-muted)", border: "1px solid var(--border)", borderRadius: 4, padding: "1px 5px", fontFamily: "inherit" }}>{navigator.platform?.includes("Mac") ? "⌘" : "Ctrl+"}K</kbd>}
        {query && <button onClick={() => { setQuery(""); inputRef.current?.focus(); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 0, display: "flex" }}><X size={14} /></button>}
      </div>

      {show && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, width: 420, background: "var(--surface)", borderRadius: 14, boxShadow: "0 12px 40px rgba(0,0,0,0.15)", border: "1px solid var(--border)", maxHeight: 440, overflowY: "auto", zIndex: 999 }}>
          {results.length === 0 ? (
            <div style={{ padding: "28px 20px", textAlign: "center" }}>
              <Search size={28} color="#cbd5e1" style={{ marginBottom: 8 }} />
              <p style={{ color: "var(--text-muted)", fontSize: 13 }}>No results for "{query}"</p>
              <p style={{ color: "#cbd5e1", fontSize: 12, marginTop: 4 }}>Try searching by name, address, category, or description</p>
            </div>
          ) : (
            <div style={{ padding: "6px 0" }}>
              {[...grouped.entries()].map(([label, items]) => (
                <div key={label}>
                  <p style={{ padding: "8px 16px 4px", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</p>
                  {items.map(item => (
                    <div key={item.type + "-" + item.id} onClick={() => handleSelect(item)}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 16px", cursor: "pointer", transition: "background 0.1s" }}
                      onMouseEnter={e => e.currentTarget.style.background = "var(--surface-alt)"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <div style={{ width: 30, height: 30, borderRadius: 8, background: item.image ? "#1e3a5f" : (item.color || "#64748b") + "18", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {item.image ? <span style={{ fontSize: 10, fontWeight: 700, color: "#fff" }}>{item.image}</span> : <item.icon size={14} color={item.color || "#64748b"} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</p>
                        <p style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.sub}</p>
                      </div>
                      <ChevronRight size={14} color="#cbd5e1" />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
