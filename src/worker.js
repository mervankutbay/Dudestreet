// Dudestreet — Cloudflare Worker
// Sadece iki iş yapar: statik siteyi sunar ve piyasa fiyatlarını/aramayı Yahoo'dan getirir.
// Kullanıcı verisi (kayıtlar, portföy, anahtar) BURADAN GEÇMEZ; hepsi tarayıcıdan doğrudan kullanıcının kendi Google hesabına gider.
//
// Değişkenler (Cloudflare > Workers > dudestreet > Settings > Variables and Secrets):
//   GOOGLE_CLIENT_ID   Google Cloud'daki OAuth "Web application" istemci kimliği (README'ye bak)

const UA = {
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
  accept: 'application/json,text/plain,*/*',
};
const OZ = 31.1034768; // 1 ons = 31,1 gram
// Uygulama sürümü: public/config.js'teki APP_VERSION ile aynı tutulur (telefonda eski sürüm kalırsa "güncelle" uyarısı çıkar)
const SURUM = 'v3';

const json = (obj, status = 200, maxAge = 0) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': maxAge ? `public, max-age=${maxAge}` : 'no-store',
    },
  });

function zamanAsimi(p, ms = 6000) {
  return Promise.race([p, new Promise((_, rj) => setTimeout(() => rj(new Error('zaman aşımı')), ms))]);
}

// Yahoo'ya giden istekleri 2 dakika önbellekte tut (kota ve hız için)
async function onbellekliJson(url, ttl = 120) {
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  const key = new Request(url);
  if (cache) {
    const hit = await cache.match(key);
    if (hit) return hit.json();
  }
  let son;
  for (const host of ['query1', 'query2']) {
    try {
      const u = url.replace('://query1.', `://${host}.`);
      const r = await zamanAsimi(fetch(u, { headers: UA }));
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const body = await r.text();
      if (cache) await cache.put(key, new Response(body, { headers: { 'content-type': 'application/json', 'cache-control': `max-age=${ttl}` } })).catch(() => {});
      return JSON.parse(body);
    } catch (e) { son = e; }
  }
  throw son;
}

