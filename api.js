// =============================================================================
// PropBooks API Service Layer — updated 2026-04-06
// =============================================================================
// All data access goes through this file. Right now every function returns
// mock data. When you add a backend (Supabase, etc.) swap the implementation
// here — no component code needs to change.
//
// Pattern for each function:
//   export async function getThings() {
//     // TODO: replace with → return await supabase.from('things').select()
//     return mockThings;
//   }
// =============================================================================

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------
export const newId = () => Date.now() + Math.floor(Math.random() * 1000);

export const fmt  = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

export const fmtK = (n) =>
  n >= 1000000 ? `$${(n / 1000000).toFixed(1)}M` : `$${(n / 1000).toFixed(0)}K`;

// -----------------------------------------------------------------------------
// Constants (move to DB config table later)
// -----------------------------------------------------------------------------
export const PROP_COLORS  = ["#3b82f6","#10b981","#8b5cf6","#e95e00","#ef4444","#06b6d4","#ec4899"];
export const DEAL_COLORS  = ["#e95e00","#10b981","#8b5cf6","#3b82f6","#ef4444","#06b6d4"];
export const STAGE_ORDER  = ["Under Contract","Active Rehab","Listed","Sold","Converted to Rental"];
export const STAGE_COLORS = {
  "Under Contract":       { bg: "#ede9fe", text: "#6d28d9", dot: "#8b5cf6" },
  "Active Rehab":         { bg: "#fff7ed", text: "#9a3412", dot: "#e95e00" },
  "Listed":               { bg: "#dbeafe", text: "#1d4ed8", dot: "#3b82f6" },
  "Sold":                 { bg: "#dcfce7", text: "#15803d", dot: "#10b981" },
  "Converted to Rental":  { bg: "#f0f9ff", text: "#0369a1", dot: "#0ea5e9" },
};
// -----------------------------------------------------------------------------
// Rehab Categories — canonical taxonomy used by the rehab scope typeahead and
// by cross-deal benchmarking. Each item has a slug (stable), a label (display),
// and a group (for section headers in the dropdown). Users can still type any
// free-text category; canonical entries just get better analytics treatment.
// -----------------------------------------------------------------------------
export const REHAB_CATEGORIES = [
  // Demo & Prep
  { slug: "demo",                 label: "Demo & Debris Removal",   group: "Demo & Prep" },
  { slug: "dumpster",              label: "Dumpster / Haul-Off",     group: "Demo & Prep" },
  { slug: "permits",               label: "Permits & Fees",          group: "Demo & Prep" },

  // Structural
  { slug: "foundation",            label: "Foundation / Concrete",   group: "Structural" },
  { slug: "framing",               label: "Framing & Structural",    group: "Structural" },
  { slug: "insulation",            label: "Insulation",              group: "Structural" },
  { slug: "drywall",               label: "Drywall",                 group: "Structural" },

  // Exterior
  { slug: "roof",                  label: "Roof",                    group: "Exterior" },
  { slug: "siding",                label: "Siding / Stucco",         group: "Exterior" },
  { slug: "windows",               label: "Windows",                 group: "Exterior" },
  { slug: "exterior-doors",        label: "Exterior Doors",          group: "Exterior" },
  { slug: "exterior-paint",        label: "Exterior Paint",          group: "Exterior" },
  { slug: "gutters",               label: "Gutters & Downspouts",    group: "Exterior" },

  // Mechanicals
  { slug: "plumbing",              label: "Plumbing",                group: "Mechanicals" },
  { slug: "electrical",            label: "Electrical",              group: "Mechanicals" },
  { slug: "hvac",                  label: "HVAC",                    group: "Mechanicals" },
  { slug: "water-heater",          label: "Water Heater",            group: "Mechanicals" },

  // Kitchen
  { slug: "kitchen-cabinets",      label: "Kitchen Cabinets",        group: "Kitchen" },
  { slug: "kitchen-countertops",   label: "Kitchen Countertops",     group: "Kitchen" },
  { slug: "kitchen-appliances",    label: "Kitchen Appliances",      group: "Kitchen" },
  { slug: "kitchen-backsplash",    label: "Kitchen Backsplash",      group: "Kitchen" },

  // Bathrooms
  { slug: "bath-vanity",           label: "Bathroom Vanity",         group: "Bathrooms" },
  { slug: "bath-tub-shower",       label: "Tub / Shower",            group: "Bathrooms" },
  { slug: "bath-tile",             label: "Bathroom Tile",           group: "Bathrooms" },
  { slug: "bath-fixtures",         label: "Bathroom Fixtures",       group: "Bathrooms" },

  // Interior Finishes
  { slug: "flooring",              label: "Flooring",                group: "Interior Finishes" },
  { slug: "interior-paint",        label: "Interior Paint",          group: "Interior Finishes" },
  { slug: "interior-doors",        label: "Interior Doors",          group: "Interior Finishes" },
  { slug: "trim",                  label: "Trim & Millwork",         group: "Interior Finishes" },
  { slug: "lighting",              label: "Lighting Fixtures",       group: "Interior Finishes" },

  // Exterior Site
  { slug: "landscaping",           label: "Landscaping",             group: "Site & Exterior" },
  { slug: "driveway",              label: "Driveway / Walkways",     group: "Site & Exterior" },
  { slug: "fencing",               label: "Fencing",                 group: "Site & Exterior" },

  // Soft Costs
  { slug: "staging",               label: "Staging",                 group: "Soft Costs" },
  { slug: "cleaning",              label: "Final Clean",             group: "Soft Costs" },
  { slug: "contingency",           label: "Contingency",             group: "Soft Costs" },
];

export const REHAB_CATEGORY_GROUPS = [
  "Demo & Prep", "Structural", "Exterior", "Mechanicals",
  "Kitchen", "Bathrooms", "Interior Finishes", "Site & Exterior", "Soft Costs",
];

export const getCanonicalBySlug   = (slug)  => REHAB_CATEGORIES.find(c => c.slug === slug) || null;
export const getCanonicalByLabel  = (label) => {
  if (!label) return null;
  const q = label.trim().toLowerCase();
  return REHAB_CATEGORIES.find(c => c.label.toLowerCase() === q) || null;
};

