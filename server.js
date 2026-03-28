const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (req, res) => {
  res.json({ 
    ok: true, 
    hasKey: !!process.env.ANTHROPIC_API_KEY,
    keyStart: process.env.ANTHROPIC_API_KEY ? process.env.ANTHROPIC_API_KEY.slice(0,12) + '...' : 'MISSING'
  });
});

app.post('/answer', async (req, res) => {
  const { question, slide, history } = req.body;
  
  console.log('=== NEW QUESTION ===');
  console.log('Question:', question);
  console.log('API Key exists:', !!process.env.ANTHROPIC_API_KEY);
  
  if (!question) return res.status(400).json({ error: 'No question provided' });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set on server' });

  const SYSTEM = `You are a real-time interview copilot for Mohan Krishna K presenting ClinTrialAI at Medidata for Data Scientist R&D. Give him a clear answer to read on screen.

PROJECT: ClinTrialAI predicts patient dropout risk in Phase 2/3 clinical trials.
XGBoost on CDISC SDTM: PR-AUC 0.84, ROC-AUC 0.88, Recall 0.83.
BioBERT on clinical notes: F1 0.74.
LLaMA-3 RAG with FAISS under 50ms.
Ensemble: 0.55 x XGBoost + 0.30 x BioBERT + 0.15 x RAG.
Results: PR-AUC 0.62 to 0.84 (+35%), dropout 28% to 21%, saves $15-25M per trial, 4 months faster, 14x faster.
Stack: FastAPI Docker AWS MLflow Airflow Evidently SHAP LIME GitHub Actions Feast Redis.
Data: 50000 patients, 120 trials, CDISC SDTM, HIPAA, 21 CFR Part 11.
Mohan: Best Buy RAG/LLMs, LabCorp BioBERT, TD Bank XGBoost SHAP. MS Applied Stats UT Arlington 2024.

RULES: First person as Mohan. Max 5 sentences. Simple English. No bullets. No "Great question". Direct answer. End with Medidata connection.`;

  const ctx = slide && slide !== 'any' ? `Slide ${slide}. ` : '';
  const messages = [];

  if (history && history.length > 0) {
    history.slice(-2).forEach(h => {
      messages.push({ role: 'user', content: `"${h.q}"` });
      messages.push({ role: 'assistant', content: h.a });
    });
  }

  messages.push({
    role: 'user',
    content: `${ctx}Interviewer asked: "${question}"\n\nAnswer clearly. Max 5 sentences.`
  });

  try {
    console.log('Calling Anthropic API...');
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        system: SYSTEM,
        messages: messages
      })
    });

    console.log('API response status:', response.status);
    const text = await response.text();
    console.log('API raw response:', text.slice(0, 500));

    let data;
    try { data = JSON.parse(text); }
    catch(e) { return res.status(500).json({ error: 'Invalid JSON from API', raw: text.slice(0, 200) }); }

    if (data.content && data.content[0] && data.content[0].text) {
      console.log('SUCCESS - Answer:', data.content[0].text.slice(0, 100));
      res.json({ answer: data.content[0].text.trim() });
    } else if (data.error) {
      console.error('Anthropic error:', JSON.stringify(data.error));
      res.status(500).json({ error: 'API error: ' + data.error.message, type: data.error.type });
    } else {
      console.error('Unexpected response:', JSON.stringify(data));
      res.status(500).json({ error: 'Unexpected API response', raw: JSON.stringify(data).slice(0, 200) });
    }
  } catch (err) {
    console.error('Fetch error:', err.message);
    res.status(500).json({ error: 'Server fetch error: ' + err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API Key configured: ${!!process.env.ANTHROPIC_API_KEY}`);
});
