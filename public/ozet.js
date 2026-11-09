// Dudestreet — Özet: toplam mal varlığı, dağılım, "Bugün" satırından açılan bakiye grafiği (Nébula'daki gibi, "Yatırım hariç" anahtarlı)
import { S, $, $$, esc, num, money, fmt, today, buAy, ymAdi, ikon, lsGet, lsSet, kisaPara, tarihFmt, gunFark } from './core.js';
import { malVarligi, hedefHesap, ayHesap, borclar, GRUP_RENK } from './hesap.js';
import { bekleyenToplam } from './plan.js';

const ic = (k, s = 18) => ikon(k, 'currentColor', s);
const GRUP_IK = { 'Nakit': '💰', 'Yatırım': '📈', 'Gayrimenkul': '🏠', 'Araç': '🚗', 'Diğer': '📦' };

// ---------- Günlük kayıt: uygulama her açıldığında bugünün satırı Geçmiş sekmesine yazılır/güncellenir ----------
let sonYazim = 0, yaziyor = false;
export async function gecmisYaz() {
  if (!S.db || yaziyor || Date.now() - sonYazim < 10 * 60e3) return;
  const canliVar = S.portfoy.some(p => !['Nakit / Banka', 'Ev / Daire', 'Arsa / Tarla', 'Araba', 'Diğer'].includes(p['Tür']));
  if (canliVar && !S.fiyat.zaman) return;   // fiyatlar gelmeden yazma (eksik değer kaydolmasın)
  yaziyor = true;
  try {
    const m = malVarligi(), satir = { Tarih: today(), Nakit: String(Math.round(m.nakit)), 'Varlık': String(Math.round(m.varlik)), 'Borç': String(Math.round(m.borc)), Toplam: String(Math.round(m.net)) };
    const g = await S.db.table('Geçmiş'), bugun = g.find(r => String(r['Tarih']).slice(0, 10) === today());
    if (bugun) { const { _row } = bugun; await S.db.writeObj('Geçmiş', _row, satir); }
    else await S.db.appendObj('Geçmiş', satir);
    S.gecmis = await S.db.table('Geçmiş');
    sonYazim = Date.now();
  } catch (e) { console.warn('geçmiş yazılamadı', e); }
  yaziyor = false;
}

// ---------- Grafik verisi ----------
const gunTs = iso => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d); };
const ARALIK = [['7G', 7], ['1A', 31], ['3A', 92], ['6A', 183], ['1Y', 366], ['Tümü', 0]];
const bgAralik = () => lsGet('ds_bgAralik', '1A');
const bgHaric = () => lsGet('ds_bgHaric', false);
// Portföye giren/çıkan para (alım, satış, nakitsiz ekleme/çıkarma): "yatırım hariç" çizgide bu akışlar düşülür, sadece değer değişimi kalır
function akisFn() {
  const ol = S.kayitlar.map(r => [String(r['Tarih'] || '').slice(0, 10), ({ 'Varlık alımı': 1, 'Varlık girişi': 1, 'Varlık satışı': -1, 'Varlık çıkışı': -1 }[r['Tür']] || 0) * num(r['Tutar'])]).filter(o => o[1] && /^\d{4}-\d{2}-\d{2}$/.test(o[0]));
  return (once, son) => ol.reduce((t, o) => o[0] > once && o[0] <= son ? t + o[1] : t, 0);
}
function seri(sec) {
  const m = malVarligi(), akis = akisFn();
  const gun = {};
  S.gecmis.forEach(g => { const t = String(g['Tarih'] || '').slice(0, 10); if (/^\d{4}-\d{2}-\d{2}$/.test(t)) gun[t] = { tarih: t, varlik: num(g['Varlık']), toplam: num(g['Toplam']) }; });
  gun[today()] = { tarih: today(), varlik: m.varlik, toplam: m.net, canli: true };
  let tum = Object.values(gun).sort((a, b) => a.tarih < b.tarih ? -1 : 1).map(p => ({ ...p, t: gunTs(p.tarih) }));
  const g = (ARALIK.find(r => r[0] === sec) || [])[1];
  if (g) {
    const sinir = gunTs(today()) - (g - 1) * 864e5, icx = tum.filter(p => p.t >= sinir), once = tum.filter(p => p.t < sinir).pop();
    tum = once && icx.length ? [{ ...once, t: sinir, kenar: true }, ...icx] : icx;
  }
  let onceki = null, duz = 0;
  return tum.map(p => { duz = !onceki ? 0 : p.canli && onceki.tarih === today() ? duz : duz + (p.varlik - onceki.varlik - akis(onceki.tarih, p.tarih)); onceki = p; return { ...p, duz }; });
}
const adim = v => { const e = Math.pow(10, Math.floor(Math.log10(v || 1))); return [1, 2, 2.5, 5, 10].map(k => k * e).find(k => k >= v) || 10 * e; };