// -----------------------------------------------------------------------------
// Rehab Templates — one-click starter scopes for new deals. Each template is a
// list of canonical slugs plus an optional suggested budget (user adjusts).
// -----------------------------------------------------------------------------
export const REHAB_TEMPLATES = [
  {
    id: "cosmetic",
    name: "Light Cosmetic",
    description: "Paint, flooring, fixtures, minor kitchen/bath refresh. Best for $20-40K rehabs.",
    items: [
      { slug: "interior-paint",     budgeted: 3500 },
      { slug: "flooring",           budgeted: 6000 },
      { slug: "kitchen-cabinets",   budgeted: 3500 },
      { slug: "kitchen-countertops",budgeted: 2500 },
      { slug: "kitchen-appliances", budgeted: 2500 },
      { slug: "bath-vanity",        budgeted: 1200 },
      { slug: "bath-fixtures",      budgeted: 800  },
      { slug: "lighting",           budgeted: 1200 },
      { slug: "cleaning",           budgeted: 500  },
      { slug: "contingency",        budgeted: 2500 },
    ],
  },
  {
    id: "standard",
    name: "Standard Flip",
    description: "Full interior refresh including kitchen and bath remodels. Best for $50-90K rehabs.",
    items: [
      { slug: "demo",                budgeted: 3000 },
      { slug: "dumpster",            budgeted: 1500 },
      { slug: "permits",             budgeted: 1500 },
      { slug: "plumbing",            budgeted: 4500 },
      { slug: "electrical",          budgeted: 3500 },
      { slug: "hvac",                budgeted: 4500 },
      { slug: "drywall",             budgeted: 3500 },
      { slug: "interior-paint",      budgeted: 4500 },
      { slug: "flooring",            budgeted: 8500 },
      { slug: "kitchen-cabinets",    budgeted: 6500 },
      { slug: "kitchen-countertops", budgeted: 3500 },
      { slug: "kitchen-appliances",  budgeted: 3000 },
      { slug: "bath-vanity",         budgeted: 1800 },
      { slug: "bath-tub-shower",     budgeted: 2800 },
      { slug: "bath-tile",           budgeted: 2200 },
      { slug: "trim",                budgeted: 2500 },
      { slug: "lighting",            budgeted: 1500 },
      { slug: "exterior-paint",      budgeted: 3500 },
      { slug: "landscaping",         budgeted: 1500 },
      { slug: "cleaning",            budgeted: 700  },
      { slug: "contingency",         budgeted: 5000 },
    ],
  },
  {
    id: "gut",
    name: "Full Gut Rehab",
    description: "Down-to-studs rebuild: mechanicals, structural, full finish. Best for $100K+ rehabs.",
    items: [
      { slug: "demo",                budgeted: 8000 },
      { slug: "dumpster",            budgeted: 3500 },
      { slug: "permits",             budgeted: 3500 },
      { slug: "foundation",          budgeted: 6000 },
      { slug: "framing",             budgeted: 7500 },
      { slug: "roof",                budgeted: 9500 },
      { slug: "siding",              budgeted: 8500 },
      { slug: "windows",             budgeted: 6500 },
      { slug: "exterior-doors",      budgeted: 1800 },
      { slug: "exterior-paint",      budgeted: 4500 },
      { slug: "plumbing",            budgeted: 9500 },
      { slug: "electrical",          budgeted: 8500 },
      { slug: "hvac",                budgeted: 7500 },
      { slug: "water-heater",        budgeted: 1500 },
      { slug: "insulation",          budgeted: 2800 },
      { slug: "drywall",             budgeted: 6500 },
      { slug: "interior-paint",      budgeted: 5500 },
      { slug: "flooring",            budgeted: 11000 },
      { slug: "kitchen-cabinets",    budgeted: 9500 },
      { slug: "kitchen-countertops", budgeted: 4500 },
      { slug: "kitchen-appliances",  budgeted: 4000 },
      { slug: "kitchen-backsplash",  budgeted: 1500 },
      { slug: "bath-vanity",         budgeted: 2800 },
      { slug: "bath-tub-shower",     budgeted: 3800 },
      { slug: "bath-tile",           budgeted: 3500 },
      { slug: "bath-fixtures",       budgeted: 1500 },
      { slug: "interior-doors",      budgeted: 2500 },
      { slug: "trim",                budgeted: 4500 },
      { slug: "lighting",            budgeted: 2500 },
      { slug: "landscaping",         budgeted: 3500 },
      { slug: "driveway",            budgeted: 3500 },
      { slug: "cleaning",            budgeted: 1200 },
      { slug: "contingency",         budgeted: 10000 },
    ],
  },
  {
    id: "kitchen-bath",
    name: "Kitchen + Baths Only",
    description: "Targeted upgrade of kitchen and bathrooms. Best for properties with solid bones.",
    items: [
      { slug: "demo",                budgeted: 2500 },
      { slug: "plumbing",            budgeted: 3500 },
      { slug: "electrical",          budgeted: 1800 },
      { slug: "kitchen-cabinets",    budgeted: 7500 },
      { slug: "kitchen-countertops", budgeted: 3800 },
      { slug: "kitchen-appliances",  budgeted: 3500 },
      { slug: "kitchen-backsplash",  budgeted: 1200 },
      { slug: "bath-vanity",         budgeted: 2200 },
      { slug: "bath-tub-shower",     budgeted: 3200 },
      { slug: "bath-tile",           budgeted: 2800 },
      { slug: "bath-fixtures",       budgeted: 1200 },
      { slug: "lighting",            budgeted: 1500 },
      { slug: "interior-paint",      budgeted: 2500 },
      { slug: "contingency",         budgeted: 3500 },
    ],
  },
];

export const DEFAULT_MILESTONES = [
  "Contract Executed","Inspection Complete","Financing Secured",
  "Purchased / Closed","Demo Complete","Rough-In (Plumbing/Electric)",
  "Drywall","Paint","Flooring","Kitchen & Baths","Punch List",
  "Listed for Sale","Under Contract","Sold / Closed",
];

// -----------------------------------------------------------------------------
// Mock Data
// -----------------------------------------------------------------------------



