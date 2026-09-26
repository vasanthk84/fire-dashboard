const { fetchTradingIncomeSummary } = require('./_lib/tradingIncome');
const { fetchOptionsCapital, resolveOptionsCapital } = require('./_lib/optionsCapital');
const { resolveOptionsYield } = require('./_lib/optionsYield');

function growNMonths(principal, annualRate, monthlySIP, nMonths) {
  if (nMonths <= 0) return principal;
  const monthlyRate = annualRate / 12;
  const fvPrincipal = principal * Math.pow(1 + monthlyRate, nMonths);
  const fvSIP = (monthlySIP > 0 && monthlyRate > 0)
    ? monthlySIP * ((Math.pow(1 + monthlyRate, nMonths) - 1) / monthlyRate) * (1 + monthlyRate)
    : monthlySIP * nMonths;
  return fvPrincipal + fvSIP;
}

function growOneYear(principal, annualRate, monthlySIP) {
  return growNMonths(principal, annualRate, monthlySIP, 12);
}

function calculateEPFYearly(startBalance, basicPay, interestRate, vpfRate) {
  let balance = startBalance;
  let yearlyInterest = 0;
  const employeeMonthly = basicPay * (0.12 + vpfRate);
  const employerMonthly = basicPay * 0.12;
  const totalMonthly = employeeMonthly + employerMonthly;

  for (let m = 1; m <= 12; m++) {
    balance += totalMonthly;
    yearlyInterest += balance * (interestRate / 12);
  }
  balance += yearlyInterest;
  return { endBalance: balance };
}

function projectSimpleForward(startBalance, monthlyContribution, annualRatePct, months) {
  if (months <= 0) return startBalance;
  let balance = startBalance;
  let yearlyInterest = 0;
  for (let m = 1; m <= months; m++) {
    balance += monthlyContribution;
    yearlyInterest += balance * (annualRatePct / 100 / 12);
  }
  return balance + yearlyInterest;
}

