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
const _properties = [
  { id:1, name:"Maple Ridge Duplex",     address:"2847 Maple Ridge Dr, Austin, TX 78701",         type:"Multi-Family",  units:2, purchasePrice:385000,  currentValue:462000,  mortgage:298000, monthlyRent:3800, monthlyExpenses:1640, purchaseDate:"2021-03-15", status:"Occupied",         image:"MR", capRate:7.2, cashOnCash:9.1,  color:"#3b82f6", landValue:77000,   createdAt:"2021-03-15T09:00:00Z", updatedAt:"2021-03-15T09:00:00Z", userId:"usr_001" },
  { id:2, name:"Lakeview SFR",           address:"518 Lakeview Terrace, Denver, CO 80203",         type:"Single Family", units:1, purchasePrice:520000,  currentValue:598000,  mortgage:410000, monthlyRent:2950, monthlyExpenses:1120, purchaseDate:"2020-07-22", status:"Occupied",         image:"LV", capRate:5.6, cashOnCash:7.4,  color:"#10b981", landValue:130000,  createdAt:"2020-07-22T09:00:00Z", updatedAt:"2020-07-22T09:00:00Z", userId:"usr_001" },
  { id:3, name:"Midtown Condo #4B",      address:"1200 Peachtree St NE #4B, Atlanta, GA 30309",    type:"Condo",         units:1, purchasePrice:280000,  currentValue:315000,  mortgage:194000, monthlyRent:2100, monthlyExpenses:860,  purchaseDate:"2022-01-10", status:"Occupied",         image:"MC", capRate:6.9, cashOnCash:8.3,  color:"#8b5cf6", landValue:56000,   createdAt:"2022-01-10T09:00:00Z", updatedAt:"2022-01-10T09:00:00Z", userId:"usr_001" },
  { id:4, name:"Riverside Triplex",      address:"744 Riverside Blvd, Portland, OR 97201",         type:"Multi-Family",  units:3, purchasePrice:670000,  currentValue:745000,  mortgage:520000, monthlyRent:5700, monthlyExpenses:2380, purchaseDate:"2019-11-05", status:"Partial Vacancy",  image:"RT", capRate:8.1, cashOnCash:10.2, color:"#f59e0b", landValue:null,    createdAt:"2019-11-05T09:00:00Z", updatedAt:"2019-11-05T09:00:00Z", userId:"usr_001" },
  { id:5, name:"Sunset Strip Commercial",address:"9220 Sunset Blvd, West Hollywood, CA 90069",     type:"Commercial",    units:1, purchasePrice:1200000, currentValue:1380000, mortgage:920000, monthlyRent:8500, monthlyExpenses:3200, purchaseDate:"2018-06-30", status:"Occupied",         image:"SS", capRate:7.0, cashOnCash:6.8,  color:"#ef4444", landValue:480000,  createdAt:"2018-06-30T09:00:00Z", updatedAt:"2018-06-30T09:00:00Z", userId:"usr_001" },
];

