const express = require('express');
const cors = require('cors');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const calculate = require('./api/calculate');

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

// --- MAIN CALCULATION ENDPOINT ---
// Delegates to api/calculate.js, the same serverless function Vercel runs in
// production, so local dev never drifts from what's actually deployed.
app.post('/api/calculate', (req, res) => {
  calculate(req, res);
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