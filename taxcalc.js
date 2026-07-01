/* TaxClear Canada — Shared Tax Logic (2026) */

const FED_BRACKETS = [
  { min: 0,      max: 55867,   rate: 0.15  },
  { min: 55867,  max: 111733,  rate: 0.205 },
  { min: 111733, max: 154906,  rate: 0.26  },
  { min: 154906, max: 220000,  rate: 0.29  },
  { min: 220000, max: Infinity,rate: 0.33  }
];
const FED_BPA        = 15705;
const RRSP_MAX_2026  = 31560;
const CPP_RATE       = 0.0595;
const CPP_MIN        = 3500;
const CPP_MAX_EARN   = 68500;
const CPP2_RATE      = 0.04;
const CPP2_MAX_EARN  = 73200;
const EI_RATE        = 0.0166;
const EI_MAX_EARN    = 63200;
const EI_ER_MULT     = 1.4;

const PROV_DATA = {
  ON: { name:'Ontario',                  abbr:'ON', bpa:11865,
        brackets:[{min:0,max:51446,rate:.0505},{min:51446,max:102894,rate:.0915},{min:102894,max:150000,rate:.1116},{min:150000,max:220000,rate:.1216},{min:220000,max:Infinity,rate:.1316}],
        corp:{ sbd:.122, gen:.265, eligDTC:.100, nonEligDTC:.0312 } },
  BC: { name:'British Columbia',         abbr:'BC', bpa:11981,
        brackets:[{min:0,max:45654,rate:.0506},{min:45654,max:91310,rate:.077},{min:91310,max:104835,rate:.105},{min:104835,max:127299,rate:.1229},{min:127299,max:172602,rate:.147},{min:172602,max:240716,rate:.168},{min:240716,max:Infinity,rate:.205}],
        corp:{ sbd:.11,  gen:.27,  eligDTC:.120, nonEligDTC:.0393 } },
  AB: { name:'Alberta',                  abbr:'AB', bpa:21003,
        brackets:[{min:0,max:148269,rate:.10},{min:148269,max:177922,rate:.12},{min:177922,max:237230,rate:.13},{min:237230,max:355845,rate:.14},{min:355845,max:Infinity,rate:.15}],
        corp:{ sbd:.11,  gen:.23,  eligDTC:.100, nonEligDTC:.0225 } },
  QC: { name:'Québec',                   abbr:'QC', bpa:17183,
        brackets:[{min:0,max:51780,rate:.14},{min:51780,max:103545,rate:.19},{min:103545,max:126000,rate:.24},{min:126000,max:Infinity,rate:.2575}],
        corp:{ sbd:.122, gen:.265, eligDTC:.119, nonEligDTC:.0705 } },
  SK: { name:'Saskatchewan',             abbr:'SK', bpa:17661,
        brackets:[{min:0,max:49720,rate:.105},{min:49720,max:142058,rate:.125},{min:142058,max:Infinity,rate:.145}],
        corp:{ sbd:.10,  gen:.27,  eligDTC:.110, nonEligDTC:.0363 } },
  MB: { name:'Manitoba',                 abbr:'MB', bpa:15780,
        brackets:[{min:0,max:36842,rate:.108},{min:36842,max:79625,rate:.1275},{min:79625,max:Infinity,rate:.174}],
        corp:{ sbd:.09,  gen:.27,  eligDTC:.080, nonEligDTC:.010  } },
  NS: { name:'Nova Scotia',              abbr:'NS', bpa:8481,
        brackets:[{min:0,max:29590,rate:.0879},{min:29590,max:59180,rate:.1495},{min:59180,max:93000,rate:.1667},{min:93000,max:150000,rate:.175},{min:150000,max:Infinity,rate:.21}],
        corp:{ sbd:.12,  gen:.29,  eligDTC:.0885,nonEligDTC:.045  } },
  NB: { name:'New Brunswick',            abbr:'NB', bpa:12458,
        brackets:[{min:0,max:44887,rate:.094},{min:44887,max:89775,rate:.14},{min:89775,max:145955,rate:.16},{min:145955,max:Infinity,rate:.195}],
        corp:{ sbd:.115, gen:.29,  eligDTC:.140, nonEligDTC:.0464 } },
  NL: { name:'Newfoundland & Labrador',  abbr:'NL', bpa:10818,
        brackets:[{min:0,max:43198,rate:.087},{min:43198,max:86395,rate:.145},{min:86395,max:154244,rate:.158},{min:154244,max:215943,rate:.178},{min:215943,max:275870,rate:.198},{min:275870,max:Infinity,rate:.208}],
        corp:{ sbd:.12,  gen:.30,  eligDTC:.051, nonEligDTC:.045  } },
  PE: { name:'Prince Edward Island',     abbr:'PE', bpa:12000,
        brackets:[{min:0,max:32656,rate:.098},{min:32656,max:64313,rate:.138},{min:64313,max:105000,rate:.167},{min:105000,max:140000,rate:.18},{min:140000,max:Infinity,rate:.185}],
        corp:{ sbd:.10,  gen:.31,  eligDTC:.100, nonEligDTC:.035  } }
};

