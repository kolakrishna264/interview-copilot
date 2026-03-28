var express = require('express');
var cors = require('cors');
var path = require('path');

var app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', function(req, res) {
  res.json({ status: 'ok', key: !!process.env.ANTHROPIC_API_KEY });
});

app.get('/test', function(req, res) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.json({ error: 'API key not set' });
  }
  fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 30,
      messages: [{ role: 'user', content: 'Reply with: working' }]
    })
  })
  .then(function(r) { return r.json(); })
  .then(function(d) {
    res.json({ answer: d.content && d.content[0] ? d.content[0].text : null, error: d.error || null });
  })
  .catch(function(e) { res.json({ error: e.message }); });
});

app.post('/answer', function(req, res) {
  var question = req.body.question;
  var slide = req.body.slide;
  var history = req.body.history;

  if (!question) return res.status(400).json({ error: 'No question' });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'API key not set on Render' });

  var system = 'You are a real-time interview copilot for Mohan Krishna K presenting ClinTrialAI at Medidata for Data Scientist R&D. Give a clear answer to read on screen.\n\nPROJECT: ClinTrialAI predicts patient dropout risk in Phase 2/3 clinical trials. XGBoost on CDISC SDTM: PR-AUC 0.84, ROC-AUC 0.88, Recall 0.83. BioBERT on clinical notes: F1 0.74. LLaMA-3 RAG with FAISS under 50ms. Ensemble: 0.55 x XGBoost + 0.30 x BioBERT + 0.15 x RAG. Results: PR-AUC 0.62 to 0.84 (+35%), dropout 28% to 21%, saves $15-25M per trial, 4 months faster, 14x faster detection. Stack: FastAPI Docker AWS MLflow Airflow Evidently SHAP LIME GitHub Actions Feast Redis. Data: 50000 patients, 120 trials, CDISC SDTM, HIPAA, 21 CFR Part 11. Mohan: Best Buy RAG/LLMs, LabCorp BioBERT, TD Bank XGBoost SHAP. MS Applied Stats UT Arlington 2024.\n\nRULES: First person as Mohan. Max 5 sentences. Simple English. No bullets. No Great question. Direct answer. End with Medidata connection.';

  var ctx = (slide && slide !== 'any') ? 'Slide ' + slide + '. ' : '';
  var messages = [];

  if (history && Array.isArray(history)) {
    history.slice(-2).forEach(function(h) {
      if (h.q && h.a) {
        messages.push({ role: 'user', content: h.q });
        messages.push({ role: 'assistant', content: h.a });
      }
    });
  }

  messages.push({
    role: 'user',
    content: ctx + 'Interviewer asked: ' + question + '\n\nAnswer clearly. Max 5 sentences.'
  });

  fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: claude-haiku-4-5-20251001
      max_tokens: 300,
      system: system,
      messages: messages
    })
  })
  .then(function(r) { return r.json(); })
  .then(function(data) {
    if (data.content && data.content[0] && data.content[0].text) {
      return res.json({ answer: data.content[0].text.trim() });
    }
    if (data.error) {
      return res.status(500).json({ error: data.error.message });
    }
    return res.status(500).json({ error: 'No answer', raw: JSON.stringify(data) });
  })
  .catch(function(err) {
    return res.status(500).json({ error: err.message });
  });
});

var PORT = process.env.PORT || 3000;
app.listen(PORT, function() {
  console.log('Server running on port ' + PORT);
  console.log('API key set: ' + !!process.env.ANTHROPIC_API_KEY);
});