const _transactions = [
  { id:1,  date:"2026-03-20", propertyId:1, tenantId:1, category:"Rent Income",  description:"March rent - Unit A",           amount:1900,  type:"income",   createdAt:"2026-03-20T10:00:00Z", updatedAt:"2026-03-20T10:00:00Z", userId:"usr_001" },
  { id:2,  date:"2026-03-20", propertyId:1, tenantId:2, category:"Rent Income",  description:"March rent - Unit B",           amount:1900,  type:"income",   createdAt:"2026-03-20T10:00:00Z", updatedAt:"2026-03-20T10:00:00Z", userId:"usr_001" },
  { id:3,  date:"2026-03-18", propertyId:4, category:"Maintenance",  description:"HVAC repair - Unit 2",          amount:-420,  type:"expense",  createdAt:"2026-03-18T09:30:00Z", updatedAt:"2026-03-18T09:30:00Z", userId:"usr_001" },
  { id:4,  date:"2026-03-15", propertyId:2, tenantId:3, category:"Rent Income",  description:"March rent",                    amount:2950,  type:"income",   createdAt:"2026-03-15T10:00:00Z", updatedAt:"2026-03-15T10:00:00Z", userId:"usr_001" },
  { id:5,  date:"2026-03-12", propertyId:3, category:"HOA Fees",     description:"Monthly HOA",                   amount:-285,  type:"expense",  createdAt:"2026-03-12T09:00:00Z", updatedAt:"2026-03-12T09:00:00Z", userId:"usr_001" },
  { id:6,  date:"2026-03-10", propertyId:5, tenantId:8, category:"Rent Income",  description:"March commercial rent",         amount:8500,  type:"income",   createdAt:"2026-03-10T10:00:00Z", updatedAt:"2026-03-10T10:00:00Z", userId:"usr_001" },
  { id:7,  date:"2026-03-08", propertyId:4, tenantId:5, category:"Rent Income",  description:"March rent - Unit 1",           amount:1950,  type:"income",   createdAt:"2026-03-08T10:00:00Z", updatedAt:"2026-03-08T10:00:00Z", userId:"usr_001" },
  { id:16, date:"2026-03-08", propertyId:4, tenantId:7, category:"Rent Income",  description:"March rent - Unit 3",           amount:1875,  type:"income",   createdAt:"2026-03-08T10:00:00Z", updatedAt:"2026-03-08T10:00:00Z", userId:"usr_001" },
  { id:8,  date:"2026-03-05", propertyId:1, category:"Insurance",    description:"Q1 property insurance",         amount:-1200, type:"expense",  createdAt:"2026-03-05T11:00:00Z", updatedAt:"2026-03-05T11:00:00Z", userId:"usr_001" },
  { id:9,  date:"2026-03-03", propertyId:2, category:"Property Tax", description:"Semi-annual tax payment",       amount:-2100, type:"expense",  createdAt:"2026-03-03T14:00:00Z", updatedAt:"2026-03-03T14:00:00Z", userId:"usr_001" },
  { id:10, date:"2026-03-01", propertyId:3, tenantId:4, category:"Rent Income",  description:"March rent",                    amount:2100,  type:"income",   createdAt:"2026-03-01T10:00:00Z", updatedAt:"2026-03-01T10:00:00Z", userId:"usr_001" },
  { id:11, date:"2026-02-28", propertyId:5, category:"Maintenance",  description:"Parking lot reseal",            amount:-3500, type:"expense",  createdAt:"2026-02-28T08:30:00Z", updatedAt:"2026-02-28T08:30:00Z", userId:"usr_001" },
  { id:12, date:"2026-02-20", propertyId:4, category:"Mortgage",     description:"February mortgage",             amount:-2840, type:"expense",  createdAt:"2026-02-20T09:00:00Z", updatedAt:"2026-02-20T09:00:00Z", userId:"usr_001" },
  { id:13, date:"2026-02-15", propertyId:1, category:"Mortgage",     description:"February mortgage",             amount:-1620, type:"expense",  createdAt:"2026-02-15T09:00:00Z", updatedAt:"2026-02-15T09:00:00Z", userId:"usr_001" },
  { id:14, date:"2026-02-10", propertyId:2, category:"Landscaping",  description:"Monthly lawn service",          amount:-180,  type:"expense",  createdAt:"2026-02-10T10:30:00Z", updatedAt:"2026-02-10T10:30:00Z", userId:"usr_001" },
  { id:15, date:"2026-02-05", propertyId:3, category:"Utilities",    description:"Common area utilities",         amount:-95,   type:"expense",  createdAt:"2026-02-05T15:00:00Z", updatedAt:"2026-02-05T15:00:00Z", userId:"usr_001" },
];

const _monthlyCashFlow = [
  { month:"Oct", income:18500, expenses:8200,  net:10300 },
  { month:"Nov", income:19200, expenses:9100,  net:10100 },
  { month:"Dec", income:19800, expenses:11400, net:8400  },
  { month:"Jan", income:20100, expenses:8600,  net:11500 },
  { month:"Feb", income:21200, expenses:10200, net:11000 },
  { month:"Mar", income:23050, expenses:9775,  net:13275 },
];

const _equityGrowth = [
  { year:"2020", equity:248000 },
  { year:"2021", equity:412000 },
  { year:"2022", equity:580000 },
  { year:"2023", equity:698000 },
  { year:"2024", equity:815000 },
  { year:"2025", equity:892000 },
  { year:"2026", equity:960000 },
];

