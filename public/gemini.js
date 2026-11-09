// Gemini: kullanıcının kendi anahtarıyla, tarayıcıdan doğrudan Google'a.
const BASE = 'https://generativelanguage.googleapis.com/v1beta';
const LS_KEY = 'ds_gemini_key';
const LS_MODEL = 'ds_gemini_model';

export const getKey = () => localStorage.getItem(LS_KEY) || '';
export const setKey = k => (k ? localStorage.setItem(LS_KEY, k) : localStorage.removeItem(LS_KEY));
export const getModel = () => localStorage.getItem(LS_MODEL) || '';
export const setModel = m => (m ? localStorage.setItem(LS_MODEL, m) : localStorage.removeItem(LS_MODEL));

async function call(path, key, opts = {}) {
  const r = await fetch(`${BASE}/${path}`, {
    ...opts,
    headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error?.message || `Gemini hatası (${r.status})`);
  return j;
}

// Anahtarı test et ve en güncel "flash" modelini seç
export async function testKey(key) {
  const j = await call('models?pageSize=200', key);
  const models = (j.models || []).filter(m => (m.supportedGenerationMethods || []).includes('generateContent'));
  if (!models.length) throw new Error('Bu anahtarla kullanılabilir model bulunamadı.');
  return pickModel(models.map(m => m.name));
}

export function pickModel(names) {
  const flash = names
    .map(n => ({ n, m: n.match(/^models\/gemini-(\d+(?:\.\d+)?)-flash(?:-latest)?$/) }))
    .filter(x => x.m)
    .sort((a, b) => parseFloat(b.m[1]) - parseFloat(a.m[1]));
  if (flash.length) return flash[0].n;
  return names.find(n => n === 'models/gemini-flash-latest') || names.find(n => n.startsWith('models/gemini')) || names[0];
}

export async function chat({ key, model, system, history }) {
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: history.map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.text }] })),
    generationConfig: { temperature: 0.9 },
  };
  const j = await call(`${model}:generateContent`, key, { method: 'POST', body: JSON.stringify(body) });
  const parts = j.candidates?.[0]?.content?.parts || [];
  const text = parts.map(p => p.text || '').join('').trim();
  if (!text) throw new Error(j.promptFeedback?.blockReason ? 'Cevap engellendi: ' + j.promptFeedback.blockReason : 'Boş cevap geldi.');
  return text;
}

// Tek seferlik JSON cevap (notlardaki belirsiz satırları sınıflandırmak gibi işler için)
export async function jsonSor({ key, model, prompt, sure = 15000 }) {
  const body = { contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0, responseMimeType: 'application/json' } };
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), sure);
  try {
    const j = await call(`${model}:generateContent`, key, { method: 'POST', body: JSON.stringify(body), signal: ctrl.signal });
    const text = (j.candidates?.[0]?.content?.parts || []).filter(p => !p.thought).map(p => p.text || '').join('');
    return JSON.parse(text.replace(/^```(?:json)?|```$/g, '').trim());
  } finally { clearTimeout(t); }
}