export const DEALS = [
  {
    id:1, name:"Oakdale Craftsman", address:"1422 Oakdale Ave, Nashville, TN 37206",
    stage:"Active Rehab", image:"OC", color:"#f59e0b",
    purchasePrice:195000, arv:310000, arvUpdatedAt:"2026-01-08", rehabBudget:62000, rehabSpent:38500,
    holdingCostsPerMonth:1850, acquisitionDate:"2026-01-08", rehabStartDate:"2026-01-20",
    projectedListDate:"2026-04-15", projectedCloseDate:"2026-05-30", daysOwned:75,
    sellingCostPct:6,
    createdAt:"2026-01-08T09:00:00Z", updatedAt:"2026-01-08T09:00:00Z", userId:"usr_001",
    rehabItems:[
      { category:"Kitchen",          budgeted:18000, spent:16200, status:"complete",    contractors:[]  },
      { category:"Bathrooms (2)",    budgeted:12000, spent:11500, status:"complete",    contractors:[{id:1, bid:8500}] },
      { category:"Flooring",         budgeted:8500,  spent:5200,  status:"in-progress", contractors:[]  },
      { category:"Roof",             budgeted:9500,  spent:5600,  status:"in-progress", contractors:[]  },
      { category:"Exterior / Paint", budgeted:6000,  spent:0,     status:"pending",     contractors:[]  },
      { category:"HVAC",             budgeted:5500,  spent:0,     status:"pending",     contractors:[]  },
      { category:"Landscaping",      budgeted:2500,  spent:0,     status:"pending",     contractors:[]  },
    ],
  },
  {
    id:2, name:"Pine Street Ranch", address:"874 Pine Street, Memphis, TN 38104",
    stage:"Listed", image:"PS", color:"#10b981",
    purchasePrice:148000, arv:229000, arvUpdatedAt:"2026-01-15", listPrice:229000, rehabBudget:38000, rehabSpent:39200,
    holdingCostsPerMonth:1420, acquisitionDate:"2025-10-14", rehabStartDate:"2025-10-28",
    rehabEndDate:"2026-01-15", listDate:"2026-01-22", daysOwned:161,
    sellingCostPct:6,
    createdAt:"2025-10-14T09:00:00Z", updatedAt:"2025-10-14T09:00:00Z", userId:"usr_001",
    rehabItems:[
      { category:"Kitchen",          budgeted:14000, spent:15200, status:"complete", contractors:[]    },
      { category:"Bathroom",         budgeted:7000,  spent:7400,  status:"complete", contractors:[]    },
      { category:"Flooring",         budgeted:6500,  spent:6800,  status:"complete", contractors:[{id:4, bid:3900}]   },
      { category:"Windows",          budgeted:5500,  spent:5400,  status:"complete", contractors:[{id:5, bid:5400}]   },
      { category:"Electrical",       budgeted:3000,  spent:3100,  status:"complete", contractors:[]    },
      { category:"Exterior / Paint", budgeted:2000,  spent:1300,  status:"complete", contractors:[]    },
    ],
  },
  {
    id:3, name:"Hawthorne Heights", address:"3305 Hawthorne Blvd, Charlotte, NC 28205",
    stage:"Under Contract", image:"HH", color:"#8b5cf6",
    purchasePrice:268000, arv:445000, arvUpdatedAt:"2026-03-10", rehabBudget:95000, rehabSpent:0,
    holdingCostsPerMonth:2600, contractDate:"2026-03-10", projectedCloseDate:"2026-04-05", daysOwned:0,
    sellingCostPct:6,
    createdAt:"2026-03-10T09:00:00Z", updatedAt:"2026-03-10T09:00:00Z", userId:"usr_001",
    rehabItems:[
      { category:"Full Kitchen Remodel",   budgeted:28000, spent:0, status:"pending", contractors:[] },
      { category:"Master Bath",            budgeted:18000, spent:0, status:"pending", contractors:[] },
      { category:"Secondary Baths (2)",    budgeted:14000, spent:0, status:"pending", contractors:[] },
      { category:"Addition / Expansion",   budgeted:22000, spent:0, status:"pending", contractors:[] },
      { category:"Flooring",               budgeted:8000,  spent:0, status:"pending", contractors:[] },
      { category:"Roof & Gutters",         budgeted:5000,  spent:0, status:"pending", contractors:[] },
    ],
  },
  {
    id:4, name:"Birchwood Colonial", address:"612 Birchwood Lane, Raleigh, NC 27601",
    stage:"Sold", image:"BC", color:"#6b7280",
    purchasePrice:220000, arv:358000, salePrice:361500, rehabBudget:55000, rehabSpent:52800,
    holdingCostsPerMonth:2100, acquisitionDate:"2025-04-12", rehabStartDate:"2025-04-25",
    rehabEndDate:"2025-07-10", listDate:"2025-07-18", closeDate:"2025-08-29",
    daysOwned:139, totalHoldingCosts:9730, sellingCosts:21690, netProfit:61280,
    sellingCostPct:6,
    createdAt:"2025-04-12T09:00:00Z", updatedAt:"2025-04-12T09:00:00Z", userId:"usr_001",
    rehabItems:[
      { category:"Kitchen",          budgeted:16000, spent:15600, status:"complete", contractors:[] },
      { category:"Bathrooms (2)",    budgeted:13000, spent:12400, status:"complete", contractors:[] },
      { category:"Basement Finish",  budgeted:12000, spent:11800, status:"complete", contractors:[] },
      { category:"HVAC",             budgeted:7500,  spent:7200,  status:"complete", contractors:[{id:6, bid:7200}] },
      { category:"Flooring",         budgeted:4500,  spent:4300,  status:"complete", contractors:[] },
      { category:"Exterior",         budgeted:2000,  spent:1500,  status:"complete", contractors:[] },
    ],
  },
];

export const DEAL_EXPENSES = [
  { id:1,  dealId:1, date:"2026-03-18", vendor:"Home Depot",        contractorId:null, category:"Materials & Supplies",     description:"Hardwood flooring - 680 sqft",        amount:2890, createdAt:"2026-03-18T11:00:00Z", updatedAt:"2026-03-18T11:00:00Z", userId:"usr_001" },
  { id:2,  dealId:1, date:"2026-03-15", vendor:"ABC Plumbing",      contractorId:1,    bidId:101, category:"Subcontractor",            description:"Master bath rough-in",                amount:3200, createdAt:"2026-03-15T09:30:00Z", updatedAt:"2026-03-15T09:30:00Z", userId:"usr_001" },
  { id:3,  dealId:1, date:"2026-03-10", vendor:"Lowe's",            contractorId:null, category:"Fixtures & Hardware",      description:"Kitchen cabinet hardware + fixtures", amount:640,  createdAt:"2026-03-10T10:00:00Z", updatedAt:"2026-03-10T10:00:00Z", userId:"usr_001" },
  { id:4,  dealId:1, date:"2026-03-04", vendor:"City of Nashville", contractorId:null, category:"Permits",                  description:"Renovation permit",                   amount:380,  createdAt:"2026-03-04T14:00:00Z", updatedAt:"2026-03-04T14:00:00Z", userId:"usr_001" },
  { id:5,  dealId:1, date:"2026-02-28", vendor:"Elite Electric",    contractorId:2,    bidId:103, category:"Subcontractor",            description:"Panel upgrade + recessed lighting",   amount:4100, createdAt:"2026-02-28T09:00:00Z", updatedAt:"2026-02-28T09:00:00Z", userId:"usr_001" },
  { id:6,  dealId:1, date:"2026-02-20", vendor:"Lowe's",            contractorId:null, category:"Materials & Supplies",     description:"Kitchen cabinets - shaker style",     amount:5800, createdAt:"2026-02-20T10:30:00Z", updatedAt:"2026-02-20T10:30:00Z", userId:"usr_001" },
  { id:7,  dealId:1, date:"2026-02-14", vendor:"Budget Dumpster",   contractorId:null, category:"Dumpster / Debris Removal",description:"Demo debris removal",                 amount:420,  createdAt:"2026-02-14T08:30:00Z", updatedAt:"2026-02-14T08:30:00Z", userId:"usr_001" },
  { id:8,  dealId:2, date:"2026-01-12", vendor:"Sherwin-Williams",  contractorId:null, category:"Materials & Supplies",     description:"Interior/exterior paint + supplies",  amount:1150, createdAt:"2026-01-12T11:00:00Z", updatedAt:"2026-01-12T11:00:00Z", userId:"usr_001" },
  { id:9,  dealId:2, date:"2026-01-08", vendor:"Pro Flooring Co.",  contractorId:4,    bidId:105, category:"Subcontractor",            description:"LVP install - 1,100 sqft",            amount:3900, createdAt:"2026-01-08T09:00:00Z", updatedAt:"2026-01-08T09:00:00Z", userId:"usr_001" },
  { id:10, dealId:2, date:"2025-12-20", vendor:"Home Depot",        contractorId:null, category:"Appliances",               description:"Stainless appliance package",         amount:2400, createdAt:"2025-12-20T10:30:00Z", updatedAt:"2025-12-20T10:30:00Z", userId:"usr_001" },
  { id:11, dealId:2, date:"2025-12-10", vendor:"Jim's Windows",     contractorId:5,    bidId:107, category:"Subcontractor",            description:"Replace 8 windows",                   amount:5400, createdAt:"2025-12-10T09:00:00Z", updatedAt:"2025-12-10T09:00:00Z", userId:"usr_001" },
  { id:12, dealId:2, date:"2025-11-18", vendor:"City of Memphis",   contractorId:null, category:"Permits",                  description:"Electrical & structural permits",      amount:295,  createdAt:"2025-11-18T15:00:00Z", updatedAt:"2025-11-18T15:00:00Z", userId:"usr_001" },
  { id:13, dealId:4, date:"2025-07-02", vendor:"Summit HVAC",       contractorId:6,    bidId:108, category:"Subcontractor",            description:"Full HVAC replacement",               amount:7200, createdAt:"2025-07-02T09:00:00Z", updatedAt:"2025-07-02T09:00:00Z", userId:"usr_001" },
  { id:14, dealId:4, date:"2025-06-15", vendor:"Habitat Flooring",  contractorId:null, category:"Materials & Supplies",     description:"Engineered hardwood - whole house",   amount:4300, createdAt:"2025-06-15T10:00:00Z", updatedAt:"2025-06-15T10:00:00Z", userId:"usr_001" },
  { id:15, dealId:4, date:"2025-06-01", vendor:"Raleigh Tile Co.",  contractorId:null, category:"Subcontractor",            description:"Master bath tile work",               amount:3100, createdAt:"2025-06-01T10:00:00Z", updatedAt:"2025-06-01T10:00:00Z", userId:"usr_001" },
  // Partial payment on the $8500 plumbing bid; together with row 2 ($3200 on
  // 2026-03-15) totals $6400 / $8500 = 75% paid against bid 101.
  { id:16, dealId:1, date:"2026-02-15", vendor:"ABC Plumbing",     contractorId:1, bidId:101, category:"Subcontractor", description:"Progress payment — rough-in complete", amount:3200, status:"paid", createdAt:"2026-02-15T09:00:00Z", updatedAt:"2026-02-15T09:00:00Z", userId:"usr_001" },
];