const _expenseCategories = [
  { name:"Mortgage",     value:42, color:"#3b82f6" },
  { name:"Maintenance",  value:22, color:"#10b981" },
  { name:"Property Tax", value:16, color:"#8b5cf6" },
  { name:"Insurance",    value:10, color:"#f59e0b" },
  { name:"HOA",          value:6,  color:"#ef4444" },
  { name:"Other",        value:4,  color:"#6b7280" },
];

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
  { id:2,  dealId:1, date:"2026-03-15", vendor:"ABC Plumbing",      contractorId:1,    category:"Subcontractor",            description:"Master bath rough-in",                amount:3200, createdAt:"2026-03-15T09:30:00Z", updatedAt:"2026-03-15T09:30:00Z", userId:"usr_001" },
  { id:3,  dealId:1, date:"2026-03-10", vendor:"Lowe's",            contractorId:null, category:"Fixtures & Hardware",      description:"Kitchen cabinet hardware + fixtures", amount:640,  createdAt:"2026-03-10T10:00:00Z", updatedAt:"2026-03-10T10:00:00Z", userId:"usr_001" },
  { id:4,  dealId:1, date:"2026-03-04", vendor:"City of Nashville", contractorId:null, category:"Permits",                  description:"Renovation permit",                   amount:380,  createdAt:"2026-03-04T14:00:00Z", updatedAt:"2026-03-04T14:00:00Z", userId:"usr_001" },
  { id:5,  dealId:1, date:"2026-02-28", vendor:"Elite Electric",    contractorId:2,    category:"Subcontractor",            description:"Panel upgrade + recessed lighting",   amount:4100, createdAt:"2026-02-28T09:00:00Z", updatedAt:"2026-02-28T09:00:00Z", userId:"usr_001" },
  { id:6,  dealId:1, date:"2026-02-20", vendor:"Lowe's",            contractorId:null, category:"Materials & Supplies",     description:"Kitchen cabinets - shaker style",     amount:5800, createdAt:"2026-02-20T10:30:00Z", updatedAt:"2026-02-20T10:30:00Z", userId:"usr_001" },
  { id:7,  dealId:1, date:"2026-02-14", vendor:"Budget Dumpster",   contractorId:null, category:"Dumpster / Debris Removal",description:"Demo debris removal",                 amount:420,  createdAt:"2026-02-14T08:30:00Z", updatedAt:"2026-02-14T08:30:00Z", userId:"usr_001" },
  { id:8,  dealId:2, date:"2026-01-12", vendor:"Sherwin-Williams",  contractorId:null, category:"Materials & Supplies",     description:"Interior/exterior paint + supplies",  amount:1150, createdAt:"2026-01-12T11:00:00Z", updatedAt:"2026-01-12T11:00:00Z", userId:"usr_001" },
  { id:9,  dealId:2, date:"2026-01-08", vendor:"Pro Flooring Co.",  contractorId:4,    category:"Subcontractor",            description:"LVP install - 1,100 sqft",            amount:3900, createdAt:"2026-01-08T09:00:00Z", updatedAt:"2026-01-08T09:00:00Z", userId:"usr_001" },
  { id:10, dealId:2, date:"2025-12-20", vendor:"Home Depot",        contractorId:null, category:"Appliances",               description:"Stainless appliance package",         amount:2400, createdAt:"2025-12-20T10:30:00Z", updatedAt:"2025-12-20T10:30:00Z", userId:"usr_001" },
  { id:11, dealId:2, date:"2025-12-10", vendor:"Jim's Windows",     contractorId:5,    category:"Subcontractor",            description:"Replace 8 windows",                   amount:5400, createdAt:"2025-12-10T09:00:00Z", updatedAt:"2025-12-10T09:00:00Z", userId:"usr_001" },
  { id:12, dealId:2, date:"2025-11-18", vendor:"City of Memphis",   contractorId:null, category:"Permits",                  description:"Electrical & structural permits",      amount:295,  createdAt:"2025-11-18T15:00:00Z", updatedAt:"2025-11-18T15:00:00Z", userId:"usr_001" },
  { id:13, dealId:4, date:"2025-07-02", vendor:"Summit HVAC",       contractorId:6,    category:"Subcontractor",            description:"Full HVAC replacement",               amount:7200, createdAt:"2025-07-02T09:00:00Z", updatedAt:"2025-07-02T09:00:00Z", userId:"usr_001" },
  { id:14, dealId:4, date:"2025-06-15", vendor:"Habitat Flooring",  contractorId:null, category:"Materials & Supplies",     description:"Engineered hardwood - whole house",   amount:4300, createdAt:"2025-06-15T10:00:00Z", updatedAt:"2025-06-15T10:00:00Z", userId:"usr_001" },
  { id:15, dealId:4, date:"2025-06-01", vendor:"Raleigh Tile Co.",  contractorId:null, category:"Subcontractor",            description:"Master bath tile work",               amount:3100, createdAt:"2025-06-01T10:00:00Z", updatedAt:"2025-06-01T10:00:00Z", userId:"usr_001" },
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

