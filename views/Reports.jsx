import { useState, useEffect } from "react";
import {
  Building2, FileText, TrendingDown, DollarSign, Home, Search, Filter, Download,
  Calendar, List, AlertTriangle,
} from "lucide-react";
import {
  BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { fmt } from "../api.js";
import {
  TAX_CONFIG, getDeprBasis, calcLoanBalance, calcPaymentInterest, getEffectiveMonthly,
} from "../finance.js";
import { iS, downloadFile } from "../shared.jsx";
import { PROPERTIES, TRANSACTIONS } from "../mockData.js";

function exportReportCSV(activeReport, reportProps, monthlyData, deprRows, lenderData, calcPropLines, taxYear, ownerMonth) {
  let csv = "";
  if (activeReport === "scheduleE") {
    csv = "Property,Line,Description,Amount\n";
    reportProps.forEach(p => {
      const { lines, grossRent, net } = calcPropLines(p);
      csv += `"${p.name}",3,Rents Received,${grossRent}\n`;
      Object.entries(lines).forEach(([line, amt]) => {
        const labels = { "5":"Advertising","6":"Auto & Travel","7":"Cleaning","9":"Insurance","10":"Legal","11":"Management","12":"Mortgage Interest","14":"Repairs","15":"Supplies","16":"Taxes","17":"Utilities","18":"Depreciation","19":"Other" };
        csv += `"${p.name}",${line},"${labels[line] || "Other"}",${Math.round(amt)}\n`;
      });
      csv += `"${p.name}",26,Net Income / (Loss),${Math.round(net)}\n`;
    });
  } else if (activeReport === "cashflow") {
    csv = "Month,Source,Income,Expenses,Net Cash Flow,Margin %\n";
    monthlyData.forEach(m => {
      const margin = m.income > 0 ? ((m.net / m.income) * 100).toFixed(1) : "0";
      csv += `${m.month},${m.isActual ? "Actual" : "Estimated"},${m.income},${m.expenses},${m.net},${margin}\n`;
    });
  } else if (activeReport === "depreciation") {
    csv = "Property,Placed in Service,Purchase Price,Land Value,Land Source,Depr Basis,Annual Deduction,Years Held,Cumulative,Remaining\n";
    deprRows.forEach(({ p, basis, annual, yearsHeld, cumul, remaining, estimated, landValue }) => {
      csv += `"${p.name}",${p.purchaseDate || ""},${p.purchasePrice},${landValue},${estimated ? "Estimated (20%)" : "User Entered"},${basis},${annual},${yearsHeld},${cumul},${remaining}\n`;
    });
  } else if (activeReport === "lenderPackage") {
    csv = "Property,Annual NOI,Loan Balance,Current Value,Equity,Monthly DS,DSCR,LTV %\n";
    lenderData.forEach(({ p, noi, bal, mds, dscr, ltv, equity }) => {
      csv += `"${p.name}",${noi},${Math.round(bal)},${p.currentValue},${Math.round(equity)},${mds},${dscr ? dscr.toFixed(2) : ""},${ltv.toFixed(1)}\n`;
    });
  } else if (activeReport === "yearend") {
    csv = "Property,Annual Rent,Annual Expenses,Depreciation,Mortgage Interest (est),Net\n";
    reportProps.forEach(p => {
      const cEff = getEffectiveMonthly(p, TRANSACTIONS);
      const annRent = cEff.monthlyIncome * 12;
      const annExp = cEff.monthlyExpenses * 12;
      const yrs = p.type === "Commercial" ? TAX_CONFIG.depreciationCommercial : TAX_CONFIG.depreciationResidential;
      const depr = Math.round(getDeprBasis(p).basis / yrs);
      const bal = calcLoanBalance(p.loanAmount, p.loanRate, p.loanTermYears, p.loanStartDate) ?? (p.loanAmount || 0);
      const intEst = Math.round(bal * (p.loanRate || 4) / 100);
      csv += `"${p.name}",${annRent},${annExp},${depr},${intEst},${annRent - annExp - depr - intEst}\n`;
    });
  } else if (activeReport === "ownerStatement") {
    csv = "Type,Date,Description,Category,Amount\n";
    const p = reportProps[0];
    if (p) {
      const monthTx = TRANSACTIONS.filter(t => {
        const d = new Date(t.date);
        return d.getMonth() === ownerMonth && d.getFullYear() === Number(taxYear) && t.propertyId === p.id;
      });
      monthTx.forEach(t => { csv += `${t.type},${t.date},"${t.description}","${t.category}",${t.amount}\n`; });
    }
  } else if (activeReport === "transactions") {
    const reportPropIds = new Set(reportProps.map(p => p.id));
    const allTx = TRANSACTIONS.filter(t => reportPropIds.has(t.propertyId));
    csv = "Date,Property,Category,Type,Description,Amount\n";
    allTx.sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(t => {
      const propName = PROPERTIES.find(p => p.id === t.propertyId)?.name || "Unknown";
      csv += `${t.date},"${propName}","${t.category}",${t.type},"${t.description || t.vendor || ""}",${t.amount}\n`;
    });
  }
  downloadFile(csv, `PropBooks_${activeReport}_${taxYear}.csv`, "text/csv");
}

function exportReportPDF(activeReport, reportProps, monthlyData, deprRows, lenderData, calcPropLines, taxYear, propFilter, ownerMonth) {
  // Build printable HTML and open in new window for browser print-to-PDF
  const reportNames = { scheduleE: "Schedule E", cashflow: "Cash Flow Report", ownerStatement: "Owner's Statement", lenderPackage: "Lender Package", depreciation: "Depreciation Schedule", yearend: "Year-End Summary" };
  let tableHTML = "";

  if (activeReport === "scheduleE") {
    reportProps.forEach(p => {
      const { lines, grossRent, totalExp, net, interestSource } = calcPropLines(p);
      tableHTML += `<h3>${p.name}</h3><p style="color:#888">${p.address}</p><table><tr><th>Line</th><th>Description</th><th style="text-align:right">Amount</th></tr>`;
      tableHTML += `<tr><td>3</td><td>Rents Received</td><td style="text-align:right;color:green">+$${grossRent.toLocaleString()}</td></tr>`;
      const deprLabel = getDeprBasis(p).estimated ? "Depreciation (est. — no land value entered)" : "Depreciation";
      const labels = { "5":"Advertising","6":"Auto & Travel","7":"Cleaning","9":"Insurance","10":"Legal & Professional","11":"Management Fees","12":`Mortgage Interest (${interestSource})`,"14":"Repairs","15":"Supplies","16":"Taxes","17":"Utilities","18":deprLabel,"19":"Other" };
      Object.entries(lines).sort((a,b) => Number(a[0]) - Number(b[0])).forEach(([line, amt]) => {
        if (amt > 0) tableHTML += `<tr><td>${line}</td><td>${labels[line] || "Other"}</td><td style="text-align:right;color:#c0392b">-$${Math.round(amt).toLocaleString()}</td></tr>`;
      });
      tableHTML += `<tr style="border-top:2px solid #333;font-weight:bold"><td colspan="2">Net Income / (Loss)</td><td style="text-align:right;color:${net >= 0 ? 'green' : '#c0392b'}">${net >= 0 ? '' : '-'}$${Math.abs(Math.round(net)).toLocaleString()}</td></tr></table>`;
    });
  } else if (activeReport === "cashflow") {
    tableHTML = `<table><tr><th>Month</th><th>Source</th><th style="text-align:right">Income</th><th style="text-align:right">Expenses</th><th style="text-align:right">Net</th><th style="text-align:right">Margin</th></tr>`;
    monthlyData.forEach(m => {
      const margin = m.income > 0 ? ((m.net / m.income) * 100).toFixed(0) + "%" : "0%";
      tableHTML += `<tr><td>${m.month}</td><td>${m.isActual ? "Actual" : "Est."}</td><td style="text-align:right;color:green">+$${m.income.toLocaleString()}</td><td style="text-align:right;color:#c0392b">-$${m.expenses.toLocaleString()}</td><td style="text-align:right;font-weight:bold">$${m.net.toLocaleString()}</td><td style="text-align:right">${margin}</td></tr>`;
    });
    tableHTML += `</table>`;
  } else if (activeReport === "depreciation") {
    tableHTML = `<table><tr><th>Property</th><th>In Service</th><th style="text-align:right">Purchase</th><th style="text-align:right">Basis</th><th style="text-align:right">Annual</th><th>Yrs Held</th><th style="text-align:right">Cumulative</th><th style="text-align:right">Remaining</th></tr>`;
    deprRows.forEach(({ p, basis, annual, yearsHeld, cumul, remaining }) => {
      tableHTML += `<tr><td>${p.name}</td><td>${p.purchaseDate || "—"}</td><td style="text-align:right">$${p.purchasePrice.toLocaleString()}</td><td style="text-align:right">$${basis.toLocaleString()}</td><td style="text-align:right">$${annual.toLocaleString()}</td><td>${yearsHeld}</td><td style="text-align:right">$${cumul.toLocaleString()}</td><td style="text-align:right">$${remaining.toLocaleString()}</td></tr>`;
    });
    tableHTML += `</table>`;
  } else if (activeReport === "lenderPackage") {
    tableHTML = `<table><tr><th>Property</th><th style="text-align:right">NOI</th><th style="text-align:right">Loan Bal</th><th style="text-align:right">Value</th><th style="text-align:right">Equity</th><th style="text-align:right">Mo DS</th><th style="text-align:right">DSCR</th><th style="text-align:right">LTV</th></tr>`;
    lenderData.forEach(({ p, noi, bal, mds, dscr, ltv, equity }) => {
      tableHTML += `<tr><td>${p.name}</td><td style="text-align:right">$${noi.toLocaleString()}</td><td style="text-align:right">$${Math.round(bal).toLocaleString()}</td><td style="text-align:right">$${p.currentValue.toLocaleString()}</td><td style="text-align:right">$${Math.round(equity).toLocaleString()}</td><td style="text-align:right">$${mds.toLocaleString()}</td><td style="text-align:right">${dscr ? dscr.toFixed(2) : "—"}</td><td style="text-align:right">${ltv.toFixed(1)}%</td></tr>`;
    });
    tableHTML += `</table>`;
  } else if (activeReport === "transactions") {
    const reportPropIds = new Set(reportProps.map(p => p.id));
    const allTx = TRANSACTIONS.filter(t => reportPropIds.has(t.propertyId));
    allTx.sort((a, b) => new Date(b.date) - new Date(a.date));
    tableHTML = `<table><tr><th>Date</th><th>Property</th><th>Category</th><th>Type</th><th>Description</th><th style="text-align:right">Amount</th></tr>`;
    allTx.forEach(t => {
      const isIncome = t.type === "income";
      const propName = PROPERTIES.find(p => p.id === t.propertyId)?.name || "Unknown";
      tableHTML += `<tr><td>${t.date}</td><td>${propName}</td><td>${t.category}</td><td>${t.type}</td><td>${t.description || t.vendor || ""}</td><td style="text-align:right;color:${isIncome ? 'green' : '#c0392b'}">${isIncome ? '+' : '-'}$${Math.abs(t.amount).toLocaleString()}</td></tr>`;
    });
    const totIn = allTx.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const totOut = allTx.filter(t => t.type === "expense").reduce((s, t) => s + Math.abs(t.amount), 0);
    tableHTML += `<tr style="border-top:2px solid #333;font-weight:bold"><td colspan="5">Totals (${allTx.length} transactions)</td><td style="text-align:right">In: $${totIn.toLocaleString()} | Out: $${totOut.toLocaleString()}</td></tr></table>`;
  } else if (activeReport === "ownerStatement") {
    tableHTML = `<table><tr><th>Type</th><th>Date</th><th>Description</th><th>Category</th><th style="text-align:right">Amount</th></tr>`;
    const p = reportProps[0];
    if (p) {
      const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
      const monthTx = TRANSACTIONS.filter(t => {
        const d = new Date(t.date);
        return d.getMonth() === ownerMonth && d.getFullYear() === Number(taxYear) && t.propertyId === p.id;
      });
      monthTx.forEach(t => {
        const isIncome = t.type === "income";
        tableHTML += `<tr><td>${t.type}</td><td>${t.date}</td><td>${t.description}</td><td>${t.category}</td><td style="text-align:right;color:${isIncome ? 'green' : '#c0392b'}">${isIncome ? '+' : '-'}$${Math.abs(t.amount).toLocaleString()}</td></tr>`;
      });
      const totIn = monthTx.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
      const totOut = monthTx.filter(t => t.type === "expense").reduce((s, t) => s + Math.abs(t.amount), 0);
      tableHTML += `<tr style="border-top:2px solid #333;font-weight:bold"><td colspan="4">Totals</td><td style="text-align:right">In: $${totIn.toLocaleString()} | Out: $${totOut.toLocaleString()}</td></tr></table>`;
    }
  } else if (activeReport === "yearend") {
    tableHTML = `<table><tr><th>Property</th><th style="text-align:right">Annual Rent</th><th style="text-align:right">Annual Expenses</th><th style="text-align:right">Depreciation</th><th style="text-align:right">Mortgage Interest (est)</th><th style="text-align:right">Net</th></tr>`;
    reportProps.forEach(p => {
      const cEff = getEffectiveMonthly(p, TRANSACTIONS);
      const annRent = cEff.monthlyIncome * 12;
      const annExp = cEff.monthlyExpenses * 12;
      const yrs = p.type === "Commercial" ? TAX_CONFIG.depreciationCommercial : TAX_CONFIG.depreciationResidential;
      const depr = Math.round(getDeprBasis(p).basis / yrs);
      const bal = calcLoanBalance(p.loanAmount, p.loanRate, p.loanTermYears, p.loanStartDate) ?? (p.loanAmount || 0);
      const intEst = Math.round(bal * (p.loanRate || 4) / 100);
      const net = annRent - annExp - depr - intEst;
      tableHTML += `<tr><td>${p.name}</td><td style="text-align:right">$${Math.round(annRent).toLocaleString()}</td><td style="text-align:right">$${Math.round(annExp).toLocaleString()}</td><td style="text-align:right">$${depr.toLocaleString()}</td><td style="text-align:right">$${intEst.toLocaleString()}</td><td style="text-align:right;color:${net >= 0 ? 'green' : '#c0392b'}">$${Math.round(net).toLocaleString()}</td></tr>`;
    });
    tableHTML += `</table>`;
  } else {
    tableHTML = `<p>Use your browser's print dialog to save as PDF.</p>`;
  }

  const reportNames2 = { ...reportNames, transactions: "Transaction Detail" };
  const isTaxRpt = ["scheduleE", "depreciation", "yearend"].includes(activeReport);
  const scopeLabel = propFilter === "all" ? "All Properties" : (reportProps[0]?.name || "");
  const html = `<!DOCTYPE html><html><head><title>PropBooks — ${reportNames2[activeReport] || activeReport}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
    <style>
    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 900px; margin: 40px auto; color: #1e293b; }
    h1 { font-size: 22px; margin-bottom: 4px; } h2 { color: #64748b; font-size: 14px; font-weight: 400; margin-bottom: 24px; } h3 { margin-top: 28px; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; } th, td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: left; font-size: 13px; }
    th { background: #f8fafc; font-weight: 600; color: #64748b; text-transform: uppercase; font-size: 11px; }
    .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 11px; }
    @media print { body { margin: 20px; } }
  </style></head><body>
    <h1>${reportNames2[activeReport] || activeReport}</h1>
    <h2>${scopeLabel} · ${isTaxRpt ? 'Tax Year' : 'Year'} ${taxYear} · Generated ${new Date().toLocaleDateString()}</h2>
    ${tableHTML}
    <div class="footer">Generated by PROPBOOKS · For planning purposes only — consult your CPA before filing.</div>
  </body></html>`;
  const w = window.open("", "_blank");
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 500);
}
export function Reports() {
  const [activeReport, setActiveReport] = useState("scheduleE");
  const [taxYear, setTaxYear] = useState(String(TAX_CONFIG.currentYear));
  const [propFilter, setPropFilter] = useState("all");
  const [ownerMonth, setOwnerMonth] = useState(() => {
    // Default to the most recent month that has transaction data (current year), or current month
    const yr = TAX_CONFIG.currentYear;
    const yrTx = TRANSACTIONS.filter(t => new Date(t.date).getFullYear() === yr);
    if (yrTx.length > 0) return Math.max(...yrTx.map(t => new Date(t.date).getMonth()));
    return new Date().getMonth();
  });
  const [taxRate, setTaxRate] = useState(TAX_CONFIG.defaultBracket);
  const [txSearch, setTxSearch] = useState("");
  const [txCatFilter, setTxCatFilter] = useState("all");
  const [txTypeFilter, setTxTypeFilter] = useState("all");
  const [txSort, setTxSort] = useState("date-desc");
  const [txDateFrom, setTxDateFrom] = useState(`${new Date().getFullYear()}-01-01`);
  const [txDateTo, setTxDateTo] = useState(new Date().toISOString().slice(0, 10));
  const [txDatePreset, setTxDatePreset] = useState("ytd");

  const reportProps = propFilter === "all" ? PROPERTIES : PROPERTIES.filter(p => p.id === propFilter);
  const reportPropNames = new Set(reportProps.map(p => p.name));

  // Smart-default ownerMonth: when a property is selected, jump to the most recent month with data
  useEffect(() => {
    if (propFilter === "all" || activeReport !== "ownerStatement") return;
    const p = PROPERTIES.find(pr => pr.id === propFilter);
    if (!p) return;
    const propTx = TRANSACTIONS.filter(t => t.propertyId === p.id && new Date(t.date).getFullYear() === Number(taxYear));
    if (propTx.length === 0) return; // no data at all — keep current month so the warning shows
    // Find the most recent month with transactions
    const latestMonth = Math.max(...propTx.map(t => new Date(t.date).getMonth()));
    setOwnerMonth(latestMonth);
  }, [propFilter, taxYear, activeReport]);

  // IRS Schedule E line mapping keyed by transaction category
  const CAT_TO_LINE = {
    // Marketing (line 5)
    "Advertising & Marketing":  { line: "5",  label: "Advertising" },
    "Advertising":              { line: "5",  label: "Advertising" },
    "Listing Fees":             { line: "5",  label: "Advertising" },
    "Signage":                  { line: "5",  label: "Advertising" },
    // Auto & travel (line 6)
    "Travel & Mileage":         { line: "6",  label: "Auto & Travel" },
    // Cleaning (line 7)
    "Cleaning & Janitorial":    { line: "7",  label: "Cleaning & Maintenance" },
    "Cleaning":                 { line: "7",  label: "Cleaning & Maintenance" },
    // Insurance (line 9)
    "Insurance":                { line: "9",  label: "Insurance" },
    "Property Insurance":       { line: "9",  label: "Insurance" },
    "Liability Insurance":      { line: "9",  label: "Insurance" },
    "Flood Insurance":          { line: "9",  label: "Insurance" },
    // Legal & professional (line 10)
    "Legal & Professional Fees":{ line: "10", label: "Legal & Professional" },
    "Legal Fees":               { line: "10", label: "Legal & Professional" },
    "Accounting / CPA":         { line: "10", label: "Legal & Professional" },
    "Inspection Fees":          { line: "10", label: "Legal & Professional" },
    // Management (line 11)
    "Property Management":      { line: "11", label: "Management Fees" },
    "Management Fee":           { line: "11", label: "Management Fees" },
    "Leasing Fee":              { line: "11", label: "Management Fees" },
    // Mortgage (skip — handled via amortization)
    "Mortgage":                 { line: "skip", label: "" },
    "Mortgage Payment":         { line: "skip", label: "" },
    "Loan Interest":            { line: "skip", label: "" },
    "Refinance Costs":          { line: "skip", label: "" },
    // Repairs (line 14)
    "Repairs & Maintenance":    { line: "14", label: "Repairs" },
    "Maintenance":              { line: "14", label: "Repairs" },
    "Plumbing":                 { line: "14", label: "Repairs" },
    "Electrical":               { line: "14", label: "Repairs" },
    "HVAC":                     { line: "14", label: "Repairs" },
    "Appliance Repair":         { line: "14", label: "Repairs" },
    "Roof Repair":              { line: "14", label: "Repairs" },
    "General Maintenance":      { line: "14", label: "Repairs" },
    "Pest Control":             { line: "14", label: "Repairs" },
    "Landscaping":              { line: "14", label: "Repairs" },
    "Snow Removal":             { line: "14", label: "Repairs" },
    // Supplies (line 15)
    "Supplies & Materials":     { line: "15", label: "Supplies" },
    // Taxes (line 16)
    "Property Tax":             { line: "16", label: "Taxes" },
    "Tax Penalties":            { line: "16", label: "Taxes" },
    // Utilities (line 17)
    "Utilities":                { line: "17", label: "Utilities" },
    "Electric":                 { line: "17", label: "Utilities" },
    "Gas":                      { line: "17", label: "Utilities" },
    "Water / Sewer":            { line: "17", label: "Utilities" },
    "Trash":                    { line: "17", label: "Utilities" },
    "Internet / Cable":         { line: "17", label: "Utilities" },
    // Other (line 19)
    "HOA Fees":                 { line: "19", label: "Other" },
    "HOA / Condo Fees":         { line: "19", label: "Other" },
    "HOA Dues":                 { line: "19", label: "Other" },
    "Special Assessment":       { line: "19", label: "Other" },
    "Other Expenses":           { line: "19", label: "Other" },
    // Capital improvements (not deductible as expense — depreciated)
    "Capital Improvement":      { line: "cap", label: "" },
    "Kitchen Remodel":          { line: "cap", label: "" },
    "Bathroom Remodel":         { line: "cap", label: "" },
    "Flooring":                 { line: "cap", label: "" },
    "New Roof":                 { line: "cap", label: "" },
    "Other Capital":            { line: "cap", label: "" },
  };

  // Build per-property Schedule E lines from real transactions
  const calcPropLines = p => {
    const propTx = TRANSACTIONS.filter(t =>
      new Date(t.date).getFullYear() === Number(taxYear) && t.propertyId === p.id && t.type === "expense"
    );
    const lines = {};
    propTx.forEach(t => {
      const m = CAT_TO_LINE[t.category];
      if (!m || m.line === "skip" || m.line === "cap") return;
      lines[m.line] = (lines[m.line] || 0) + Math.abs(t.amount);
    });

    // Line 12: Mortgage Interest — prefer stored P&I split from transactions, then amortization calc, then estimate
    const mortgageTx = TRANSACTIONS.filter(t =>
      new Date(t.date).getFullYear() === Number(taxYear) &&
      t.propertyId === p.id &&
      (t.category === "Mortgage" || t.category === "Mortgage Payment")
    );
    let interestSource = "estimated";
    let totalPrincipal = 0;
    if (mortgageTx.length > 0) {
      lines["12"] = mortgageTx.reduce((s, t) => {
        // Use stored piInterest if available (user-entered or auto-calculated at save time), otherwise calc on the fly
        const interest = t.piInterest != null ? t.piInterest : (calcPaymentInterest(p.loanAmount, p.loanRate, p.loanTermYears, p.loanStartDate, t.date) ?? 0);
        return s + interest;
      }, 0);
      totalPrincipal = mortgageTx.reduce((s, t) => {
        const principal = t.piPrincipal != null ? t.piPrincipal : Math.max(0, Math.abs(t.amount) - (calcPaymentInterest(p.loanAmount, p.loanRate, p.loanTermYears, p.loanStartDate, t.date) ?? 0));
        return s + principal;
      }, 0);
      const hasOverrides = mortgageTx.some(t => t.piInterest != null);
      interestSource = hasOverrides ? `${mortgageTx.length} payment${mortgageTx.length > 1 ? "s" : ""} (P&I split)` : `${mortgageTx.length} payment${mortgageTx.length > 1 ? "s" : ""}`;
    } else {
      // Fallback: rough annual estimate from current balance × rate
      const bal = calcLoanBalance(p.loanAmount, p.loanRate, p.loanTermYears, p.loanStartDate) ?? (p.loanAmount || 0);
      lines["12"] = Math.round(bal * (p.loanRate || 4) / 100);
    }

    // Line 18: Depreciation — uses per-property land value when available
    const deprYrs = p.type === "Commercial" ? TAX_CONFIG.depreciationCommercial : TAX_CONFIG.depreciationResidential;
    const deprInfo = getDeprBasis(p);
    lines["18"] = Math.round(deprInfo.basis / deprYrs);

    const txIncome = TRANSACTIONS.filter(t =>
      new Date(t.date).getFullYear() === Number(taxYear) && t.propertyId === p.id && t.type === "income"
    ).reduce((s, t) => s + t.amount, 0);
    const rEff = getEffectiveMonthly(p, TRANSACTIONS);
    const grossRent = txIncome > 0 ? txIncome : rEff.monthlyIncome * 12;
    const totalExp = Object.values(lines).reduce((s, v) => s + v, 0);
    const net = grossRent - totalExp;
    return { lines, grossRent, totalExp, net, hasActual: txIncome > 0, interestSource, totalPrincipal };
  };

  // Per-property calc (for year-end) — uses transaction-derived financials
  const calcProp = p => {
    const cEff = getEffectiveMonthly(p, TRANSACTIONS);
    const annRent = cEff.monthlyIncome * 12;
    const annExp = cEff.monthlyExpenses * 12;
    const depr = Math.round(getDeprBasis(p).basis / (p.type === "Commercial" ? TAX_CONFIG.depreciationCommercial : TAX_CONFIG.depreciationResidential));
    const bal = calcLoanBalance(p.loanAmount, p.loanRate, p.loanTermYears, p.loanStartDate) ?? (p.loanAmount || 0);
    const intEst = Math.round(bal * (p.loanRate || 4) / 100);
    const net = annRent - annExp - depr - intEst;
    return { annRent, annExp, depr, intEst, net };
  };

  const totIncome   = reportProps.reduce((s, p) => s + calcProp(p).annRent, 0);
  const totExpenses = reportProps.reduce((s, p) => s + calcProp(p).annExp, 0);
  const totDepr     = reportProps.reduce((s, p) => s + calcProp(p).depr, 0);
  const totInt      = reportProps.reduce((s, p) => s + calcProp(p).intEst, 0);
  const totNet      = reportProps.reduce((s, p) => s + calcProp(p).net, 0);

  // Monthly cash flow — real transactions with estimated fallback
  const EXP_FACTORS = [1.0, 0.88, 1.15, 0.92, 1.05, 1.18, 0.97, 1.22, 0.89, 1.08, 1.30, 0.95];
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const monthlyData = MONTHS.map((month, i) => {
    const monthTx = TRANSACTIONS.filter(t => {
      const d = new Date(t.date);
      return d.getFullYear() === Number(taxYear) && d.getMonth() === i && reportProps.some(p => p.id === t.propertyId);
    });
    if (monthTx.length > 0) {
      const income   = monthTx.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
      const expenses = monthTx.filter(t => t.type === "expense").reduce((s, t) => s + Math.abs(t.amount), 0);
      return { month, income, expenses, net: income - expenses, isActual: true };
    }
    const income   = reportProps.reduce((s, p) => s + getEffectiveMonthly(p, TRANSACTIONS).monthlyIncome, 0);
    const expenses = reportProps.reduce((s, p) => s + Math.round(getEffectiveMonthly(p, TRANSACTIONS).monthlyExpenses * EXP_FACTORS[i]), 0);
    return { month, income, expenses, net: income - expenses, isActual: false };
  });

  // Depreciation schedule — uses per-property landValue when available, falls back to TAX_CONFIG estimate
  const taxYearEnd = new Date(`${taxYear}-12-31`);
  const deprRows = reportProps.map(p => {
    const depr = getDeprBasis(p);
    const basis = depr.basis;
    const deprLife = p.type === "Commercial" ? TAX_CONFIG.depreciationCommercial : TAX_CONFIG.depreciationResidential;
    const annual = Math.round(basis / deprLife);
    const start = p.purchaseDate ? new Date(p.purchaseDate) : new Date("2020-01-01");
    const yearsHeld = Math.max(0, (taxYearEnd - start) / (365.25 * 86400000));
    const cumul = Math.min(basis, Math.round(annual * yearsHeld));
    return { p, basis, annual, deprLife, yearsHeld: yearsHeld.toFixed(1), cumul, remaining: basis - cumul, estimated: depr.estimated, landValue: depr.landValue };
  });
  const hasAnyEstimatedDepr = deprRows.some(r => r.estimated);

  // Lender package data
  const lenderData = reportProps.map(p => {
    const lEff = getEffectiveMonthly(p, TRANSACTIONS);
    const noi = (lEff.monthlyIncome - lEff.monthlyExpenses) * 12;
    const bal = calcLoanBalance(p.loanAmount, p.loanRate, p.loanTermYears, p.loanStartDate) ?? (p.loanAmount ?? 0);
    const r = (p.loanRate || 4) / 100 / 12;
    const n = (p.loanTermYears || 30) * 12;
    const mds = r > 0 ? Math.round(p.loanAmount * r * Math.pow(1+r,n) / (Math.pow(1+r,n)-1)) : 0;
    const annDebt = mds * 12;
    const dscr = annDebt > 0 ? (noi / annDebt) : null;
    const ltv = p.currentValue > 0 ? ((bal / p.currentValue) * 100) : 0;
    const equity = p.currentValue - bal;
    const capRate = p.currentValue > 0 ? (noi / p.currentValue * 100) : 0;
    const grm = lEff.monthlyIncome > 0 ? (p.currentValue / (lEff.monthlyIncome * 12)) : 0;
    const perUnit = p.units > 0 ? Math.round(p.currentValue / p.units) : p.currentValue;
    return { p, noi, bal, mds, annDebt, dscr, ltv, equity, capRate, grm, perUnit };
  });

  const taxReports = [
    { id: "scheduleE",     label: "Schedule E",           icon: FileText    },
    { id: "depreciation",  label: "Depreciation Schedule", icon: TrendingDown },
    { id: "yearend",       label: "Year-End Summary",      icon: Calendar    },
  ];
  const financialReports = [
    { id: "cashflow",      label: "Cash Flow",             icon: DollarSign  },
    { id: "ownerStatement",label: "Owner's Statement",     icon: Home        },
    { id: "lenderPackage", label: "Lender Package",        icon: Building2   },
    { id: "transactions",  label: "Transaction Detail",    icon: List        },
  ];
  const allReportTypes = [...taxReports, ...financialReports];
  const isTaxReport = taxReports.some(r => r.id === activeReport);

  const thStyle = { padding: "11px 16px", textAlign: "left", color: "var(--text-muted)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", background: "var(--surface-alt)" };
  const tdStyle = { padding: "12px 16px", fontSize: 13, color: "var(--text-primary)", borderTop: "1px solid var(--border-subtle)" };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ color: "var(--text-primary)", fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Reports</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 15 }}>Financial summaries, tax reports, and lender packages</p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {activeReport !== "transactions" && activeReport !== "ownerStatement" && (
            <select value={taxYear} onChange={e => setTaxYear(e.target.value)} style={{ ...iS, width: 110, fontWeight: 700 }}>
              {TAX_CONFIG.yearRange.slice().reverse().map(y => (
                <option key={y} value={String(y)}>{isTaxReport ? `TY ${y}` : String(y)}</option>
              ))}
            </select>
          )}
          <select value={propFilter} onChange={e => setPropFilter(e.target.value)} style={{ ...iS, width: 220 }}>
            <option value="all">All Properties</option>
            {PROPERTIES.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button onClick={() => exportReportCSV(activeReport, reportProps, monthlyData, deprRows, lenderData, calcPropLines, taxYear, ownerMonth)} style={{ background: "var(--surface)", color: "var(--text-label)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 16px", fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
            <Download size={16} /> CSV
          </button>
          <button onClick={() => exportReportPDF(activeReport, reportProps, monthlyData, deprRows, lenderData, calcPropLines, taxYear, propFilter, ownerMonth)} style={{ background: "#e95e00", color: "#fff", border: "none", borderRadius: 10, padding: "10px 16px", fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
            <Download size={16} /> PDF
          </button>
        </div>
      </div>

      {/* Portfolio Summary KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14, marginBottom: 24 }}>
        {(() => {
          const allCalc = reportProps.map(p => calcPropLines(p));
          const tRent = allCalc.reduce((s, c) => s + c.grossRent, 0);
          const tExp  = allCalc.reduce((s, c) => s + c.totalExp, 0);
          const tNet  = allCalc.reduce((s, c) => s + c.net, 0);
          const tDepr = reportProps.reduce((s, p) => {
            const yrs = p.type === "Commercial" ? TAX_CONFIG.depreciationCommercial : TAX_CONFIG.depreciationResidential;
            return s + Math.round(getDeprBasis(p).basis / yrs);
          }, 0);
          const actualPct = Math.round((allCalc.filter(c => c.hasActual).length / Math.max(1, allCalc.length)) * 100);
          return [
            { label: "Gross Rental Income", value: fmt(tRent), color: "var(--c-green)", bg: "var(--success-tint)" },
            { label: "Total Expenses", value: fmt(tExp), color: "var(--c-red)", bg: "var(--danger-tint)" },
            { label: isTaxReport ? "Net Taxable Income" : "Net Operating Income", value: fmt(tNet), color: tNet >= 0 ? "var(--c-green)" : "var(--c-red)", bg: "var(--info-tint-alt)" },
            { label: isTaxReport ? "Annual Depreciation" : "Portfolio Properties", value: isTaxReport ? fmt(tDepr) : String(reportProps.length), color: isTaxReport ? "var(--c-purple)" : "var(--c-purple)", bg: "var(--purple-tint)" },
            { label: "Actual Data Coverage", value: `${actualPct}%`, color: "var(--c-blue)", bg: "var(--info-tint)" },
          ].map((m, i) => (
            <div key={i} style={{ background: "var(--surface)", borderRadius: 14, padding: "14px 16px", border: "1px solid var(--border-subtle)" }}>
              <p style={{ color: "var(--text-secondary)", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>{m.label}</p>
              <p style={{ color: "var(--text-primary)", fontSize: 20, fontWeight: 800, fontFamily: "var(--font-display)" }}>{m.value}</p>
            </div>
          ));
        })()}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 20 }}>
        {/* Sidebar nav */}
        <div style={{ background: "var(--surface)", borderRadius: 16, padding: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)", height: "fit-content" }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", padding: "8px 14px 4px" }}>Tax Reports</p>
          {taxReports.map(r => (
            <button key={r.id} onClick={() => setActiveReport(r.id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 10, border: "none", background: activeReport === r.id ? "var(--active-highlight)" : "transparent", color: activeReport === r.id ? "#e95e00" : "var(--text-label)", fontWeight: activeReport === r.id ? 700 : 500, fontSize: 14, cursor: "pointer", marginBottom: 2, textAlign: "left" }}>
              <r.icon size={16} /> {r.label}
            </button>
          ))}
          <div style={{ borderTop: "1px solid var(--border-subtle)", margin: "8px 14px", paddingTop: 0 }} />
          <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", padding: "4px 14px 4px" }}>Financial Reports</p>
          {financialReports.map(r => (
            <button key={r.id} onClick={() => setActiveReport(r.id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 10, border: "none", background: activeReport === r.id ? "var(--active-highlight)" : "transparent", color: activeReport === r.id ? "#e95e00" : "var(--text-label)", fontWeight: activeReport === r.id ? 700 : 500, fontSize: 14, cursor: "pointer", marginBottom: 2, textAlign: "left" }}>
              <r.icon size={16} /> {r.label}
            </button>
          ))}
          <div style={{ borderTop: "1px solid var(--border-subtle)", marginTop: 12, paddingTop: 12 }}>
            <p style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", padding: "0 14px", marginBottom: 6 }}>Scope</p>
            <p style={{ fontSize: 12, color: "var(--text-label)", padding: "0 14px", fontWeight: 600 }}>{propFilter === "all" ? `All ${PROPERTIES.length} properties` : PROPERTIES.find(p => p.id === propFilter)?.name}</p>
            <p style={{ fontSize: 12, color: "var(--text-muted)", padding: "0 14px" }}>{activeReport === "transactions" ? `${txDateFrom} – ${txDateTo}` : isTaxReport ? `Tax Year ${taxYear}` : `Year ${taxYear}`}</p>
          </div>
        </div>

        {/* Report content */}
        <div style={{ background: "var(--surface)", borderRadius: 16, padding: 28, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)" }}>

          {/* ── SCHEDULE E ── */}
          {activeReport === "scheduleE" && (
            <div>
              <h2 style={{ color: "var(--text-primary)", fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Schedule E — Supplemental Income &amp; Loss</h2>
              <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 24 }}>Tax Year {taxYear} · Part I: Income or Loss From Rental Real Estate</p>
              {reportProps.map(p => {
                const { lines, grossRent, totalExp, net, hasActual, interestSource } = calcPropLines(p);
                const pDeprEst = getDeprBasis(p).estimated;
                const lineOrder = [
                  { n: "3",  label: "Rents Received",         income: true },
                  { n: "5",  label: "Advertising" },
                  { n: "6",  label: "Auto & Travel" },
                  { n: "7",  label: "Cleaning & Maint." },
                  { n: "9",  label: "Insurance" },
                  { n: "10", label: "Legal & Prof." },
                  { n: "11", label: "Management Fees" },
                  { n: "12", label: `Mortgage Interest (${interestSource})` },
                  { n: "14", label: "Repairs" },
                  { n: "15", label: "Supplies" },
                  { n: "16", label: "Taxes" },
                  { n: "17", label: "Utilities" },
                  { n: "18", label: pDeprEst ? "Depreciation (est. *)" : "Depreciation" },
                  { n: "19", label: "Other" },
                ];
                const filledLines = lineOrder.filter(l => l.income ? grossRent > 0 : (lines[l.n] || 0) > 0);
                return (
                  <div key={p.id} style={{ border: "1px solid var(--border-subtle)", borderRadius: 14, padding: 20, marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                      <div style={{ width: 30, height: 30, borderRadius: 8, background: "#1e3a5f", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 11, fontWeight: 700 }}>{p.image}</div>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{p.name}</p>
                        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{p.address}</p>
                      </div>
                      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
                        {hasActual && <span style={{ fontSize: 11, background: "var(--success-badge)", color: "#1a7a4a", borderRadius: 6, padding: "3px 8px", fontWeight: 700 }}>Actual Data</span>}
                        <div style={{ textAlign: "right" }}>
                          <p style={{ fontSize: 11, color: "var(--text-muted)" }}>Net Income / (Loss)</p>
                          <p style={{ fontSize: 17, fontWeight: 800, color: net >= 0 ? "#1a7a4a" : "#c0392b" }}>{net >= 0 ? "" : "-"}{fmt(Math.abs(net))}</p>
                        </div>
                      </div>
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          <th style={{ ...thStyle, borderRadius: "6px 0 0 0" }}>Line</th>
                          <th style={thStyle}>Description</th>
                          <th style={{ ...thStyle, textAlign: "right", borderRadius: "0 6px 0 0" }}>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filledLines.map((l, i) => {
                          const val = l.income ? grossRent : (lines[l.n] || 0);
                          return (
                            <tr key={l.n} style={{ background: i % 2 === 0 ? "var(--surface)" : "var(--surface-alt)" }}>
                              <td style={{ ...tdStyle, color: "var(--text-muted)", fontWeight: 700, width: 50 }}>{l.n}</td>
                              <td style={{ ...tdStyle, color: "var(--text-label)" }}>{l.label}</td>
                              <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700, color: l.income ? "#1a7a4a" : "#c0392b" }}>
                                {l.income ? "+" : "-"}{fmt(val)}
                              </td>
                            </tr>
                          );
                        })}
                        <tr style={{ background: "var(--info-tint-alt)", borderTop: "2px solid var(--info-border-alt)" }}>
                          <td style={{ ...tdStyle, fontWeight: 800, color: "var(--text-primary)" }} colSpan={2}>26. Total Expenses &amp; Net Income / (Loss)</td>
                          <td style={{ ...tdStyle, textAlign: "right", fontWeight: 800, fontSize: 15, color: net >= 0 ? "#1a7a4a" : "#c0392b" }}>
                            {net >= 0 ? "+" : "-"}{fmt(Math.abs(net))}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                );
              })}
              <div style={{ background: "var(--info-tint-alt)", borderRadius: 14, padding: 20, border: "1px solid var(--info-border-alt)" }}>
                <h3 style={{ color: "var(--text-primary)", fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Portfolio Totals</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
                  {(() => {
                    const allCalc = reportProps.map(p => calcPropLines(p));
                    const tRent = allCalc.reduce((s, c) => s + c.grossRent, 0);
                    const tExp  = allCalc.reduce((s, c) => s + c.totalExp, 0);
                    const tNet  = allCalc.reduce((s, c) => s + c.net, 0);
                    return [
                      { label: "Total Gross Rents", value: fmt(tRent), color: "#1a7a4a" },
                      { label: "Total Expenses (incl. depr.)", value: `-${fmt(tExp)}`, color: "#c0392b" },
                      { label: "Net Taxable Rental Income", value: fmt(tNet), color: tNet >= 0 ? "#1a7a4a" : "#c0392b" },
                      { label: "Total Depreciation", value: `-${fmt(reportProps.reduce((s, p) => s + Math.round(getDeprBasis(p).basis/(p.type === "Commercial" ? TAX_CONFIG.depreciationCommercial : TAX_CONFIG.depreciationResidential)), 0))}`, color: "#c0392b" },
                      { label: "Mortgage Interest (est.)", value: `-${fmt(reportProps.reduce((s, p) => { const b = calcLoanBalance(p.loanAmount, p.loanRate, p.loanTermYears, p.loanStartDate) ?? (p.loanAmount||0); return s + Math.round(b*(p.loanRate||4)/100); }, 0))}`, color: "#c0392b" },
                      { label: "Est. Tax Liability @ 28%", value: tNet > 0 ? `-${fmt(Math.round(tNet * 0.28))}` : "$0", color: "#c0392b" },
                    ].map((m, i) => (
                      <div key={i} style={{ background: "var(--surface)", borderRadius: 10, padding: "12px 16px" }}>
                        <p style={{ color: "var(--text-secondary)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>{m.label}</p>
                        <p style={{ color: m.color, fontSize: 16, fontWeight: 800 }}>{m.value}</p>
                      </div>
                    ));
                  })()}
                </div>
                <p style={{ color: "var(--text-muted)", fontSize: 11, marginTop: 14 }}>⚠️ Estimates for planning only. Mortgage interest is estimated from outstanding loan balance. Consult your CPA before filing.</p>
              </div>
            </div>
          )}

          {/* ── CASH FLOW REPORT ── */}
          {activeReport === "cashflow" && (
            <div>
              <h2 style={{ color: "var(--text-primary)", fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Cash Flow Report</h2>
              <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 6 }}>{taxYear} · Monthly income and expense detail</p>
              <div style={{ display: "flex", gap: 14, marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: "var(--c-green)", display: "inline-block" }} />
                  <span style={{ fontSize: 12, color: "var(--text-label)" }}>Income</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: "var(--c-red)", display: "inline-block" }} />
                  <span style={{ fontSize: 12, color: "var(--text-label)" }}>Expenses</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: "var(--c-blue)", display: "inline-block" }} />
                  <span style={{ fontSize: 12, color: "var(--text-label)" }}>Net Cash Flow</span>
                </div>
              </div>

              {/* Cash Flow Bar Chart */}
              <div style={{ background: "var(--surface-alt)", borderRadius: 14, padding: "20px 16px 10px", marginBottom: 24, border: "1px solid var(--border-subtle)" }}>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={monthlyData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--chart-axis)" }} />
                    <YAxis tick={{ fontSize: 11, fill: "var(--chart-axis)" }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v, name) => [`$${v.toLocaleString()}`, name]} cursor={{ fill: "transparent" }} contentStyle={{ borderRadius: 10, border: "1px solid var(--tooltip-border)", fontSize: 12, background: "var(--tooltip-bg)", color: "var(--tooltip-text)" }} itemStyle={{ color: "var(--tooltip-text)" }} />
                    <Bar dataKey="income" name="Income" fill="var(--c-green)" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="expenses" name="Expenses" fill="var(--c-red)" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="net" name="Net" fill="var(--chart-bar-primary)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Month</th>
                      <th style={thStyle}>Source</th>
                      <th style={{ ...thStyle, color: "#1a7a4a" }}>Income</th>
                      <th style={{ ...thStyle, color: "#c0392b" }}>Expenses</th>
                      <th style={{ ...thStyle, color: "var(--c-blue)" }}>Net Cash Flow</th>
                      <th style={thStyle}>Margin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyData.map((m, i) => {
                      const margin = m.income > 0 ? ((m.net / m.income) * 100).toFixed(0) : 0;
                      return (
                        <tr key={i} style={{ background: i % 2 === 0 ? "var(--surface)" : "var(--surface-alt)" }}>
                          <td style={{ ...tdStyle, fontWeight: 600 }}>{m.month}</td>
                          <td style={tdStyle}>
                            <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 6, padding: "3px 8px", background: m.isActual ? "var(--success-badge)" : "var(--surface-muted)", color: m.isActual ? "#1a7a4a" : "var(--text-muted)" }}>
                              {m.isActual ? "Actual" : "Est."}
                            </span>
                          </td>
                          <td style={{ ...tdStyle, color: "#1a7a4a", fontWeight: 600 }}>+{fmt(m.income)}</td>
                          <td style={{ ...tdStyle, color: "#c0392b" }}>-{fmt(m.expenses)}</td>
                          <td style={{ ...tdStyle, fontWeight: 700, color: m.net >= 0 ? "#1a7a4a" : "#c0392b" }}>{m.net >= 0 ? "+" : ""}{fmt(m.net)}</td>
                          <td style={tdStyle}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div style={{ flex: 1, height: 6, background: "var(--surface-muted)", borderRadius: 99, overflow: "hidden" }}>
                                <div style={{ height: "100%", width: `${Math.max(0, Math.min(100, Number(margin)))}%`, background: Number(margin) >= 30 ? "var(--c-green)" : Number(margin) >= 10 ? "#e95e00" : "var(--c-red)", borderRadius: 99 }} />
                              </div>
                              <span style={{ fontSize: 12, color: "var(--text-secondary)", width: 34, textAlign: "right" }}>{margin}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: "var(--info-tint-alt)", borderTop: "2px solid var(--info-border-alt)" }}>
                      <td style={{ ...tdStyle, fontWeight: 800, color: "var(--text-primary)" }}>Full Year</td>
                      <td style={tdStyle} />
                      <td style={{ ...tdStyle, fontWeight: 800, color: "var(--c-green)" }}>+{fmt(monthlyData.reduce((s, m) => s + m.income, 0))}</td>
                      <td style={{ ...tdStyle, fontWeight: 800, color: "var(--c-red)" }}>-{fmt(monthlyData.reduce((s, m) => s + m.expenses, 0))}</td>
                      <td style={{ ...tdStyle, fontWeight: 800, color: "var(--c-green)" }}>{fmt(monthlyData.reduce((s, m) => s + m.net, 0))}</td>
                      <td style={{ ...tdStyle, fontWeight: 700, color: "var(--text-primary)" }}>{((monthlyData.reduce((s, m) => s + m.net, 0) / Math.max(1, monthlyData.reduce((s, m) => s + m.income, 0))) * 100).toFixed(0)}% avg</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* ── OWNER'S STATEMENT ── */}
          {activeReport === "ownerStatement" && (
            <div>
              <h2 style={{ color: "var(--text-primary)", fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Owner's Statement</h2>
              <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 20 }}>Monthly P&amp;L summary per property — select a property and month to generate</p>
              {propFilter === "all" ? (
                <div style={{ background: "var(--surface-alt)", borderRadius: 14, padding: 40, textAlign: "center", border: "1px dashed #cbd5e1" }}>
                  <Home size={36} style={{ color: "#cbd5e1", marginBottom: 12 }} />
                  <p style={{ color: "var(--text-label)", fontWeight: 600, marginBottom: 6 }}>Select a Property to Generate Owner's Statement</p>
                  <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Use the property dropdown above to filter to a single property.</p>
                </div>
              ) : (() => {
                const p = reportProps[0];
                const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
                const monthTx = TRANSACTIONS.filter(t => {
                  const d = new Date(t.date);
                  return d.getMonth() === ownerMonth && d.getFullYear() === Number(taxYear) && t.propertyId === p.id;
                });
                const income   = monthTx.filter(t => t.type === "income");
                const expenses = monthTx.filter(t => t.type === "expense");
                const totalIn  = income.reduce((s, t) => s + t.amount, 0);
                const totalOut = expenses.reduce((s, t) => s + Math.abs(t.amount), 0);
                const net      = totalIn - totalOut;
                const hasData  = monthTx.length > 0;
                return (
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: "#1e3a5f", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700 }}>{p.image}</div>
                      <div>
                        <p style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: 15 }}>{p.name}</p>
                        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>{p.address}</p>
                      </div>
                      <div style={{ marginLeft: "auto" }}>
                        <select value={ownerMonth} onChange={e => setOwnerMonth(Number(e.target.value))} style={{ ...iS, width: 160 }}>
                          {MONTH_NAMES.map((mn, i) => <option key={i} value={i}>{mn} {taxYear}</option>)}
                        </select>
                      </div>
                    </div>

                    {!hasData ? (
                      <div style={{ background: "var(--warning-bg)", borderRadius: 12, padding: "14px 18px", border: "1px solid var(--warning-border)", marginBottom: 20 }}>
                        <p style={{ color: "var(--warning-text)", fontSize: 13, fontWeight: 600 }}>No transactions logged for {MONTH_NAMES[ownerMonth]} {taxYear}. Add transactions to see actual data here.</p>
                      </div>
                    ) : null}

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
                      {[
                        { label: "Total Income", value: fmt(totalIn), color: "#1a7a4a", bg: "var(--success-tint)" },
                        { label: "Total Expenses", value: fmt(totalOut), color: "#c0392b", bg: "var(--danger-tint)" },
                        { label: "Net Operating Income", value: fmt(net), color: net >= 0 ? "#1a7a4a" : "#c0392b", bg: "var(--info-tint-alt)" },
                      ].map((kpi, i) => (
                        <div key={i} style={{ background: kpi.bg, borderRadius: 12, padding: "16px 18px" }}>
                          <p style={{ color: "var(--text-secondary)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", marginBottom: 6 }}>{kpi.label}</p>
                          <p style={{ color: kpi.color, fontSize: 22, fontWeight: 800 }}>{kpi.value}</p>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 700, color: "#1a7a4a", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>Income</p>
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                          <tbody>
                            {income.length > 0 ? income.map((t, i) => (
                              <tr key={i} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                                <td style={{ padding: "8px 0", fontSize: 13, color: "var(--text-primary)" }}>
                                  <div>{t.description}</div>
                                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{t.date}</div>
                                </td>
                                <td style={{ padding: "8px 0", fontSize: 13, fontWeight: 700, color: "#1a7a4a", textAlign: "right" }}>+{fmt(t.amount)}</td>
                              </tr>
                            )) : (
                              <tr><td colSpan={2} style={{ padding: "12px 0", color: "var(--text-muted)", fontSize: 13, fontStyle: "italic" }}>No income recorded</td></tr>
                            )}
                            <tr style={{ borderTop: "2px solid var(--border)" }}>
                              <td style={{ padding: "10px 0", fontWeight: 700, fontSize: 13 }}>Total Income</td>
                              <td style={{ padding: "10px 0", fontWeight: 800, color: "#1a7a4a", textAlign: "right" }}>+{fmt(totalIn)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 700, color: "#c0392b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>Expenses</p>
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                          <tbody>
                            {expenses.length > 0 ? expenses.map((t, i) => (
                              <tr key={i} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                                <td style={{ padding: "8px 0", fontSize: 13, color: "var(--text-primary)" }}>
                                  <div>{t.description}</div>
                                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{t.category} · {t.date}</div>
                                </td>
                                <td style={{ padding: "8px 0", fontSize: 13, fontWeight: 600, color: "#c0392b", textAlign: "right" }}>-{fmt(Math.abs(t.amount))}</td>
                              </tr>
                            )) : (
                              <tr><td colSpan={2} style={{ padding: "12px 0", color: "var(--text-muted)", fontSize: 13, fontStyle: "italic" }}>No expenses recorded</td></tr>
                            )}
                            <tr style={{ borderTop: "2px solid var(--border)" }}>
                              <td style={{ padding: "10px 0", fontWeight: 700, fontSize: 13 }}>Total Expenses</td>
                              <td style={{ padding: "10px 0", fontWeight: 800, color: "#c0392b", textAlign: "right" }}>-{fmt(totalOut)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Income → Operating Expenses → NOI → Debt Service → Owner Distribution */}
                    {(() => {
                      const mgmtTx = expenses.filter(t => ["Property Management", "Management Fee", "Leasing Fee"].includes(t.category));
                      const mgmtFee = mgmtTx.reduce((s, t) => s + Math.abs(t.amount), 0);
                      const debtTx = expenses.filter(t => ["Mortgage", "Mortgage Payment"].includes(t.category));
                      const debtService = debtTx.reduce((s, t) => s + Math.abs(t.amount), 0);
                      const opEx = totalOut - debtService;
                      const noi = totalIn - opEx;
                      const cashFlow = noi - debtService;
                      return (
                        <div style={{ marginTop: 20 }}>
                          <div style={{ background: noi >= 0 ? "var(--success-tint)" : "var(--danger-tint)", borderRadius: "12px 12px 0 0", padding: "14px 20px", border: `1px solid ${noi >= 0 ? "var(--success-border)" : "var(--danger-border)"}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <p style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>Net Operating Income — {MONTH_NAMES[ownerMonth]} {taxYear}</p>
                            <p style={{ fontWeight: 800, fontSize: 20, color: noi >= 0 ? "#1a7a4a" : "#c0392b" }}>{noi >= 0 ? "+" : "-"}{fmt(Math.abs(noi))}</p>
                          </div>
                          <div style={{ background: "var(--surface-alt)", border: "1px solid var(--border)", borderTop: "none", padding: "14px 20px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                              <span style={{ fontSize: 13, color: "var(--text-label)" }}>Operating Expenses (incl. mgmt{mgmtFee > 0 ? ` ${fmt(mgmtFee)}` : ""})</span>
                              <span style={{ fontSize: 13, fontWeight: 600, color: "#c0392b" }}>-{fmt(opEx)}</span>
                            </div>
                            {debtService > 0 && (
                              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                                <span style={{ fontSize: 13, color: "var(--text-label)" }}>Less: Debt Service (P&I)</span>
                                <span style={{ fontSize: 13, fontWeight: 600, color: "#c0392b" }}>-{fmt(debtService)}</span>
                              </div>
                            )}
                          </div>
                          <div style={{ background: "var(--info-tint)", borderRadius: "0 0 12px 12px", padding: "14px 20px", border: "1px solid var(--info-border)", borderTop: "2px solid #3b82f6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <p style={{ fontWeight: 700, fontSize: 14, color: "var(--c-blue)" }}>Owner Distribution (Cash Flow)</p>
                            <p style={{ fontWeight: 800, fontSize: 20, color: cashFlow >= 0 ? "var(--c-blue)" : "#c0392b" }}>{cashFlow >= 0 ? "+" : "-"}{fmt(Math.abs(cashFlow))}</p>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                );
              })()}
            </div>
          )}

          {/* ── LENDER PACKAGE ── */}
          {activeReport === "lenderPackage" && (
            <div>
              <h2 style={{ color: "var(--text-primary)", fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Lender / Refinance Package</h2>
              <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 24 }}>Key metrics lenders evaluate — NOI, DSCR, LTV, equity, and debt service</p>
              <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24 }}>
                <thead>
                  <tr>
                    {["Property","Annual NOI","Value","$/Unit","Equity","Cap Rate","GRM","Mo DS","DSCR","LTV"].map(h => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lenderData.map(({ p, noi, bal, mds, dscr, ltv, equity, capRate, grm, perUnit }, i) => {
                    const dscrColor = dscr === null ? "#94a3b8" : dscr >= 1.25 ? "#1a7a4a" : dscr >= 1.0 ? "#d97706" : "#c0392b";
                    const dscrBg   = dscr === null ? "var(--surface-alt)" : dscr >= 1.25 ? "var(--success-badge)" : dscr >= 1.0 ? "var(--warning-bg)" : "var(--danger-badge)";
                    const ltvColor = ltv < 70 ? "#1a7a4a" : ltv < 80 ? "#d97706" : "#c0392b";
                    const capColor = capRate >= 6 ? "#1a7a4a" : capRate >= 4 ? "#d97706" : "#c0392b";
                    return (
                      <tr key={p.id} style={{ background: i % 2 === 0 ? "var(--surface)" : "var(--surface-alt)" }}>
                        <td style={{ ...tdStyle, fontWeight: 600 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 22, height: 22, borderRadius: 6, background: "#1e3a5f", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{p.image}</div>
                            {p.name.split(" ").slice(0, 2).join(" ")}
                          </div>
                        </td>
                        <td style={{ ...tdStyle, color: noi >= 0 ? "#1a7a4a" : "#c0392b", fontWeight: 600 }}>{fmt(noi)}</td>
                        <td style={tdStyle}>{fmt(p.currentValue)}</td>
                        <td style={{ ...tdStyle, fontSize: 12 }}>{fmt(perUnit)}</td>
                        <td style={{ ...tdStyle, color: equity >= 0 ? "#1a7a4a" : "#c0392b", fontWeight: 600 }}>{fmt(equity)}</td>
                        <td style={tdStyle}><span style={{ color: capColor, fontWeight: 700 }}>{capRate.toFixed(1)}%</span></td>
                        <td style={{ ...tdStyle, fontSize: 12 }}>{grm > 0 ? `${grm.toFixed(1)}x` : "—"}</td>
                        <td style={tdStyle}>{mds > 0 ? fmt(mds) : "—"}</td>
                        <td style={tdStyle}>
                          <span style={{ background: dscrBg, color: dscrColor, fontWeight: 700, fontSize: 13, borderRadius: 7, padding: "4px 10px" }}>
                            {dscr !== null ? dscr.toFixed(2) : "—"}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <span style={{ color: ltvColor, fontWeight: 700 }}>{ltv.toFixed(1)}%</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: "var(--info-tint-alt)", borderTop: "2px solid var(--info-border-alt)" }}>
                    <td style={{ ...tdStyle, fontWeight: 800, color: "#0c4a6e" }}>Portfolio Total</td>
                    <td style={{ ...tdStyle, fontWeight: 800, color: "#1a7a4a" }}>{fmt(lenderData.reduce((s, d) => s + d.noi, 0))}</td>
                    <td style={{ ...tdStyle, fontWeight: 700 }}>{fmt(lenderData.reduce((s, d) => s + d.p.currentValue, 0))}</td>
                    <td style={tdStyle} />
                    <td style={{ ...tdStyle, fontWeight: 800, color: "#1a7a4a" }}>{fmt(lenderData.reduce((s, d) => s + d.equity, 0))}</td>
                    <td style={tdStyle} />
                    <td style={tdStyle} />
                    <td style={{ ...tdStyle, fontWeight: 700 }}>{fmt(lenderData.reduce((s, d) => s + d.mds, 0))}</td>
                    <td style={tdStyle} />
                    <td style={tdStyle} />
                  </tr>
                </tfoot>
              </table>

              {/* DSCR Guide */}
              <div style={{ background: "var(--surface-alt)", borderRadius: 14, padding: 18, border: "1px solid var(--border)" }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>DSCR Reference Guide</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
                  {[
                    { label: "Strong — Lender Favorable", range: "≥ 1.25", bg: "var(--success-badge)", color: "#1a7a4a", note: "Most lenders approve at this threshold. Strong cash coverage." },
                    { label: "Marginal — Borderline", range: "1.00 – 1.24", bg: "var(--warning-bg)", color: "#d97706", note: "Debt is covered but thin. Some lenders require reserves or higher rates." },
                    { label: "Negative Coverage", range: "< 1.00", bg: "var(--danger-badge)", color: "#c0392b", note: "Property cash flow doesn't cover debt. Refinance may be difficult." },
                  ].map((g, i) => (
                    <div key={i} style={{ background: g.bg, borderRadius: 10, padding: "12px 14px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <p style={{ fontSize: 12, fontWeight: 700, color: g.color }}>{g.label}</p>
                        <span style={{ fontSize: 14, fontWeight: 800, color: g.color }}>{g.range}</span>
                      </div>
                      <p style={{ fontSize: 11, color: "var(--text-label)" }}>{g.note}</p>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: 11, color: "var(--text-muted)" }}>DSCR = Net Operating Income ÷ Annual Debt Service. LTV = Outstanding Loan Balance ÷ Current Property Value. Loan balances estimated via amortization formula.</p>
              </div>
            </div>
          )}

          {/* ── DEPRECIATION SCHEDULE ── */}
          {activeReport === "depreciation" && (
            <div>
              <h2 style={{ color: "var(--text-primary)", fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Depreciation Schedule</h2>
              <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 6 }}>Tax Year {taxYear} · IRS MACRS — Residential ({TAX_CONFIG.depreciationResidential} yr) &amp; Commercial ({TAX_CONFIG.depreciationCommercial} yr), straight-line</p>
              <p style={{ color: "var(--text-secondary)", fontSize: 12, marginBottom: 24 }}>Depreciable basis = Purchase Price − Land Value. Land is not depreciable per IRS rules.</p>
              {hasAnyEstimatedDepr && (
                <div style={{ background: "var(--warning-bg)", border: "1px solid #fed7aa", borderRadius: 12, padding: "12px 16px", marginBottom: 20, display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <AlertTriangle size={16} color="#c2410c" style={{ flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "#c2410c", marginBottom: 2 }}>Estimated land values in use</p>
                    <p style={{ fontSize: 12, color: "#9a3412" }}>
                      {deprRows.filter(r => r.estimated).map(r => r.p.name.split(" ").slice(0,2).join(" ")).join(", ")} {deprRows.filter(r => r.estimated).length === 1 ? "is" : "are"} using the default {TAX_CONFIG.landValuePct * 100}% land estimate.
                      Enter actual land values (from county tax assessment) in each property's settings for accurate depreciation.
                    </p>
                  </div>
                </div>
              )}
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Property", "Placed in Service", "Purchase Price", "Land Value", "Depr. Basis", "Life", "Annual Deduction", "Yrs Held", "Cumul. Taken", "Remaining"].map(h => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {deprRows.map(({ p, basis, annual, yearsHeld, cumul, remaining, deprLife, estimated, landValue }, i) => (
                    <tr key={p.id} style={{ background: i % 2 === 0 ? "var(--surface)" : "var(--surface-alt)" }}>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 22, height: 22, borderRadius: 6, background: "#1e3a5f", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{p.image}</div>
                          {p.name.split(" ").slice(0, 2).join(" ")}
                        </div>
                      </td>
                      <td style={tdStyle}>{p.purchaseDate || "—"}</td>
                      <td style={tdStyle}>{fmt(p.purchasePrice)}</td>
                      <td style={tdStyle}>
                        <span style={{ color: estimated ? "#c2410c" : "var(--text-secondary)" }}>
                          {fmt(landValue)}{estimated ? " *" : ""}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, color: "var(--c-purple)", fontWeight: 600 }}>{fmt(basis)}</td>
                      <td style={{ ...tdStyle, fontSize: 12 }}>{deprLife} yr</td>
                      <td style={{ ...tdStyle, color: "#c0392b", fontWeight: 700 }}>-{fmt(annual)}</td>
                      <td style={tdStyle}>{yearsHeld} yrs</td>
                      <td style={{ ...tdStyle, color: "#c0392b" }}>-{fmt(cumul)}</td>
                      <td style={{ ...tdStyle, color: "var(--text-primary)", fontWeight: 600 }}>{fmt(remaining)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: "var(--info-tint-alt)", borderTop: "2px solid var(--info-border-alt)" }}>
                    <td colSpan={6} style={{ ...tdStyle, fontWeight: 800, color: "#0c4a6e" }}>Portfolio Total</td>
                    <td style={{ ...tdStyle, fontWeight: 800, color: "#c0392b" }}>-{fmt(deprRows.reduce((s, r) => s + r.annual, 0))}</td>
                    <td style={tdStyle} />
                    <td style={{ ...tdStyle, fontWeight: 700, color: "#c0392b" }}>-{fmt(deprRows.reduce((s, r) => s + r.cumul, 0))}</td>
                    <td style={{ ...tdStyle, fontWeight: 700 }}>{fmt(deprRows.reduce((s, r) => s + r.remaining, 0))}</td>
                  </tr>
                </tfoot>
              </table>
              {hasAnyEstimatedDepr && (
                <p style={{ fontSize: 11, color: "#9a3412", marginTop: 10 }}>* Estimated — land value not entered, using default {TAX_CONFIG.landValuePct * 100}% of purchase price</p>
              )}
              <div style={{ background: "var(--warning-bg)", border: "1px solid #fdba74", borderRadius: 12, padding: "12px 16px", marginTop: 16 }}>
                <p style={{ fontSize: 12, color: "#7c2d12" }}>⚠️ Depreciation recapture at {TAX_CONFIG.recaptureRate * 100}% applies if you sell. Buildings placed in service mid-year use the mid-month convention for the first year. This report is for informational purposes — consult your CPA for your exact tax deduction.</p>
              </div>
            </div>
          )}

          {/* ── YEAR-END SUMMARY ── */}
          {activeReport === "yearend" && (() => {
            // Pull actual other income (late fees, pet fees, app fees) from transactions
            const otherIncomeTx = TRANSACTIONS.filter(t =>
              new Date(t.date).getFullYear() === Number(taxYear) && t.type === "income" && reportProps.some(p => p.id === t.propertyId)
              && !["Rent", "Rent Payment", "Monthly Rent"].includes(t.category)
            );
            const otherIncome = otherIncomeTx.reduce((s, t) => s + t.amount, 0);

            // Pull actual property tax from transactions
            const propTaxTx = TRANSACTIONS.filter(t =>
              new Date(t.date).getFullYear() === Number(taxYear) && reportProps.some(p => p.id === t.propertyId)
              && (t.category === "Property Tax" || t.category === "Tax Penalties")
            );
            const propTaxActual = propTaxTx.reduce((s, t) => s + Math.abs(t.amount), 0);
            const propTaxHasActual = propTaxTx.length > 0;

            // Use calcPropLines for accurate P&I split across all properties
            const allPropCalc = reportProps.map(p => calcPropLines(p));
            const actualInterest = allPropCalc.reduce((s, c) => s + (c.lines["12"] || 0), 0);
            const actualPrincipal = allPropCalc.reduce((s, c) => s + (c.totalPrincipal || 0), 0);
            const hasMortgageTx = allPropCalc.some(c => c.interestSource !== "estimated");

            const totalGross = totIncome + otherIncome;
            const totalDeductions = totExpenses + actualInterest + totDepr;
            const rate = taxRate / 100;

            return (
            <div>
              <h2 style={{ color: "var(--text-primary)", fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Year-End Tax Summary</h2>
              <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 24 }}>Tax Year {taxYear} · Full rental P&amp;L for your records and CPA</p>

              {/* Income section */}
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#1a7a4a", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>Income</p>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <tbody>
                    {[
                      { label: "Gross Rents Received", value: totIncome },
                      { label: otherIncome > 0 ? `Other Income (late fees, deposits, etc.)` : "Other Income", value: otherIncome, note: otherIncome === 0 ? "No non-rent income transactions logged" : null },
                    ].map((row, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                        <td style={{ padding: "10px 0", fontSize: 14, color: "var(--text-primary)" }}>{row.label}{row.note && <span style={{ color: "var(--text-muted)", fontSize: 12, marginLeft: 8 }}>({row.note})</span>}</td>
                        <td style={{ padding: "10px 0", fontSize: 14, fontWeight: 700, color: "#1a7a4a", textAlign: "right" }}>+{fmt(row.value)}</td>
                      </tr>
                    ))}
                    <tr style={{ borderBottom: "2px solid var(--border)" }}>
                      <td style={{ padding: "10px 0", fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>Total Gross Income</td>
                      <td style={{ padding: "10px 0", fontSize: 15, fontWeight: 800, color: "#1a7a4a", textAlign: "right" }}>+{fmt(totalGross)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Deductions section */}
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#c0392b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>Deductible Expenses</p>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <tbody>
                    {[
                      { label: "Operating Expenses (repairs, insurance, mgmt, etc.)", value: totExpenses },
                      { label: hasMortgageTx ? "Mortgage Interest — Line 12 (from P&I split)" : "Mortgage Interest — Line 12 (est.)", value: actualInterest },
                      ...(hasMortgageTx && actualPrincipal > 0 ? [{ label: "Mortgage Principal (not deductible — equity building)", value: actualPrincipal, isInfo: true }] : []),
                      { label: hasAnyEstimatedDepr ? "Depreciation — straight-line (some land values estimated *)" : "Depreciation — straight-line", value: totDepr },
                      { label: propTaxHasActual ? "Property Taxes (from transactions)" : "Property Taxes (no transactions logged)", value: propTaxActual, note: !propTaxHasActual },
                    ].map((row, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid var(--border-subtle)", background: row.isInfo ? "var(--surface-alt)" : "transparent" }}>
                        <td style={{ padding: "10px 0", fontSize: row.isInfo ? 13 : 14, color: row.isInfo ? "var(--text-secondary)" : "var(--text-primary)", paddingLeft: row.isInfo ? 16 : 0 }}>
                          {row.label}
                          {row.note && <span style={{ color: "#e95e00", fontSize: 12, marginLeft: 8 }}>— log property tax payments for accuracy</span>}
                        </td>
                        <td style={{ padding: "10px 0", fontSize: row.isInfo ? 13 : 14, fontWeight: 600, color: row.isInfo ? "#94a3b8" : "#c0392b", textAlign: "right" }}>{row.isInfo ? fmt(row.value) : `-${fmt(row.value)}`}</td>
                      </tr>
                    ))}
                    <tr style={{ borderBottom: "2px solid var(--border)" }}>
                      <td style={{ padding: "10px 0", fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>Total Deductions</td>
                      <td style={{ padding: "10px 0", fontSize: 15, fontWeight: 800, color: "#c0392b", textAlign: "right" }}>-{fmt(totalDeductions)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Bottom line */}
              <div style={{ background: totNet >= 0 ? "var(--success-tint)" : "var(--danger-tint)", borderRadius: 14, padding: 20, border: `1px solid ${totNet >= 0 ? "var(--success-border)" : "var(--danger-border)"}`, marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <p style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Net Taxable Rental Income</p>
                  <p style={{ fontSize: 24, fontWeight: 800, color: totNet >= 0 ? "#1a7a4a" : "#c0392b" }}>{totNet >= 0 ? "" : "-"}{fmt(Math.abs(totNet))}</p>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 14 }}>
                  <div style={{ background: "var(--surface)", borderRadius: 10, padding: "12px 14px" }}>
                    <p style={{ color: "var(--text-muted)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Marginal Tax Rate</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <select value={taxRate} onChange={e => setTaxRate(Number(e.target.value))} style={{ background: "var(--surface-alt)", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 8px", fontSize: 15, fontWeight: 800, color: "var(--text-label)", cursor: "pointer" }}>
                        {TAX_CONFIG.brackets.map(r => <option key={r} value={r}>{r}%</option>)}
                      </select>
                    </div>
                  </div>
                  {[
                    { label: `Est. Federal Tax @ ${taxRate}%`, value: totNet > 0 ? `-${fmt(Math.round(totNet * rate))}` : "No liability", color: "#c0392b" },
                    { label: "Net After Est. Taxes", value: fmt(totNet - Math.max(0, Math.round(totNet * rate))), color: "#1a7a4a" },
                    { label: "Effective Rate", value: totNet > 0 ? `${((Math.round(totNet * rate) / totalGross) * 100).toFixed(1)}%` : "N/A", color: "var(--text-label)" },
                  ].map((m, i) => (
                    <div key={i} style={{ background: "var(--surface)", borderRadius: 10, padding: "12px 14px" }}>
                      <p style={{ color: "var(--text-muted)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>{m.label}</p>
                      <p style={{ color: m.color, fontSize: 15, fontWeight: 800 }}>{m.value}</p>
                    </div>
                  ))}
                </div>
              </div>
              <p style={{ fontSize: 11, color: "var(--text-muted)" }}>⚠️ Estimates for planning only — does not account for the {TAX_CONFIG.qbiDeductionPct * 100}% QBI deduction (Sec. 199A), passive activity loss rules, or state taxes. Please consult your CPA before filing.</p>
            </div>
            );
          })()}

          {/* ── TRANSACTION DETAIL ── */}
          {activeReport === "transactions" && (() => {
            // Date range presets helper
            const applyPreset = (preset) => {
              const today = new Date();
              const todayStr = today.toISOString().slice(0, 10);
              setTxDatePreset(preset);
              if (preset === "thisMonth") {
                setTxDateFrom(`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-01`);
                setTxDateTo(todayStr);
              } else if (preset === "lastMonth") {
                const lm = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                const lmEnd = new Date(today.getFullYear(), today.getMonth(), 0);
                setTxDateFrom(lm.toISOString().slice(0, 10));
                setTxDateTo(lmEnd.toISOString().slice(0, 10));
              } else if (preset === "90days") {
                const d90 = new Date(today); d90.setDate(d90.getDate() - 90);
                setTxDateFrom(d90.toISOString().slice(0, 10));
                setTxDateTo(todayStr);
              } else if (preset === "ytd") {
                setTxDateFrom(`${today.getFullYear()}-01-01`);
                setTxDateTo(todayStr);
              } else if (preset === "lastYear") {
                setTxDateFrom(`${today.getFullYear() - 1}-01-01`);
                setTxDateTo(`${today.getFullYear() - 1}-12-31`);
              } else if (preset === "all") {
                setTxDateFrom("2000-01-01");
                setTxDateTo(todayStr);
              }
            };

            // All transactions for date range + selected properties
            const fromDate = new Date(txDateFrom + "T00:00:00");
            const toDate = new Date(txDateTo + "T23:59:59");
            const allTx = TRANSACTIONS.filter(t => {
              const d = new Date(t.date);
              return d >= fromDate && d <= toDate && reportProps.some(p => p.id === t.propertyId);
            });

            // Unique categories
            const categories = [...new Set(allTx.map(t => t.category))].sort();

            // Apply filters
            let filtered = allTx;
            if (txTypeFilter !== "all") filtered = filtered.filter(t => t.type === txTypeFilter);
            if (txCatFilter !== "all") filtered = filtered.filter(t => t.category === txCatFilter);
            if (txSearch.trim()) {
              const q = txSearch.toLowerCase();
              filtered = filtered.filter(t => {
                const propName = PROPERTIES.find(p => p.id === t.propertyId)?.name || "";
                return (t.description || "").toLowerCase().includes(q) ||
                  (t.category || "").toLowerCase().includes(q) ||
                  propName.toLowerCase().includes(q) ||
                  (t.vendor || "").toLowerCase().includes(q);
              });
            }

            // Sort
            const sorted = [...filtered].sort((a, b) => {
              if (txSort === "date-desc") return new Date(b.date) - new Date(a.date);
              if (txSort === "date-asc") return new Date(a.date) - new Date(b.date);
              if (txSort === "amount-desc") return Math.abs(b.amount) - Math.abs(a.amount);
              if (txSort === "amount-asc") return Math.abs(a.amount) - Math.abs(b.amount);
              if (txSort === "property") {
                const aPropName = PROPERTIES.find(p => p.id === a.propertyId)?.name || "";
                const bPropName = PROPERTIES.find(p => p.id === b.propertyId)?.name || "";
                return aPropName.localeCompare(bPropName);
              }
              if (txSort === "category") return (a.category || "").localeCompare(b.category || "");
              return 0;
            });

            // Summary stats
            const totalIncome = filtered.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
            const totalExpenses = filtered.filter(t => t.type === "expense").reduce((s, t) => s + Math.abs(t.amount), 0);
            const netFlow = totalIncome - totalExpenses;

            // Category breakdown
            const catBreakdown = {};
            filtered.forEach(t => {
              const cat = t.category || "Uncategorized";
              if (!catBreakdown[cat]) catBreakdown[cat] = { income: 0, expense: 0, count: 0 };
              catBreakdown[cat].count++;
              if (t.type === "income") catBreakdown[cat].income += t.amount;
              else catBreakdown[cat].expense += Math.abs(t.amount);
            });
            const catRows = Object.entries(catBreakdown).sort((a, b) => (b[1].income + b[1].expense) - (a[1].income + a[1].expense));

            return (
            <div>
              <h2 style={{ color: "var(--text-primary)", fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Transaction Detail</h2>
              <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 16 }}>All transactions for selected date range · Filter by property, type, or category</p>

              {/* Date range row */}
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
                {[
                  { id: "thisMonth", label: "This Month" },
                  { id: "lastMonth", label: "Last Month" },
                  { id: "90days",    label: "Last 90 Days" },
                  { id: "ytd",       label: "Year to Date" },
                  { id: "lastYear",  label: "Last Year" },
                  { id: "all",       label: "All Time" },
                ].map(p => (
                  <button key={p.id} onClick={() => applyPreset(p.id)} style={{ padding: "7px 14px", borderRadius: 8, border: txDatePreset === p.id ? "2px solid #3b82f6" : "1px solid var(--border)", background: txDatePreset === p.id ? "var(--info-tint)" : "var(--surface)", color: txDatePreset === p.id ? "var(--c-blue)" : "var(--text-label)", fontWeight: txDatePreset === p.id ? 700 : 500, fontSize: 12, cursor: "pointer" }}>
                    {p.label}
                  </button>
                ))}
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 8 }}>
                  <input type="date" value={txDateFrom} onChange={e => { setTxDateFrom(e.target.value); setTxDatePreset("custom"); }} style={{ padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 12, color: "var(--text-primary)" }} />
                  <span style={{ color: "var(--text-muted)", fontSize: 12 }}>to</span>
                  <input type="date" value={txDateTo} onChange={e => { setTxDateTo(e.target.value); setTxDatePreset("custom"); }} style={{ padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 12, color: "var(--text-primary)" }} />
                </div>
              </div>

              {/* Summary cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 20 }}>
                {[
                  { label: "Total Income", value: `+${fmt(totalIncome)}`, color: "#1a7a4a", bg: "var(--success-tint)" },
                  { label: "Total Expenses", value: `-${fmt(totalExpenses)}`, color: "#c0392b", bg: "var(--danger-tint)" },
                  { label: "Net Cash Flow", value: `${netFlow >= 0 ? "+" : ""}${fmt(netFlow)}`, color: netFlow >= 0 ? "#1a7a4a" : "#c0392b", bg: "var(--info-tint-alt)" },
                  { label: "Transactions", value: `${filtered.length}`, color: "var(--c-blue)", bg: "var(--info-tint)" },
                ].map((m, i) => (
                  <div key={i} style={{ background: m.bg, borderRadius: 14, padding: "14px 16px", border: "1px solid var(--border-subtle)" }}>
                    <p style={{ color: "var(--text-secondary)", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>{m.label}</p>
                    <p style={{ color: m.color, fontSize: 20, fontWeight: 800 }}>{m.value}</p>
                  </div>
                ))}
              </div>

              {/* Filters */}
              <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
                <div style={{ position: "relative", flex: 1, minWidth: 180 }}>
                  <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                  <input value={txSearch} onChange={e => setTxSearch(e.target.value)} placeholder="Search description, vendor, property..." style={{ width: "100%", padding: "10px 12px 10px 34px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 13, color: "var(--text-primary)", outline: "none" }} />
                </div>
                <select value={txTypeFilter} onChange={e => setTxTypeFilter(e.target.value)} style={{ ...iS, width: 130 }}>
                  <option value="all">All Types</option>
                  <option value="income">Income</option>
                  <option value="expense">Expenses</option>
                </select>
                <select value={txCatFilter} onChange={e => setTxCatFilter(e.target.value)} style={{ ...iS, width: 200 }}>
                  <option value="all">All Categories</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={txSort} onChange={e => setTxSort(e.target.value)} style={{ ...iS, width: 160 }}>
                  <option value="date-desc">Newest First</option>
                  <option value="date-asc">Oldest First</option>
                  <option value="amount-desc">Largest Amount</option>
                  <option value="amount-asc">Smallest Amount</option>
                  <option value="property">By Property</option>
                  <option value="category">By Category</option>
                </select>
              </div>

              {/* Transaction table */}
              <div style={{ overflowX: "auto", marginBottom: 24 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
                  <thead>
                    <tr>
                      {["Date", "Property", "Category", "Description", "Type", "Amount"].map(h => (
                        <th key={h} style={{ ...thStyle, textAlign: h === "Amount" ? "right" : "left" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.length === 0 ? (
                      <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>No transactions match your filters</td></tr>
                    ) : sorted.slice(0, 200).map((t, i) => {
                      const isIncome = t.type === "income";
                      return (
                        <tr key={t.id || i} style={{ background: i % 2 === 0 ? "var(--surface)" : "var(--surface-alt)" }}>
                          <td style={{ ...tdStyle, fontSize: 12, whiteSpace: "nowrap" }}>{new Date(t.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
                          <td style={{ ...tdStyle, fontSize: 12 }}>
                            <span style={{ fontWeight: 600 }}>{(PROPERTIES.find(p => p.id === t.propertyId)?.name || "Unknown").split(" ").slice(0, 2).join(" ")}</span>
                          </td>
                          <td style={tdStyle}>
                            <span style={{ fontSize: 11, fontWeight: 600, borderRadius: 6, padding: "3px 8px", background: isIncome ? "var(--success-badge)" : "var(--danger-badge)", color: isIncome ? "#1a7a4a" : "#c0392b" }}>{t.category}</span>
                          </td>
                          <td style={{ ...tdStyle, fontSize: 12, color: "var(--text-label)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.description || t.vendor || "—"}</td>
                          <td style={tdStyle}>
                            <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: isIncome ? "#1a7a4a" : "#c0392b" }}>{t.type}</span>
                          </td>
                          <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700, color: isIncome ? "#1a7a4a" : "#c0392b", whiteSpace: "nowrap" }}>
                            {isIncome ? "+" : "-"}{fmt(Math.abs(t.amount))}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {sorted.length > 0 && (
                    <tfoot>
                      <tr style={{ background: "var(--info-tint-alt)", borderTop: "2px solid var(--info-border-alt)" }}>
                        <td colSpan={5} style={{ ...tdStyle, fontWeight: 800, color: "#0c4a6e" }}>
                          {sorted.length > 200 ? `Showing 200 of ${sorted.length}` : `${sorted.length} transaction${sorted.length !== 1 ? "s" : ""}`}
                        </td>
                        <td style={{ ...tdStyle, textAlign: "right", fontWeight: 800, color: netFlow >= 0 ? "#1a7a4a" : "#c0392b" }}>
                          {netFlow >= 0 ? "+" : ""}{fmt(netFlow)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {/* Category Breakdown */}
              {catRows.length > 0 && (
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>Category Breakdown</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
                    {catRows.map(([cat, data]) => {
                      const total = data.income + data.expense;
                      const isIncomeCat = data.income > data.expense;
                      return (
                        <div key={cat} style={{ background: "var(--surface-alt)", borderRadius: 12, padding: "12px 14px", border: "1px solid var(--border-subtle)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                            <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>{cat}</p>
                            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", background: "var(--surface-muted)", borderRadius: 6, padding: "2px 6px" }}>{data.count}</span>
                          </div>
                          {data.income > 0 && <p style={{ fontSize: 13, fontWeight: 700, color: "#1a7a4a" }}>+{fmt(data.income)}</p>}
                          {data.expense > 0 && <p style={{ fontSize: 13, fontWeight: 700, color: "#c0392b" }}>-{fmt(data.expense)}</p>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            );
          })()}

        </div>
      </div>
    </div>
  );
}