function calcBracketTax(income, brackets) {
  let tax = 0;
  for (const b of brackets) {
    if (income <= b.min) break;
    tax += (Math.min(income, b.max) - b.min) * b.rate;
  }
  return tax;
}

function getMarginal(income, brackets) {
  for (let i = brackets.length - 1; i >= 0; i--) {
    if (income > brackets[i].min) return brackets[i].rate;
  }
  return brackets[0].rate;
}

function calcCPP(emp) {
  return Math.min(Math.max(emp - CPP_MIN, 0), CPP_MAX_EARN - CPP_MIN) * CPP_RATE;
}
function calcEI(emp) {
  return Math.min(emp, EI_MAX_EARN) * EI_RATE;
}

function calcPersonalTax(netIncome, province) {
  const p = PROV_DATA[province] || PROV_DATA.ON;
  let fed = Math.max(0, calcBracketTax(netIncome, FED_BRACKETS) - FED_BPA * 0.15);
  let prov = Math.max(0, calcBracketTax(netIncome, p.brackets) - p.bpa * (p.brackets[0]?.rate || 0.05));
  return { fed, prov, total: fed + prov };
}

function calcTax({ province, employment=0, selfEmployment=0, investment=0, capitalGains=0, rrsp=0, dues=0, childcare=0, moving=0 }) {
  const p = PROV_DATA[province] || PROV_DATA.ON;
  const totalIncome = employment + selfEmployment + investment + capitalGains * 0.5;
  const totalDeductions = rrsp + dues + childcare + moving;
  const netIncome = Math.max(0, totalIncome - totalDeductions);
  const cpp = calcCPP(employment);
  const ei  = calcEI(employment);
  const { fed: fedTax, prov: provTax } = calcPersonalTax(netIncome, province);
  const totalTax = fedTax + provTax + cpp + ei;
  const afterTax = totalIncome - totalTax;
  const effectiveRate = totalIncome > 0 ? totalTax / totalIncome : 0;
  const fedMarginal  = getMarginal(netIncome, FED_BRACKETS);
  const provMarginal = getMarginal(netIncome, p.brackets);
  const marginalRate = fedMarginal + provMarginal;
  const rrspRoom    = Math.min(totalIncome * 0.18, RRSP_MAX_2026);
  const rrspSaved   = rrsp * marginalRate;
  const rrspRemain  = Math.max(0, rrspRoom - rrsp);
  return {
    totalIncome, totalDeductions, netIncome, cpp, ei,
    fedTax, provTax, totalTax, afterTax,
    effectiveRate, marginalRate, fedMarginal, provMarginal,
    bpaCredit: FED_BPA * 0.15,
    rrspRoom, rrspSaved, rrspRemain
  };
}

function calcRRSP({ balance, annual, years, returnRate, province, income }) {
  const r = returnRate / 100;
  const n = years;
  const projected = balance * Math.pow(1 + r, n) + (r > 0 ? annual * (Math.pow(1 + r, n) - 1) / r : annual * n);
  const totalContrib = balance + annual * n;
  const growth = projected - totalContrib;
  const p = PROV_DATA[province] || PROV_DATA.ON;
  const netIncome = Math.max(0, income);
  const marginal = getMarginal(netIncome, FED_BRACKETS) + getMarginal(netIncome, p.brackets);
  const refundThisYear = annual * marginal;
  const milestones = [];
  for (let y = 5; y <= Math.max(n, 5); y += 5) {
    if (y > n) break;
    const v = balance * Math.pow(1 + r, y) + (r > 0 ? annual * (Math.pow(1 + r, y) - 1) / r : annual * y);
    milestones.push({ year: y, value: v });
  }
  milestones.push({ year: n, value: projected });
  return { projected, totalContrib, growth, refundThisYear, marginal, milestones };
}

function calcCapGains({ purchasePrice, salePrice, otherIncome, province }) {
  const gain = salePrice - purchasePrice;
  const taxable = Math.max(0, gain) * 0.5;
  const p = PROV_DATA[province] || PROV_DATA.ON;
  const baseNet = Math.max(0, otherIncome);
  const t0 = calcPersonalTax(baseNet, province);
  const t1 = calcPersonalTax(baseNet + taxable, province);
  const taxOnGain = (t1.fed + t1.prov) - (t0.fed + t0.prov);
  const afterTaxProceeds = salePrice - taxOnGain;
  const afterTaxProfit = gain - taxOnGain;
  const effectiveGainsRate = gain > 0 ? taxOnGain / gain : 0;
  const marginal = getMarginal(baseNet + taxable, FED_BRACKETS) + getMarginal(baseNet + taxable, p.brackets);
  return { gain, taxable, taxOnGain, afterTaxProceeds, afterTaxProfit, effectiveGainsRate, marginal };
}