export const CONTRACTOR_PAYMENTS = [
  { id:201, contractorId:1, dealId:1, amount:3200, date:"2026-02-15", note:"Progress payment — rough-in complete", createdAt:"2026-02-15T09:00:00Z", updatedAt:"2026-02-15T09:00:00Z", userId:"usr_001" },
  { id:202, contractorId:2, dealId:1, amount:4100, date:"2026-02-28", note:"Final payment — work complete", createdAt:"2026-02-28T09:00:00Z", updatedAt:"2026-02-28T09:00:00Z", userId:"usr_001" },
  { id:203, contractorId:4, dealId:2, amount:3900, date:"2026-01-20", note:"Final — flooring complete", createdAt:"2026-01-20T09:00:00Z", updatedAt:"2026-01-20T09:00:00Z", userId:"usr_001" },
  { id:204, contractorId:5, dealId:2, amount:5400, date:"2026-01-10", note:"Paid in full", createdAt:"2026-01-10T09:00:00Z", updatedAt:"2026-01-10T09:00:00Z", userId:"usr_001" },
  { id:205, contractorId:6, dealId:4, amount:7200, date:"2025-08-20", note:"Final — system installed", createdAt:"2025-08-20T09:00:00Z", updatedAt:"2025-08-20T09:00:00Z", userId:"usr_001" },
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

// ── Receipt / attachment records on transactions and expenses ──
export const TRANSACTION_RECEIPTS = [
  { id: 701, transactionId: 3, name: "HVAC_repair_receipt.jpg", mimeType: "image/jpeg", size: "1.4 MB", url: null, ocrData: { vendor: "AirPro HVAC Services", amount: 420, date: "2026-03-18" }, createdAt: "2026-03-18T11:30:00Z", userId: "usr_001" },
  { id: 702, transactionId: 8, name: "StateFarm_Q1_invoice.pdf", mimeType: "application/pdf", size: "380 KB", url: null, ocrData: null, createdAt: "2026-03-05T14:00:00Z", userId: "usr_001" },
];

export const DEAL_EXPENSE_RECEIPTS = [
  { id: 801, expenseId: 1, name: "HomeDepot_flooring_receipt.jpg", mimeType: "image/jpeg", size: "2.1 MB", url: null, ocrData: { vendor: "Home Depot", amount: 2890, date: "2026-03-18" }, createdAt: "2026-03-18T12:00:00Z", userId: "usr_001" },
  { id: 802, expenseId: 4, name: "Nashville_permit_receipt.pdf", mimeType: "application/pdf", size: "156 KB", url: null, ocrData: null, createdAt: "2026-03-04T15:00:00Z", userId: "usr_001" },
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

const _tenants = [
  // ── Active tenants ──
  { id:1,  propertyId:1, unit:"Unit A",    name:"Marcus & Priya Williams",     rent:1900, leaseStart:"2024-02-01", leaseEnd:"2025-01-31", status:"active-lease",   lastPayment:"2026-03-01", phone:"512-555-0143", email:"mwilliams@email.com",    moveOutDate:null, moveOutReason:null, securityDeposit:1900, createdAt:"2024-02-01T09:00:00Z", updatedAt:"2024-02-01T09:00:00Z", userId:"usr_001"  },
  { id:2,  propertyId:1, unit:"Unit B",    name:"Jordan Lee",                  rent:1900, leaseStart:"2023-08-01", leaseEnd:"2024-07-31", status:"month-to-month", lastPayment:"2026-03-01", phone:"512-555-0287", email:"jlee@email.com",         moveOutDate:null, moveOutReason:null, securityDeposit:1900, createdAt:"2023-08-01T09:00:00Z", updatedAt:"2023-08-01T09:00:00Z", userId:"usr_001"  },
  { id:3,  propertyId:2, unit:"Main",      name:"Stephanie & Dan Kowalski",    rent:2950, leaseStart:"2024-06-01", leaseEnd:"2025-05-31", status:"active-lease",   lastPayment:"2026-03-15", phone:"303-555-0194", email:"kowalski@email.com",     moveOutDate:null, moveOutReason:null, securityDeposit:2950, createdAt:"2024-06-01T09:00:00Z", updatedAt:"2024-06-01T09:00:00Z", userId:"usr_001"  },
  { id:4,  propertyId:3, unit:"#4B",       name:"Alexis Fontaine",             rent:2100, leaseStart:"2025-01-01", leaseEnd:"2025-12-31", status:"active-lease",   lastPayment:"2026-03-01", phone:"404-555-0362", email:"afontaine@email.com",    moveOutDate:null, moveOutReason:null, securityDeposit:2100, createdAt:"2025-01-01T09:00:00Z", updatedAt:"2025-01-01T09:00:00Z", userId:"usr_001"  },
  { id:5,  propertyId:4, unit:"Unit 1",    name:"Ryan & Keisha Thompson",      rent:1950, leaseStart:"2024-09-01", leaseEnd:"2025-08-31", status:"active-lease",   lastPayment:"2026-03-08", phone:"503-555-0218", email:"kthompson@email.com",    moveOutDate:null, moveOutReason:null, securityDeposit:1950, createdAt:"2024-09-01T09:00:00Z", updatedAt:"2024-09-01T09:00:00Z", userId:"usr_001"  },
  { id:6,  propertyId:4, unit:"Unit 2",    name:"Vacant",                      rent:1875, leaseStart:null,         leaseEnd:null,         status:"vacant",         lastPayment:null,         phone:null,           email:null,                     moveOutDate:null, moveOutReason:null, securityDeposit:null, createdAt:"2025-03-15T09:00:00Z", updatedAt:"2025-03-15T09:00:00Z", userId:"usr_001"  },
  { id:7,  propertyId:4, unit:"Unit 3",    name:"Carlos Mendez",               rent:1875, leaseStart:"2025-03-01", leaseEnd:"2026-02-28", status:"month-to-month", lastPayment:"2026-03-08", phone:"503-555-0445", email:"cmendez@email.com",      moveOutDate:null, moveOutReason:null, securityDeposit:1875, createdAt:"2025-03-01T09:00:00Z", updatedAt:"2025-03-01T09:00:00Z", userId:"usr_001"  },
  { id:8,  propertyId:5, unit:"Commercial",name:"Pacific Rim Restaurant Group", rent:8500, leaseStart:"2023-01-01", leaseEnd:"2027-12-31", status:"active-lease",   lastPayment:"2026-03-10", phone:"310-555-0501", email:"leasing@pacificrimrg.com",moveOutDate:null, moveOutReason:null, securityDeposit:12000, createdAt:"2023-01-01T09:00:00Z", updatedAt:"2023-01-01T09:00:00Z", userId:"usr_001" },
  // ── Past tenants (lease closed) ──
  { id:101, propertyId:1, unit:"Unit A",   name:"David Chen",                  rent:1650, leaseStart:"2022-01-15", leaseEnd:"2024-01-14", status:"past",           lastPayment:"2024-01-01", phone:"512-555-0099", email:"dchen@email.com",        moveOutDate:"2024-01-31", moveOutReason:"Relocated for work",       securityDeposit:1650, createdAt:"2022-01-15T09:00:00Z", updatedAt:"2022-01-15T09:00:00Z", userId:"usr_001"  },
  { id:102, propertyId:2, unit:"Main",     name:"Angela & Tim Briggs",         rent:2650, leaseStart:"2021-06-01", leaseEnd:"2024-05-31", status:"past",           lastPayment:"2024-05-01", phone:"303-555-0077", email:"abriggs@email.com",      moveOutDate:"2024-05-31", moveOutReason:"Purchased own home",       securityDeposit:2650, createdAt:"2021-06-01T09:00:00Z", updatedAt:"2021-06-01T09:00:00Z", userId:"usr_001"  },
  { id:103, propertyId:4, unit:"Unit 2",   name:"Mei-Lin Patel",              rent:1750, leaseStart:"2023-04-01", leaseEnd:"2025-03-31", status:"past",           lastPayment:"2025-02-01", phone:"503-555-0333", email:"mpatel@email.com",       moveOutDate:"2025-03-15", moveOutReason:"Lease not renewed",        securityDeposit:1750, createdAt:"2023-04-01T09:00:00Z", updatedAt:"2023-04-01T09:00:00Z", userId:"usr_001"  },
  { id:104, propertyId:3, unit:"#4B",      name:"Jason & Marie Torres",        rent:1850, leaseStart:"2022-06-01", leaseEnd:"2024-12-31", status:"past",           lastPayment:"2024-12-01", phone:"404-555-0211", email:"jtorres@email.com",      moveOutDate:"2024-12-31", moveOutReason:"Lease ended, rent increase",securityDeposit:1850, createdAt:"2022-06-01T09:00:00Z", updatedAt:"2022-06-01T09:00:00Z", userId:"usr_001" },
];

const _mileageTrips = [
  { id:1, date:"2026-03-22", description:"Inspect Oakdale Craftsman - contractor walkthrough", from:"Home", to:"1422 Oakdale Ave, Nashville",     miles:14.2, purpose:"Deal",     businessPct:100, createdAt:"2026-03-22T10:00:00Z", updatedAt:"2026-03-22T10:00:00Z", userId:"usr_001" },
  { id:2, date:"2026-03-20", description:"Collect rent - Maple Ridge Duplex",                  from:"Home", to:"2847 Maple Ridge Dr, Austin",     miles:8.5,  purpose:"Rental",   businessPct:100, createdAt:"2026-03-20T10:00:00Z", updatedAt:"2026-03-20T10:00:00Z", userId:"usr_001" },
  { id:3, date:"2026-03-18", description:"Meet plumber - Oakdale Craftsman",                   from:"Home", to:"1422 Oakdale Ave, Nashville",     miles:14.2, purpose:"Deal",     businessPct:100, createdAt:"2026-03-18T09:30:00Z", updatedAt:"2026-03-18T09:30:00Z", userId:"usr_001" },
  { id:4, date:"2026-03-15", description:"Annual inspection - Lakeview SFR",                   from:"Home", to:"518 Lakeview Terrace, Denver",    miles:22.7, purpose:"Rental",   businessPct:100, createdAt:"2026-03-15T08:00:00Z", updatedAt:"2026-03-15T08:00:00Z", userId:"usr_001" },
  { id:5, date:"2026-03-12", description:"Pine Street Ranch showing",                          from:"Home", to:"874 Pine Street, Memphis",        miles:18.9, purpose:"Deal",     businessPct:100, createdAt:"2026-03-12T10:00:00Z", updatedAt:"2026-03-12T10:00:00Z", userId:"usr_001" },
  { id:6, date:"2026-03-10", description:"Commercial property check-in",                       from:"Home", to:"9220 Sunset Blvd, W Hollywood",   miles:31.4, purpose:"Rental",   businessPct:100, createdAt:"2026-03-10T14:00:00Z", updatedAt:"2026-03-10T14:00:00Z", userId:"usr_001" },
  { id:7, date:"2026-03-05", description:"Riverside Triplex - maintenance call",               from:"Home", to:"744 Riverside Blvd, Portland",    miles:12.1, purpose:"Rental",   businessPct:100, createdAt:"2026-03-05T09:00:00Z", updatedAt:"2026-03-05T09:00:00Z", userId:"usr_001" },
  { id:8, date:"2026-02-28", description:"Accountant meeting - tax prep",                      from:"Home", to:"Downtown Office",                 miles:9.3,  purpose:"Business", businessPct:100, createdAt:"2026-02-28T10:00:00Z", updatedAt:"2026-02-28T10:00:00Z", userId:"usr_001" },
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

// -----------------------------------------------------------------------------
// =============================================================================
// Demo / Real-user data gate
// Call clearDemoData() for any non-demo user so they start with a blank slate.
// When Supabase data persistence is wired up, this layer gets replaced with
// real DB queries and this function can be removed.
// =============================================================================
export const DEMO_EMAIL = "demo@propbooks.com";

export function clearDemoData() {
  // Empty every in-memory data array in-place so all components see [] immediately
  _properties.length        = 0;
  _transactions.length      = 0;
  _tenants.length           = 0;
  _mileageTrips.length      = 0;
  DEALS.length              = 0;
  DEAL_EXPENSES.length      = 0;
  CONTRACTORS.length        = 0;
  CONTRACTOR_BIDS.length    = 0;
  CONTRACTOR_PAYMENTS.length= 0;
  CONTRACTOR_DOCUMENTS.length=0;
  DEAL_MILESTONES.length    = 0;
  PROPERTY_DOCUMENTS.length = 0;
  DEAL_DOCUMENTS.length     = 0;
  TENANT_DOCUMENTS.length   = 0;
  MAINTENANCE_REQUESTS.length=0;
  TRANSACTION_RECEIPTS.length=0;
  DEAL_EXPENSE_RECEIPTS.length=0;
  RENTAL_NOTES.length       = 0;
  DEAL_NOTES.length         = 0;
  GENERAL_NOTES.length      = 0;
  // Chart series — replace with empty months so charts render (not crash)
  _monthlyCashFlow.length   = 0;
  _equityGrowth.length      = 0;
  _expenseCategories.length = 0;
}

// Properties
// -----------------------------------------------------------------------------
export function getProperties()             { return Promise.resolve([..._properties]); }
export function addProperty(prop)           { _properties.push(prop); return Promise.resolve(prop); }
export function updateProperty(id, updates) {
  const i = _properties.findIndex(p => p.id === id);
  if (i !== -1) Object.assign(_properties[i], updates);
  return Promise.resolve(_properties[i]);
}
export function deleteProperty(id) {
  const i = _properties.findIndex(p => p.id === id);
  if (i !== -1) _properties.splice(i, 1);
  return Promise.resolve();
}

// -----------------------------------------------------------------------------
// Transactions
// -----------------------------------------------------------------------------
export function getTransactions()          { return Promise.resolve([..._transactions]); }
export function addTransaction(txn)        { _transactions.unshift(txn); return Promise.resolve(txn); }
export function deleteTransaction(id) {
  const i = _transactions.findIndex(t => t.id === id);
  if (i !== -1) _transactions.splice(i, 1);
  return Promise.resolve();
}

// -----------------------------------------------------------------------------
// Charts / Analytics
// -----------------------------------------------------------------------------
export function getMonthlyCashFlow()    { return Promise.resolve([..._monthlyCashFlow]); }
export function getEquityGrowth()       { return Promise.resolve([..._equityGrowth]);    }
export function getExpenseCategories()  { return Promise.resolve([..._expenseCategories]); }

// -----------------------------------------------------------------------------
// Deals
// -----------------------------------------------------------------------------
export function getDeals()              { return Promise.resolve([...DEALS]);         }
export function addDeal(deal)           { DEALS.push(deal); return Promise.resolve(deal); }
export function updateDeal(id, updates) {
  const i = DEALS.findIndex(f => f.id === id);
  if (i !== -1) Object.assign(DEALS[i], updates);
  return Promise.resolve(DEALS[i]);
}
export function getDealExpenses(dealId) {
  return Promise.resolve(DEAL_EXPENSES.filter(e => e.dealId === dealId));
}
export function addDealExpense(exp)     { DEAL_EXPENSES.push(exp); return Promise.resolve(exp); }
export function getContractors(dealId)  {
  if (dealId) return Promise.resolve(CONTRACTORS.filter(c => c.dealIds.includes(dealId)));
  return Promise.resolve([...CONTRACTORS]);
}
export function addContractor(c)        { CONTRACTORS.push(c); return Promise.resolve(c); }
export function getDealMilestones(dealId) {
  return Promise.resolve(DEAL_MILESTONES.filter(m => m.dealId === dealId));
}
export function updateDealMilestones(dealId, milestones) {
  // Remove old milestones for this deal
  const oldIndices = DEAL_MILESTONES.map((m, i) => m.dealId === dealId ? i : -1).filter(i => i !== -1);
  for (let i = oldIndices.length - 1; i >= 0; i--) {
    DEAL_MILESTONES.splice(oldIndices[i], 1);
  }
  // Add updated milestones
  DEAL_MILESTONES.push(...milestones);
  return Promise.resolve(milestones);
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

// Team members (for @mention support)
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

// -----------------------------------------------------------------------------
// Tenants
// -----------------------------------------------------------------------------
export function getTenants()            { return Promise.resolve([..._tenants]);       }
export function addTenant(t)            { _tenants.push(t); return Promise.resolve(t); }
export function updateTenant(id, updates) {
  const i = _tenants.findIndex(t => t.id === id);
  if (i !== -1) Object.assign(_tenants[i], updates);
  return Promise.resolve(_tenants[i]);
}

// -----------------------------------------------------------------------------
// Mileage
// -----------------------------------------------------------------------------
export function getMileageTrips()       { return Promise.resolve([..._mileageTrips]);  }
export function addMileageTrip(trip)    { _mileageTrips.unshift(trip); return Promise.resolve(trip); }
export function deleteMileageTrip(id) {
  const i = _mileageTrips.findIndex(t => t.id === id);
  if (i !== -1) _mileageTrips.splice(i, 1);
  return Promise.resolve();
}

// -----------------------------------------------------------------------------
// Property Lookup (Rentcast / Zillow stub)
// When you have an API key, replace this with a real fetch call.
// -----------------------------------------------------------------------------
export async function lookupPropertyByAddress(address) {
  // TODO: replace with →
  // const res = await fetch(`https://api.rentcast.io/v1/properties?address=${encodeURIComponent(address)}`, {
  //   headers: { 'X-Api-Key': import.meta.env.VITE_RENTCAST_KEY }
  // });
  // return res.json();

  // Mock response for now
  await new Promise(r => setTimeout(r, 800)); // simulate network delay
  return {
    address,
    estimatedValue: Math.floor(Math.random() * 400000) + 200000,
    estimatedRent:  Math.floor(Math.random() * 2000)   + 1000,
    bedrooms: 3,
    bathrooms: 2,
    sqft: 1450,
    yearBuilt: 2001,
    lastSalePrice: Math.floor(Math.random() * 350000) + 150000,
    lastSaleDate: "2022-06-14",
  };
}

// ── Document & Receipt CRUD helpers ──────────────────────────────────────────
export function getPropertyDocuments(propertyId) { return PROPERTY_DOCUMENTS.filter(d => d.propertyId === propertyId); }
export function addPropertyDocument(doc) { PROPERTY_DOCUMENTS.push(doc); return doc; }
export function deletePropertyDocument(id) { const i = PROPERTY_DOCUMENTS.findIndex(d => d.id === id); if (i !== -1) PROPERTY_DOCUMENTS.splice(i, 1); }

export function getDealDocuments(dealId) { return DEAL_DOCUMENTS.filter(d => d.dealId === dealId); }
export function addDealDocument(doc) { DEAL_DOCUMENTS.push(doc); return doc; }
export function deleteDealDocument(id) { const i = DEAL_DOCUMENTS.findIndex(d => d.id === id); if (i !== -1) DEAL_DOCUMENTS.splice(i, 1); }

export function getTenantDocuments(tenantId) { return TENANT_DOCUMENTS.filter(d => d.tenantId === tenantId); }
export function addTenantDocument(doc) { TENANT_DOCUMENTS.push(doc); return doc; }
export function deleteTenantDocument(id) { const i = TENANT_DOCUMENTS.findIndex(d => d.id === id); if (i !== -1) TENANT_DOCUMENTS.splice(i, 1); }

export function getMaintenanceRequests(tenantId) { return MAINTENANCE_REQUESTS.filter(r => r.tenantId === tenantId); }
export function addMaintenanceRequest(r) { MAINTENANCE_REQUESTS.push(r); return r; }
export function updateMaintenanceRequest(id, updates) { const i = MAINTENANCE_REQUESTS.findIndex(r => r.id === id); if (i !== -1) Object.assign(MAINTENANCE_REQUESTS[i], updates); return MAINTENANCE_REQUESTS[i]; }

export function getTransactionReceipts(transactionId) { return TRANSACTION_RECEIPTS.filter(r => r.transactionId === transactionId); }
export function addTransactionReceipt(r) { TRANSACTION_RECEIPTS.push(r); return r; }
export function deleteTransactionReceipt(id) { const i = TRANSACTION_RECEIPTS.findIndex(r => r.id === id); if (i !== -1) TRANSACTION_RECEIPTS.splice(i, 1); }

export function getDealExpenseReceipts(expenseId) { return DEAL_EXPENSE_RECEIPTS.filter(r => r.expenseId === expenseId); }
export function addDealExpenseReceipt(r) { DEAL_EXPENSE_RECEIPTS.push(r); return r; }
export function deleteDealExpenseReceipt(id) { const i = DEAL_EXPENSE_RECEIPTS.findIndex(r => r.id === id); if (i !== -1) DEAL_EXPENSE_RECEIPTS.splice(i, 1); }

// ── Mock OCR — simulates receipt scanning ────────────────────────────────────
// In production, replace with Google Cloud Vision / AWS Textract API call.
// Returns a promise that resolves with extracted fields after a simulated delay.
export async function mockOcrScan(file) {
  await new Promise(r => setTimeout(r, 1200)); // simulate processing time
  // Generate plausible receipt data based on filename hints
  const name = (file.name || "").toLowerCase();
  const vendors = {
    homedepot: { vendor: "Home Depot", categories: ["Materials & Supplies"] },
    lowes:     { vendor: "Lowe's", categories: ["Materials & Supplies"] },
    sherwin:   { vendor: "Sherwin-Williams", categories: ["Materials & Supplies"] },
    statefarm: { vendor: "State Farm", categories: ["Insurance"] },
    hvac:      { vendor: "AirPro HVAC Services", categories: ["Maintenance"] },
    plumbing:  { vendor: "ABC Plumbing", categories: ["Maintenance"] },
    permit:    { vendor: "City Permits Office", categories: ["Permits"] },
    electric:  { vendor: "Elite Electric", categories: ["Utilities"] },
  };
  let match = null;
  for (const [key, val] of Object.entries(vendors)) {
    if (name.includes(key)) { match = val; break; }
  }
  if (!match) {
    // Fallback: generate generic receipt data
    const genericVendors = ["Home Depot", "Lowe's", "Ace Hardware", "Menards", "Harbor Freight"];
    match = { vendor: genericVendors[Math.floor(Math.random() * genericVendors.length)], categories: ["Materials & Supplies"] };
  }
  const amount = parseFloat((Math.random() * 500 + 20).toFixed(2));
  const today = new Date().toISOString().slice(0, 10);
  return {
    vendor: match.vendor,
    amount,
    date: today,
    category: match.categories[0],
    tax: parseFloat((amount * 0.0825).toFixed(2)),
    subtotal: parseFloat((amount - amount * 0.0825).toFixed(2)),
    confidence: 0.87 + Math.random() * 0.12, // 87-99% confidence
    lineItems: [
      { description: "Item from receipt", qty: 1, amount },
    ],
  };
}
