// Gemini: kullanıcının kendi anahtarıyla, tarayıcıdan doğrudan Google'a.
// Model sırası Nébula'daki gibi: günün ilk 20 sohbet mesajı gemini-3.6-flash, sonrası daha hafif model (kota bitmesin);
// bir model takılır/hata verirse sıradakine geçilir. Hafıza ve notları sınıflandırma gibi arka plan işleri flash-lite ile.
const BASE = 'https://generativelanguage.googleapis.com/v1beta';
const LS_KEY = 'ds_gemini_key', LS_MODEL = 'ds_gemini_model', LS_LISTE = 'ds_gemini_modeller', LS_SAYAC = 'ds_gemini_sayac';
export const GUNLUK_ANA = 20;
const ANA_SIRA = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-2.5-flash'];
const HAFIF_SIRA = ['gemini-3.5-flash-lite', 'gemini-2.5-flash-lite', 'gemini-3.5-flash', 'gemini-2.5-flash'];

export const getKey = () => localStorage.getItem(LS_KEY) || '';
export const setKey = k => (k ? localStorage.setItem(LS_KEY, k) : localStorage.removeItem(LS_KEY));
export const getModel = () => localStorage.getItem(LS_MODEL) || '';
export const setModel = m => (m ? localStorage.setItem(LS_MODEL, m) : localStorage.removeItem(LS_MODEL));
const liste = () => { try { return JSON.parse(localStorage.getItem(LS_LISTE) || '[]'); } catch { return []; } };

