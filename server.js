const express = require('express');
const cors = require('cors');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));

  app.get('/', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.status(200).send('Frontend runs from the Vite dev server at http://localhost:5173');
  });
}

// --- HELPER FUNCTIONS ---

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
    yearlyInterest += (balance * (interestRate / 12));
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

// --- MAIN CALCULATION ENDPOINT ---

app.post('/api/calculate', (req, res) => {
  try {
    const input = req.body;
    const parseVal = (val, defaultVal) => (val !== undefined && val !== '' && val !== null) ? parseFloat(val) : defaultVal;
    
    // Inputs
    const startYear = parseInt(input.startYear) || 2025;
    const retirementYear = parseInt(input.retirementYear) || 2035;
    const targetYear = retirementYear; 
    
    // Assets
    const mfCurrent = parseVal(input.mfCurrent, 122);
    const stocksIndia = parseVal(input.stocksIndia, 29.6);
    const usStocksINR = parseVal(input.usStocks, 16);
    const emergencyFund = parseVal(input.emergencyFund, 10);
    
    // 401k & EPF
    const us401kUSD = parseVal(input.us401k, 52000);
    const usdToInr401k = parseVal(input.usdExchangeRate, 95);
    const epfCurrent = parseVal(input.epfCurrent, 62.93);
    const basicPay = parseVal(input.basicPay, 34900);
    const epfRate = parseVal(input.epfRate, 0.0825);
    const vpfRate = parseVal(input.vpfRate, 0.88);
    
    // Fixed Income
    const bondsInitial = parseVal(input.bondsInitial, 18);
    const bondAnnualIncrease = parseVal(input.bondAnnualIncrease, 0.01);
    const bondRate = parseVal(input.bondRate, 0.10);

    // Flows
    const mfSIP = parseVal(input.mfSIP, 1.2);
    const sipStepUpRate = parseVal(input.sipStepUpRate, 0.10); 
    const optionSellingMonthly = parseVal(input.optionSellingMonthly, 0.20);
    
    const annualSalary = parseVal(input.annualSalary, 94000);
    const returnToIndiaYear = parseInt(input.returnYear) || 2030;
    const withdraw401kYear = parseInt(input.withdraw401kYear) || 2033;
    const taxRate401k = 0.37;
    
    // Expenses & Taxation
    const monthlyExpensesStart = parseVal(input.monthlyExpenses, 0);
    const oneTimeExpenseTotalRaw = parseVal(input.oneTimeExpenseTotal, 0);
    const applyTax = input.applyTax === true;
    const taxDragRate = 0.125; 
    
    // Rates
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
            if (year <= returnToIndiaYear) cur401kUSD = calculate401kYearly(cur401kUSD, annualSalary, 0.05, 0.04, usRate);
            else if (year > withdraw401kYear) cur401kUSD = 0; 
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
          calculatedMonthlyExpense: parseFloat((currentMonthlyExpenseInflated/100000).toFixed(2)) || 0,
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
          if (year >= startYear) { 
             let bondInjection = currentBondAddition;
             currentBondAddition = currentBondAddition * (1 + bondAnnualIncrease);
             curBonds += bondInterest + bondInjection;
          }
          currentSIP = currentSIP * (1 + sipStepUpRate);
        }

        if (curMF > 0) curMF = growOneYear(curMF, mfRate, activeSIP);
        curStocks *= (1 + stocksRate);
        
        if (isRetired) curEPF += curEPF * 0.07; 
        else {
           const epfResult = calculateEPFYearly(curEPF * 100000, basicPay, epfRate, vpfRate);
           curEPF = epfResult.endBalance / 100000; 
        }

        const optionIncome = growOneYear(0, mfRate, optionSellingMonthly);
        curMF += optionIncome;

        if (bondInterestToMF > 0) curMF += bondInterestToMF;
      }
      return projection;
    };

    const fireProjections = generateProjection();
    
    const enrichMilestones = (projections) => {
      projections.forEach((p, i) => {
        const prev = projections[i-1];
        const ms = [];
        if (p.year === parseInt(returnToIndiaYear)) {
            ms.push({type:'life', text:'🇮🇳 Return India'});
            if (p.oneTimeDeduction > 0) ms.push({type:'expense', text:`📉 Setup Cost`});
        }
        if (p.year === parseInt(retirementYear)) ms.push({type:'life', text:'🚀 Retirement'});
        if (p.year === parseInt(withdraw401kYear)) ms.push({type:'wealth', text:`💰 401k Injected`});
        const totalCr = p.total / 100;
        const prevTotalCr = prev ? prev.total / 100 : 0;
        const threshold = 0.5;
        const crossedMark = Math.floor(totalCr / threshold) * threshold;
        const prevCrossedMark = Math.floor(prevTotalCr / threshold) * threshold;
        if (crossedMark > prevCrossedMark && crossedMark >= 3.0) ms.push({type:'milestone', text:`🏆 ₹${crossedMark.toFixed(1)} Cr`});
        p.milestones = ms;
      });
    };

    enrichMilestones(fireProjections);

    const finalWealth = fireProjections.find(p => p.year === targetYear)?.total || 0;
    const p401k = fireProjections.find(p => p.year === withdraw401kYear);
    const net401kINR = p401k ? p401k.us401k : 0;

    const withdrawalRates = [0.02, 0.03, 0.04];
    const withdrawalScenarios = {};
    withdrawalRates.forEach(rate => {
        const projections = [];
        let corpus = finalWealth;
        for(let y = targetYear; y <= targetYear + 25; y++) {
            const w = corpus * rate;
            const netMonthlyIncome = (w / 12) * (applyTax ? (1 - taxDragRate) : 1);
            const growth = corpus * 0.12; 
            const end = corpus - w + growth;
            projections.push({
                year: y,
                corpusStart: corpus,
                withdrawalMonthly: netMonthlyIncome,
                realWithdrawalMonthly: netMonthlyIncome / Math.pow(1+inflationRate, y-targetYear),
                corpusEnd: end,
            });
            corpus = end;
        }
        withdrawalScenarios[`${(rate * 100).toFixed(0)}%`] = projections;
    });

    res.json({
      summary: { startWealth: fireProjections[0].total, finalWealth, net401kINR },
      fireProjections,
      withdrawalScenarios: withdrawalScenarios || {},
      inputs: { ...input } 
    });
    
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// --- NEW MULTI-SHEET EXCEL GENERATOR ---
app.post('/api/generate-excel', async (req, res) => {
  try {
    const { summary, fireProjections, withdrawalScenarios, inputs, expenses, oneTimeExpenses } = req.body;
    const workbook = new ExcelJS.Workbook();

    // -- STYLE DEFS --
    const headerStyle = {
      font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } }, // Indigo
      alignment: { horizontal: 'center', vertical: 'middle' }
    };
    const currencyFmt = '₹#,##0.00';

    // 1. SUMMARY SHEET
    const sheetSum = workbook.addWorksheet('Summary & Inputs');
    sheetSum.columns = [{ header: 'Metric', key: 'metric', width: 35 }, { header: 'Value', key: 'value', width: 20 }];
    sheetSum.getRow(1).eachCell((cell) => { cell.font = headerStyle.font; cell.fill = headerStyle.fill; });
    
    sheetSum.addRows([
        { metric: 'Projected Freedom Wealth (at Retire)', value: summary.finalWealth },
        { metric: 'Projected 401k (Side Pot)', value: summary.net401kINR },
        { metric: 'Start Year', value: inputs.startYear },
        { metric: 'Retirement Year', value: inputs.retirementYear },
        { metric: 'Return to India Year', value: inputs.returnYear },
        { metric: 'Inflation Rate', value: `${(inputs.inflationRate*100).toFixed(1)}%` },
        { metric: 'Forecast CAGR', value: `${(inputs.mfRate*100).toFixed(1)}%` },
        { metric: 'Tax Drag Applied?', value: inputs.applyTax ? 'Yes (12.5%)' : 'No' }
    ]);

    // 2. FREEDOM JOURNEY SHEET
    const sheetJourney = workbook.addWorksheet('Freedom Journey');
    sheetJourney.columns = [
        { header: 'Year', key: 'year', width: 10 },
        { header: 'SIP (L)', key: 'sip', width: 12 },
        { header: 'MF Corpus', key: 'mf', width: 15 },
        { header: 'Stocks', key: 'stocks', width: 15 },
        { header: 'EPF', key: 'epf', width: 15 },
        { header: '401k (INR)', key: 'us401k', width: 15 },
        { header: 'Total Wealth', key: 'total', width: 18 },
        { header: 'Passive Income', key: 'passive', width: 18 },
        { header: 'Expense (Adj)', key: 'expense', width: 18 },
        { header: 'One-Time Cost', key: 'onetime', width: 18 }
    ];
    sheetJourney.getRow(1).eachCell((cell) => { cell.font = headerStyle.font; cell.fill = headerStyle.fill; });
    
    fireProjections.forEach(p => {
        sheetJourney.addRow({
            year: p.year,
            sip: p.sipAmount,
            mf: p.mf,
            stocks: p.stocksIndia,
            epf: p.epf,
            us401k: p.us401k,
            total: p.total,
            passive: p.passiveIncomeMonthly,
            expense: p.calculatedMonthlyExpense,
            onetime: p.oneTimeDeduction > 0 ? -p.oneTimeDeduction : ''
        });
    });

    // 3. EXPENSES SHEET
    const sheetExp = workbook.addWorksheet('Expenses Analysis');
    sheetExp.columns = [{ header: 'Category', key: 'cat', width: 30 }, { header: 'Cost (Current ₹)', key: 'val', width: 20 }];
    sheetExp.getRow(1).eachCell((cell) => { cell.font = headerStyle.font; cell.fill = headerStyle.fill; });
    
    sheetExp.addRow({ cat: '--- MONTHLY LIFESTYLE ---', val: '' });
    Object.entries(expenses).forEach(([key, val]) => {
        sheetExp.addRow({ cat: key.charAt(0).toUpperCase() + key.slice(1), val: val });
    });
    
    sheetExp.addRow({ cat: '', val: '' }); // Spacer
    sheetExp.addRow({ cat: '--- ONE-TIME SETUP COSTS ---', val: '' });
    if(oneTimeExpenses) {
        Object.entries(oneTimeExpenses).forEach(([key, val]) => {
            sheetExp.addRow({ cat: key.charAt(0).toUpperCase() + key.slice(1), val: val });
        });
    }

    // 4. SWP SHEET
    const sheetSWP = workbook.addWorksheet('SWP Scenarios');
    sheetSWP.columns = [
        { header: 'Scenario', key: 'rate', width: 10 },
        { header: 'Year', key: 'year', width: 10 },
        { header: 'Start Corpus', key: 'start', width: 15 },
        { header: 'Withdrawal/mo', key: 'with', width: 15 },
        { header: 'Real Value (Inf. Adj)', key: 'real', width: 20 },
        { header: 'End Corpus', key: 'end', width: 15 }
    ];
    sheetSWP.getRow(1).eachCell((cell) => { cell.font = headerStyle.font; cell.fill = headerStyle.fill; });

    Object.entries(withdrawalScenarios).forEach(([rate, data]) => {
        data.forEach(row => {
            sheetSWP.addRow({
                rate: rate,
                year: row.year,
                start: row.corpusStart,
                with: row.withdrawalMonthly,
                real: row.realWithdrawalMonthly,
                end: row.corpusEnd
            });
        });
        sheetSWP.addRow({}); // Spacer between scenarios
    });

    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=FIRE_Freedom_Plan_Pro.xlsx');
    res.send(buffer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 FIRE Architect V3.5 (Combined Edition) running on port ${PORT}`);
});