export const CONTRACTORS = [
  { id:1, name:"ABC Plumbing",    trade:"Plumbing",   phone:"615-555-0182", email:"info@abcplumbing.com",  license:"PL-2024-1847", insuranceExpiry:"2027-03-15", rating:4, notes:"Reliable, occasionally runs a day behind schedule.", dealIds:[1,3], createdAt:"2026-01-08T09:00:00Z", updatedAt:"2026-01-08T09:00:00Z", userId:"usr_001" },
  { id:2, name:"Elite Electric",  trade:"Electrical", phone:"615-555-0247", email:"mike@eliteelectric.com", license:"EL-2023-9921", insuranceExpiry:"2026-11-30", rating:5, notes:"Top-notch work, always on schedule.", dealIds:[1], createdAt:"2026-01-08T09:00:00Z", updatedAt:"2026-01-08T09:00:00Z", userId:"usr_001" },
  { id:3, name:"Nash Drywall",    trade:"Drywall",    phone:"615-555-0318", email:"nashdrywalltn@gmail.com", license:null, insuranceExpiry:"2027-01-10", rating:3, notes:"Good quality but communication could improve.", dealIds:[1], createdAt:"2026-01-08T09:00:00Z", updatedAt:"2026-01-08T09:00:00Z", userId:"usr_001" },
  { id:4, name:"Pro Flooring Co.", trade:"Flooring",  phone:"901-555-0144", email:"quotes@proflooring.com", license:"FL-2025-0033", insuranceExpiry:"2027-06-01", rating:4, notes:"", dealIds:[1,2], createdAt:"2025-11-15T09:00:00Z", updatedAt:"2025-11-15T09:00:00Z", userId:"usr_001" },
  { id:5, name:"Jim's Windows",   trade:"Windows",    phone:"901-555-0229", email:"jim@jimswindows.com", license:"WD-2024-4412", insuranceExpiry:"2026-09-15", rating:5, notes:"Family-owned, excellent craftsmanship.", dealIds:[2], createdAt:"2025-11-15T09:00:00Z", updatedAt:"2025-11-15T09:00:00Z", userId:"usr_001" },
  { id:6, name:"Summit HVAC",     trade:"HVAC",       phone:"919-555-0361", email:"service@summithvac.com", license:"HVAC-2023-7710", insuranceExpiry:"2026-12-31", rating:4, notes:"", dealIds:[4], createdAt:"2025-06-10T09:00:00Z", updatedAt:"2025-06-10T09:00:00Z", userId:"usr_001" },
];

export const CONTRACTOR_BIDS = [
  { id:101, contractorId:1, dealId:1, rehabItem:"Rough-In (Plumbing)", amount:8500, status:"accepted", date:"2026-01-10", createdAt:"2026-01-10T10:00:00Z", updatedAt:"2026-01-10T10:00:00Z", userId:"usr_001" },
  { id:102, contractorId:1, dealId:3, rehabItem:"Plumbing",             amount:6200, status:"pending",  date:"2026-03-15", createdAt:"2026-03-15T10:00:00Z", updatedAt:"2026-03-15T10:00:00Z", userId:"usr_001" },
  { id:103, contractorId:2, dealId:1, rehabItem:"Electrical Rough-In", amount:4100, status:"accepted", date:"2026-01-08", createdAt:"2026-01-08T09:00:00Z", updatedAt:"2026-01-08T09:00:00Z", userId:"usr_001" },
  { id:104, contractorId:3, dealId:1, rehabItem:"Drywall", amount:3800, status:"pending", date:"2026-02-20", createdAt:"2026-02-20T10:00:00Z", updatedAt:"2026-02-20T10:00:00Z", userId:"usr_001" },
  { id:105, contractorId:4, dealId:2, rehabItem:"Flooring", amount:3900, status:"accepted", date:"2025-12-01", createdAt:"2025-12-01T09:00:00Z", updatedAt:"2025-12-01T09:00:00Z", userId:"usr_001" },
  { id:106, contractorId:4, dealId:1, rehabItem:"Flooring",  amount:4200, status:"pending",  date:"2026-03-01", createdAt:"2026-03-01T10:00:00Z", updatedAt:"2026-03-01T10:00:00Z", userId:"usr_001" },
  { id:107, contractorId:5, dealId:2, rehabItem:"Windows & Doors", amount:5400, status:"accepted", date:"2025-11-15", createdAt:"2025-11-15T09:00:00Z", updatedAt:"2025-11-15T09:00:00Z", userId:"usr_001" },
  { id:108, contractorId:6, dealId:4, rehabItem:"HVAC Replacement", amount:7200, status:"accepted", date:"2025-06-10", createdAt:"2025-06-10T09:00:00Z", updatedAt:"2025-06-10T09:00:00Z", userId:"usr_001" },
];

