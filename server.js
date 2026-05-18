const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// API route FIRST
app.post('/api/chat', async (req, res) => {
  const { system, messages } = req.body;
  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

  console.log('Chat request received, messages:', messages?.length);

  if (!ANTHROPIC_KEY) {
    console.error('ANTHROPIC_API_KEY not set');
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        system,
        messages
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Anthropic API error:', response.status, errText);
      return res.status(response.status).json({ error: errText });
    }

    const data = await response.json();
    console.log('Response OK, stop_reason:', data.stop_reason);
    res.json(data);
  } catch (error) {
    console.error('Fetch error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Explicit routes for legal pages
app.get('/privacidad.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'privacidad.html'));
});

app.get('/terminos.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'terminos.html'));
});

// Static files
app.use(express.static(path.join(__dirname)));

// Catch-all — SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Sin Etiquetas server running on port ${PORT}`);
  console.log(`ANTHROPIC_API_KEY set: ${!!process.env.ANTHROPIC_API_KEY}`);
  console.log(`YOUTUBE_API_KEY set: ${!!process.env.YOUTUBE_API_KEY}`);
});
