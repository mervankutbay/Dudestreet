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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const p = url.pathname;
    try {
      if (p === '/api/ayar') {
        return json({ googleClientId: String(env.GOOGLE_CLIENT_ID || '').trim(), surum: 'v1' });
      }
      if (p === '/api/fiyatlar' && request.method === 'POST') {
        const b = await request.json().catch(() => ({}));
        const liste = (Array.isArray(b.liste) ? b.liste : []).slice(0, 60)
          .map(x => ({ tur: String(x.tur || 'Hisse').slice(0, 20), sembol: String(x.sembol || '').slice(0, 24) }))
          .filter(x => x.sembol || x.tur.includes('gram'));
        return json(await fiyatlar(liste, b.para || 'TRY'));
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