export const CONTRACTOR_DOCUMENTS = [
  { id:301, contractorId:1, name:"W-9 (2026)",         type:"w9",        dealId:null, date:"2026-01-02", size:"42 KB", createdAt:"2026-01-02T10:00:00Z", updatedAt:"2026-01-02T10:00:00Z", userId:"usr_001" },
  { id:302, contractorId:1, name:"Insurance Certificate", type:"insurance", dealId:null, date:"2026-01-05", size:"128 KB", createdAt:"2026-01-05T10:00:00Z", updatedAt:"2026-01-05T10:00:00Z", userId:"usr_001" },
  { id:303, contractorId:1, name:"Plumbing Contract — Oakdale", type:"contract", dealId:1, date:"2026-01-10", size:"84 KB", createdAt:"2026-01-10T10:00:00Z", updatedAt:"2026-01-10T10:00:00Z", userId:"usr_001" },
  { id:304, contractorId:2, name:"W-9 (2026)", type:"w9", dealId:null, date:"2026-01-03", size:"38 KB", createdAt:"2026-01-03T10:00:00Z", updatedAt:"2026-01-03T10:00:00Z", userId:"usr_001" },
  { id:305, contractorId:6, name:"HVAC Warranty Certificate", type:"warranty", dealId:4, date:"2025-08-20", size:"56 KB", createdAt:"2025-08-20T09:00:00Z", updatedAt:"2025-08-20T09:00:00Z", userId:"usr_001" },
];

// ── Property-level documents (leases, inspections, insurance, etc.) ──
export const PROPERTY_DOCUMENTS = [
  { id: 401, propertyId: 1, name: "Lease Agreement — Unit A", type: "lease", mimeType: "application/pdf", size: "1.2 MB", date: "2024-02-01", url: null, createdAt: "2024-02-01T10:00:00Z", updatedAt: "2024-02-01T10:00:00Z", userId: "usr_001" },
  { id: 402, propertyId: 1, name: "Home Inspection Report", type: "inspection", mimeType: "application/pdf", size: "3.8 MB", date: "2023-06-15", url: null, createdAt: "2023-06-15T10:00:00Z", updatedAt: "2023-06-15T10:00:00Z", userId: "usr_001" },
  { id: 403, propertyId: 2, name: "Property Insurance Policy", type: "insurance", mimeType: "application/pdf", size: "892 KB", date: "2026-01-10", url: null, createdAt: "2026-01-10T10:00:00Z", updatedAt: "2026-01-10T10:00:00Z", userId: "usr_001" },
  { id: 404, propertyId: 4, name: "Lease Agreement — Unit 1", type: "lease", mimeType: "application/pdf", size: "1.1 MB", date: "2024-09-01", url: null, createdAt: "2024-09-01T10:00:00Z", updatedAt: "2024-09-01T10:00:00Z", userId: "usr_001" },
  { id: 405, propertyId: 5, name: "NNN Lease — Pacific Rim", type: "lease", mimeType: "application/pdf", size: "2.4 MB", date: "2023-01-01", url: null, createdAt: "2023-01-01T10:00:00Z", updatedAt: "2023-01-01T10:00:00Z", userId: "usr_001" },
];

// ── Deal-level documents (contracts, scope docs, closing statements) ──
export const DEAL_DOCUMENTS = [
  { id: 501, dealId: 1, name: "Purchase Agreement — Oakdale", type: "contract", mimeType: "application/pdf", size: "1.5 MB", date: "2026-01-06", url: null, createdAt: "2026-01-06T10:00:00Z", updatedAt: "2026-01-06T10:00:00Z", userId: "usr_001" },
  { id: 502, dealId: 1, name: "Scope of Work — Full Rehab", type: "scope", mimeType: "application/pdf", size: "680 KB", date: "2026-01-08", url: null, createdAt: "2026-01-08T10:00:00Z", updatedAt: "2026-01-08T10:00:00Z", userId: "usr_001" },
  { id: 503, dealId: 2, name: "Closing Statement — Pine Street", type: "closing", mimeType: "application/pdf", size: "420 KB", date: "2025-10-14", url: null, createdAt: "2025-10-14T10:00:00Z", updatedAt: "2025-10-14T10:00:00Z", userId: "usr_001" },
  { id: 504, dealId: 4, name: "Appraisal Report — Biltmore", type: "appraisal", mimeType: "application/pdf", size: "2.1 MB", date: "2025-04-05", url: null, createdAt: "2025-04-05T10:00:00Z", updatedAt: "2025-04-05T10:00:00Z", userId: "usr_001" },
];

// ── Tenant-level documents (applications, IDs, lease addenda) ──
export const TENANT_DOCUMENTS = [
  { id: 601, tenantId: 1, name: "Rental Application — Williams", type: "application", mimeType: "application/pdf", size: "340 KB", date: "2024-01-15", url: null, createdAt: "2024-01-15T10:00:00Z", updatedAt: "2024-01-15T10:00:00Z", userId: "usr_001" },
  { id: 602, tenantId: 3, name: "Pet Addendum — Kowalski", type: "addendum", mimeType: "application/pdf", size: "180 KB", date: "2024-06-01", url: null, createdAt: "2024-06-01T10:00:00Z", updatedAt: "2024-06-01T10:00:00Z", userId: "usr_001" },
  { id: 603, tenantId: 8, name: "Commercial Lease Addendum", type: "addendum", mimeType: "application/pdf", size: "520 KB", date: "2025-01-01", url: null, createdAt: "2025-01-01T10:00:00Z", updatedAt: "2025-01-01T10:00:00Z", userId: "usr_001" },
];

// ── Maintenance requests ──
export const MAINTENANCE_REQUESTS = [
  { id: 4001, tenantId: 2, propertyId: 1, title: "Kitchen drain running slow", description: "Slow drain in kitchen sink, getting worse over last week", priority: "medium", status: "scheduled", createdAt: "2026-03-30T10:00:00Z", scheduledDate: "2026-04-02", resolvedDate: null, cost: null, vendor: "Mike's Plumbing" },
  { id: 4002, tenantId: 3, propertyId: 2, title: "Garage door opener not working", description: "Remote stopped opening the garage door. Tried new batteries.", priority: "low", status: "open", createdAt: "2026-03-28T14:00:00Z", scheduledDate: null, resolvedDate: null, cost: null, vendor: null },
  { id: 4003, tenantId: 4, propertyId: 3, title: "HVAC not cooling", description: "AC running but not cooling below 78°F. Filter was replaced last month.", priority: "high", status: "resolved", createdAt: "2026-03-10T08:00:00Z", scheduledDate: "2026-03-11", resolvedDate: "2026-03-12", cost: 420, vendor: "AirPro HVAC Services" },
  { id: 4004, tenantId: 5, propertyId: 4, title: "Leaky faucet in master bath", description: "Hot water faucet drips constantly", priority: "low", status: "resolved", createdAt: "2026-02-20T09:00:00Z", scheduledDate: "2026-02-25", resolvedDate: "2026-02-25", cost: 150, vendor: "Mike's Plumbing" },
  { id: 4005, tenantId: 1, propertyId: 1, title: "Smoke detector beeping", description: "Smoke detector in hallway beeping intermittently", priority: "medium", status: "resolved", createdAt: "2026-02-15T07:00:00Z", scheduledDate: "2026-02-16", resolvedDate: "2026-02-16", cost: 35, vendor: null },
  { id: 4006, tenantId: 8, propertyId: 5, title: "Commercial hood vent inspection", description: "Annual hood vent cleaning and inspection due per lease", priority: "medium", status: "open", createdAt: "2026-04-01T10:00:00Z", scheduledDate: null, resolvedDate: null, cost: null, vendor: null },
];