// Tek sembolün fiyatı: { fiyat, onceki, para }
async function yahooFiyat(sembol) {
  const j = await onbellekliJson(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sembol)}?range=1d&interval=5m`);
  const res = j?.chart?.result?.[0];
  const m = res?.meta;
  if (!m || !(m.regularMarketPrice > 0)) throw new Error('fiyat yok');
  let fiyat = m.regularMarketPrice, onceki = m.chartPreviousClose || m.previousClose || fiyat, para = m.currency || 'USD';
  if (para === 'GBp' || para === 'GBX') { fiyat /= 100; onceki /= 100; para = 'GBP'; } // Londra borsası peni verir
  if (para === 'ILA') { fiyat /= 100; onceki /= 100; para = 'ILS'; }
  return { fiyat, onceki, para: para.toUpperCase(), ad: m.longName || m.shortName || '' };
}

// Döviz kuru: 1 [kaynak] = ? [hedef]
async function kur(kaynak, hedef) {
  if (kaynak === hedef) return 1;
  const f = await yahooFiyat(`${kaynak}${hedef}=X`);
  return f.fiyat;
}

const KODLAR = { '₺': 'TRY', 'TL': 'TRY', '€': 'EUR', '$': 'USD', '£': 'GBP' };
const paraKodu = p => KODLAR[p] || String(p || 'TRY').toUpperCase().slice(0, 3);

// Varlık türüne göre Yahoo sembolü
function yahooSembol(tur, sembol) {
  const s = String(sembol || '').trim().toUpperCase();
  if (tur === 'Altın (gram)') return 'GC=F';
  if (tur === 'Gümüş (gram)') return 'SI=F';
  if (tur === 'Kripto' && !s.includes('-')) return `${s}-USD`;
  if (tur === 'Döviz') return `${s}USD=X`;
  return s;
}

async function fiyatlar(liste, hedefPara) {
  const hedef = paraKodu(hedefPara);
  const kurlar = {};
  const sonuc = {};
  await Promise.all(liste.map(async ({ tur, sembol }) => {
    const anahtar = `${tur}|${sembol}`;
    try {
      const ys = yahooSembol(tur, sembol);
      let f;
      if (tur === 'Döviz' && String(sembol).toUpperCase() === 'USD') f = { fiyat: 1, onceki: 1, para: 'USD', ad: 'Amerikan doları' };
      else f = await yahooFiyat(ys);
      if (tur === 'Altın (gram)' || tur === 'Gümüş (gram)') { f.fiyat /= OZ; f.onceki /= OZ; }
      kurlar[f.para] ??= kur(f.para, hedef);
      const k = await kurlar[f.para];
      sonuc[anahtar] = { fiyat: f.fiyat * k, onceki: f.onceki * k, yerel: f.fiyat, yerelPara: f.para, ad: f.ad, degisim: f.onceki ? (f.fiyat / f.onceki - 1) * 100 : 0 };
    } catch (e) {
      sonuc[anahtar] = { hata: String(e.message || e).slice(0, 80) };
    }
  }));
  return { para: hedef, fiyatlar: sonuc, zaman: new Date().toISOString() };
}

async function ara(q) {
  const j = await onbellekliJson(`https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=10&newsCount=0&listsCount=0`, 3600);
  const TUR = { EQUITY: 'Hisse', ETF: 'Fon / ETF', MUTUALFUND: 'Fon / ETF', CRYPTOCURRENCY: 'Kripto', INDEX: 'Endeks', CURRENCY: 'Döviz', FUTURE: 'Emtia' };
  return (j.quotes || [])
    .filter(x => x.symbol && TUR[x.quoteType])
    .map(x => ({ sembol: x.symbol, ad: x.longname || x.shortname || x.symbol, tur: TUR[x.quoteType], borsa: x.exchDisp || x.exchange || '' }))
    .map(x => (x.tur === 'Endeks' || x.tur === 'Emtia' || x.tur === 'Döviz' ? { ...x, tur: 'Hisse' } : x));
}

// ---------- MBKAYO bireysel bakiye ----------
// MBKAYO fonunun yayınlanmış "Canlı Bakiye" tablosundan varlıkları (isim, adet) ve nakdi okur, fiyatları canlı çeker, toplamı 6'ya böler.
const MBKAYO_CSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTDOcXpS6WsMaXzqXVB030Nd-T7atxODPiP_8kxjEhMCndS_en6qgsEt5vKk44koRN9agtfaoDa7eDY/pub?gid=512531579&single=true&output=csv';
const MBKAYO_KISI = 6;
const KRIPTO = new Set(['BTC', 'ETH', 'XRP', 'SOL', 'DOGE', 'SUI', 'AVAX', 'ADA', 'DOT', 'LINK', 'XLM', 'TRX', 'BNB', 'LTC', 'SHIB', 'PEPE', 'TON', 'NEAR', 'APT', 'ARB', 'OP', 'ATOM', 'HBAR', 'RENDER', 'INJ', 'FET']);
const YAHOO_OZEL = { SUI: 'SUI20947-USD', PEPE: 'PEPE24478-USD', TON: 'TON11419-USD', APT: 'APT21794-USD', ARB: 'ARB11841-USD', RENDER: 'RENDER-USD' };
function csvSatirlar(t) {
  const out = []; let satir = [], hucre = '', tirnak = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (tirnak) { if (c === '"') { if (t[i + 1] === '"') { hucre += '"'; i++; } else tirnak = false; } else hucre += c; }
    else if (c === '"') tirnak = true;
    else if (c === ',') { satir.push(hucre); hucre = ''; }
    else if (c === '\n') { satir.push(hucre.replace(/\r$/, '')); out.push(satir); satir = []; hucre = ''; }
    else hucre += c;
  }
  if (hucre || satir.length) { satir.push(hucre); out.push(satir); }
  return out;
}
const trSayi = v => {
  const s = String(v || '').replace(/[₺$\s%]/g, '').trim(); if (!s || !/\d/.test(s)) return null;
  let n = s;
  if (s.includes(',')) n = s.replace(/\./g, '').replace(',', '.');
  else if (/^-?[1-9]\d{0,2}(\.\d{3})+$/.test(s)) n = s.replace(/\./g, '');
  const x = Number(n); return Number.isFinite(x) ? x : null;
};
async function mbkayo(para) {
  const cache = typeof caches !== 'undefined' ? caches.default : null, key = new Request('https://dudestreet.cache/mbkayo-csv');
  let metin = null;
  if (cache) { const h = await cache.match(key); if (h) metin = await h.text(); }
  if (!metin) {
    const r = await zamanAsimi(fetch(MBKAYO_CSV + '&t=' + Date.now(), { headers: UA }), 8000);
    if (!r.ok) throw new Error('MBKAYO tablosu okunamadı (HTTP ' + r.status + ')');
    metin = await r.text();
    if (cache) await cache.put(key, new Response(metin, { headers: { 'cache-control': 'max-age=60' } })).catch(() => {});
  }
  const satirlar = csvSatirlar(metin);
  const bas = satirlar.findIndex(r => String(r[1]).trim() === 'İsim' && /adet/i.test(r[2] || ''));
  if (bas < 0) throw new Error('MBKAYO tablosunun yapısı değişmiş');
  const kalemler = []; let nakit = 0, tabloToplam = null;
  for (let i = bas + 1; i < satirlar.length; i++) {
    const r = satirlar[i], ad = String(r[1] || '').trim();
    if (/^NAK[İI]T$/i.test(ad)) { nakit = trSayi(r[6]) ?? trSayi(r[5]) ?? 0; break; }
    const adet = trSayi(r[2]);
    if (!ad || adet === null || !(adet > 0)) continue;
    kalemler.push({ ad, adet, tabloFiyat: trSayi(r[3]), tabloDeger: trSayi(r[6]) });
  }
  const tb = satirlar.findIndex(r => r.some(h => /^Toplam Bakiye$/i.test(String(h).trim())));
  if (tb >= 0 && satirlar[tb + 1]) tabloToplam = trSayi(satirlar[tb + 1][3]);
  // Canlı fiyatlar (TL)
  const usdtry = await kur('USD', 'TRY').catch(() => null);
  await Promise.all(kalemler.map(async k => {
    const taban = k.ad.toUpperCase().replace(/\d+$/, '');
    const sembol = KRIPTO.has(taban) ? (YAHOO_OZEL[taban] || `${taban}-USD`) : `${taban}.IS`;
    try {
      const f = await yahooFiyat(sembol);
      const carpan = f.para === 'TRY' ? 1 : f.para === 'USD' && usdtry ? usdtry : await kur(f.para, 'TRY');
      k.fiyat = f.fiyat * carpan; k.canli = true;
    } catch (e) { k.fiyat = k.tabloFiyat ?? (k.tabloDeger && k.adet ? k.tabloDeger / k.adet : 0); k.canli = false; }
    k.deger = k.adet * k.fiyat;
  }));
  const toplamTL = kalemler.reduce((s, k) => s + k.deger, 0) + nakit;
  const hedef = paraKodu(para), carp = hedef === 'TRY' ? 1 : 1 / await kur(hedef, 'TRY');
  return { para: hedef, toplam: toplamTL * carp, kisiBasi: toplamTL * carp / MBKAYO_KISI, kisi: MBKAYO_KISI, nakit: nakit * carp, tabloToplam: tabloToplam !== null ? tabloToplam * carp : null, kalemler: kalemler.map(k => ({ ad: k.ad, adet: k.adet, deger: k.deger * carp, canli: k.canli })), zaman: new Date().toISOString() };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const p = url.pathname;
    try {
      if (p === '/api/ayar') {
        return json({ googleClientId: String(env.GOOGLE_CLIENT_ID || '').trim(), surum: SURUM });
      }
      if (p === '/api/fiyatlar' && request.method === 'POST') {
        const b = await request.json().catch(() => ({}));
        const liste = (Array.isArray(b.liste) ? b.liste : []).slice(0, 60)
          .map(x => ({ tur: String(x.tur || 'Hisse').slice(0, 20), sembol: String(x.sembol || '').slice(0, 24) }))
          .filter(x => x.sembol || x.tur.includes('gram'));
        return json(await fiyatlar(liste, b.para || 'TRY'));
      }
      if (p === '/api/mbkayo') {
        try { return json(await mbkayo(url.searchParams.get('para') || 'TRY')); }
        catch (e) { return json({ hata: String(e.message || e).slice(0, 120) }, 200); }
      }
      if (p === '/api/ara') {
        const q = (url.searchParams.get('q') || '').trim().slice(0, 40);
        if (q.length < 2) return json({ sonuclar: [] });
        return json({ sonuclar: await ara(q) }, 200, 3600);
      }
      if (p.startsWith('/api/')) return json({ hata: 'Bulunamadı' }, 404);
    } catch (e) {
      return json({ hata: 'Fiyat servisine ulaşılamadı: ' + String(e.message || e).slice(0, 120) }, 502);
    }
    return env.ASSETS.fetch(request);
  },
};
