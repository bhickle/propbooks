// =============================================================================
// MentionTextarea + NoteTextWithMentions — @-mention textarea with team-member
// dropdown, plus a renderer that highlights mentions in saved note text.
// Used by UnifiedNotes (rental notes view) AND by deals.jsx (DealNotes view).
// =============================================================================
import { useState, useRef } from "react";
import { X } from "lucide-react";
import { TEAM_MEMBERS } from "../api.js";
import { iS, colorWithAlpha } from "../shared.jsx";

export function MentionTextarea({ value, onChange, placeholder, mentions, onMentionsChange }) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStartIdx, setMentionStartIdx] = useState(null);
  const [dropdownIdx, setDropdownIdx] = useState(0);
  const textareaRef = useRef(null);

  const filteredMembers = TEAM_MEMBERS.filter(m =>
    mentionQuery === "" || m.name.toLowerCase().includes(mentionQuery.toLowerCase())
  );

  const handleKeyDown = (e) => {
    if (!showDropdown) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setDropdownIdx(i => Math.min(i + 1, filteredMembers.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setDropdownIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && filteredMembers.length > 0) {
      e.preventDefault();
      insertMention(filteredMembers[dropdownIdx]);
    }
    else if (e.key === "Escape") { setShowDropdown(false); setMentionStartIdx(null); }
  };

  const insertMention = (member) => {
    const before = value.substring(0, mentionStartIdx);
    const after = value.substring(textareaRef.current?.selectionStart || mentionStartIdx);
    const newText = before + "@" + member.name + " " + after;
    onChange(newText);
    const newMentions = [...(mentions || [])];
    if (!newMentions.includes(member.id)) newMentions.push(member.id);
    onMentionsChange(newMentions);
    setShowDropdown(false);
    setMentionStartIdx(null);
    setTimeout(() => {
      const pos = before.length + member.name.length + 2;
      textareaRef.current?.setSelectionRange(pos, pos);
      textareaRef.current?.focus();
    }, 0);
  };

  const handleInput = (e) => {
    const val = e.target.value;
    const pos = e.target.selectionStart;
    onChange(val);

    // Detect @ trigger
    const textBefore = val.substring(0, pos);
    const atIdx = textBefore.lastIndexOf("@");
    if (atIdx !== -1) {
      const charBefore = atIdx > 0 ? textBefore[atIdx - 1] : " ";
      if (charBefore === " " || charBefore === "\n" || atIdx === 0) {
        const query = textBefore.substring(atIdx + 1);
        if (!query.includes(" ") || query.length < 20) {
          setMentionQuery(query);
          setMentionStartIdx(atIdx);
          setShowDropdown(true);
          setDropdownIdx(0);
          return;
        }
      }
    }
    setShowDropdown(false);
    setMentionStartIdx(null);
  };

  return (
    <div style={{ position: "relative" }}>
      <textarea
        ref={textareaRef}
        style={{ ...iS, minHeight: 120, resize: "vertical", fontFamily: "inherit" }}
        placeholder={placeholder || "Write a note... Type @ to mention a team member"}
        value={value}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
      />
      {showDropdown && filteredMembers.length > 0 && (
        <div style={{ position: "absolute", bottom: "100%", left: 0, width: 280, background: "var(--surface)", borderRadius: 12, boxShadow: "0 8px 30px rgba(0,0,0,0.15)", border: "1px solid var(--border)", maxHeight: 200, overflowY: "auto", zIndex: 100, marginBottom: 4 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", padding: "8px 12px 4px" }}>Team Members</p>
          {filteredMembers.map((m, i) => (
            <div key={m.id}
              onMouseDown={(e) => { e.preventDefault(); insertMention(m); }}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", cursor: "pointer", background: i === dropdownIdx ? "var(--surface-muted)" : "transparent", transition: "background 0.1s" }}
              onMouseEnter={() => setDropdownIdx(i)}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: colorWithAlpha(m.color, 0.1), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: m.color }}>{m.initials}</div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{m.name}</p>
                <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{m.email}</p>
              </div>
            </div>
          ))}
        </div>
      )}
      {/* Show mention chips */}
      {mentions && mentions.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
          {mentions.map(mId => {
            const member = TEAM_MEMBERS.find(m => m.id === mId);
            if (!member) return null;
            return (
              <span key={mId} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: member.color + "15", color: member.color, fontSize: 12, fontWeight: 600, padding: "3px 8px", borderRadius: 6, border: "1px solid " + member.color + "30" }}>
                @{member.name}
                <button onClick={() => onMentionsChange(mentions.filter(id => id !== mId))} style={{ background: "none", border: "none", cursor: "pointer", color: member.color, padding: 0, display: "flex", alignItems: "center", marginLeft: 2 }}><X size={10} /></button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Render note text with highlighted @mentions
export function NoteTextWithMentions({ text }) {
  const parts = text.split(/(@[\w\s]+?)(?=\s|$|,|\.)/g);
  return (
    <p style={{ fontSize: 13, color: "var(--text-label)", lineHeight: 1.6 }}>
      {parts.map((part, i) => {
        if (part.startsWith("@")) {
          const name = part.substring(1).trim();
          const member = TEAM_MEMBERS.find(m => m.name.toLowerCase() === name.toLowerCase());
          if (member) {
            return <span key={i} style={{ background: member.color + "15", color: member.color, fontWeight: 600, padding: "1px 4px", borderRadius: 4 }}>{part}</span>;
          }
        }
        return <span key={i}>{part}</span>;
      })}
    </p>
  );
}