export const DEAL_MILESTONES = [
  // Deal 1 milestones (id 3001-3012)
  { id: 3001, dealId: 1, label: "Contract Executed", done: true, date: "2026-01-06", createdAt:"2026-01-06T09:00:00Z", updatedAt:"2026-01-06T09:00:00Z", userId:"usr_001" },
  { id: 3002, dealId: 1, label: "Inspection Complete", done: true, date: "2026-01-07", createdAt:"2026-01-07T09:00:00Z", updatedAt:"2026-01-07T09:00:00Z", userId:"usr_001" },
  { id: 3003, dealId: 1, label: "Purchased / Closed", done: true, date: "2026-01-08", createdAt:"2026-01-08T09:00:00Z", updatedAt:"2026-01-08T09:00:00Z", userId:"usr_001" },
  { id: 3004, dealId: 1, label: "Demo Complete", done: true, date: "2026-01-22", createdAt:"2026-01-22T09:00:00Z", updatedAt:"2026-01-22T09:00:00Z", userId:"usr_001" },
  { id: 3005, dealId: 1, label: "Rough-In (Plumbing/Electric)", done: true, date: "2026-02-10", createdAt:"2026-02-10T09:00:00Z", updatedAt:"2026-02-10T09:00:00Z", userId:"usr_001" },
  { id: 3006, dealId: 1, label: "Drywall", done: true, date: "2026-02-24", createdAt:"2026-02-24T09:00:00Z", updatedAt:"2026-02-24T09:00:00Z", userId:"usr_001" },
  { id: 3007, dealId: 1, label: "Paint", done: false, date: null, createdAt:"2026-01-08T09:00:00Z", updatedAt:"2026-01-08T09:00:00Z", userId:"usr_001" },
  { id: 3008, dealId: 1, label: "Flooring", done: false, date: null, createdAt:"2026-01-08T09:00:00Z", updatedAt:"2026-01-08T09:00:00Z", userId:"usr_001" },
  { id: 3009, dealId: 1, label: "Kitchen & Baths", done: false, date: null, createdAt:"2026-01-08T09:00:00Z", updatedAt:"2026-01-08T09:00:00Z", userId:"usr_001" },
  { id: 3010, dealId: 1, label: "Punch List", done: false, date: null, createdAt:"2026-01-08T09:00:00Z", updatedAt:"2026-01-08T09:00:00Z", userId:"usr_001" },
  { id: 3011, dealId: 1, label: "Listed for Sale", done: false, date: null, createdAt:"2026-01-08T09:00:00Z", updatedAt:"2026-01-08T09:00:00Z", userId:"usr_001" },
  { id: 3012, dealId: 1, label: "Sold / Closed", done: false, date: null, createdAt:"2026-01-08T09:00:00Z", updatedAt:"2026-01-08T09:00:00Z", userId:"usr_001" },
  // Deal 2 milestones (id 3013-3026)
  { id: 3013, dealId: 2, label: "Contract Executed", done: true, date: "2026-01-15", createdAt:"2026-01-15T09:00:00Z", updatedAt:"2026-01-15T09:00:00Z", userId:"usr_001" },
  { id: 3014, dealId: 2, label: "Inspection Complete", done: true, date: "2026-01-15", createdAt:"2026-01-15T09:00:00Z", updatedAt:"2026-01-15T09:00:00Z", userId:"usr_001" },
  { id: 3015, dealId: 2, label: "Financing Secured", done: true, date: "2026-01-15", createdAt:"2026-01-15T09:00:00Z", updatedAt:"2026-01-15T09:00:00Z", userId:"usr_001" },
  { id: 3016, dealId: 2, label: "Purchased / Closed", done: true, date: "2026-01-15", createdAt:"2025-10-14T09:00:00Z", updatedAt:"2025-10-14T09:00:00Z", userId:"usr_001" },
  { id: 3017, dealId: 2, label: "Demo Complete", done: true, date: "2026-01-15", createdAt:"2025-10-14T09:00:00Z", updatedAt:"2025-10-14T09:00:00Z", userId:"usr_001" },
  { id: 3018, dealId: 2, label: "Rough-In (Plumbing/Electric)", done: true, date: "2026-01-15", createdAt:"2025-10-14T09:00:00Z", updatedAt:"2025-10-14T09:00:00Z", userId:"usr_001" },
  { id: 3019, dealId: 2, label: "Drywall", done: true, date: "2026-01-15", createdAt:"2025-10-14T09:00:00Z", updatedAt:"2025-10-14T09:00:00Z", userId:"usr_001" },
  { id: 3020, dealId: 2, label: "Paint", done: true, date: "2026-01-15", createdAt:"2025-10-14T09:00:00Z", updatedAt:"2025-10-14T09:00:00Z", userId:"usr_001" },
  { id: 3021, dealId: 2, label: "Flooring", done: true, date: "2026-01-15", createdAt:"2025-10-14T09:00:00Z", updatedAt:"2025-10-14T09:00:00Z", userId:"usr_001" },
  { id: 3022, dealId: 2, label: "Kitchen & Baths", done: true, date: "2026-01-15", createdAt:"2025-10-14T09:00:00Z", updatedAt:"2025-10-14T09:00:00Z", userId:"usr_001" },
  { id: 3023, dealId: 2, label: "Punch List", done: true, date: "2026-01-15", createdAt:"2025-10-14T09:00:00Z", updatedAt:"2025-10-14T09:00:00Z", userId:"usr_001" },
  { id: 3024, dealId: 2, label: "Listed for Sale", done: false, date: null, createdAt:"2025-10-14T09:00:00Z", updatedAt:"2025-10-14T09:00:00Z", userId:"usr_001" },
  { id: 3025, dealId: 2, label: "Under Contract", done: false, date: null, createdAt:"2025-10-14T09:00:00Z", updatedAt:"2025-10-14T09:00:00Z", userId:"usr_001" },
  { id: 3026, dealId: 2, label: "Sold / Closed", done: false, date: null, createdAt:"2025-10-14T09:00:00Z", updatedAt:"2025-10-14T09:00:00Z", userId:"usr_001" },
  // Deal 3 milestones (id 3027-3029)
  { id: 3027, dealId: 3, label: "Contract Executed", done: true, date: "2026-03-12", createdAt:"2026-03-12T09:00:00Z", updatedAt:"2026-03-12T09:00:00Z", userId:"usr_001" },
  { id: 3028, dealId: 3, label: "Inspection Complete", done: true, date: "2026-03-12", createdAt:"2026-03-12T09:00:00Z", updatedAt:"2026-03-12T09:00:00Z", userId:"usr_001" },
  { id: 3029, dealId: 3, label: "Financing Secured", done: false, date: null, createdAt:"2026-03-10T09:00:00Z", updatedAt:"2026-03-10T09:00:00Z", userId:"usr_001" },
  // Deal 4 milestones (id 3030-3043)
  { id: 3030, dealId: 4, label: "Contract Executed", done: true, date: "2025-08-29", createdAt:"2025-08-29T09:00:00Z", updatedAt:"2025-08-29T09:00:00Z", userId:"usr_001" },
  { id: 3031, dealId: 4, label: "Inspection Complete", done: true, date: "2025-08-29", createdAt:"2025-08-29T09:00:00Z", updatedAt:"2025-08-29T09:00:00Z", userId:"usr_001" },
  { id: 3032, dealId: 4, label: "Financing Secured", done: true, date: "2025-08-29", createdAt:"2025-08-29T09:00:00Z", updatedAt:"2025-08-29T09:00:00Z", userId:"usr_001" },
  { id: 3033, dealId: 4, label: "Purchased / Closed", done: true, date: "2025-08-29", createdAt:"2025-04-12T09:00:00Z", updatedAt:"2025-04-12T09:00:00Z", userId:"usr_001" },
  { id: 3034, dealId: 4, label: "Demo Complete", done: true, date: "2025-08-29", createdAt:"2025-04-12T09:00:00Z", updatedAt:"2025-04-12T09:00:00Z", userId:"usr_001" },
  { id: 3035, dealId: 4, label: "Rough-In (Plumbing/Electric)", done: true, date: "2025-08-29", createdAt:"2025-04-12T09:00:00Z", updatedAt:"2025-04-12T09:00:00Z", userId:"usr_001" },
  { id: 3036, dealId: 4, label: "Drywall", done: true, date: "2025-08-29", createdAt:"2025-04-12T09:00:00Z", updatedAt:"2025-04-12T09:00:00Z", userId:"usr_001" },
  { id: 3037, dealId: 4, label: "Paint", done: true, date: "2025-08-29", createdAt:"2025-04-12T09:00:00Z", updatedAt:"2025-04-12T09:00:00Z", userId:"usr_001" },
  { id: 3038, dealId: 4, label: "Flooring", done: true, date: "2025-08-29", createdAt:"2025-04-12T09:00:00Z", updatedAt:"2025-04-12T09:00:00Z", userId:"usr_001" },
  { id: 3039, dealId: 4, label: "Kitchen & Baths", done: true, date: "2025-08-29", createdAt:"2025-04-12T09:00:00Z", updatedAt:"2025-04-12T09:00:00Z", userId:"usr_001" },
  { id: 3040, dealId: 4, label: "Punch List", done: true, date: "2025-08-29", createdAt:"2025-04-12T09:00:00Z", updatedAt:"2025-04-12T09:00:00Z", userId:"usr_001" },
  { id: 3041, dealId: 4, label: "Listed for Sale", done: true, date: "2025-08-29", createdAt:"2025-04-12T09:00:00Z", updatedAt:"2025-04-12T09:00:00Z", userId:"usr_001" },
  { id: 3042, dealId: 4, label: "Under Contract", done: true, date: "2025-08-29", createdAt:"2025-04-12T09:00:00Z", updatedAt:"2025-04-12T09:00:00Z", userId:"usr_001" },
  { id: 3043, dealId: 4, label: "Sold / Closed", done: true, date: "2025-08-29", createdAt:"2025-04-12T09:00:00Z", updatedAt:"2025-04-12T09:00:00Z", userId:"usr_001" },
];



