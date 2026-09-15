require('dotenv').config(); // loads .env for local dev (e.g. UPSTASH_REDIS_REST_URL/TOKEN) — harmless if the file doesn't exist; Vercel injects its own env vars in production without this

const express = require('express');
const cors = require('cors');
const ExcelJS = require('exceljs');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const calculate = require('./api/calculate');
const cloudState = require('./api/state');

const app = express();
app.use(cors());
// CAS statements arrive as base64 in the JSON body, which runs ~33% larger
// than the PDF itself — a 41-page statement is a few hundred KB, so 20mb
// leaves plenty of headroom without opening the door to huge uploads.
app.use(express.json({ limit: '20mb' }));

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

// --- OPTIONAL CLOUD BACKUP (see api/state.js) ---
// Same shared-module delegation as /api/calculate above — works whether or
// not UPSTASH_REDIS_REST_URL/TOKEN are set; api/state.js itself reports
// "not configured" rather than erroring when they're missing.
app.get('/api/state', (req, res) => {
  cloudState(req, res);
});
app.post('/api/state', (req, res) => {
  cloudState(req, res);
});

// --- CAS STATEMENT PARSER (local dev only — spawns a Python subprocess, ---
// --- which Vercel's Node serverless functions cannot do) ---

// On Windows, `python`/`python3` on PATH is very often not Python at all —
// it's a Microsoft Store "app execution alias" stub. Running it doesn't fail
// to spawn (so there's no ENOENT to catch); it just prints a
// "Python was not found; run without arguments to install from the
// Microsoft Store..." message and exits, which broke every CAS import until
// this was handled explicitly. `py` (the official Windows Python launcher,
// installed alongside a real python.exe and NOT covered by that alias) is
// tried first on Windows for that reason.
function resolvePythonCandidates() {
  if (process.env.CAS_PYTHON_BIN) return [process.env.CAS_PYTHON_BIN];
  return process.platform === 'win32' ? ['py', 'python', 'python3'] : ['python3', 'python'];
}

const PYTHON_STORE_STUB_PATTERN = /Microsoft Store|app execution alias|was not found; run without arguments/i;

// Tries each candidate interpreter in order, moving to the next only when a
// candidate clearly isn't a real Python (missing entirely, or the Windows
// Store stub described above) — any other failure (bad password, corrupt
// PDF, casparser not installed for that interpreter) is reported as-is
// rather than silently retried under a different interpreter.
function runPythonParser(candidates, scriptPath, tempPath, password, cb) {
  const [bin, ...rest] = candidates;
  if (!bin) {
    cb(new Error(
      'Could not find a working Python interpreter (tried: ' + resolvePythonCandidates().join(', ') + '). ' +
      'Install Python 3 from python.org — not the Microsoft Store — then run `pip install casparser`, ' +
      'or set CAS_PYTHON_BIN to the full path of your python.exe.'
    ));
    return;
  }

  const args = bin === 'py' ? ['-3', scriptPath, tempPath] : [scriptPath, tempPath];
  let settled = false;
  // PYTHONIOENCODING: belt-and-suspenders alongside parse_cas.py's own stdout
  // reconfigure — Windows can pipe a subprocess's stdout through a non-UTF-8
  // codepage, which breaks on a CAS containing stray non-ASCII PDF-extraction
  // artifacts (observed: a lone U+FFFE noncharacter in a real statement).
  const child = spawn(bin, args, { env: { ...process.env, CAS_PASSWORD: password || '', PYTHONIOENCODING: 'utf-8' } });

  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });

  child.on('error', (spawnErr) => {
    if (settled) return;
    settled = true;
    if (spawnErr.code === 'ENOENT' && rest.length > 0) {
      runPythonParser(rest, scriptPath, tempPath, password, cb);
    } else {
      cb(spawnErr);
    }
  });

  child.on('close', (code) => {
    if (settled) return;
    settled = true;
    const looksLikeStoreStub = PYTHON_STORE_STUB_PATTERN.test(stdout) || PYTHON_STORE_STUB_PATTERN.test(stderr);
    if (looksLikeStoreStub && rest.length > 0) {
      runPythonParser(rest, scriptPath, tempPath, password, cb);
      return;
    }
    cb(null, { code, stdout, stderr, usedBin: bin });
  });
}

app.post('/api/cas/parse', (req, res) => {
  const { fileBase64, password } = req.body || {};
  if (!fileBase64 || typeof fileBase64 !== 'string') {
    res.status(400).json({ error: 'Missing fileBase64 in request body.' });
    return;
  }

  let pdfBuffer;
  try {
    // Accept both a bare base64 string and a data: URL (FileReader.readAsDataURL).
    const base64Data = fileBase64.includes(',') ? fileBase64.split(',').pop() : fileBase64;
    pdfBuffer = Buffer.from(base64Data, 'base64');
  } catch {
    res.status(400).json({ error: 'Could not decode fileBase64 as base64.' });
    return;
  }

  const tempPath = path.join(os.tmpdir(), `cas-${crypto.randomUUID()}.pdf`);
  fs.writeFile(tempPath, pdfBuffer, (writeErr) => {
    if (writeErr) {
      res.status(500).json({ error: `Could not write temp file for parsing: ${writeErr.message}` });
      return;
    }

    const scriptPath = path.join(__dirname, 'scripts', 'parse_cas.py');
    runPythonParser(resolvePythonCandidates(), scriptPath, tempPath, password, (spawnErr, result) => {
      fs.unlink(tempPath, () => {});

      if (spawnErr) {
        const hint = spawnErr.code === 'ENOENT'
          ? `Could not find a Python interpreter (tried: ${resolvePythonCandidates().join(', ')}). ` +
            `Install Python 3 and casparser (pip install casparser), or set CAS_PYTHON_BIN to the full path of your python.exe.`
          : spawnErr.message;
        res.status(500).json({ error: hint });
        return;
      }

      const { code, stdout, stderr } = result;
      let parsed;
      try {
        parsed = JSON.parse(stdout);
      } catch {
        const storeHint = PYTHON_STORE_STUB_PATTERN.test(stdout) || PYTHON_STORE_STUB_PATTERN.test(stderr)
          ? ' It looks like every "python"/"python3"/"py" on PATH opens the Microsoft Store install prompt instead of ' +
            'running Python — install Python 3 from python.org (check "Add python.exe to PATH" during setup) and run ' +
            '`pip install casparser`, or set CAS_PYTHON_BIN to the full path of your python.exe.'
          : '';
        res.status(500).json({
          error: `Python parser produced unexpected output${stderr ? `: ${stderr.slice(0, 500)}` : '.'}${storeHint}`
        });
        return;
      }

      if (code !== 0 || parsed.error) {
        res.status(422).json({ error: parsed.error || 'Failed to parse the CAS statement.' });
        return;
      }

      res.json(parsed);
    });
  });
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