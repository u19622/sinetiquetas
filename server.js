const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1); // Railway pone un proxy delante: así req.ip es la IP real del visitante
app.use(express.json({ limit: '20kb' }));

// Instrucción de sistema del chat: vive solo en el servidor, el navegador no puede cambiarla
const SYSTEM_PROMPT = `Eres el asistente oficial de Sin Etiquetas, un podcast de salud emocional conducido por Auria Oblitas desde Lima, Perú. Tu rol es ayudar a los visitantes del sitio web de manera cálida, cercana y profesional.

SOBRE SIN ETIQUETAS:
- Podcast de historias de vida auténticas, poderosas y llenas de emoción
- Conductora: Auria Oblitas — Economista y "Financiera con corazón"
- 149+ episodios publicados
- Disponible en: YouTube (@SinEtiquetas-j6f), Spotify, Instagram (@sinetiquetas.oficial), TikTok (@sin.etiquetas.oficial), Facebook, LinkedIn
- Contacto: contacto@sinetiquetas.org.pe
- Los 4 pilares: Vulnerabilidad, Humanidad real, Transformación, Sin filtros

SOBRE FITNESS EMOCIONAL:
- Es la metodología y visión que inspira y da propósito a Sin Etiquetas
- Propósito: reducir el sufrimiento emocional evitable en el Perú
- Sin Etiquetas es la primera expresión pública de esta visión — a través de historias reales que generan conciencia emocional
- IMPORTANTE: No menciones ejes, programas, asociación civil, metodología detallada, ni ningún servicio específico de Fitness Emocional. Esa información no está disponible al público todavía.

COLABORACIÓN Y PATROCINIO:
- Sponsor de episodio: mención integrada al inicio/final del episodio
- Segmento patrocinado: bloque dentro del episodio
- Colaboración de contenido: co-creación de episodios especiales
- Participación como invitado: personas con historia real que quieran compartirla
- Contacto para colaboraciones: contacto@sinetiquetas.org.pe

INSTRUCCIONES:
- Responde siempre en español
- Sé cálido, empático y cercano — refleja los valores del podcast
- Respuestas concisas (máximo 3-4 párrafos)
- Si alguien quiere colaborar, pídeles nombre, empresa/proyecto y tipo de colaboración, luego indícales que escriban a contacto@sinetiquetas.org.pe
- Si preguntan por Fitness Emocional, explica el propósito general sin entrar en detalles de programas, ejes ni metodología
- No inventes información que no esté en este contexto
- Nunca menciones: 8R, Asociación Civil, Eje 2, Eje 3, programas de formación, contención, ni liderazgo humanista`;

// Límites del chat
const MAX_MENSAJES = 9;        // historial que se envía al modelo (últimos 9)
const MAX_CARACTERES = 1000;   // largo máximo de cada mensaje
const LIMITE_PETICIONES = 20;  // peticiones por visitante...
const VENTANA_MS = 10 * 60 * 1000; // ...cada 10 minutos
const peticiones = new Map();  // ip -> [marcas de tiempo]

function excedeLimite(ip) {
  const ahora = Date.now();
  const recientes = (peticiones.get(ip) || []).filter(t => ahora - t < VENTANA_MS);
  recientes.push(ahora);
  peticiones.set(ip, recientes);
  return recientes.length > LIMITE_PETICIONES;
}
setInterval(() => { // limpieza para que el mapa no crezca sin fin
  const ahora = Date.now();
  for (const [ip, ts] of peticiones) if (ts.every(t => ahora - t >= VENTANA_MS)) peticiones.delete(ip);
}, VENTANA_MS).unref();

function mensajesValidos(messages) {
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 40) return null;
  const ok = messages.every(m => m && (m.role === 'user' || m.role === 'assistant')
    && typeof m.content === 'string' && m.content.length > 0 && m.content.length <= MAX_CARACTERES);
  if (!ok) return null;
  let recortados = messages.slice(-MAX_MENSAJES).map(m => ({ role: m.role, content: m.content }));
  while (recortados.length && recortados[0].role !== 'user') recortados.shift();
  if (!recortados.length || recortados[recortados.length - 1].role !== 'user') return null;
  return recortados;
}

app.post('/api/chat', async (req, res) => {
  if (excedeLimite(req.ip)) return res.status(429).json({ error: 'Demasiadas peticiones' });
  const messages = mensajesValidos(req.body && req.body.messages);
  if (!messages) return res.status(400).json({ error: 'Mensaje no válido' });
  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) return res.status(500).json({ error: 'API key not configured' });
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 600, system: SYSTEM_PROMPT, messages })
    });
    if (!response.ok) { const e = await response.text(); return res.status(response.status).json({ error: e }); }
    res.json(await response.json());
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/privacidad.html', (req, res) => res.sendFile(path.join(__dirname, 'privacidad.html')));
app.get('/terminos.html', (req, res) => res.sendFile(path.join(__dirname, 'terminos.html')));
// Archivos internos del proyecto: no se sirven al público
const PRIVADOS = ['/server.js', '/package.json', '/package-lock.json', '/railway.json', '/Procfile', '/README.md', '/.gitattributes', '/.gitignore'];
app.use((req, res, next) => PRIVADOS.includes(req.path) ? res.status(404).sendFile(path.join(__dirname, '404.html')) : next());

app.use(express.static(path.join(__dirname)));

// Cualquier ruta que no existe responde 404 real (antes devolvía la portada con 200)
app.use((req, res) => res.status(404).sendFile(path.join(__dirname, '404.html')));

app.listen(PORT, () => {
  console.log('Sin Etiquetas server running on port ' + PORT);
  console.log('ANTHROPIC_API_KEY set: ' + !!process.env.ANTHROPIC_API_KEY);
  console.log('YOUTUBE_API_KEY set: ' + !!process.env.YOUTUBE_API_KEY);
});