function grafikHTML(sec) {
  const s = seri(sec), haric = bgHaric(), V = p => haric ? p.duz : p.toplam;
  const butonlar = `<div class="seg kucuk-seg">${ARALIK.map(([k]) => `<button type="button" data-bgar="${k}" class="${k === sec ? 'on' : ''}">${k}</button>`).join('')}</div>`;
  const dugme = `<button type="button" class="bg-haric ${haric ? 'on' : ''}" id="bgHaric" aria-pressed="${haric}"><i></i><span>Yatırım hariç<small>${haric ? 'sadece varlıkların değer değişimi (para giriş-çıkışı düşülür)' : 'toplam mal varlığı'}</small></span></button>`;
  const gercek = s.filter(p => !p.kenar);
  if (gercek.length < 2) return `${butonlar}${dugme}<div class="mini ortala" style="padding:18px 0">Grafik her gün bir nokta ekleyerek büyüyecek; yarın ilk çizgiyi görürsün 📈</div>`;
  const W = 340, H = 196, L = 46, R = 12, T = 26, B = 22;
  const vals = s.map(V); let mx = Math.max(...vals), mn = Math.min(...vals);
  const yuksek = gercek.reduce((b, p) => V(p) > V(b) ? p : b, gercek[0]), dusuk = gercek.reduce((b, p) => V(p) < V(b) ? p : b, gercek[0]);
  const pay = (mx - mn) * 0.18 || Math.abs(mx) * 0.02 || 1;
  let ust = mx + pay, alt = haric ? mn - pay : Math.max(0, mn - pay);
  const a = adim((ust - alt) / 3); ust = Math.ceil(ust / a) * a; alt = Math.floor(alt / a) * a; if (ust === alt) ust = alt + a;
  const t0 = s[0].t, t1 = s[s.length - 1].t;
  const x = t => L + (W - L - R) * (t1 === t0 ? 0.5 : (t - t0) / (t1 - t0)), y = v => T + (H - T - B) * (1 - (v - alt) / (ust - alt));
  const cizgi = s.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)} ${y(V(p)).toFixed(1)}`).join(' ');
  const alan = `${cizgi} L${x(t1).toFixed(1)} ${H - B} L${x(t0).toFixed(1)} ${H - B} Z`;
  const grid = []; for (let v = alt; v <= ust + 1e-6; v += a) grid.push(`<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text class="eksen" x="${L - 6}" y="${(y(v) + 3).toFixed(1)}" text-anchor="end">${esc(kisaPara(v))}</text>`);
  const gs = (t1 - t0) / 864e5, et = t => new Date(t).toLocaleDateString('tr-TR', gs > 150 ? { month: 'short', year: '2-digit', timeZone: 'UTC' } : { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const xEt = [0, 1, 2, 3].map(i => { const t = t0 + (t1 - t0) * i / 3; return `<text class="eksen" x="${x(t).toFixed(1)}" y="${H - 6}" text-anchor="${i === 0 ? 'start' : i === 3 ? 'end' : 'middle'}">${esc(et(t))}</text>`; }).join('');
  const isaret = (p, sinif, yukari) => { const cx = x(p.t), cy = y(V(p)), anchor = cx < W * 0.28 ? 'start' : cx > W * 0.72 ? 'end' : 'middle'; return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="4.5" class="${sinif}-nokta"/><text class="bg-etiket ${sinif}" x="${cx.toFixed(1)}" y="${(yukari ? cy - 10 : cy + 17).toFixed(1)}" text-anchor="${anchor}">${esc(kisaPara(V(p)))}</text>`; };
  const ilk = gercek[0], son = gercek[gercek.length - 1], fark = V(son) - V(ilk), oran = V(ilk) ? fark / Math.abs(V(ilk)) * 100 : 0;
  const tarihUz = p => p.canli ? 'Bugün' : new Date(p.t).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', timeZone: 'UTC' });
  grafikHTML.olcek = { x, y, noktalar: gercek, V, ilk };
  return `<div class="bg-fark ${fark >= 0 ? 'artı' : 'eksi'}">${fark >= 0 ? '+' : '−'}${money(Math.abs(fark), 0)}${haric ? '' : ` · ${fark >= 0 ? '▲' : '▼'} %${fmt(Math.abs(oran), 1)}`} <span class="mini">· ${esc(sec === 'Tümü' ? 'tüm zamanlar' : sec)}</span></div>
    ${butonlar}${dugme}
    <svg class="bg-svg" id="bgSvg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Mal varlığı grafiği">
      <defs><linearGradient id="bgDolgu" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" class="dolgu-ust"/><stop offset="100%" class="dolgu-alt"/></linearGradient></defs>
      ${grid.join('')}<path d="${alan}" fill="url(#bgDolgu)"/><path d="${cizgi}" fill="none" class="bg-cizgi" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${x(son.t).toFixed(1)}" cy="${y(V(son)).toFixed(1)}" r="4" class="son-nokta"/>${V(yuksek) === V(dusuk) ? '' : isaret(yuksek, 'artı', true) + isaret(dusuk, 'eksi', false)}
      ${xEt}<line class="imlec" id="bgImlec" x1="0" x2="0" y1="${T}" y2="${H - B}" style="display:none"/><g id="bgNokta"></g>
      <rect id="bgAlan" x="${L - 6}" y="0" width="${W - L - R + 12}" height="${H}" fill="transparent"/>
    </svg>
    <div class="bg-ipucu" id="bgIpucu">${ipucu(son)}</div>
    <div class="uclu kucuk-uclu">
      <div><span class="mini artı">▲ En yüksek</span><b>${money(V(yuksek), 0)}</b><span class="mini">${esc(tarihUz(yuksek))}</span></div>
      <div><span class="mini eksi">▼ En düşük</span><b>${money(V(dusuk), 0)}</b><span class="mini">${esc(tarihUz(dusuk))}</span></div>
      <div><span class="mini">Aralık farkı</span><b>${money(V(yuksek) - V(dusuk), 0)}</b><span class="mini">yüksek − düşük</span></div>
    </div>`;
}
function ipucu(p) {
  const o = grafikHTML.olcek || {}, V = o.V || (q => q.toplam), ilk = o.ilk, haric = bgHaric();
  const t = p.canli ? 'Bugün' : new Date(p.t).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  const f = ilk ? V(p) - V(ilk) : 0;
  return `<b>${esc(t)}</b> · ${haric ? 'değer değişimi' : 'mal varlığı'} <b>${money(V(p), 0)}</b>${ilk && p !== ilk ? ` · aralık başına göre <b class="${f >= 0 ? 'artı' : 'eksi'}">${f >= 0 ? '+' : '−'}${money(Math.abs(f), 0)}</b>` : ''}${haric ? ` · toplam <b>${money(p.toplam, 0)}</b>` : ''}`;
}
function grafikBagla() {
  const kok = $('#bgIc'); if (!kok) return;
  const yeniden = () => { kok.innerHTML = grafikHTML(bgAralik()); grafikBagla(); };
  $('#bgHaric', kok)?.addEventListener('click', () => { lsSet('ds_bgHaric', !bgHaric()); yeniden(); });
  $$('[data-bgar]', kok).forEach(b => b.onclick = () => { lsSet('ds_bgAralik', b.dataset.bgar); yeniden(); });
  const svg = $('#bgSvg', kok), alan = $('#bgAlan', kok), o = grafikHTML.olcek;
  if (!svg || !alan || !o) return;
  const { x, y, noktalar, V } = o, vb = svg.viewBox.baseVal;
  const sec = e => {
    const r = svg.getBoundingClientRect(), vx = (e.clientX - r.left) / r.width * vb.width;
    const p = noktalar.reduce((b, q) => Math.abs(x(q.t) - vx) < Math.abs(x(b.t) - vx) ? q : b, noktalar[0]), cx = x(p.t).toFixed(1), im = $('#bgImlec', kok);
    im.setAttribute('x1', cx); im.setAttribute('x2', cx); im.style.display = '';
    $('#bgIpucu', kok).innerHTML = ipucu(p);
    $('#bgNokta', kok).innerHTML = `<circle cx="${cx}" cy="${y(V(p)).toFixed(1)}" r="5" class="son-nokta"/>`;
  };
  const bitir = () => { $('#bgImlec', kok).style.display = 'none'; $('#bgNokta', kok).innerHTML = ''; $('#bgIpucu', kok).innerHTML = ipucu(noktalar[noktalar.length - 1]); };
  alan.addEventListener('pointerdown', sec); alan.addEventListener('pointermove', sec); alan.addEventListener('pointerleave', bitir); alan.addEventListener('pointercancel', bitir);
}