// -----------------------------------------------------------------------------
// Mock User (replace with real auth session later)
// -----------------------------------------------------------------------------
export const MOCK_USER = {
  id: "usr_001",
  name: "Brandon H.",
  email: "brandon@gmail.com",
  initials: "B",
  plan: "pro",
  planLabel: "PRO PLAN",
  planDescription: "5 properties · Unlimited transactions",
  memberSince: "2024-01-15",
};

// Demo account email — used by AppShell to gate demo-only data restoration.
export const DEMO_EMAIL = "demo@propbooks.com";

// Empty every in-memory data array in-place so all components see [] immediately.
// Called for non-demo users so they start with a blank slate before Supabase
// hydration replaces the contents.
export function clearDemoData() {
  DEALS.length              = 0;
  DEAL_EXPENSES.length      = 0;
  CONTRACTORS.length        = 0;
  CONTRACTOR_BIDS.length    = 0;
  CONTRACTOR_DOCUMENTS.length=0;
  DEAL_MILESTONES.length    = 0;
  PROPERTY_DOCUMENTS.length = 0;
  DEAL_DOCUMENTS.length     = 0;
  TENANT_DOCUMENTS.length   = 0;
  MAINTENANCE_REQUESTS.length=0;
  RENTAL_NOTES.length       = 0;
  DEAL_NOTES.length         = 0;
  GENERAL_NOTES.length      = 0;
  TEAM_MEMBERS.length       = 0;
}

// Rental notes — flat array with propertyId reference
export const RENTAL_NOTES = [
  { id: 2001, propertyId: 1, tenantId: 2, date: "2026-03-30", text: "Tenant in Unit B reported slow drain in kitchen. Scheduled plumber for April 2nd.", createdAt: "2026-03-30T10:00:00Z", updatedAt: "2026-03-30T10:00:00Z", userId: "usr_001" },
  { id: 2002, propertyId: 1, tenantId: null, date: "2026-03-12", text: "Annual property inspection complete. Minor drywall crack in Unit A hallway — cosmetic only, will patch at next turnover.", createdAt: "2026-03-12T09:00:00Z", updatedAt: "2026-03-12T09:00:00Z", userId: "usr_001" },
  { id: 2003, propertyId: 1, tenantId: null, date: "2026-02-20", text: "Renewed insurance policy with Liberty Mutual. Premium increased 4% — still competitive.", createdAt: "2026-02-20T10:00:00Z", updatedAt: "2026-02-20T10:00:00Z", userId: "usr_001" },
  { id: 2004, propertyId: 2, tenantId: 3, date: "2026-03-25", text: "Tenant asked about installing a Ring doorbell. Approved as long as they restore on move-out.", createdAt: "2026-03-25T10:00:00Z", updatedAt: "2026-03-25T10:00:00Z", userId: "usr_001" },
  { id: 2005, propertyId: 2, tenantId: 3, date: "2026-02-01", text: "Lease renewal signed through Feb 2027. Rent bumped from $2,800 to $2,950.", createdAt: "2026-02-01T09:00:00Z", updatedAt: "2026-02-01T09:00:00Z", userId: "usr_001" },
  { id: 2006, propertyId: 3, tenantId: null, date: "2026-03-18", text: "HOA approved new landscaping plan for common areas. Assessment may increase $15/mo starting Q3.", createdAt: "2026-03-18T10:00:00Z", updatedAt: "2026-03-18T10:00:00Z", userId: "usr_001" },
  { id: 2007, propertyId: 4, tenantId: null, date: "2026-03-22", text: "Unit 3 still vacant. Dropped listing price to $1,800/mo and refreshed photos. Two showings this week.", createdAt: "2026-03-22T10:00:00Z", updatedAt: "2026-03-22T10:00:00Z", userId: "usr_001" },
  { id: 2008, propertyId: 4, tenantId: 5, date: "2026-03-05", text: "Replaced garbage disposal in Unit 1. Parts + labor = $285, logged as maintenance expense.", createdAt: "2026-03-05T14:00:00Z", updatedAt: "2026-03-05T14:00:00Z", userId: "usr_001" },
  // Tenant-specific notes (migrated from tenant notes)
  { id: 2009, propertyId: 1, tenantId: 1, date: "2026-03-15", text: "Williams renewed for another 12 months at $1,900. Happy tenants, always pay on time.", createdAt: "2026-03-15T10:00:00Z", updatedAt: "2026-03-15T10:00:00Z", userId: "usr_001" },
  { id: 2010, propertyId: 1, tenantId: 2, date: "2026-02-10", text: "Jordan mentioned might not renew when lease is up. Exploring options.", createdAt: "2026-02-10T14:00:00Z", updatedAt: "2026-02-10T14:00:00Z", userId: "usr_001" },
  { id: 2011, propertyId: 2, tenantId: 3, date: "2026-01-20", text: "Kowalskis asked about getting a dog. Sent pet addendum for review.", createdAt: "2026-01-20T09:00:00Z", updatedAt: "2026-01-20T09:00:00Z", userId: "usr_001" },
  { id: 2012, propertyId: 4, tenantId: 5, date: "2026-03-01", text: "Thompsons have been great tenants. Will offer renewal at $2,000 — $50 increase.", createdAt: "2026-03-01T10:00:00Z", updatedAt: "2026-03-01T10:00:00Z", userId: "usr_001" },
  { id: 2013, propertyId: 5, tenantId: 8, date: "2026-02-20", text: "Pacific Rim wants to discuss lease extension through 2030. Meeting scheduled for March.", createdAt: "2026-02-20T11:00:00Z", updatedAt: "2026-02-20T11:00:00Z", userId: "usr_001" },
];

