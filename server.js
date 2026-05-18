const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.post('/api/chat', async (req, res) => {
  const { system, messages } = req.body;
  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) return res.status(500).json({ error: 'API key not configured' });
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 600, system, messages })
    });
    if (!response.ok) { const e = await response.text(); return res.status(response.status).json({ error: e }); }
    res.json(await response.json());
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.use(express.static(path.join(__dirname)));

app.listen(PORT, () => {
  console.log(`Sin Etiquetas server running on port ${PORT}`);
  console.log(`ANTHROPIC_API_KEY set: ${!!process.env.ANTHROPIC_API_KEY}`);
  console.log(`YOUTUBE_API_KEY set: ${!!process.env.YOUTUBE_API_KEY}`);
});