async function call(path, key, opts = {}) {
  const r = await fetch(`${BASE}/${path}`, { ...opts, headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json', ...(opts.headers || {}) } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.error?.message || `Gemini hatası (${r.status})`); e.status = r.status; throw e; }
  return j;
}

// Anahtarı test et; erişilebilen modelleri kaydet
export async function testKey(key) {
  const j = await call('models?pageSize=200', key);
  const ad = (j.models || []).filter(m => (m.supportedGenerationMethods || []).includes('generateContent')).map(m => m.name.replace('models/', ''));
  if (!ad.length) throw new Error('Bu anahtarla kullanılabilir model bulunamadı.');
  localStorage.setItem(LS_LISTE, JSON.stringify(ad));
  return 'models/' + anaModeller(ad)[0];
}
const surum = n => parseFloat((String(n).match(/gemini-(\d+(?:\.\d+)?)/) || [])[1] || '0');
function anaModeller(ad = liste()) {
  const flash = ad.filter(n => /^gemini-[\d.]+-flash$/.test(n)).sort((a, b) => surum(b) - surum(a));
  const sira = [...ANA_SIRA.filter(m => !ad.length || ad.includes(m)), ...flash];
  return [...new Set(sira.length ? sira : ANA_SIRA)];
}
function hafifModeller(ad = liste()) {
  const lite = ad.filter(n => /^gemini-[\d.]+-flash-lite$/.test(n)).sort((a, b) => surum(b) - surum(a));
  return [...new Set([...HAFIF_SIRA.filter(m => !ad.length || ad.includes(m)), ...lite, ...anaModeller(ad)])];
}
// Bugün kaç sohbet mesajı gönderildi
export function sayac() { const b = new Date().toDateString(); try { const s = JSON.parse(localStorage.getItem(LS_SAYAC) || '{}'); return s.gun === b ? s.n : 0; } catch { return 0; } }
const sayacArtir = () => localStorage.setItem(LS_SAYAC, JSON.stringify({ gun: new Date().toDateString(), n: sayac() + 1 }));

// Düşünme ayarı: Gemini 3+ "thinkingLevel", 2.5 "thinkingBudget"; model bir seviyeyi reddederse sonrakine geçilir
const gen3 = m => surum(m) >= 3;
const dusunme = m => gen3(m) ? [{ thinkingLevel: 'minimal' }, { thinkingLevel: 'low' }, null] : [{ thinkingBudget: 0 }, null];
const kotu = new Set();

// Sırayla modelleri dener. tur: 'sohbet' (günün ilk 20 mesajı ana model) | 'hafif'
export async function uret({ system, contents, tur = 'sohbet', arama = false, json = false, sicaklik = 0.85, sure = 30000 }) {
  const key = getKey(); if (!key) throw new Error('Gemini anahtarı bağlı değil');
  let sira = tur === 'hafif' ? hafifModeller() : sayac() < GUNLUK_ANA ? anaModeller() : [...hafifModeller().filter(m => /lite/.test(m)), ...anaModeller()];
  sira = [...sira.filter(m => !kotu.has(m)), ...sira.filter(m => kotu.has(m))];
  let son = null, aramaAcik = arama;
  for (const m of sira) {
    const adimlar = dusunme(m);
    for (let i = 0; i < adimlar.length; i++) {
      const body = { contents, generationConfig: { temperature: sicaklik, maxOutputTokens: json ? 1500 : 2048 } };
      if (system) body.systemInstruction = { parts: [{ text: system }] };
      if (adimlar[i]) body.generationConfig.thinkingConfig = adimlar[i];
      if (json) body.generationConfig.responseMimeType = 'application/json';
      if (aramaAcik) body.tools = [{ google_search: {} }];
      const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), sure);
      try {
        const j = await call(`models/${m}:generateContent`, key, { method: 'POST', body: JSON.stringify(body), signal: ctrl.signal });
        clearTimeout(t);
        const parts = j.candidates?.[0]?.content?.parts || [];
        const text = parts.filter(p => !p.thought).map(p => p.text || '').join('').trim();
        if (!text) { son = new Error(j.promptFeedback?.blockReason ? 'Cevap engellendi: ' + j.promptFeedback.blockReason : 'Boş cevap geldi'); break; }
        if (tur === 'sohbet') { sayacArtir(); setModel('models/' + m); }
        const gm = j.candidates?.[0]?.groundingMetadata || {};
        const kaynaklar = (gm.groundingChunks || []).map(c => c.web).filter(w => w && w.uri).map(w => ({ baslik: String(w.title || w.uri).slice(0, 80), url: w.uri })).slice(0, 4);
        return { text, model: m, kaynaklar };
      } catch (e) {
        clearTimeout(t); son = e;
        const msg = String(e.message || '');
        if (e.name === 'AbortError') { son = new Error(`${m} zamanında cevap vermedi`); kotu.add(m); break; }
        if (/thinking/i.test(msg)) continue;
        if (aramaAcik && (e.status === 429 || /search|grounding|tool/i.test(msg))) { aramaAcik = false; i--; continue; }
        if (e.status === 400 && !/model|not found|available|support/i.test(msg)) throw e;
        if (e.status === 401 || e.status === 403) throw new Error('Gemini anahtarı geçersiz ya da yetkisiz');
        kotu.add(m); break;
      }
    }
  }
  if (son && /quota|exhausted|429/i.test(son.message)) throw new Error('Gemini günlük kotan doldu; biraz sonra tekrar dene.');
  throw son || new Error('Gemini cevap vermedi');
}

export async function chat({ system, history, arama = false, tur = 'sohbet' }) {
  const contents = history.map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: String(m.text).slice(0, 4000) }] }));
  return (await uret({ system, contents, arama, tur })).text;
}
export async function sohbet({ system, history }) {
  const contents = history.map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: String(m.text).slice(0, 4000) }] }));
  return uret({ system, contents, arama: true, tur: 'sohbet' });
}
// Tek seferlik JSON cevap (hafif model)
export async function jsonSor({ prompt, sure = 20000 }) {
  const r = await uret({ contents: [{ role: 'user', parts: [{ text: prompt }] }], tur: 'hafif', json: true, sicaklik: 0.1, sure });
  return JSON.parse(r.text.replace(/^```(?:json)?|```$/g, '').trim());
}
