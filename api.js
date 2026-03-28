// =============================================================================
// RealVault API Service Layer
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
export const PROP_COLORS  = ["#3b82f6","#10b981","#8b5cf6","#f59e0b","#ef4444","#06b6d4","#ec4899"];
export const FLIP_COLORS  = ["#f59e0b","#10b981","#8b5cf6","#3b82f6","#ef4444","#06b6d4"];
export const STAGE_ORDER  = ["Under Contract","Active Rehab","Listed","Sold"];
export const STAGE_COLORS = {
  "Under Contract": { bg: "#ede9fe", text: "#6d28d9", dot: "#8b5cf6" },
  "Active Rehab":   { bg: "#fef9c3", text: "#a16207", dot: "#f59e0b" },
  "Listed":         { bg: "#dbeafe", text: "#1d4ed8", dot: "#3b82f6" },
  "Sold":           { bg: "#dcfce7", text: "#15803d", dot: "#10b981" },
};
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
  { id:1, name:"Maple Ridge Duplex",     address:"2847 Maple Ridge Dr, Austin, TX 78701",         type:"Multi-Family",  units:2, purchasePrice:385000,  currentValue:462000,  mortgage:298000, monthlyRent:3800, monthlyExpenses:1640, purchaseDate:"2021-03-15", status:"Occupied",         image:"MR", capRate:7.2, cashOnCash:9.1,  color:"#3b82f6" },
  { id:2, name:"Lakeview SFR",           address:"518 Lakeview Terrace, Denver, CO 80203",         type:"Single Family", units:1, purchasePrice:520000,  currentValue:598000,  mortgage:410000, monthlyRent:2950, monthlyExpenses:1120, purchaseDate:"2020-07-22", status:"Occupied",         image:"LV", capRate:5.6, cashOnCash:7.4,  color:"#10b981" },
  { id:3, name:"Midtown Condo #4B",      address:"1200 Peachtree St NE #4B, Atlanta, GA 30309",    type:"Condo",         units:1, purchasePrice:280000,  currentValue:315000,  mortgage:194000, monthlyRent:2100, monthlyExpenses:860,  purchaseDate:"2022-01-10", status:"Occupied",         image:"MC", capRate:6.9, cashOnCash:8.3,  color:"#8b5cf6" },
  { id:4, name:"Riverside Triplex",      address:"744 Riverside Blvd, Portland, OR 97201",         type:"Multi-Family",  units:3, purchasePrice:670000,  currentValue:745000,  mortgage:520000, monthlyRent:5700, monthlyExpenses:2380, purchaseDate:"2019-11-05", status:"Partial Vacancy",  image:"RT", capRate:8.1, cashOnCash:10.2, color:"#f59e0b" },
  { id:5, name:"Sunset Strip Commercial",address:"9220 Sunset Blvd, West Hollywood, CA 90069",     type:"Commercial",    units:1, purchasePrice:1200000, currentValue:1380000, mortgage:920000, monthlyRent:8500, monthlyExpenses:3200, purchaseDate:"2018-06-30", status:"Occupied",         image:"SS", capRate:7.0, cashOnCash:6.8,  color:"#ef4444" },
];

