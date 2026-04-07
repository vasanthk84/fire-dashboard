function growOneYear(principal, annualRate, monthlySIP) {
  const monthlyRate = annualRate / 12;
  const fvPrincipal = principal * Math.pow(1 + monthlyRate, 12);
  const fvSIP = monthlySIP > 0
    ? monthlySIP * ((Math.pow(1 + monthlyRate, 12) - 1) / monthlyRate) * (1 + monthlyRate)
    : 0;
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

module.exports = (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const input = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const parseVal = (val, defaultVal) => (val !== undefined && val !== '' && val !== null) ? parseFloat(val) : defaultVal;

    const startYear = parseInt(input.startYear, 10) || 2025;
    const retirementYear = parseInt(input.retirementYear, 10) || 2035;
    const targetYear = retirementYear;

    const mfCurrent = parseVal(input.mfCurrent, 122);
    const stocksIndia = parseVal(input.stocksIndia, 29.6);
    const usStocksINR = parseVal(input.usStocks, 16);
    const emergencyFund = parseVal(input.emergencyFund, 10);

    const us401kUSD = parseVal(input.us401k, 52000);
    const usdToInr401k = parseVal(input.usdExchangeRate, 95);
    const epfCurrent = parseVal(input.epfCurrent, 62.93);
    const basicPay = parseVal(input.basicPay, 34900);
    const epfRate = parseVal(input.epfRate, 0.0825);
    const vpfRate = parseVal(input.vpfRate, 0.88);

    const bondsInitial = parseVal(input.bondsInitial, 18);
    const bondAnnualIncrease = parseVal(input.bondAnnualIncrease, 0.01);
    const bondRate = parseVal(input.bondRate, 0.10);

    const mfSIP = parseVal(input.mfSIP, 1.2);
    const sipStepUpRate = parseVal(input.sipStepUpRate, 0.10);
    const optionSellingMonthly = parseVal(input.optionSellingMonthly, 0.20);

    const annualSalary = parseVal(input.annualSalary, 94000);
    const returnToIndiaYear = parseInt(input.returnYear, 10) || 2030;
    const withdraw401kYear = parseInt(input.withdraw401kYear, 10) || 2033;
    const taxRate401k = 0.37;

    const monthlyExpensesStart = parseVal(input.monthlyExpenses, 0);
    const oneTimeExpenseTotalRaw = parseVal(input.oneTimeExpenseTotal, 0);
    const applyTax = input.applyTax === true;
    const taxDragRate = 0.125;

    const mfRate = parseVal(input.mfRate, 0.12);
    const stocksRate = parseVal(input.stocksRate, 0.15);
    const usRate = parseVal(input.usRate, 0.12);
    const inflationRate = parseVal(input.inflationRate, 0.06);

    const generateProjection = () => {
      const projection = [];

      let curMF = mfCurrent;
      let curStocks = stocksIndia;
      let curUSStocks = usStocksINR;
      let curBonds = bondsInitial;
      let curEmergency = emergencyFund;
      let curEPF = epfCurrent;
      let cur401kUSD = us401kUSD;

      let currentBondAddition = bondsInitial * bondAnnualIncrease;
      let currentSIP = mfSIP;

      for (let year = startYear; year <= 2055; year++) {
        const isRetired = year >= retirementYear;
        const isWithdrawing401k = year === withdraw401kYear;
        const yearsPassed = year - startYear;

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
          mf: parseFloat(curMF.toFixed(2)),
          stocksIndia: parseFloat(curStocks.toFixed(2)),
          usStocks: parseFloat(curUSStocks.toFixed(2)),
          bonds: parseFloat(curBonds.toFixed(2)),
          epf: parseFloat(curEPF.toFixed(2)),
          us401k: parseFloat(display401kINR.toFixed(2)),
          emergencyFund: parseFloat(curEmergency.toFixed(2)),
          sipAmount: isRetired ? 0 : parseFloat(currentSIP.toFixed(2)),
          total: parseFloat(total.toFixed(2)),
          passiveIncomeMonthly: parseFloat(passiveIncomeNet.toFixed(2)),
          passiveIncomeGross: parseFloat(passiveIncomeGross.toFixed(2)),
          monthlyTax: parseFloat(monthlyTax.toFixed(2)),
          calculatedMonthlyExpense: parseFloat((currentMonthlyExpenseInflated / 100000).toFixed(2)) || 0,
          oneTimeDeduction: parseFloat(oneTimeDeductionDisplay.toFixed(2)),
          milestones: []
        });

        let activeSIP = currentSIP;
        let bondInterestToMF = 0;

        if (isRetired) {
          activeSIP = 0;
          bondInterestToMF = curBonds * bondRate;
          if (monthlyExpensesStart > 0) {
            const expenseInLakhs = currentAnnualExpense / 100000;
            curMF -= expenseInLakhs;
          }
        } else {
          const bondInterest = curBonds * bondRate;
          let bondInjection = currentBondAddition;
          currentBondAddition = currentBondAddition * (1 + bondAnnualIncrease);
          curBonds += bondInterest + bondInjection;
          currentSIP = currentSIP * (1 + sipStepUpRate);
        }

        if (curMF > 0) {
          curMF = growOneYear(curMF, mfRate, activeSIP);
        }

        curStocks *= (1 + stocksRate);
        curUSStocks *= (1 + usRate);
        curEmergency *= 1.06;

        if (isRetired) {
          curEPF += curEPF * 0.07;
        } else {
          const epfResult = calculateEPFYearly(curEPF * 100000, basicPay, epfRate, vpfRate);
          curEPF = epfResult.endBalance / 100000;
        }

        const optionIncome = growOneYear(0, mfRate, optionSellingMonthly);
        curMF += optionIncome;

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

    const withdrawalRates = [0.02, 0.03, 0.04];
    const withdrawalScenarios = {};

    withdrawalRates.forEach((rate) => {
      const projections = [];
      let corpus = finalWealth;

      for (let y = targetYear; y <= targetYear + 25; y++) {
        const w = corpus * rate;
        const netMonthlyIncome = (w / 12) * (applyTax ? (1 - taxDragRate) : 1);
        const growth = corpus * 0.12;
        const end = corpus - w + growth;

        projections.push({
          year: y,
          corpusStart: corpus,
          withdrawalMonthly: netMonthlyIncome,
          realWithdrawalMonthly: netMonthlyIncome / Math.pow(1 + inflationRate, y - targetYear),
          corpusEnd: end
        });

        corpus = end;
      }

      withdrawalScenarios[`${(rate * 100).toFixed(0)}%`] = projections;
    });

    return res.status(200).json({
      summary: { startWealth: fireProjections[0].total, finalWealth, net401kINR },
      fireProjections,
      withdrawalScenarios,
      inputs: { ...input }
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};