function calcCPP2(emp) {
  return Math.min(Math.max(emp - CPP_MAX_EARN, 0), CPP2_MAX_EARN - CPP_MAX_EARN) * CPP2_RATE;
}

function calcCPPEI({ employment, selfEmployed, eiOptin = false }) {
  const cpp1Emp = calcCPP(employment);
  const cpp2Emp = calcCPP2(employment);
  const eiEmp   = (!selfEmployed || eiOptin) ? calcEI(employment) : 0;
  const eiEr    = (!selfEmployed) ? eiEmp * EI_ER_MULT : 0;
  const totalEmployee = cpp1Emp + cpp2Emp + eiEmp;
  return {
    cpp1Employee: cpp1Emp,
    cpp1Employer: cpp1Emp,
    cpp2Employee: cpp2Emp,
    cpp2Employer: cpp2Emp,
    eiEmployee: eiEmp,
    eiEmployer: eiEr,
    totalEmployee
  };
}

function calcSalaryDividend({ corpIncome, province, otherIncome }) {
  const p = PROV_DATA[province] || PROV_DATA.ON;
  const base = Math.max(0, otherIncome);

  // Salary scenario: corp deducts salary, no corp tax
  const salBase = base + corpIncome;
  const salNet  = Math.max(0, salBase);
  const salTax  = calcPersonalTax(salNet, province);
  const salCPP  = calcCPP(corpIncome);
  const salEI   = calcEI(corpIncome);
  const salAfterTax = corpIncome - (salTax.total - calcPersonalTax(base, province).total) - salCPP - salEI;

  // Non-eligible dividends (Small Business)
  const sbdTax    = corpIncome * p.corp.sbd;
  const sbdNet    = corpIncome - sbdTax;
  const sbdGross  = sbdNet * 1.15;
  const t0        = calcPersonalTax(base, province);
  const t1ne      = calcPersonalTax(base + sbdGross, province);
  const fedDTCne  = sbdGross * 0.090301;
  const prvDTCne  = sbdGross * p.corp.nonEligDTC;
  const persTaxNE = Math.max(0, (t1ne.total - t0.total) - fedDTCne - prvDTCne);
  const neAfterTax = sbdNet - persTaxNE;

  // Eligible dividends (General Rate)
  const genTax    = corpIncome * p.corp.gen;
  const genNet    = corpIncome - genTax;
  const eligGross = genNet * 1.38;
  const t1el      = calcPersonalTax(base + eligGross, province);
  const fedDTCel  = eligGross * 0.150198;
  const prvDTCel  = eligGross * p.corp.eligDTC;
  const persTaxEL = Math.max(0, (t1el.total - t0.total) - fedDTCel - prvDTCel);
  const elAfterTax = genNet - persTaxEL;

  const best = Math.max(salAfterTax, neAfterTax, elAfterTax);
  return {
    salary:    { afterTax: salAfterTax,  corpTax: 0,       persTax: salTax.total - t0.total + salCPP + salEI },
    nonElig:   { afterTax: neAfterTax,   corpTax: sbdTax,  persTax: persTaxNE },
    eligible:  { afterTax: elAfterTax,   corpTax: genTax,  persTax: persTaxEL },
    best: salAfterTax === best ? 'salary' : neAfterTax === best ? 'nonElig' : 'eligible'
  };
}

/* ---- Formatting ---- */
function fmt(n)    { return '$' + Math.round(n).toLocaleString('en-CA'); }
function fmtPct(r) { return (r * 100).toFixed(1) + '%'; }
function fmtK(n)   { return n >= 1000 ? '$' + (n/1000).toFixed(n >= 100000 ? 0 : 1) + 'K' : fmt(n); }

/* ---- Shareable URL ---- */
function readURLParams(defaults) {
  const p = new URLSearchParams(window.location.search);
  const out = {};
  for (const [k, v] of Object.entries(defaults)) {
    out[k] = p.has(k) ? p.get(k) : v;
  }
  return out;
}

function pushURLParams(params) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '' && v !== '0' && v !== 0) u.set(k, v);
  }
  history.replaceState(null, '', '?' + u.toString());
}

function copyShareURL() {
  navigator.clipboard.writeText(window.location.href).then(() => {
    const btn = document.getElementById('share-btn');
    if (btn) { btn.textContent = '✓ Copied!'; setTimeout(() => { btn.textContent = '🔗 Copy link'; }, 2000); }
  });
}