function calculate401kYearly(currentBalance, annualSalary, yourContribPct, employerMatchPct, growthRate) {
  const monthlyContrib = (annualSalary * (yourContribPct + employerMatchPct)) / 12;
  const monthlyRate = growthRate / 12;
  const fvPrincipal = currentBalance * Math.pow(1 + monthlyRate, 12);
  const fvSIP = monthlyContrib > 0
    ? monthlyContrib * ((Math.pow(1 + monthlyRate, 12) - 1) / monthlyRate) * (1 + monthlyRate)
    : 0;
  return fvPrincipal + fvSIP;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const input = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const parseVal = (val, defaultVal) => (val !== undefined && val !== '' && val !== null) ? parseFloat(val) : defaultVal;

    const startYear = parseInt(input.startYear, 10) || new Date().getFullYear();
    const startMonth = Math.min(12, Math.max(1, parseInt(input.startMonth, 10) || 1));
    const retirementYear = parseInt(input.retirementYear, 10) || (startYear + 10);
    const targetYear = retirementYear;

    const mfCurrent = parseVal(input.mfCurrent, 0);
    const mfPrincipal = parseVal(input.mfPrincipal, 0);
    const stocksIndia = parseVal(input.stocksIndia, 0);
    const usStocksINR = parseVal(input.usStocks, 0);

    const us401kUSD = parseVal(input.us401k, 0);
    const usdToInr401k = parseVal(input.usdExchangeRate, 86);
    const epfCurrent = parseVal(input.epfCurrent, 0);
    const basicPay = parseVal(input.basicPay, 0);
    const epfRate = parseVal(input.epfRate, 0.0825);
    const vpfRate = parseVal(input.vpfRate, 0.12);

    // --- PPF (Public Provident Fund) — matured, held idle: carried forward
    // flat with no further interest or contributions.
    const ppfCurrent = parseVal(input.ppfCurrent, 0);

    // --- Fixed Deposits ---
    const fdCurrent = parseVal(input.fdCurrent, 0);
    const fdRatePct = parseVal(input.fdRatePct, 7);

    // --- NPS (National Pension System) ---
    const npsCurrent = parseVal(input.npsCurrent, 0);
    const npsRatePct = parseVal(input.npsRatePct, 10);

    // --- 401k Projector: employee/employer contribution rates ---
    const us401kContribPct = parseVal(input.us401kContribPct, 0.05);
    const us401kEmployerMatchPct = parseVal(input.us401kEmployerMatchPct, 0.04);

    // --- PF Closure & Reinvestment ---
    const pfWithdrawalMonth = Math.min(12, Math.max(1, parseInt(input.pfWithdrawalMonth, 10) || 12));
    const pfWithdrawalYear = parseInt(input.pfWithdrawalYear, 10) || (startYear + 1);
    const gratuityAmount = parseVal(input.gratuityAmount, 0);
    const superannuationBalance = parseVal(input.superannuationBalance, 0);
    const superMonthlyContribution = parseVal(input.superMonthlyContribution, 0);
    const superInterestRatePct = parseVal(input.superInterestRatePct, 0);
    const superCommutationPct = parseVal(input.superCommutationPct, 0.5);
    const annuityRatePct = parseVal(input.annuityRatePct, 0.06);
    const pfCashAllocPct = parseVal(input.pfCashAllocPct, 68);
    const pfCashRatePct = parseVal(input.pfCashRatePct, 7);
    const pfBondAllocPct = parseVal(input.pfBondAllocPct, 0);
    const pfBondRatePct = parseVal(input.pfBondRatePct, 7.5);
    const pfWheelYieldPctMonthly = parseVal(input.pfWheelYieldPctMonthly, 1.25);
    const pfReinvestTaxPct = parseVal(input.pfReinvestTaxPct, 0);

    // --- Villa Purchase (India) — optional goal, off by default ---
    const villaEnabled = input.villaEnabled === true;
    const villaYear = parseInt(input.villaYear, 10) || (startYear + 5);
    const villaDownPaymentLakhs = parseVal(input.villaDownPaymentLakhs, 0);
    const villaLoanAmountLakhs = parseVal(input.villaLoanAmountLakhs, 0);
    const villaLoanRatePct = parseVal(input.villaLoanRatePct, 8.5);
    const villaLoanTenureYears = parseVal(input.villaLoanTenureYears, 15);

    // --- Apartment (India) — existing owned property ---
    const apartmentCurrent = parseVal(input.apartmentCurrent, 0);
    const apartmentAppreciationPct = parseVal(input.apartmentAppreciationPct, 6);
    const apartmentSellAtVilla = input.apartmentSellAtVilla === true;

    // Standard reducing-balance EMI formula.
    const villaMonthlyRate = villaLoanRatePct / 100 / 12;
    const villaTenureMonths = Math.round(villaLoanTenureYears * 12);
    const villaLoanAmountINR = villaLoanAmountLakhs * 100000;
    let villaEmiINR = 0;
    if (villaEnabled && villaLoanAmountINR > 0 && villaTenureMonths > 0) {
      villaEmiINR = villaMonthlyRate > 0
        ? (villaLoanAmountINR * villaMonthlyRate * Math.pow(1 + villaMonthlyRate, villaTenureMonths)) /
          (Math.pow(1 + villaMonthlyRate, villaTenureMonths) - 1)
        : villaLoanAmountINR / villaTenureMonths;
    }
    const villaEmiLakhsPerMonth = villaEmiINR / 100000;
    const villaLoanPayoffYear = villaEnabled ? villaYear + Math.ceil(villaTenureMonths / 12) - 1 : null;

    // Superannuation keeps earning employer contributions + interest (per your
    // statement) right up to the PF withdrawal date, so grow it forward before
    // splitting into the commuted lump sum vs the annuitised remainder.
    const _nowForSuper = new Date();
    const monthsToPfWithdrawal = (pfWithdrawalYear * 12 + (pfWithdrawalMonth - 1)) - (_nowForSuper.getFullYear() * 12 + _nowForSuper.getMonth());
    const superannuationAtWithdrawal = projectSimpleForward(superannuationBalance, superMonthlyContribution, superInterestRatePct, Math.max(0, monthsToPfWithdrawal));

    // Commuted portion is a tax-free lump sum, the remainder buys an annuity
    // (TCS policy: commute 1/3 or 1/2 of the corpus, or annuitise it all).
    const superLumpINR = superannuationAtWithdrawal * superCommutationPct;
    const superAnnuityCorpusINR = superannuationAtWithdrawal * (1 - superCommutationPct);
    const annuityMonthlyIncomeLakhs = (superAnnuityCorpusINR * annuityRatePct / 12) / 100000;

    // Gratuity + the commuted superannuation lump sum are NEW money injected into
    // the reinvestment bucket at withdrawal (the PF balance itself already lives
    // in curEPF and simply changes its growth model from that point on).
    const pfInjectionLakhs = (gratuityAmount + superLumpINR) / 100000;

    // Blended annual return on the reinvested PF corpus — cash/savings + bonds/debt
    // funds + option wheeling — net of the assumed tax rate on that income. Cash and
    // bond allocations are clamped to sum to at most 100%; whatever's left goes to wheeling.
    let pfCashFrac = Math.max(0, Math.min(100, pfCashAllocPct)) / 100;
    let pfBondFrac = Math.max(0, Math.min(100, pfBondAllocPct)) / 100;
    if (pfCashFrac + pfBondFrac > 1) {
      const scale = 1 / (pfCashFrac + pfBondFrac);
      pfCashFrac *= scale;
      pfBondFrac *= scale;
    }
    const pfWheelFrac = 1 - pfCashFrac - pfBondFrac;
    const pfWheelAnnualPct = (pfWheelYieldPctMonthly / 100) * 12;
    const pfBlendedAnnualRate = (pfCashFrac * (pfCashRatePct / 100)) + (pfBondFrac * (pfBondRatePct / 100)) + (pfWheelFrac * pfWheelAnnualPct);
    const pfBlendedPostTaxRate = pfBlendedAnnualRate * (1 - (pfReinvestTaxPct / 100));

    const bondsInitial = parseVal(input.bondsInitial, 0);
    const bondAnnualIncrease = parseVal(input.bondAnnualIncrease, 0.01);
    const bondRate = parseVal(input.bondRate, 0.10);

    const mfSIP = parseVal(input.mfSIP, 0);
    const sipStepUpRate = parseVal(input.sipStepUpRate, 0.10);
    const optionsCapital = resolveOptionsCapital(
      input.optionsCapitalUseKite !== false ? await fetchOptionsCapital() : {},
      parseVal(input.optionsPortfolioValue, 0), input.optionsCapitalUseKite !== false
    );
    const optionsPortfolioValue = optionsCapital.valueLakhs;
    const optionsYield = resolveOptionsYield(
      optionsPortfolioValue > 0 ? await fetchTradingIncomeSummary() : { configured: false },
      optionsPortfolioValue, parseVal(input.optionsYieldPct, 0.20)
    );
    const optionsYieldPct = optionsYield.annualRate;

    const annualSalary = parseVal(input.annualSalary, 0);
    const returnToIndiaYear = parseInt(input.returnYear, 10) || 2030;
    const withdraw401kYear = parseInt(input.withdraw401kYear, 10) || 2033;
    const currentAge = parseVal(input.currentAge, 40);
    const retirementIncomeTaxRate = parseVal(input.retirementIncomeTaxRate, 0.22);
    const earlyWithdrawalPenalty = 0.10;
    // IRS rule: withdrawals before age 59½ incur ordinary income tax PLUS a 10%
    // early withdrawal penalty; at/after 59½, only ordinary income tax applies.
    const ageAtWithdrawal = currentAge + (withdraw401kYear - startYear);
    const isEarlyWithdrawal = ageAtWithdrawal < 59.5;
    const taxRate401k = isEarlyWithdrawal
      ? retirementIncomeTaxRate + earlyWithdrawalPenalty
      : retirementIncomeTaxRate;

    const monthlyExpensesStart = parseVal(input.monthlyExpenses, 0);
    const abroadMonthlyExpenses = parseVal(input.abroadMonthlyExpenses, 0);
    const oneTimeExpenseTotalRaw = parseVal(input.oneTimeExpenseTotal, 0);
    const applyTax = input.applyTax === true;

    // --- Tax model (India, FY2025-26/26-27 rules) — per-bucket, not a flat
    // drag, but without per-unit/lot-level cost-basis tracking:
    //   EPF / PPF                        -> 0% (EEE, tax-free withdrawal)
    //   Equity MF + direct Indian stocks -> 12.5% LTCG on the GAIN portion
    //                                       only, above a Rs 1.25L/yr exemption
    //                                       (Sec 112A). The gain fraction is
    //                                       approximated from mfPrincipal (your
    //                                       entered MF cost basis) vs current MF
    //                                       value, and that same ratio is applied
    //                                       to direct stocks too since no separate
    //                                       principal is tracked for them.
    //   US stocks / Bonds / FD / NPS      -> your India income-tax slab rate —
    //                                       debt-taxed assets get no LTCG or
    //                                       indexation benefit (Section 50AA,
    //                                       effective for units bought on/after
    //                                       1 Apr 2023, and unchanged for plain
    //                                       interest income like FD/bonds).
    const indiaSlabRatePct = parseVal(input.indiaSlabRatePct, 20);
    const LTCG_EXEMPTION_LAKHS = 1.25;
    const LTCG_RATE = 0.125;

    const mfRate = parseVal(input.mfRate, 0.12);
    const stocksRate = parseVal(input.stocksRate, 0.15);
    const usRate = parseVal(input.usRate, 0.12);
    const inflationRate = parseVal(input.inflationRate, 0.06);
    const postFireRate = parseVal(input.postFireRate, 0.065);

    const generateProjection = () => {
      const projection = [];

      let curMF = mfCurrent;
      let curStocks = stocksIndia;
      let curUSStocks = usStocksINR;
      let curBonds = bondsInitial;
      let curEPF = epfCurrent;
      let curPPF = ppfCurrent;
      let curFD = fdCurrent;
      let curNPS = npsCurrent;
      let curApartment = apartmentCurrent;
      let cur401kUSD = us401kUSD;
      let curOptions = optionsPortfolioValue;
      let pfInjected = false;

      let currentBondAddition = bondsInitial * bondAnnualIncrease;
      let currentSIP = mfSIP;

      for (let year = startYear; year <= 2055; year++) {
        const isRetired = year >= retirementYear;
        const isWithdrawing401k = year === withdraw401kYear;
        const yearsPassed = year - startYear;
        // For the start year, only grow for the remaining months of the year
        const growMonths = year === startYear ? (13 - startMonth) : 12;
        const yearFraction = growMonths / 12;

        const isAbroad = year < returnToIndiaYear;

        // --- PF Closure & Reinvestment: which growth model applies this year ---
        // Before pfWithdrawalYear/Month: normal EPF accumulation (unchanged).
        // From that point on: PF balance + gratuity + commuted superannuation
        // lump sum move into the cash/wheeling reinvestment blend, and the
        // annuitised superannuation portion starts paying monthly income.
        const windowStart = year === startYear ? startMonth : 1;
        let fracEpfOld = 0;
        let fracReinvestNew = 0;
        if (year < pfWithdrawalYear) {
          fracEpfOld = yearFraction;
        } else if (year > pfWithdrawalYear) {
          fracReinvestNew = yearFraction;
        } else {
          const monthsBeforeWithdrawal = Math.max(0, Math.min(growMonths, pfWithdrawalMonth - windowStart));
          const monthsAfterWithdrawal = growMonths - monthsBeforeWithdrawal;
          fracEpfOld = monthsBeforeWithdrawal / 12;
          fracReinvestNew = monthsAfterWithdrawal / 12;
        }
        const annuityActive = year > pfWithdrawalYear || (year === pfWithdrawalYear && fracReinvestNew > 0);

        // Retirement corpus deduction — always India (post-return) expenses; never abroad
        const retirementAnnualExpense = (monthlyExpensesStart * 12) * Math.pow(1 + inflationRate, yearsPassed);

        // Display column in table:
        //   Pre-return  → always null (show —); expenses only start on return to India
        //   Post-return → inflation-adjusted India expense
        let displayMonthlyExpenseLakhs = null;
        if (!isAbroad && monthlyExpensesStart > 0) {
          const indiaInflated = monthlyExpensesStart * Math.pow(1 + inflationRate, yearsPassed);
          displayMonthlyExpenseLakhs = parseFloat((indiaInflated / 100000).toFixed(2));
        }

        if (year > startYear) {
          if (year <= returnToIndiaYear) {
            cur401kUSD = calculate401kYearly(cur401kUSD, annualSalary, us401kContribPct, us401kEmployerMatchPct, usRate);
          } else if (year <= withdraw401kYear) {
            // Coast phase: no contributions, monthly compound growth at usRate
            cur401kUSD = cur401kUSD * Math.pow(1 + usRate / 12, 12);
          } else {
            cur401kUSD = 0;
          }
        }

        let display401kINR = (cur401kUSD * usdToInr401k) / 100000;
        if (isWithdrawing401k) {
          const netUSD = cur401kUSD * (1 - taxRate401k);
          display401kINR = (netUSD * usdToInr401k) / 100000;
          curMF += display401kINR;
        }

        let oneTimeDeductionDisplay = 0;
        if (year === returnToIndiaYear && oneTimeExpenseTotalRaw > 0) {
          const inflatedOneTimeCost = oneTimeExpenseTotalRaw * Math.pow(1 + inflationRate, yearsPassed);
          const costInLakhs = inflatedOneTimeCost / 100000;
          curMF -= costInLakhs;
          oneTimeDeductionDisplay = costInLakhs;
        }

        // Villa down payment — a one-time capital outflow from the portfolio the
        // year of purchase, inflated to that year like the other one-time costs.
        // Only fires if the goal is switched on.
        let villaDownPaymentDeductionDisplay = 0;
        if (villaEnabled && year === villaYear && villaDownPaymentLakhs > 0) {
          const inflatedDownPayment = villaDownPaymentLakhs * Math.pow(1 + inflationRate, yearsPassed);
          curMF -= inflatedDownPayment;
          villaDownPaymentDeductionDisplay = inflatedDownPayment;
        }

        // Apartment: if keeping it as a second property alongside the villa,
        // it's left untouched here and simply keeps appreciating on its own
        // (see the growth section below). If selling it to help fund the
        // villa, its current (already-appreciated) value is liquidated into
        // cash the same year the down payment is paid.
        let apartmentSaleProceedsDisplay = 0;
        if (villaEnabled && apartmentSellAtVilla && year === villaYear && curApartment > 0) {
          apartmentSaleProceedsDisplay = curApartment;
          curMF += curApartment;
          curApartment = 0;
        }

        // Villa loan EMI — a fixed nominal monthly payment for the loan tenure.
        // Pre-retirement, we assume it's covered by salary like any other
        // household bill (consistent with how regular monthlyExpenses is only
        // deducted from the corpus post-retirement). Post-retirement, if the
        // loan is still active, it's a real drag on the corpus and is deducted.
        const villaLoanActiveThisYear = villaEnabled && villaLoanPayoffYear != null &&
          year >= villaYear && year <= villaLoanPayoffYear;
        // Shown from the purchase year onward regardless of retirement status
        // (mirrors how calculatedMonthlyExpense previews post-return spend before
        // retirement even though it isn't drawn from the corpus until then).
        const villaEmiDeductionDisplay = villaLoanActiveThisYear ? (villaEmiLakhsPerMonth * 12) * yearFraction : 0;

        const total = curMF + curStocks + curUSStocks + curBonds + curEPF + curPPF + curFD + curNPS + curApartment + curOptions;

        // The 4% SWR estimate is a generic passive-income yardstick for assets
        // that don't have their own explicit income model. The options portfolio
        // already has one (its actual premium yield, below) — including it again
        // here would double-count that income and overstate readiness/coverage.
        // Real estate (the apartment) is excluded too — it's illiquid and isn't
        // assumed to generate rental/SWR income unless actually sold above.
        //
        // The base is split into three tax buckets (see the tax-model note above
        // this loop) so each slice of the notional income is taxed the way that
        // asset class actually is, instead of one flat rate over everything.
        const taxFreeBase = curEPF + curPPF;
        const equityBase = curMF + curStocks;
        const slabBase = curUSStocks + curBonds + curFD + curNPS;
        const passiveEligibleBase = taxFreeBase + equityBase + slabBase;
        let passiveIncomeGross = passiveEligibleBase > 0 ? (passiveEligibleBase * 0.04) / 12 : 0;
        if (annuityActive) {
          // Superannuation annuity income — a separate stream from the 4% SWR
          // estimate above, added once the annuity has commenced.
          passiveIncomeGross += annuityMonthlyIncomeLakhs;
        }
        let passiveIncomeNet = passiveIncomeGross;
        let monthlyTax = 0;
        let equityTaxMonthly = 0;
        let slabTaxMonthly = 0;

        if (applyTax && passiveEligibleBase > 0) {
          const annualSwrIncome = passiveEligibleBase * 0.04;
          const equityShare = equityBase / passiveEligibleBase;
          const slabShare = slabBase / passiveEligibleBase;

          const equityGainFraction = curMF > 0 ? Math.max(0, Math.min(1, (curMF - mfPrincipal) / curMF)) : 0.5;
          const equityIncomeAnnual = annualSwrIncome * equityShare;
          const equityGainAnnual = equityIncomeAnnual * equityGainFraction;
          const taxableEquityGainAnnual = Math.max(0, equityGainAnnual - LTCG_EXEMPTION_LAKHS);
          const equityTaxAnnual = taxableEquityGainAnnual * LTCG_RATE;

          const slabIncomeAnnual = annualSwrIncome * slabShare;
          const slabTaxAnnual = slabIncomeAnnual * (indiaSlabRatePct / 100);

          equityTaxMonthly = equityTaxAnnual / 12;
          slabTaxMonthly = slabTaxAnnual / 12;
          monthlyTax = equityTaxMonthly + slabTaxMonthly;
          passiveIncomeNet = passiveIncomeGross - monthlyTax;
        }

        // Options premium income (covered calls / cash-secured puts): a yield on
        // the options-linked portfolio, active every year including retirement —
        // this is an ongoing trading strategy, not tied to employment.
        const optionsAnnualIncome = curOptions * optionsYieldPct * yearFraction;
        const optionsIncomeMonthly = optionsAnnualIncome / 12;

        projection.push({
          year,
          mf: parseFloat(curMF.toFixed(2)),
          stocksIndia: parseFloat(curStocks.toFixed(2)),
          usStocks: parseFloat(curUSStocks.toFixed(2)),
          bonds: parseFloat(curBonds.toFixed(2)),
          epf: parseFloat(curEPF.toFixed(2)),
          ppf: parseFloat(curPPF.toFixed(2)),
          us401k: parseFloat(display401kINR.toFixed(2)),
          fd: parseFloat(curFD.toFixed(2)),
          nps: parseFloat(curNPS.toFixed(2)),
          apartment: parseFloat(curApartment.toFixed(2)),
          optionsPortfolio: parseFloat(curOptions.toFixed(2)),
          optionsIncomeMonthly: parseFloat(optionsIncomeMonthly.toFixed(3)),
          sipAmount: isRetired ? 0 : parseFloat(currentSIP.toFixed(2)),
          total: parseFloat(total.toFixed(2)),
          passiveIncomeMonthly: parseFloat(passiveIncomeNet.toFixed(2)),
          passiveIncomeGross: parseFloat(passiveIncomeGross.toFixed(2)),
          monthlyTax: parseFloat(monthlyTax.toFixed(2)),
          equityTaxMonthly: parseFloat(equityTaxMonthly.toFixed(3)),
          slabTaxMonthly: parseFloat(slabTaxMonthly.toFixed(3)),
          calculatedMonthlyExpense: displayMonthlyExpenseLakhs,
          oneTimeDeduction: parseFloat(oneTimeDeductionDisplay.toFixed(2)),
          villaDownPaymentDeduction: parseFloat(villaDownPaymentDeductionDisplay.toFixed(2)),
          apartmentSaleProceeds: parseFloat(apartmentSaleProceedsDisplay.toFixed(2)),
          villaEmiDeduction: parseFloat(villaEmiDeductionDisplay.toFixed(2)),
          milestones: []
        });

        let activeSIP = currentSIP;
        let bondInterestToMF = 0;

        if (isRetired) {
          activeSIP = 0;
          bondInterestToMF = curBonds * bondRate * yearFraction;
          if (monthlyExpensesStart > 0) {
            curMF -= (retirementAnnualExpense * yearFraction) / 100000;
          }
          if (villaLoanActiveThisYear) {
            curMF -= villaEmiDeductionDisplay;
          }
        } else {
          const bondInterest = curBonds * bondRate * yearFraction;
          const bondInjection = currentBondAddition * yearFraction;
          currentBondAddition = currentBondAddition * (1 + bondAnnualIncrease);
          curBonds += bondInterest + bondInjection;
          currentSIP = currentSIP * (1 + sipStepUpRate);
        }

        if (curMF > 0) {
          curMF = growNMonths(curMF, mfRate, activeSIP, growMonths);
        }

        curStocks *= Math.pow(1 + stocksRate, yearFraction);
        curUSStocks *= Math.pow(1 + usRate, yearFraction);

        if (fracEpfOld > 0) {
          if (isRetired) {
            curEPF += curEPF * 0.07 * fracEpfOld;
          } else {
            const epfResult = calculateEPFYearly(curEPF * 100000, basicPay, epfRate, vpfRate);
            // Scale EPF contribution for the portion of the year before withdrawal
            curEPF = (curEPF * 100000 + (epfResult.endBalance - curEPF * 100000) * fracEpfOld) / 100000;
          }
        }

        // PPF: matured and idle — no further interest accrues and no further
        // contributions are made, so the balance is carried forward flat.
        // (curPPF intentionally left unchanged here.)

        // FD & NPS: simple monthly-compounding growth, no ongoing contribution
        // modeled (lump-sum balances carried forward at their stated rates).
        curFD = projectSimpleForward(curFD * 100000, 0, fdRatePct, growMonths) / 100000;
        curNPS = projectSimpleForward(curNPS * 100000, 0, npsRatePct, growMonths) / 100000;

        // Apartment: appreciates like any real-asset holding (a no-op once
        // sold above — curApartment is already 0 from that point on).
        curApartment *= Math.pow(1 + apartmentAppreciationPct / 100, yearFraction);

        if (fracReinvestNew > 0) {
          if (!pfInjected) {
            // One-time injection at the withdrawal date: gratuity + commuted
            // superannuation lump sum. The PF balance itself is already curEPF.
            curEPF += pfInjectionLakhs;
            pfInjected = true;
          }
          curEPF += curEPF * pfBlendedPostTaxRate * fracReinvestNew;
        }

        // Underlying options-linked stocks appreciate like any equity holding;
        // the premium income already computed above is swept out as cash into MF.
        curOptions *= Math.pow(1 + stocksRate, yearFraction);
        curMF += optionsAnnualIncome;

        if (bondInterestToMF > 0) {
          curMF += bondInterestToMF;
        }
      }

      return projection;
    };

    const fireProjections = generateProjection();

    fireProjections.forEach((p, i) => {
      const prev = fireProjections[i - 1];
      const milestones = [];

      if (p.year === returnToIndiaYear) {
        milestones.push({ type: 'life', text: 'Return India' });
        if (p.oneTimeDeduction > 0) {
          milestones.push({ type: 'expense', text: 'Setup Cost' });
        }
      }

      if (p.year === retirementYear) {
        milestones.push({ type: 'life', text: 'Retirement' });
      }

      if (p.year === withdraw401kYear) {
        milestones.push({ type: 'wealth', text: '401k Injected' });
      }

      if (p.year === pfWithdrawalYear) {
        milestones.push({ type: 'wealth', text: 'PF Withdrawn & Reinvested' });
      }

      if (villaEnabled && p.year === villaYear) {
        milestones.push({ type: 'expense', text: 'Villa Purchased' });
        if (apartmentSellAtVilla) {
          milestones.push({ type: 'wealth', text: 'Apartment Sold' });
        }
      }

      if (villaEnabled && villaLoanPayoffYear != null && p.year === villaLoanPayoffYear) {
        milestones.push({ type: 'wealth', text: 'Home Loan Paid Off' });
      }

      const totalCr = p.total / 100;
      const prevTotalCr = prev ? prev.total / 100 : 0;
      const threshold = 0.5;
      const crossedMark = Math.floor(totalCr / threshold) * threshold;
      const prevCrossedMark = Math.floor(prevTotalCr / threshold) * threshold;
      if (crossedMark > prevCrossedMark && crossedMark >= 3.0) {
        milestones.push({ type: 'milestone', text: `INR ${crossedMark.toFixed(1)} Cr` });
      }

      p.milestones = milestones;
    });

    const finalWealth = fireProjections.find((p) => p.year === targetYear)?.total || 0;
    const p401k = fireProjections.find((p) => p.year === withdraw401kYear);
    const net401kINR = p401k ? p401k.us401k : 0;

    // Fixed real withdrawal ("Trinity study" / 4%-rule) model: the withdrawal
    // amount is set ONCE at retirement (rate × corpus at retirement), then only
    // inflation-adjusted every year after — it does not fluctuate with the
    // portfolio balance. This is what "corpus lasts N years at X% SWR" means.
    // --- Retirement-time bucket composition, used to blend the SWP tax rate ---
    // Simplifying assumption (no per-unit lot tracking / no explicit drawdown
    // sequencing): each year's withdrawal is assumed to draw down every bucket
    // in the same proportion it held at retirement, so these shares stay fixed
    // across the whole withdrawal horizon rather than being recomputed yearly.
    const retirementRow = fireProjections.find((p) => p.year === targetYear) || fireProjections[fireProjections.length - 1];
    const rTaxFreeBase = (retirementRow?.epf || 0) + (retirementRow?.ppf || 0);
    const rEquityBase = (retirementRow?.mf || 0) + (retirementRow?.stocksIndia || 0);
    const rSlabBase = (retirementRow?.usStocks || 0) + (retirementRow?.bonds || 0) + (retirementRow?.fd || 0) + (retirementRow?.nps || 0);
    const rLiquidTotal = rTaxFreeBase + rEquityBase + rSlabBase;
    const equityShareAtRetirement = rLiquidTotal > 0 ? rEquityBase / rLiquidTotal : 0;
    const slabShareAtRetirement = rLiquidTotal > 0 ? rSlabBase / rLiquidTotal : 0;
    const taxFreeShareAtRetirement = rLiquidTotal > 0 ? rTaxFreeBase / rLiquidTotal : 0;
    const equityGainFractionAtRetirement = (retirementRow?.mf || 0) > 0
      ? Math.max(0, Math.min(1, (retirementRow.mf - mfPrincipal) / retirementRow.mf))
      : 0.5;

    const withdrawalRates = [0.02, 0.03, 0.04];
    const withdrawalScenarios = {};
    const withdrawalSustainability = {};
    const withdrawalHorizonYears = 30;

    withdrawalRates.forEach((rate) => {
      const projections = [];
      let corpus = finalWealth;
      const firstYearWithdrawal = finalWealth * rate;
      let depletionYear = null;

      for (let y = targetYear; y <= targetYear + withdrawalHorizonYears; y++) {
        const yearsIntoRetirement = y - targetYear;
        // Real spending held constant; nominal withdrawal rises with inflation
        const nominalAnnualWithdrawal = corpus > 0
          ? firstYearWithdrawal * Math.pow(1 + inflationRate, yearsIntoRetirement)
          : 0;
        const actualWithdrawal = Math.min(nominalAnnualWithdrawal, corpus);

        // Per-bucket SWP tax (see the tax-model note above): equity gains taxed
        // at 12.5% above the Rs 1.25L/yr exemption, debt-taxed buckets (US
        // stocks/bonds/FD/NPS) at your slab rate, EPF/PPF share untaxed.
        let annualTax = 0;
        let equityTaxAnnual = 0;
        let slabTaxAnnual = 0;
        if (applyTax && actualWithdrawal > 0) {
          const equityWithdrawal = actualWithdrawal * equityShareAtRetirement;
          const equityGainWithdrawal = equityWithdrawal * equityGainFractionAtRetirement;
          const taxableEquityGain = Math.max(0, equityGainWithdrawal - LTCG_EXEMPTION_LAKHS);
          equityTaxAnnual = taxableEquityGain * LTCG_RATE;

          const slabWithdrawal = actualWithdrawal * slabShareAtRetirement;
          slabTaxAnnual = slabWithdrawal * (indiaSlabRatePct / 100);

          annualTax = equityTaxAnnual + slabTaxAnnual;
        }
        const grossMonthlyIncome = actualWithdrawal / 12;
        const netMonthlyIncome = grossMonthlyIncome - (annualTax / 12);

        const corpusStart = corpus;
        const afterWithdrawal = corpus - actualWithdrawal;
        const growth = afterWithdrawal * postFireRate;
        const end = Math.max(0, afterWithdrawal + growth);

        if (end <= 0 && depletionYear === null && corpusStart > 0) {
          depletionYear = y;
        }

        projections.push({
          year: y,
          corpusStart,
          withdrawalMonthly: netMonthlyIncome,
          grossWithdrawalMonthly: grossMonthlyIncome,
          taxMonthly: annualTax / 12,
          equityTaxMonthly: equityTaxAnnual / 12,
          slabTaxMonthly: slabTaxAnnual / 12,
          realWithdrawalMonthly: netMonthlyIncome / Math.pow(1 + inflationRate, yearsIntoRetirement),
          corpusEnd: end,
          depleted: corpusStart <= 0
        });

        corpus = end;
      }

      const label = `${(rate * 100).toFixed(0)}%`;
      withdrawalScenarios[label] = projections;
      withdrawalSustainability[label] = {
        depletionYear,
        sustainableYears: depletionYear ? depletionYear - targetYear : null,
        horizonYears: withdrawalHorizonYears
      };
    });

    return res.status(200).json({
      summary: {
        optionsYield: { ...optionsYield, capital: optionsCapital },
        optionsCapital,
        startWealth: fireProjections[0].total,
        finalWealth,
        net401kINR,
        ageAtWithdrawal401k: ageAtWithdrawal,
        isEarlyWithdrawal401k: isEarlyWithdrawal,
        taxRate401k,
        pfWithdrawalYear,
        pfWithdrawalMonth,
        pfAnnuityMonthlyIncomeLakhs: parseFloat(annuityMonthlyIncomeLakhs.toFixed(3)),
        pfBlendedReinvestRate: pfBlendedPostTaxRate,
        superannuationAtWithdrawalINR: Math.round(superannuationAtWithdrawal),
        villaEnabled,
        villaYear,
        villaEmiLakhsPerMonth: parseFloat(villaEmiLakhsPerMonth.toFixed(4)),
        villaLoanPayoffYear,
        taxModel: {
          indiaSlabRatePct,
          ltcgExemptionLakhs: LTCG_EXEMPTION_LAKHS,
          ltcgRate: LTCG_RATE,
          equityShareAtRetirement: parseFloat(equityShareAtRetirement.toFixed(4)),
          slabShareAtRetirement: parseFloat(slabShareAtRetirement.toFixed(4)),
          taxFreeShareAtRetirement: parseFloat(taxFreeShareAtRetirement.toFixed(4)),
          equityGainFractionAtRetirement: parseFloat(equityGainFractionAtRetirement.toFixed(4))
        }
      },
      fireProjections,
      withdrawalScenarios,
      withdrawalSustainability,
      inputs: { ...input }
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};