const _transactions = [
  { id:1,  date:"2026-03-20", property:"Maple Ridge Duplex",      category:"Rent Income",  description:"March rent - Unit A",           amount:1900,  type:"income"  },
  { id:2,  date:"2026-03-20", property:"Maple Ridge Duplex",      category:"Rent Income",  description:"March rent - Unit B",           amount:1900,  type:"income"  },
  { id:3,  date:"2026-03-18", property:"Riverside Triplex",       category:"Maintenance",  description:"HVAC repair - Unit 2",          amount:-420,  type:"expense" },
  { id:4,  date:"2026-03-15", property:"Lakeview SFR",            category:"Rent Income",  description:"March rent",                    amount:2950,  type:"income"  },
  { id:5,  date:"2026-03-12", property:"Midtown Condo #4B",       category:"HOA Fees",     description:"Monthly HOA",                   amount:-285,  type:"expense" },
  { id:6,  date:"2026-03-10", property:"Sunset Strip Commercial", category:"Rent Income",  description:"March commercial rent",         amount:8500,  type:"income"  },
  { id:7,  date:"2026-03-08", property:"Riverside Triplex",       category:"Rent Income",  description:"March rent - Units 1,2,3",      amount:5700,  type:"income"  },
  { id:8,  date:"2026-03-05", property:"Maple Ridge Duplex",      category:"Insurance",    description:"Q1 property insurance",         amount:-1200, type:"expense" },
  { id:9,  date:"2026-03-03", property:"Lakeview SFR",            category:"Property Tax", description:"Semi-annual tax payment",       amount:-2100, type:"expense" },
  { id:10, date:"2026-03-01", property:"Midtown Condo #4B",       category:"Rent Income",  description:"March rent",                    amount:2100,  type:"income"  },
  { id:11, date:"2026-02-28", property:"Sunset Strip Commercial", category:"Maintenance",  description:"Parking lot reseal",            amount:-3500, type:"expense" },
  { id:12, date:"2026-02-20", property:"Riverside Triplex",       category:"Mortgage",     description:"February mortgage",             amount:-2840, type:"expense" },
  { id:13, date:"2026-02-15", property:"Maple Ridge Duplex",      category:"Mortgage",     description:"February mortgage",             amount:-1620, type:"expense" },
  { id:14, date:"2026-02-10", property:"Lakeview SFR",            category:"Landscaping",  description:"Monthly lawn service",          amount:-180,  type:"expense" },
  { id:15, date:"2026-02-05", property:"Midtown Condo #4B",       category:"Utilities",    description:"Common area utilities",         amount:-95,   type:"expense" },
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

export const FLIPS = [
  {
    id:1, name:"Oakdale Craftsman", address:"1422 Oakdale Ave, Nashville, TN 37206",
    stage:"Active Rehab", image:"OC", color:"#f59e0b",
    purchasePrice:195000, arv:310000, rehabBudget:62000, rehabSpent:38500,
    holdingCostsPerMonth:1850, acquisitionDate:"2026-01-08", rehabStartDate:"2026-01-20",
    projectedListDate:"2026-04-15", projectedCloseDate:"2026-05-30", daysOwned:75,
    rehabItems:[
      { category:"Kitchen",          budgeted:18000, spent:16200, status:"complete",    contractorId:null },
      { category:"Bathrooms (2)",    budgeted:12000, spent:11500, status:"complete",    contractorId:1    },
      { category:"Flooring",         budgeted:8500,  spent:5200,  status:"in-progress", contractorId:null },
      { category:"Roof",             budgeted:9500,  spent:5600,  status:"in-progress", contractorId:null },
      { category:"Exterior / Paint", budgeted:6000,  spent:0,     status:"pending",     contractorId:null },
      { category:"HVAC",             budgeted:5500,  spent:0,     status:"pending",     contractorId:null },
      { category:"Landscaping",      budgeted:2500,  spent:0,     status:"pending",     contractorId:null },
    ],
  },
  {
    id:2, name:"Pine Street Ranch", address:"874 Pine Street, Memphis, TN 38104",
    stage:"Listed", image:"PS", color:"#10b981",
    purchasePrice:148000, arv:229000, listPrice:229000, rehabBudget:38000, rehabSpent:39200,
    holdingCostsPerMonth:1420, acquisitionDate:"2025-10-14", rehabStartDate:"2025-10-28",
    rehabEndDate:"2026-01-15", listDate:"2026-01-22", daysOwned:161,
    rehabItems:[
      { category:"Kitchen",          budgeted:14000, spent:15200, status:"complete", contractorId:null },
      { category:"Bathroom",         budgeted:7000,  spent:7400,  status:"complete", contractorId:null },
      { category:"Flooring",         budgeted:6500,  spent:6800,  status:"complete", contractorId:4    },
      { category:"Windows",          budgeted:5500,  spent:5400,  status:"complete", contractorId:5    },
      { category:"Electrical",       budgeted:3000,  spent:3100,  status:"complete", contractorId:null },
      { category:"Exterior / Paint", budgeted:2000,  spent:1300,  status:"complete", contractorId:null },
    ],
  },
  {
    id:3, name:"Hawthorne Heights", address:"3305 Hawthorne Blvd, Charlotte, NC 28205",
    stage:"Under Contract", image:"HH", color:"#8b5cf6",
    purchasePrice:268000, arv:445000, rehabBudget:95000, rehabSpent:0,
    holdingCostsPerMonth:2600, contractDate:"2026-03-10", projectedCloseDate:"2026-04-05", daysOwned:0,
    rehabItems:[
      { category:"Full Kitchen Remodel",   budgeted:28000, spent:0, status:"pending", contractorId:null },
      { category:"Master Bath",            budgeted:18000, spent:0, status:"pending", contractorId:null },
      { category:"Secondary Baths (2)",    budgeted:14000, spent:0, status:"pending", contractorId:null },
      { category:"Addition / Expansion",   budgeted:22000, spent:0, status:"pending", contractorId:null },
      { category:"Flooring",               budgeted:8000,  spent:0, status:"pending", contractorId:null },
      { category:"Roof & Gutters",         budgeted:5000,  spent:0, status:"pending", contractorId:null },
    ],
  },
  {
    id:4, name:"Birchwood Colonial", address:"612 Birchwood Lane, Raleigh, NC 27601",
    stage:"Sold", image:"BC", color:"#6b7280",
    purchasePrice:220000, arv:358000, salePrice:361500, rehabBudget:55000, rehabSpent:52800,
    holdingCostsPerMonth:2100, acquisitionDate:"2025-04-12", rehabStartDate:"2025-04-25",
    rehabEndDate:"2025-07-10", listDate:"2025-07-18", closeDate:"2025-08-29",
    daysOwned:139, totalHoldingCosts:9730, sellingCosts:21690, netProfit:61280,
    rehabItems:[
      { category:"Kitchen",          budgeted:16000, spent:15600, status:"complete" },
      { category:"Bathrooms (2)",    budgeted:13000, spent:12400, status:"complete" },
      { category:"Basement Finish",  budgeted:12000, spent:11800, status:"complete" },
      { category:"HVAC",             budgeted:7500,  spent:7200,  status:"complete" },
      { category:"Flooring",         budgeted:4500,  spent:4300,  status:"complete" },
      { category:"Exterior",         budgeted:2000,  spent:1500,  status:"complete" },
    ],
  },
];

export const FLIP_EXPENSES = [
  { id:1,  flipId:1, date:"2026-03-18", vendor:"Home Depot",        category:"Materials/Supplies",    description:"Hardwood flooring - 680 sqft",        amount:2890 },
  { id:2,  flipId:1, date:"2026-03-15", vendor:"ABC Plumbing",      category:"Subcontractor",         description:"Master bath rough-in",                amount:3200 },
  { id:3,  flipId:1, date:"2026-03-10", vendor:"Lowe's",            category:"Materials/Supplies",    description:"Kitchen cabinet hardware + fixtures", amount:640  },
  { id:4,  flipId:1, date:"2026-03-04", vendor:"City of Nashville", category:"Permits & Inspections", description:"Renovation permit",                   amount:380  },
  { id:5,  flipId:1, date:"2026-02-28", vendor:"Elite Electric",    category:"Subcontractor",         description:"Panel upgrade + recessed lighting",   amount:4100 },
  { id:6,  flipId:1, date:"2026-02-20", vendor:"Lowe's",            category:"Materials/Supplies",    description:"Kitchen cabinets - shaker style",     amount:5800 },
  { id:7,  flipId:1, date:"2026-02-14", vendor:"Budget Dumpster",   category:"Dump Fees",             description:"Demo debris removal",                 amount:420  },
  { id:8,  flipId:2, date:"2026-01-12", vendor:"Sherwin-Williams",  category:"Materials/Supplies",    description:"Interior/exterior paint + supplies",  amount:1150 },
  { id:9,  flipId:2, date:"2026-01-08", vendor:"Pro Flooring Co.",  category:"Subcontractor",         description:"LVP install - 1,100 sqft",            amount:3900 },
  { id:10, flipId:2, date:"2025-12-20", vendor:"Home Depot",        category:"Appliances",            description:"Stainless appliance package",         amount:2400 },
  { id:11, flipId:2, date:"2025-12-10", vendor:"Jim's Windows",     category:"Subcontractor",         description:"Replace 8 windows",                   amount:5400 },
  { id:12, flipId:2, date:"2025-11-18", vendor:"City of Memphis",   category:"Permits & Inspections", description:"Electrical & structural permits",      amount:295  },
  { id:13, flipId:4, date:"2025-07-02", vendor:"Summit HVAC",       category:"Subcontractor",         description:"Full HVAC replacement",               amount:7200 },
  { id:14, flipId:4, date:"2025-06-15", vendor:"Habitat Flooring",  category:"Materials/Supplies",    description:"Engineered hardwood - whole house",   amount:4300 },
  { id:15, flipId:4, date:"2025-06-01", vendor:"Raleigh Tile Co.",  category:"Subcontractor",         description:"Master bath tile work",               amount:3100 },
];

export const CONTRACTORS = [
  { id:1, flipId:1, name:"ABC Plumbing",   trade:"Plumbing",   paymentType:"Fixed Bid", totalBid:8500, totalPaid:3200, status:"active",   phone:"615-555-0182" },
  { id:2, flipId:1, name:"Elite Electric", trade:"Electrical", paymentType:"Fixed Bid", totalBid:4100, totalPaid:4100, status:"complete", phone:"615-555-0247" },
  { id:3, flipId:1, name:"Nash Drywall",   trade:"Drywall",    paymentType:"Day Rate",  dayRate:450,   totalPaid:0,    status:"pending",  phone:"615-555-0318" },
  { id:4, flipId:2, name:"Pro Flooring Co.", trade:"Flooring", paymentType:"Fixed Bid", totalBid:3900, totalPaid:3900, status:"complete", phone:"901-555-0144" },
  { id:5, flipId:2, name:"Jim's Windows",  trade:"Windows",    paymentType:"Fixed Bid", totalBid:5400, totalPaid:5400, status:"complete", phone:"901-555-0229" },
  { id:6, flipId:4, name:"Summit HVAC",    trade:"HVAC",       paymentType:"Fixed Bid", totalBid:7200, totalPaid:7200, status:"complete", phone:"919-555-0361" },
];

const _flipMilestones = {
  1: [
    { label:"Contract Executed",           done:true,  date:"2026-01-06" },
    { label:"Inspection Complete",         done:true,  date:"2026-01-07" },
    { label:"Purchased / Closed",          done:true,  date:"2026-01-08" },
    { label:"Demo Complete",               done:true,  date:"2026-01-22" },
    { label:"Rough-In (Plumbing/Electric)",done:true,  date:"2026-02-10" },
    { label:"Drywall",                     done:true,  date:"2026-02-24" },
    { label:"Paint",                       done:false, date:null },
    { label:"Flooring",                    done:false, date:null },
    { label:"Kitchen & Baths",             done:false, date:null },
    { label:"Punch List",                  done:false, date:null },
    { label:"Listed for Sale",             done:false, date:null },
    { label:"Sold / Closed",               done:false, date:null },
  ],
  2: DEFAULT_MILESTONES.map((label, i) => ({ label, done: i < 11, date: i < 11 ? "2026-01-15" : null })),
  3: DEFAULT_MILESTONES.slice(0, 3).map((label, i) => ({ label, done: i < 2, date: i < 2 ? "2026-03-12" : null })),
  4: DEFAULT_MILESTONES.map(label => ({ label, done: true, date: "2025-08-29" })),
};

const _tenants = [
  { id:1, propertyId:1, unit:"Unit A",    name:"Marcus & Priya Williams",    rent:1900, leaseStart:"2024-02-01", leaseEnd:"2025-01-31", status:"current",        daysUntilExpiry:40,  lastPayment:"2026-03-01", phone:"512-555-0143", email:"mwilliams@email.com"   },
  { id:2, propertyId:1, unit:"Unit B",    name:"Jordan Lee",                 rent:1900, leaseStart:"2023-08-01", leaseEnd:"2024-07-31", status:"month-to-month", daysUntilExpiry:null,lastPayment:"2026-03-01", phone:"512-555-0287", email:"jlee@email.com"        },
  { id:3, propertyId:2, unit:"Main",      name:"Stephanie & Dan Kowalski",   rent:2950, leaseStart:"2024-06-01", leaseEnd:"2025-05-31", status:"current",        daysUntilExpiry:68,  lastPayment:"2026-03-15", phone:"303-555-0194", email:"kowalski@email.com"    },
  { id:4, propertyId:3, unit:"#4B",       name:"Alexis Fontaine",            rent:2100, leaseStart:"2025-01-01", leaseEnd:"2025-12-31", status:"current",        daysUntilExpiry:282, lastPayment:"2026-03-01", phone:"404-555-0362", email:"afontaine@email.com"   },
  { id:5, propertyId:4, unit:"Unit 1",    name:"Ryan & Keisha Thompson",     rent:1950, leaseStart:"2024-09-01", leaseEnd:"2025-08-31", status:"current",        daysUntilExpiry:159, lastPayment:"2026-03-08", phone:"503-555-0218", email:"kthompson@email.com"   },
  { id:6, propertyId:4, unit:"Unit 2",    name:"Vacant",                     rent:1875, leaseStart:null,         leaseEnd:null,         status:"vacant",         daysUntilExpiry:null,lastPayment:null,          phone:null,           email:null                    },
  { id:7, propertyId:4, unit:"Unit 3",    name:"Carlos Mendez",              rent:1875, leaseStart:"2025-03-01", leaseEnd:"2026-02-28", status:"month-to-month", daysUntilExpiry:null,lastPayment:"2026-03-08", phone:"503-555-0445", email:"cmendez@email.com"     },
  { id:8, propertyId:5, unit:"Commercial",name:"Pacific Rim Restaurant Group",rent:8500,leaseStart:"2023-01-01", leaseEnd:"2027-12-31", status:"current",        daysUntilExpiry:648, lastPayment:"2026-03-10", phone:"310-555-0501", email:"leasing@pacificrimrg.com"},
];

const _mileageTrips = [
  { id:1, date:"2026-03-22", description:"Inspect Oakdale Craftsman - contractor walkthrough", from:"Home", to:"1422 Oakdale Ave, Nashville",     miles:14.2, purpose:"Flip",     businessPct:100 },
  { id:2, date:"2026-03-20", description:"Collect rent - Maple Ridge Duplex",                  from:"Home", to:"2847 Maple Ridge Dr, Austin",     miles:8.5,  purpose:"Rental",   businessPct:100 },
  { id:3, date:"2026-03-18", description:"Meet plumber - Oakdale Craftsman",                   from:"Home", to:"1422 Oakdale Ave, Nashville",     miles:14.2, purpose:"Flip",     businessPct:100 },
  { id:4, date:"2026-03-15", description:"Annual inspection - Lakeview SFR",                   from:"Home", to:"518 Lakeview Terrace, Denver",    miles:22.7, purpose:"Rental",   businessPct:100 },
  { id:5, date:"2026-03-12", description:"Pine Street Ranch showing",                          from:"Home", to:"874 Pine Street, Memphis",        miles:18.9, purpose:"Flip",     businessPct:100 },
  { id:6, date:"2026-03-10", description:"Commercial property check-in",                       from:"Home", to:"9220 Sunset Blvd, W Hollywood",   miles:31.4, purpose:"Rental",   businessPct:100 },
  { id:7, date:"2026-03-05", description:"Riverside Triplex - maintenance call",               from:"Home", to:"744 Riverside Blvd, Portland",    miles:12.1, purpose:"Rental",   businessPct:100 },
  { id:8, date:"2026-02-28", description:"Accountant meeting - tax prep",                      from:"Home", to:"Downtown Office",                 miles:9.3,  purpose:"Business", businessPct:100 },
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
// Flips
// -----------------------------------------------------------------------------
export function getFlips()              { return Promise.resolve([...FLIPS]);         }
export function addFlip(flip)           { FLIPS.push(flip); return Promise.resolve(flip); }
export function updateFlip(id, updates) {
  const i = FLIPS.findIndex(f => f.id === id);
  if (i !== -1) Object.assign(FLIPS[i], updates);
  return Promise.resolve(FLIPS[i]);
}
export function getFlipExpenses(flipId) {
  return Promise.resolve(FLIP_EXPENSES.filter(e => e.flipId === flipId));
}
export function addFlipExpense(exp)     { FLIP_EXPENSES.push(exp); return Promise.resolve(exp); }
export function getContractors(flipId)  {
  return Promise.resolve(CONTRACTORS.filter(c => c.flipId === flipId));
}
export function addContractor(c)        { CONTRACTORS.push(c); return Promise.resolve(c); }
export function getFlipMilestones(flipId) {
  return Promise.resolve([...(_flipMilestones[flipId] || DEFAULT_MILESTONES.map(label => ({ label, done: false, date: null })))]);
}
export function updateFlipMilestones(flipId, milestones) {
  _flipMilestones[flipId] = milestones;
  return Promise.resolve(milestones);
}

// -----------------------------------------------------------------------------
// Tenants / Rent Roll
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
