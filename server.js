const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Proxy endpoint — receives question from browser, calls Anthropic, returns answer
app.post('/answer', async (req, res) => {
  const { question, slide, history } = req.body;
  if (!question) return res.status(400).json({ error: 'No question provided' });

  const SYSTEM = `You are a real-time interview copilot for Mohan Krishna K presenting ClinTrialAI at Medidata for Data Scientist R&D. Print the answer clearly on screen so he can read it out loud.

PROJECT: ClinTrialAI predicts patient dropout risk in Phase 2/3 clinical trials.
- XGBoost on CDISC SDTM structured data: PR-AUC 0.84, ROC-AUC 0.88, Recall 0.83
- BioBERT fine-tuned on clinical notes: F1 0.74, 3-class risk classification  
- LLaMA-3 RAG with FAISS vector store: retrieval under 50ms
- Ensemble: 0.55 x XGBoost + 0.30 x BioBERT + 0.15 x RAG flag
- Results: PR-AUC improved 35% from 0.62 to 0.84, dropout reduced 28% to 21%, saves $15-25M per trial, 4 months faster completion, 14x faster risk detection
- Stack: FastAPI, Docker, AWS EC2, MLflow, Airflow, Evidently AI, SHAP, LIME, GitHub Actions, Feast feature store, Redis
- Data: 50,000 patients across 120 trials, CDISC SDTM format, HIPAA compliant, 21 CFR Part 11
- Mohan's experience: Best Buy (RAG/LLMs/MLOps), LabCorp (BioBERT/clinical NLP), TD Bank (XGBoost/SHAP)
- MS Applied Statistics and Data Science, UT Arlington, December 2024

ANSWER RULES:
- Write in first person as Mohan
- Maximum 5 sentences
- Simple clear English — easy to read fast on a phone screen
- No bullet points, no markdown formatting
- Do not start with "Great question"
- Answer directly and confidently
- End with one sentence connecting to Medidata or the role`;

  const ctx = slide && slide !== 'any' ? `Context: Mohan is on slide ${slide} of his presentation. ` : '';
  
  const messages = [];
  if (history && history.length > 0) {
    history.slice(-3).forEach(h => {
      messages.push({ role: 'user', content: `"${h.q}"` });
      messages.push({ role: 'assistant', content: h.a });
    });
  }
  messages.push({
    role: 'user',
    content: `${ctx}The interviewer just asked: "${question}"\n\nPrint the answer clearly. Max 5 sentences. Simple English.`
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
        model: 'claude-sonnet-4-20250514',
        max_tokens: 250,
        system: SYSTEM,
        messages: messages
      })
    });

    const data = await response.json();

    if (data.content && data.content[0] && data.content[0].text) {
      res.json({ answer: data.content[0].text.trim() });
    } else {
      console.error('API error:', JSON.stringify(data));
      res.status(500).json({ error: 'No answer from AI', details: data.error?.message });
    }
  } catch (err) {
    console.error('Fetch error:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Copilot server running on port ${PORT}`));