// Team members (for @mention support). Real users hydrate this from
// db/accounts.listAccountMembers() on login; the demo account uses the seed
// values below. Like the other DEMO/portfolio arrays, this is a mutable
// reference that gets refilled in place — never reassigned — so importers
// (MentionTextarea etc.) keep their reference.
export const TEAM_MEMBERS = [
  { id: "usr_001", name: "Brandon H.", email: "brandon@gmail.com", initials: "BH", color: "#3b82f6" },
  { id: "usr_002", name: "Jessica Torres", email: "jessica.t@propbooks.io", initials: "JT", color: "#8b5cf6" },
  { id: "usr_003", name: "Marcus Chen", email: "marcus.c@propbooks.io", initials: "MC", color: "#059669" },
  { id: "usr_004", name: "Danielle Brooks", email: "danielle.b@propbooks.io", initials: "DB", color: "#e95e00" },
];

// General notes — not tied to any property or deal
export const GENERAL_NOTES = [
  { id: 3001, date: "2026-04-01", text: "Met with CPA to discuss depreciation strategy across the portfolio. Need to pull cost-seg studies for 445 Maple and 320 Cedar before filing deadline.", createdAt: "2026-04-01T14:00:00Z", updatedAt: "2026-04-01T14:00:00Z", userId: "usr_001", mentions: [] },
  { id: 3002, date: "2026-03-20", text: "Reviewed insurance coverage with @Jessica Torres — she's getting quotes from three carriers for a blanket policy across all rentals.", createdAt: "2026-03-20T11:00:00Z", updatedAt: "2026-03-20T11:00:00Z", userId: "usr_001", mentions: ["usr_002"] },
  { id: 3003, date: "2026-03-10", text: "Annual goals check-in: 2 more rental acquisitions by Q3, target $8k/mo net cash flow. Currently at $5.2k.", createdAt: "2026-03-10T09:00:00Z", updatedAt: "2026-03-10T09:00:00Z", userId: "usr_001", mentions: [] },
];

// Deal notes — flat array with dealId reference
export const DEAL_NOTES = [
  { id: 1001, dealId: 1, date: "2026-03-28", text: "Spoke with inspector — back wall needs structural review before drywall. Getting quote from Nash Drywall.", createdAt: "2026-03-28T10:00:00Z", updatedAt: "2026-03-28T10:00:00Z", userId: "usr_001" },
  { id: 1002, dealId: 1, date: "2026-03-15", text: "ABC Plumbing delayed 1 week on master bath rough-in. Pushed flooring start to 3/21.", createdAt: "2026-03-15T10:00:00Z", updatedAt: "2026-03-15T10:00:00Z", userId: "usr_001" },
  { id: 1003, dealId: 1, date: "2026-02-10", text: "Demo went smooth. Dumpster picked up, ready for rough-in next week.", createdAt: "2026-02-10T09:00:00Z", updatedAt: "2026-02-10T09:00:00Z", userId: "usr_001" },
  { id: 1004, dealId: 2, date: "2026-01-20", text: "All rehab complete. Scheduling photographer for listing photos this week.", createdAt: "2026-01-20T10:00:00Z", updatedAt: "2026-01-20T10:00:00Z", userId: "usr_001" },
];

// =============================================================================
// Demo data snapshot — captured once at module load AFTER all arrays exist.
// restoreDemoData() re-populates every array from this frozen copy so the demo
// user always sees full data regardless of which account logged in before them.
// =============================================================================
const _snap = {
  deals:                JSON.parse(JSON.stringify(DEALS)),
  dealExpenses:         JSON.parse(JSON.stringify(DEAL_EXPENSES)),
  contractors:          JSON.parse(JSON.stringify(CONTRACTORS)),
  contractorBids:       JSON.parse(JSON.stringify(CONTRACTOR_BIDS)),
  contractorDocuments:  JSON.parse(JSON.stringify(CONTRACTOR_DOCUMENTS)),
  dealMilestones:       JSON.parse(JSON.stringify(DEAL_MILESTONES)),
  propertyDocuments:    JSON.parse(JSON.stringify(PROPERTY_DOCUMENTS)),
  dealDocuments:        JSON.parse(JSON.stringify(DEAL_DOCUMENTS)),
  tenantDocuments:      JSON.parse(JSON.stringify(TENANT_DOCUMENTS)),
  maintenanceRequests:  JSON.parse(JSON.stringify(MAINTENANCE_REQUESTS)),
  rentalNotes:          JSON.parse(JSON.stringify(RENTAL_NOTES)),
  dealNotes:            JSON.parse(JSON.stringify(DEAL_NOTES)),
  generalNotes:         JSON.parse(JSON.stringify(GENERAL_NOTES)),
  teamMembers:          JSON.parse(JSON.stringify(TEAM_MEMBERS)),
};

function refill(target, source) { target.length = 0; source.forEach(item => target.push(item)); }

export function restoreDemoData() {
  refill(DEALS,                _snap.deals);
  refill(DEAL_EXPENSES,        _snap.dealExpenses);
  refill(CONTRACTORS,          _snap.contractors);
  refill(CONTRACTOR_BIDS,      _snap.contractorBids);
  refill(CONTRACTOR_DOCUMENTS, _snap.contractorDocuments);
  refill(DEAL_MILESTONES,      _snap.dealMilestones);
  refill(PROPERTY_DOCUMENTS,   _snap.propertyDocuments);
  refill(DEAL_DOCUMENTS,       _snap.dealDocuments);
  refill(TENANT_DOCUMENTS,     _snap.tenantDocuments);
  refill(MAINTENANCE_REQUESTS, _snap.maintenanceRequests);
  refill(RENTAL_NOTES,         _snap.rentalNotes);
  refill(DEAL_NOTES,           _snap.dealNotes);
  refill(GENERAL_NOTES,        _snap.generalNotes);
  refill(TEAM_MEMBERS,         _snap.teamMembers);
}