// ---------- Özet sayfası ----------
export function renderOzet() {
  const m = malVarligi(), h = hedefHesap(), ym = buAy(), ay = ayHesap(ym), bek = bekleyenToplam(ym, ay.temel);
  const ad = (() => { try { const l = JSON.parse(S.persona.karakterler || '[]'); return (l.find(k => k.id === S.persona.aktif) || l[0])?.cevaplar?.ad || S.persona.cevapObj?.ad || ''; } catch { return ''; } })();
  const saat = new Date().getHours(), selam = saat < 6 ? 'İyi geceler' : saat < 12 ? 'Günaydın' : saat < 18 ? 'İyi günler' : 'İyi akşamlar';
  const gruplar = Object.entries(m.gruplar).filter(([, v]) => v > 0.5).sort((a, b) => b[1] - a[1]);
  const yakin = borclar().filter(x => x.borc > 0 && x.kalanGun !== null && x.kalanGun <= 7).sort((a, b) => a.kalanGun - b.kalanGun);
  const acik = !!S.bgAcik;
  const dun = S.gecmis.map(g => ({ t: String(g['Tarih']).slice(0, 10), v: num(g['Toplam']) })).filter(g => g.t < today()).sort((a, b) => a.t < b.t ? -1 : 1).pop();
  $('#app').innerHTML = `
    <div class="kart ana-kart">
      <div class="selam">${selam}${ad ? `, ${esc(ad)}` : ''} 👋</div>
      <span class="ust-etiket">Toplam mal varlığı</span>
      <div class="dev-rakam">${money(m.net)}</div>
      <div class="satir mini"><span>Varlıklar ${money(m.brut)}</span>${m.borc ? `<span>· Borçlar <b class="eksi">−${money(m.borc)}</b></span>` : ''}</div>
      <button type="button" class="bugun-satir ${acik ? 'acik' : ''}" id="bugun" aria-expanded="${acik}">
        <span>Bugün</span>
        <b class="${m.gunluk >= 0 ? 'artı' : 'eksi'}">${m.gunluk >= 0 ? '+' : '−'}${money(Math.abs(m.gunluk))}</b>
        ${dun ? `<span class="mini bosluk">· düne göre ${m.net - dun.v >= 0 ? '+' : '−'}${money(Math.abs(m.net - dun.v), 0)}</span>` : ''}
        ${dun ? '' : '<span class="bosluk"></span>'}<span class="ok-ikon">${ic('asagi', 16)}</span>
      </button>
      <div class="bg-kap ${acik ? 'acik' : ''}" id="bgKap"><div id="bgIc">${acik ? grafikHTML(bgAralik()) : ''}</div></div>
    </div>
    ${yakin.length ? `<button class="uyari blok-uyari" id="yakinBorc">💳 ${yakin.map(x => `<b>${esc(x.b['Ad'])}</b> son ödeme ${x.kalanGun === 0 ? 'bugün' : x.kalanGun === 1 ? 'yarın' : x.kalanGun + ' gün sonra'}`).join(' · ')}</button>` : ''}
    ${gruplar.length ? `<div class="kart">
      <h3>Dağılım</h3>
      <div class="dagilim">${gruplar.map(([g, v]) => `<i style="width:${(v / Math.max(1, m.brut) * 100).toFixed(2)}%;background:${GRUP_RENK[g]}"></i>`).join('')}</div>
      <ul class="liste">${gruplar.map(([g, v]) => `<li class="tikla" data-git="${g === 'Nakit' && !S.portfoy.some(p => p['Tür'] === 'Nakit / Banka') ? 'hedef' : 'varliklar'}"><span class="kayit-ik">${GRUP_IK[g]}</span><span class="bosluk"><b>${g === 'Nakit' ? 'Nakit ve birikim' : g}</b><div class="mini"><i class="nokta" style="background:${GRUP_RENK[g]}"></i>%${fmt(v / Math.max(1, m.brut) * 100, 1)}</div></span><span class="tutar">${money(v)}</span></li>`).join('')}
        ${m.borc ? `<li class="tikla" data-git="borclar"><span class="kayit-ik">💳</span><span class="bosluk"><b>Borçlar</b><div class="mini">${borclar().length} kalem</div></span><span class="tutar eksi">−${money(m.borc)}</span></li>` : ''}</ul>
    </div>` : `<div class="kart"><h3>Hadi başlayalım 🚀</h3><p class="soluk">Mal varlığını görmek için varlıklarını ekle: banka hesabın, altının, hissen, evin, araban… Hepsi tek ekranda toplanır.</p><button class="blok" data-git="varliklar">Varlık ekle</button></div>`}
    <button class="kart tikla-kart" data-git="gelirgider">
      <div class="satir"><h3 class="bosluk">📊 ${esc(ymAdi(ym))}</h3><span class="mini">Gelir-Gider ›</span></div>
      <div class="uclu">
        <div><span class="mini">Gelir</span><b class="artı">${money(ay.gelir, 0)}</b></div>
        <div><span class="mini">Gider</span><b class="eksi">−${money(ay.gider, 0)}</b></div>
        <div><span class="mini">Ay sonu</span><b class="${ay.kalan >= 0 ? 'artı' : 'eksi'}">${ay.kalan >= 0 ? '+' : '−'}${money(Math.abs(ay.kalan), 0)}</b></div>
      </div>
      ${bek > 0.004 ? `<div class="mini">⏳ Onay bekleyen ${money(bek, 0)} · hepsi onaylanırsa ay sonu ${money(ay.kalan - bek, 0)}</div>` : !ay.gelir ? '<div class="mini">Bu ayın gelirini henüz girmedin.</div>' : ''}
    </button>
    ${h.var ? `<button class="kart tikla-kart" data-git="hedef">
      <div class="satir"><h3 class="bosluk">🎯 ${esc(S.ayar.hedef_ne)}</h3><span class="mini">Hedef ›</span></div>
      <div class="satir"><b class="tutar">${money(h.toplam)}</b><span class="bosluk"></span>${h.hedef ? `<span class="mini">%${fmt(h.ilerleme * 100, 1)} · ${esc(h.varis || '')}</span>` : ''}</div>
      ${h.hedef ? `<div class="cubuk ince"><div style="width:${(h.ilerleme * 100).toFixed(1)}%"></div></div>` : ''}
      ${h.min ? `<div class="mini">Bu ay ${money(h.buAy)} / ${money(h.min)} ${h.buAy >= h.min ? '✅' : ''}</div>` : ''}
    </button>` : `<button class="kart tikla-kart" data-git="hedef"><div class="satir"><h3 class="bosluk">🎯 Hedef koy</h3><span class="mini">›</span></div><p class="mini" style="margin:0">Aylık birikim hedefi ve birikim hesabı için.</p></button>`}`;
  $('#bugun').onclick = () => {
    S.bgAcik = !S.bgAcik;
    if (S.bgAcik) { $('#bgIc').innerHTML = grafikHTML(bgAralik()); grafikBagla(); }
    $('#bgKap').classList.toggle('acik', S.bgAcik); $('#bugun').classList.toggle('acik', S.bgAcik); $('#bugun').setAttribute('aria-expanded', S.bgAcik);
  };
  if (acik) grafikBagla();
  $$('[data-git]').forEach(b => b.onclick = () => S.go(b.dataset.git));
  if ($('#yakinBorc')) $('#yakinBorc').onclick = () => S.go('borclar');
}
export { gunFark, tarihFmt };
