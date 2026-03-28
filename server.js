const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (req, res) => {
  res.json({
    status: 'running',
    hasKey: !!process.env.ANTHROPIC_API_KEY,
    keyPreview: process.env.ANTHROPIC_API_KEY
      ? process.env.ANTHROPIC_API_KEY.slice(0, 14) + '...'
      : 'NOT SET'
  });
});

app.get('/test', async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.json({ error: 'ANTHROPIC_API_KEY not set' });
  }
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 50,
        messages: [{ role: 'user', content: 'Say: API working' }]
      })
    });
    const d = await r.json();
    res.json({
      httpStatus: r.status,
      answer: d.content?.[0]?.text || null,
      error: d.error || null
    });
  } catch (e) {
    res.json({ fetchError: e.message });
  }
});

app.post('/answer', async (req, res) => {
  const { question, slide, history } = req.body;
  console.log('Question received:', question);
  if (!question) return res.status(400).json({ error: 'No question provided' });
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set on server' });
  }

  const SYSTEM = `You are a real-time interview copilot for Mohan Krishna K presenting ClinTrialAI at Medidata for Data Scientist R&D. Give a clear answer to read on screen.

PROJECT: ClinTrialAI predicts patient dropout risk in Phase 2/3 clinical trials.
XGBoost on CDISC SDTM: PR-AUC 0.84, ROC-AUC 0.88, Recall 0.83.
BioBERT on clinical notes: F1 0.74. LLaMA-3 RAG with FAISS under 50ms.
Ensemble: 0.55 x XGBoost + 0.30 x BioBERT + 0.15 x RAG.
Results: PR-AUC 0.62 to 0.84 (+35%), dropout 28% to 21%, saves $15-25M per trial, 4 months faster, 14x faster detection.
Stack: FastAPI Docker AWS MLflow Airflow Evidently SHAP LIME GitHub Actions Feast Redis.
Data: 50000 patients, 120 trials, CDISC SDTM, HIPAA, 21 CFR Part 11.
Mohan: Best Buy RAG/LLMs, LabCorp BioBERT, TD Bank XGBoost SHAP. MS Applied Stats UT Arlington 2024.

RULES: First person as Mohan. Max 5 sentences. Simple English. No bullets. No "Great question". Direct answer. End with Medidata connection.`;

  const ctx = slide && slide !== 'any' ? `Slide ${slide}. ` : '';
  const messages = [];
  if (history && Array.isArray(history)) {
    history.slice(-2).forEach(h => {
      if (h.q && h.a) {
        messages.push({ role: 'user', content: `"${h.q}"` });
        messages.push({ role: 'assistant', content: h.a });
      }
    });
  }
  messages.push({
    role: 'user',
    content: `${ctx}Interviewer asked: "${question}"\n\nAnswer clearly. Max 5 sentences.`
  });

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 300,
        system: SYSTEM,
        messages: messages
      })
    });
    const data = await response.json();
    console.log('API status:', response.status);
    if (data.content && data.content[0] && data.content[0].text) {
      return res.json({ answer: data.content[0].text.trim() });
    }
    if (data.error) {
      return res.status(500).json({ error: data.error.message, type: data.error.type });
    }
    return res.status(500).json({ error: 'No answer returned', debug: data });
  } catch (err) {
    return res.status(500).json({ error: 'Fetch failed: ' + err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server on port ${PORT}`);
  console.log(`API key set: ${!!process.env.ANTHROPIC_API_KEY}`);
});
```

**Step 5 — Commit on GitHub**
Scroll down → click **Commit changes** → click **Commit changes** again

**Step 6 — Wait for Render to redeploy**
Go to Render → click your service → click **Logs** tab → wait until you see:
```
Server on port 10000
API key set: true
