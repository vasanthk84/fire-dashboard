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

module.exports = (req, res) => {
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
    const stocksIndia = parseVal(input.stocksIndia, 0);
    const usStocksINR = parseVal(input.usStocks, 0);
    const emergencyFund = parseVal(input.emergencyFund, 0);

    const us401kUSD = parseVal(input.us401k, 0);
    const usdToInr401k = parseVal(input.usdExchangeRate, 86);
    const epfCurrent = parseVal(input.epfCurrent, 0);
    const basicPay = parseVal(input.basicPay, 0);
    const epfRate = parseVal(input.epfRate, 0.0825);
    const vpfRate = parseVal(input.vpfRate, 0.12);

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
    const optionsPortfolioValue = parseVal(input.optionsPortfolioValue, 0);
    const optionsYieldPct = parseVal(input.optionsYieldPct, 0.20);

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
    const taxDragRate = 0.125;

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
      let curEmergency = emergencyFund;
      let curEPF = epfCurrent;
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

        const total = curMF + curStocks + curUSStocks + curBonds + curEmergency + curEPF + curOptions;

        // The 4% SWR estimate is a generic passive-income yardstick for assets
        // that don't have their own explicit income model. The options portfolio
        // already has one (its actual premium yield, below) — including it again
        // here would double-count that income and overstate readiness/coverage.
        const passiveEligibleBase = curMF + curStocks + curUSStocks + curBonds + curEmergency + curEPF;
        let passiveIncomeGross = passiveEligibleBase > 0 ? (passiveEligibleBase * 0.04) / 12 : 0;
        if (annuityActive) {
          // Superannuation annuity income — a separate stream from the 4% SWR
          // estimate above, added once the annuity has commenced.
          passiveIncomeGross += annuityMonthlyIncomeLakhs;
        }
        let passiveIncomeNet = passiveIncomeGross;
        let monthlyTax = 0;

        if (applyTax) {
          monthlyTax = passiveIncomeGross * taxDragRate;
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
          us401k: parseFloat(display401kINR.toFixed(2)),
          emergencyFund: parseFloat(curEmergency.toFixed(2)),
          optionsPortfolio: parseFloat(curOptions.toFixed(2)),
          optionsIncomeMonthly: parseFloat(optionsIncomeMonthly.toFixed(3)),
          sipAmount: isRetired ? 0 : parseFloat(currentSIP.toFixed(2)),
          total: parseFloat(total.toFixed(2)),
          passiveIncomeMonthly: parseFloat(passiveIncomeNet.toFixed(2)),
          passiveIncomeGross: parseFloat(passiveIncomeGross.toFixed(2)),
          monthlyTax: parseFloat(monthlyTax.toFixed(2)),
          calculatedMonthlyExpense: displayMonthlyExpenseLakhs,
          oneTimeDeduction: parseFloat(oneTimeDeductionDisplay.toFixed(2)),
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
        curEmergency *= Math.pow(1.06, yearFraction);

        if (fracEpfOld > 0) {
          if (isRetired) {
            curEPF += curEPF * 0.07 * fracEpfOld;
          } else {
            const epfResult = calculateEPFYearly(curEPF * 100000, basicPay, epfRate, vpfRate);
            // Scale EPF contribution for the portion of the year before withdrawal
            curEPF = (curEPF * 100000 + (epfResult.endBalance - curEPF * 100000) * fracEpfOld) / 100000;
          }
        }

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
        const netMonthlyIncome = (actualWithdrawal / 12) * (applyTax ? (1 - taxDragRate) : 1);

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
        superannuationAtWithdrawalINR: Math.round(superannuationAtWithdrawal)
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
