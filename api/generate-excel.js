const ExcelJS = require('exceljs');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { summary = {}, fireProjections = [], withdrawalScenarios = {}, inputs = {}, expenses = {}, oneTimeExpenses = {} } = body;

    const workbook = new ExcelJS.Workbook();

    const headerStyle = {
      font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } },
      alignment: { horizontal: 'center', vertical: 'middle' }
    };

    const sheetSum = workbook.addWorksheet('Summary & Inputs');
    sheetSum.columns = [
      { header: 'Metric', key: 'metric', width: 35 },
      { header: 'Value', key: 'value', width: 20 }
    ];
    sheetSum.getRow(1).eachCell((cell) => {
      cell.font = headerStyle.font;
      cell.fill = headerStyle.fill;
    });

    sheetSum.addRows([
      { metric: 'Projected Freedom Wealth (at Retire)', value: summary.finalWealth || 0 },
      { metric: 'Projected 401k (Side Pot)', value: summary.net401kINR || 0 },
      { metric: 'Start Year', value: inputs.startYear || '' },
      { metric: 'Retirement Year', value: inputs.retirementYear || '' },
      { metric: 'Return to India Year', value: inputs.returnYear || '' },
      { metric: 'Inflation Rate', value: inputs.inflationRate !== undefined ? `${(inputs.inflationRate * 100).toFixed(1)}%` : '' },
      { metric: 'Forecast CAGR', value: inputs.mfRate !== undefined ? `${(inputs.mfRate * 100).toFixed(1)}%` : '' },
      { metric: 'Tax Drag Applied?', value: inputs.applyTax ? 'Yes (12.5%)' : 'No' }
    ]);

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
    sheetJourney.getRow(1).eachCell((cell) => {
      cell.font = headerStyle.font;
      cell.fill = headerStyle.fill;
    });

    fireProjections.forEach((p) => {
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

    const sheetExp = workbook.addWorksheet('Expenses Analysis');
    sheetExp.columns = [
      { header: 'Category', key: 'cat', width: 30 },
      { header: 'Cost (Current Rs)', key: 'val', width: 20 }
    ];
    sheetExp.getRow(1).eachCell((cell) => {
      cell.font = headerStyle.font;
      cell.fill = headerStyle.fill;
    });

    sheetExp.addRow({ cat: '--- MONTHLY LIFESTYLE ---', val: '' });
    Object.entries(expenses).forEach(([key, val]) => {
      sheetExp.addRow({ cat: key.charAt(0).toUpperCase() + key.slice(1), val });
    });

    sheetExp.addRow({ cat: '', val: '' });
    sheetExp.addRow({ cat: '--- ONE-TIME SETUP COSTS ---', val: '' });
    Object.entries(oneTimeExpenses).forEach(([key, val]) => {
      sheetExp.addRow({ cat: key.charAt(0).toUpperCase() + key.slice(1), val });
    });

    const sheetSWP = workbook.addWorksheet('SWP Scenarios');
    sheetSWP.columns = [
      { header: 'Scenario', key: 'rate', width: 10 },
      { header: 'Year', key: 'year', width: 10 },
      { header: 'Start Corpus', key: 'start', width: 15 },
      { header: 'Withdrawal/mo', key: 'with', width: 15 },
      { header: 'Real Value (Inf. Adj)', key: 'real', width: 20 },
      { header: 'End Corpus', key: 'end', width: 15 }
    ];
    sheetSWP.getRow(1).eachCell((cell) => {
      cell.font = headerStyle.font;
      cell.fill = headerStyle.fill;
    });

    Object.entries(withdrawalScenarios).forEach(([rate, data]) => {
      data.forEach((row) => {
        sheetSWP.addRow({
          rate,
          year: row.year,
          start: row.corpusStart,
          with: row.withdrawalMonthly,
          real: row.realWithdrawalMonthly,
          end: row.corpusEnd
        });
      });
      sheetSWP.addRow({});
    });

    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=FIRE_Freedom_Plan_Pro.xlsx');
    return res.status(200).send(Buffer.from(buffer));
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to generate excel' });
  }
};
