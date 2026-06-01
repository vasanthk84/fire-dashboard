/* FIRE calculation engine — faithful client-side port of api/calculate.js.
   Exposes window.calculateFirePlan(input) and window.runStressScenarios(input, base). */
(function () {
  function growNMonths(principal, annualRate, monthlySIP, nMonths) {
    if (nMonths <= 0) return principal;
    const monthlyRate = annualRate / 12;
    const fvPrincipal = principal * Math.pow(1 + monthlyRate, nMonths);
    const fvSIP = (monthlySIP > 0 && monthlyRate > 0)
      ? monthlySIP * ((Math.pow(1 + monthlyRate, nMonths) - 1) / monthlyRate) * (1 + monthlyRate)
      : monthlySIP * nMonths;
    return fvPrincipal + fvSIP;
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

  function calculate401kYearly(currentBalance, annualSalary, yourContribPct, employerMatchPct, growthRate) {
    const monthlyContrib = (annualSalary * (yourContribPct + employerMatchPct)) / 12;
    const monthlyRate = growthRate / 12;
    const fvPrincipal = currentBalance * Math.pow(1 + monthlyRate, 12);
    const fvSIP = monthlyContrib > 0
      ? monthlyContrib * ((Math.pow(1 + monthlyRate, 12) - 1) / monthlyRate) * (1 + monthlyRate)
      : 0;
    return fvPrincipal + fvSIP;
  }

  function num(val, defaultVal) {
    return (val !== undefined && val !== '' && val !== null) ? parseFloat(val) : defaultVal;
  }

  function calculateFirePlan(input) {
    input = input || {};
    const startYear = parseInt(input.startYear, 10) || new Date().getFullYear();
    const startMonth = Math.min(12, Math.max(1, parseInt(input.startMonth, 10) || 1));
    const retirementYear = parseInt(input.retirementYear, 10) || (startYear + 10);
    const targetYear = retirementYear;

    const mfCurrent = num(input.mfCurrent, 0);
    const stocksIndia = num(input.stocksIndia, 0);
    const usStocksINR = num(input.usStocks, 0);
    const emergencyFund = num(input.emergencyFund, 0);

    const us401kUSD0 = num(input.us401k, 0);
    const usdToInr401k = num(input.usdExchangeRate, 86);
    const epfCurrent = num(input.epfCurrent, 0);
    const basicPay = num(input.basicPay, 0);
    const epfRate = num(input.epfRate, 0.0825);
    const vpfRate = num(input.vpfRate, 0.12);

    const bondsInitial = num(input.bondsInitial, 0);
    const bondAnnualIncrease = num(input.bondAnnualIncrease, 0.01);
    const bondRate = num(input.bondRate, 0.10);

    const mfSIP = num(input.mfSIP, 0);
    const sipStepUpRate = num(input.sipStepUpRate, 0.10);
    const optionSellingMonthly = num(input.optionSellingMonthly, 0);

    const annualSalary = num(input.annualSalary, 0);
    const returnToIndiaYear = parseInt(input.returnYear, 10) || 2030;
    const withdraw401kYear = parseInt(input.withdraw401kYear, 10) || 2033;
    const taxRate401k = 0.37;

    const monthlyExpensesStart = num(input.monthlyExpenses, 0);
    const oneTimeExpenseTotalRaw = num(input.oneTimeExpenseTotal, 0);
    const applyTax = input.applyTax === true;
    const taxDragRate = 0.125;

    const mfRate = num(input.mfRate, 0.12);
    const stocksRate = num(input.stocksRate, 0.15);
    const usRate = num(input.usRate, 0.12);
    const inflationRate = num(input.inflationRate, 0.06);

    const projection = [];
    let curMF = mfCurrent, curStocks = stocksIndia, curUSStocks = usStocksINR;
    let curBonds = bondsInitial, curEmergency = emergencyFund, curEPF = epfCurrent;
    let cur401kUSD = us401kUSD0;
    let currentBondAddition = bondsInitial * bondAnnualIncrease;
    let currentSIP = mfSIP;

    for (let year = startYear; year <= 2055; year++) {
      const isRetired = year >= retirementYear;
      const isWithdrawing401k = year === withdraw401kYear;
      const yearsPassed = year - startYear;
      const growMonths = year === startYear ? (13 - startMonth) : 12;
      const yearFraction = growMonths / 12;

      const currentAnnualExpense = (monthlyExpensesStart * 12) * Math.pow(1 + inflationRate, yearsPassed);
      const currentMonthlyExpenseInflated = currentAnnualExpense / 12;

      if (year > startYear) {
        if (year <= returnToIndiaYear) {
          cur401kUSD = calculate401kYearly(cur401kUSD, annualSalary, 0.05, 0.04, usRate);
        } else if (year > withdraw401kYear) {
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

      const total = curMF + curStocks + curUSStocks + curBonds + curEmergency + curEPF;
      const passiveIncomeGross = total > 0 ? (total * 0.04) / 12 : 0;
      let passiveIncomeNet = passiveIncomeGross;
      let monthlyTax = 0;
      if (applyTax) {
        monthlyTax = passiveIncomeGross * taxDragRate;
        passiveIncomeNet = passiveIncomeGross - monthlyTax;
      }

      projection.push({
        year,
        mf: +curMF.toFixed(2),
        stocksIndia: +curStocks.toFixed(2),
        usStocks: +curUSStocks.toFixed(2),
        bonds: +curBonds.toFixed(2),
        epf: +curEPF.toFixed(2),
        us401k: +display401kINR.toFixed(2),
        emergencyFund: +curEmergency.toFixed(2),
        sipAmount: isRetired ? 0 : +currentSIP.toFixed(2),
        total: +total.toFixed(2),
        passiveIncomeMonthly: +passiveIncomeNet.toFixed(2),
        passiveIncomeGross: +passiveIncomeGross.toFixed(2),
        monthlyTax: +monthlyTax.toFixed(2),
        calculatedMonthlyExpense: +(currentMonthlyExpenseInflated / 100000).toFixed(2) || 0,
        oneTimeDeduction: +oneTimeDeductionDisplay.toFixed(2),
        milestones: []
      });

      let activeSIP = currentSIP;
      let bondInterestToMF = 0;
      if (isRetired) {
        activeSIP = 0;
        bondInterestToMF = curBonds * bondRate * yearFraction;
        if (monthlyExpensesStart > 0) {
          curMF -= (currentAnnualExpense * yearFraction) / 100000;
        }
      } else {
        const bondInterest = curBonds * bondRate * yearFraction;
        const bondInjection = currentBondAddition * yearFraction;
        currentBondAddition = currentBondAddition * (1 + bondAnnualIncrease);
        curBonds += bondInterest + bondInjection;
        currentSIP = currentSIP * (1 + sipStepUpRate);
      }

      if (curMF > 0) curMF = growNMonths(curMF, mfRate, activeSIP, growMonths);
      curStocks *= Math.pow(1 + stocksRate, yearFraction);
      curUSStocks *= Math.pow(1 + usRate, yearFraction);
      curEmergency *= Math.pow(1.06, yearFraction);

      if (isRetired) {
        curEPF += curEPF * 0.07 * yearFraction;
      } else {
        const epfResult = calculateEPFYearly(curEPF * 100000, basicPay, epfRate, vpfRate);
        curEPF = (curEPF * 100000 + (epfResult.endBalance - curEPF * 100000) * yearFraction) / 100000;
      }

      const optionIncome = growNMonths(0, mfRate, optionSellingMonthly, growMonths);
      curMF += optionIncome;
      if (bondInterestToMF > 0) curMF += bondInterestToMF;
    }

    // milestones
    projection.forEach((p, i) => {
      const prev = projection[i - 1];
      const milestones = [];
      if (p.year === returnToIndiaYear) {
        milestones.push({ type: 'life', text: 'Return India' });
        if (p.oneTimeDeduction > 0) milestones.push({ type: 'expense', text: 'Setup Cost' });
      }
      if (p.year === retirementYear) milestones.push({ type: 'life', text: 'Retire' });
      if (p.year === withdraw401kYear) milestones.push({ type: 'wealth', text: '401k In' });
      const totalCr = p.total / 100;
      const prevTotalCr = prev ? prev.total / 100 : 0;
      const crossedMark = Math.floor(totalCr / 0.5) * 0.5;
      const prevCrossedMark = Math.floor(prevTotalCr / 0.5) * 0.5;
      if (crossedMark > prevCrossedMark && crossedMark >= 3.0) {
        milestones.push({ type: 'milestone', text: `₹${crossedMark.toFixed(1)}Cr` });
      }
      p.milestones = milestones;
    });

    const finalWealth = projection.find((p) => p.year === targetYear)?.total || 0;
    const p401k = projection.find((p) => p.year === withdraw401kYear);
    const net401kINR = p401k ? p401k.us401k : 0;

    const withdrawalRates = [0.02, 0.03, 0.04];
    const withdrawalScenarios = {};
    withdrawalRates.forEach((rate) => {
      const rows = [];
      let corpus = finalWealth;
      for (let y = targetYear; y <= targetYear + 25; y++) {
        const w = corpus * rate;
        const netMonthlyIncome = (w / 12) * (applyTax ? (1 - taxDragRate) : 1);
        const growth = corpus * 0.12;
        const end = corpus - w + growth;
        rows.push({
          year: y,
          corpusStart: corpus,
          withdrawalMonthly: netMonthlyIncome,
          realWithdrawalMonthly: netMonthlyIncome / Math.pow(1 + inflationRate, y - targetYear),
          corpusEnd: end
        });
        corpus = end;
      }
      withdrawalScenarios[`${(rate * 100).toFixed(0)}%`] = rows;
    });

    return {
      summary: { startWealth: projection[0].total, finalWealth, net401kINR },
      fireProjections: projection,
      withdrawalScenarios,
      inputs: Object.assign({}, input)
    };
  }

  // Stress scenarios: rerun the engine with perturbed assumptions vs a base result.
  function runStressScenarios(input, baseResults, fireNumberLakhs) {
    const retYear = parseInt(input.retirementYear, 10);
    const baseFinal = baseResults.summary.finalWealth;

    function build(label, assumption, tone, overrides) {
      const r = calculateFirePlan(Object.assign({}, input, overrides));
      const at = r.fireProjections.find((p) => p.year === retYear);
      const finalWealth = at ? at.total : 0;
      const coverage = at && at.calculatedMonthlyExpense
        ? (at.passiveIncomeMonthly / at.calculatedMonthlyExpense) * 100 : null;
      let fireYear = null;
      if (fireNumberLakhs > 0) {
        const hit = r.fireProjections.find((p) => p.total >= fireNumberLakhs);
        fireYear = hit ? hit.year : null;
      }
      return { key: label, label, assumption, tone, finalWealth, wealthDelta: finalWealth - baseFinal, coverage, fireYear };
    }

    return [
      build('Low returns', 'Equity CAGR −2%', 'warning', {
        mfRate: num(input.mfRate, 0.12) - 0.02,
        stocksRate: num(input.stocksRate, 0.15) - 0.02,
        usRate: num(input.usRate, 0.12) - 0.02
      }),
      build('High inflation', 'Inflation +2%', 'warning', {
        inflationRate: num(input.inflationRate, 0.06) + 0.02
      }),
      build('Market shock', 'Equity −30% today', 'danger', {
        mfCurrent: num(input.mfCurrent, 0) * 0.7,
        stocksIndia: num(input.stocksIndia, 0) * 0.7,
        usStocks: num(input.usStocks, 0) * 0.7
      })
    ];
  }

  window.calculateFirePlan = calculateFirePlan;
  window.runStressScenarios = runStressScenarios;
})();
