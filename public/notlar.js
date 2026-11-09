// Dudestreet — Notlar (Nébula'daki gibi): çok sayfalı notlar, "Listeye çevir" ile harcama listesi, gelir-gidere aktarma.
// Ek: saat/tarih geçen satırlar (ör. "Özel ders akşam 16:30") için takvime alarmlı etkinlik ekleme.
import { takvimPenceresi } from './paylas.js';
import { S, $, $$, katmanKaydet, esc, num, money, today, buAy, uid, toast, sheet, onayKutusu, guard, ikon, pick, trFold, buyukIlk, lsGet, lsSet, tutarAlan, fmtIn, isDemo, girdi } from './core.js';
import { butceAy, katIkon, birlesikKat, katAd, varliklar, ayHesap } from './hesap.js';

const KAT_ANAHTAR = {
  'Seyahat': ['ucak', 'bilet', 'otel', 'tatil', 'gezi', 'otobus', 'trip', 'flight', 'hotel'],
  'Sağlık': ['doktor', 'hastane', 'ilac', 'dis', 'disci', 'saglik', 'eczane', 'muayene'],
  'Hediye': ['hediye', 'dogum', 'gift', 'cicek'],
  'Yeme-içme': ['restoran', 'yemek', 'kahve', 'market', 'bakkal', 'cafe', 'kafe', 'migros', 'a101', 'bim', 'sok', 'manav', 'kasap', 'firin'],
  'Ulaşım': ['taksi', 'metro', 'benzin', 'yakit', 'mazot', 'otopark', 'istanbulkart', 'marmaray', 'uber'],
  'Alışveriş': ['alisveris', 'kiyafet', 'ayakkabi', 'mont', 'giyim', 'trendyol', 'hepsiburada', 'amazon'],
  'Ev': ['mobilya', 'tamir', 'temizlik', 'tadilat', 'dekor', 'ikea'],
  'Eğlence': ['sinema', 'konser', 'mac', 'bilet', 'oyun', 'netflix', 'spotify'],
};
const kategoriBulYardim = ws => { for (const [k, l] of Object.entries(KAT_ANAHTAR)) if (ws.some(w => l.some(x => w === x || (x.length >= 5 && w.startsWith(x))))) return k; return 'Diğer'; };
import { planOku, planYaz, planListe, planEklenen, planEtki, planOnayla, planGeriAl, bekleyenToplam } from './plan.js';
import { katSecenek, yeniKatSor } from './gelirgider.js';
import * as AI from './gemini.js';

const ic = (k, s = 18) => ikon(k, 'currentColor', s);
const NOT_SON = 'ds_sonNot', NOT_BEKLE = 'ds_notBekle', TAKVIM_LS = 'ds_takvim';
const SATIS_KELIME = ['sat', 'satis', 'satma', 'satmak', 'sattim', 'satacagim', 'satiyorum', 'satilacak', 'nakde', 'sell', 'sold'];
const TEMEL_EN = { rent: 'kira', electricity: 'elektrik', electric: 'elektrik', wifi: 'internet', internet: 'internet', water: 'su', gas: 'dogalgaz' };
const PLAN_TUR = [['temel', 'Temel gider'], ['ek', 'Ek gider'], ['satis', 'Satış (hisse/kripto)']];

// ---------- Satır çözümleme (Nébula ile aynı kurallar) ----------
function varlikBul(ws) {
  for (const x of varliklar()) {
    const v = x.p, adlar = [trFold(v['Sembol']), ...trFold(v['Ad']).split(' ').filter(w => w.length > 2 && !['inc', 'the', 'corp', 'com', 'ltd'].includes(w))];
    if (/alt[iı]n/i.test(v['Ad'] || '') || v['Tür'] === 'Altın (gram)') adlar.push('altin');
    if (adlar.some(a => a && ws.some(w => w === a || (a.length >= 4 && w.startsWith(a))))) return v['Sembol'];
  }
  return null;
}
const PARA_SIM = { TRY: '₺', USD: '$', EUR: '€', GBP: '£' };
// Nottaki tutarı kullanıcının para birimine çevirir (₺/$/€ yazılmışsa)
function cevir(ham, para) {
  const hedef = { '₺': 'TRY', '€': 'EUR', '$': 'USD', '£': 'GBP' }[S.ayar.para_birimi || '₺'] || 'TRY';
  if (!para || para === hedef) return ham;
  const k = S.kurlar[para]; return k > 0 ? Math.round(ham * k * 100) / 100 : 0;
}
export function satirCoz(parca, ym) {
  const m = parca.match(/([₺$€£])?\s*(\d+(?:[.,]\d+)*)\s*(₺|tl\b|lira\b|try\b|\$|usd\b|dolar\b|dollars?\b|€|euros?\b|eur\b|avro\b|£|sterlin\b|gbp\b|bin\b|k\b)?/i);
  const sym = String((m && (m[1] || m[3])) || '').toLowerCase();
  const para = /^(₺|tl|lira|try)$/.test(sym) ? 'TRY' : /^(\$|usd|dolar|dollars?)$/.test(sym) ? 'USD' : /^(€|euros?|eur|avro)$/.test(sym) ? 'EUR' : /^(£|sterlin|gbp)$/.test(sym) ? 'GBP' : null;
  let ham = m ? girdi(m[2]) : 0;
  if (/^(bin|k)$/.test(sym)) ham *= 1000;
  const tutar = cevir(ham, para);
  const kurYok = para && ham > 0 && !(tutar > 0);
  const orj = para && tutar > 0 && tutar !== ham ? { t: ham, p: para } : null;
  // Saat/tarih gibi görünen sayı: harcama olmayabilir, yapay zekaya sorulur; ulaşılamazsa sıradan not sayılır
  const supheli = !!m && !sym && (/\d{1,2}[:.]\d{2}(?!\d)/.test(parca) || /\d\s*(am|pm)\b/i.test(parca) || new RegExp(m[2].replace('.', '\\.') + "\\s*['’]").test(parca) || /\b(da|de|ta|te)\b/i.test(parca.slice(parca.indexOf(m[2]) + m[2].length, parca.indexOf(m[2]) + m[2].length + 4)));
  const ad = (m ? parca.replace(m[0], ' ') : parca).replace(/[₺$€£]|\b(euros?|eur|avro|tl|lira|try|usd|dolar|dollars?|sterlin|gbp)\b/ig, ' ').replace(/[:+\-–]/g, ' ').replace(/\s+/g, ' ').trim() || 'Harcama';
  const f = trFold(ad), ws = f.split(' '), taban = { orj, kurYok, varlik: null };
  if (ws.some(w => SATIS_KELIME.includes(w) || w.startsWith('bozdur'))) {
    const varlik = varlikBul(ws), kalan = ws.filter(w => !(SATIS_KELIME.includes(w) || w.startsWith('bozdur'))).join(' ');
    return { ...taban, ad: buyukIlk((kalan || 'hisse') + ' satışı'), tutar, tur: 'satis', varlik, emin: !!varlik, kategori: '' };
  }
  if (!m) return { ...taban, ad: parca, tutar: 0, tur: 'not', emin: true, kategori: '' };
  if (supheli) return { ...taban, ad: buyukIlk(ad), tutar, tur: 'ek', emin: false, supheli: true, kategori: kategoriBulYardim(ws) };
  // Temel gider sayılması için satırın adı kalemin ADIYLA aynı olmalı (fatura/ödeme gibi dolgu kelimeler hariç)
  const DOLGU = ['fatura', 'faturasi', 'odeme', 'odemesi', 'bu', 'ay', 'aylik', 'ucreti', 'taksiti', 'bill', 'the', 'my', 'for', 'payment'];
  const sade = ws.filter(w => !DOLGU.includes(w)).map(w => TEMEL_EN[w] || w).join(' ');
  const temel = butceAy(ym), es = temel.find(b => sade && trFold(b.kalem) === sade);
  if (es) return { ...taban, ad: es.kalem, tutar, tur: 'temel', emin: tutar > 0, kategori: '' };
  const kismi = temel.some(b => { const k = trFold(b.kalem); return k && (f.includes(k) || k.split(' ').some(w => w.length > 3 && ws.includes(w))); });
  return { ...taban, ad: buyukIlk(ad), tutar, tur: 'ek', emin: false, kategori: kategoriBulYardim(ws), kismi };
}

const satirEslesir = (anahtar, p) => p.satir ? p.satir === anahtar : trFold(anahtar).includes(trFold(p.ad));
function satirDurum(anahtar, nid) {
  const l = planOku().filter(p => p.notId === nid && satirEslesir(anahtar, p));
  if (!l.length) return null;
  return l.some(p => p.durum === 'bekliyor') ? 'bekliyor' : l.some(p => p.durum === 'eklendi') ? 'eklendi' : null;
}
function isler(metin, ym, nid) {
  const satirlar = String(metin || '').split('\n'), out = [];
  satirlar.forEach((satir, li) => {
    const anahtar = satir.trim(); if (!anahtar) return;
    if (satirDurum(anahtar, nid)) return;
    const parcalar = (anahtar.match(/\d+(?:[.,]\d+)*/g) || []).length > 1 && !/\d{1,2}[:.]\d{2}/.test(anahtar) ? anahtar.split(/[;,](?![\d])/) : [anahtar];
    parcalar.map(x => x.trim()).filter(Boolean).forEach(pc => out.push({ li, pc, satir: anahtar, ...satirCoz(pc, ym) }));
  });
  return { satirlar, isler: out };
}

// ---------- Takvim: satırdan tarih + saat bulma ----------
const GUNLER = { pazar: 0, pazartesi: 1, sali: 2, carsamba: 3, persembe: 4, cuma: 5, cumartesi: 6 };
const AYLAR = { ocak: 1, subat: 2, mart: 3, nisan: 4, mayis: 5, haziran: 6, temmuz: 7, agustos: 8, eylul: 9, ekim: 10, kasim: 11, aralik: 12 };
export function zamanBul(satir, simdi = new Date()) {
  const f = trFold(satir);
  let saat = null, dakika = 0, tarihEsle = null;
  let m = satir.match(/(?:^|[^\d.])([01]?\d|2[0-3]):([0-5]\d)(?!\d)/);
  const tarihRe = /(?:^|\s)(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?(?=\s|$)/;
  if (m) { saat = +m[1]; dakika = +m[2]; tarihEsle = satir.match(tarihRe); }
  else if ((m = satir.match(/(?:^|[^\d.])([01]?\d|2[0-3])\.([0-5]\d)(?![\d.])/)) && !satir.match(/\d{1,2}\.\d{1,2}\.\d{2,4}/)) { saat = +m[1]; dakika = +m[2]; }
  else if ((m = satir.match(/(?:^|[^\d])([01]?\d|2[0-3])\s*['’]?\s*(?:da|de|ta|te)\b/i))) { saat = +m[1]; tarihEsle = satir.match(tarihRe); }
  else if ((m = f.match(/\bsaat ([01]?\d|2[0-3])\b/))) saat = +m[1];
  else if ((m = satir.match(/\b(1[0-2]|0?[1-9])\s*(am|pm)\b/i))) saat = (+m[1] % 12) + (/pm/i.test(m[2]) ? 12 : 0);
  if (saat === null) return null;
  if (/\b(aksam|gece|ogleden sonra)\b/.test(f) && saat < 12) saat += 12;
  if (/\bsabah\b/.test(f) && saat === 12) saat = 0;
  // tarih
  let d = new Date(simdi.getFullYear(), simdi.getMonth(), simdi.getDate()), acik = false;
  let g;
  if (/\byarin\b/.test(f)) { d.setDate(d.getDate() + 1); acik = true; }
  else if (/\b(obur gun|ertesi gun)\b/.test(f)) { d.setDate(d.getDate() + 2); acik = true; }
  else if (/\bbugun\b|\bbu aksam\b/.test(f)) acik = true;
  else if ((g = Object.keys(GUNLER).sort((a, b) => b.length - a.length).find(k => new RegExp(`\\b${k}`).test(f)))) {
    const fark = (GUNLER[g] - d.getDay() + 7) % 7; d.setDate(d.getDate() + fark); acik = true;
    if (fark === 0 && (saat * 60 + dakika) <= simdi.getHours() * 60 + simdi.getMinutes()) d.setDate(d.getDate() + 7);
  } else if (tarihEsle && +tarihEsle[2] >= 1 && +tarihEsle[2] <= 12 && +tarihEsle[1] >= 1 && +tarihEsle[1] <= 31) {
    const t3 = tarihEsle[3], y = t3 ? (t3.length === 2 ? 2000 + +t3 : +t3) : simdi.getFullYear();
    d = new Date(y, +tarihEsle[2] - 1, +tarihEsle[1]); acik = true;
    if (!t3 && d < new Date(simdi.getFullYear(), simdi.getMonth(), simdi.getDate())) d.setFullYear(d.getFullYear() + 1);
  } else if ((m = f.match(/\b(\d{1,2}) (ocak|subat|mart|nisan|mayis|haziran|temmuz|agustos|eylul|ekim|kasim|aralik)\b/))) {
    d = new Date(simdi.getFullYear(), AYLAR[m[2]] - 1, +m[1]); acik = true;
    if (d < new Date(simdi.getFullYear(), simdi.getMonth(), simdi.getDate())) d.setFullYear(d.getFullYear() + 1);
  }
  d.setHours(saat, dakika, 0, 0);
  if (!acik && d <= simdi) d.setDate(d.getDate() + 1);   // gün yazılmamışsa ve saat geçtiyse yarın
  const baslik = buyukIlk(satir.replace(/(?:^|\s)([01]?\d|2[0-3])[:.]([0-5]\d)(?!\d)/, ' ').replace(/([01]?\d|2[0-3])\s*['’]?\s*(da|de|ta|te)\b/i, ' ')
    .replace(/\b(yarın|yarin|bugün|bugun|öbür gün|akşam|aksam|sabah|gece|öğleden sonra|saat)\b/gi, ' ').replace(/\s+/g, ' ').trim()) || satir.trim();
  return { tarih: d, baslik };
}
function takvimSheet(satir, bulunan, sonra) {
  takvimPenceresi({ baslik: bulunan.baslik, tarih: bulunan.tarih, aciklama: `Notundaki satır: “${esc(satir)}”`, not: 'Dudestreet notlarından',
    sonra: () => { const l = lsGet(TAKVIM_LS, []); l.push(trFold(satir)); lsSet(TAKVIM_LS, l.slice(-200)); sonra?.(); } });
}

// ---------- Kaydetme kuyruğu (yazarken kaybolmasın; tabloya biraz gecikmeli yazılır) ----------
let bekle = lsGet(NOT_BEKLE, {}) || {};
let kayitta = false, durumYaz = () => {}, flushT = null;
const bekleKaydet = () => { if (Object.keys(bekle).length) lsSet(NOT_BEKLE, bekle); else localStorage.removeItem(NOT_BEKLE); };
async function flush() {
  if (kayitta || !Object.keys(bekle).length || !S.db) return;
  kayitta = true; durumYaz('Kaydediliyor…');
  try {
    const tablo = await S.db.table('Notlar');
    while (Object.keys(bekle).length) {
      const id = Object.keys(bekle)[0], p = bekle[id]; delete bekle[id]; bekleKaydet();
      try {
        const r = tablo.find(x => x['Kimlik'] === id);
        if (p.sil) { if (r) { await S.db.deleteRow('Notlar', r._row); tablo.splice(tablo.indexOf(r), 1); tablo.forEach(x => { if (x._row > r._row) x._row--; }); } }
        else {
          const obj = { Kimlik: id, Metin: p.metin ?? r?.['Metin'] ?? '', 'Güncelleme': new Date().toISOString(), Sabit: (p.sabit ?? (r ? r['Sabit'] === 'evet' : false)) ? 'evet' : '' };
          if (r) { await S.db.writeObj('Notlar', r._row, obj); Object.assign(r, obj); }
          else { await S.db.appendObj('Notlar', obj); tablo.push({ ...obj, _row: (tablo.length ? Math.max(...tablo.map(x => x._row)) : 1) + 1 }); }
        }
      } catch (e) { bekle[id] = { ...p, ...(bekle[id] || {}) }; bekleKaydet(); throw e; }
    }
    S.notlar = await S.db.table('Notlar');
    durumYaz('Kaydedildi ✓');
  } catch (e) { durumYaz('Kaydedilemedi, tekrar denenecek'); setTimeout(flush, 4000); }
  kayitta = false;
}
const yama = (id, f) => { bekle[id] = f.sil ? { sil: true } : { ...(bekle[id] || {}), ...f }; bekleKaydet(); clearTimeout(flushT); flushT = setTimeout(flush, 1200); };
addEventListener('visibilitychange', () => { if (document.hidden) { bekleKaydet(); flush(); } });
addEventListener('pagehide', bekleKaydet);
export const notFlush = flush;

const satirlarOf = m => String(m || '').split('\n').map(x => x.trim()).filter(Boolean);
const baslikOf = m => satirlarOf(m)[0] || 'Yeni not';
const onizleme = m => satirlarOf(m).slice(1).join(' · ') || 'Ek metin yok';
const zamanYazi = iso => { if (!iso) return ''; const d = new Date(iso); if (isNaN(d)) return ''; return d.toDateString() === new Date().toDateString() ? d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }); };

// ---------- Not defteri penceresi ----------
export function notlarAc() {
  if ($('.notlar-ov')) return;
  const ym = buAy();
  const nb = { view: 'liste', id: null, ara: '', notlar: S.notlar.filter(n => n['Kimlik']).map(n => ({ id: String(n['Kimlik']), metin: String(n['Metin'] || ''), guncelleme: n['Güncelleme'] || '', sabit: n['Sabit'] === 'evet' })) };
  Object.entries(bekle).forEach(([id, p]) => { if (p.sil) nb.notlar = nb.notlar.filter(n => n.id !== id); else { let n = nb.notlar.find(x => x.id === id); if (!n) { n = { id, metin: '', guncelleme: new Date().toISOString(), sabit: false }; nb.notlar.push(n); } if (p.metin !== undefined) n.metin = p.metin; if (p.sabit !== undefined) n.sabit = !!p.sabit; } });
  const el = document.createElement('div'); el.className = 'notlar-ov'; el.innerHTML = '<div class="not-ic" id="nbKok"></div>'; document.body.appendChild(el);
  document.body.classList.add('not-acik');
  const kok = $('#nbKok', el);
  const sirali = () => nb.notlar.slice().sort((x, y) => (y.sabit - x.sabit) || String(y.guncelleme).localeCompare(String(x.guncelleme)));
  const senk = () => { S.notlar = nb.notlar.map(n => ({ 'Kimlik': n.id, 'Metin': n.metin, 'Güncelleme': n.guncelleme, 'Sabit': n.sabit ? 'evet' : '' })); };
  const yerel = (n, f) => { Object.assign(n, f, { guncelleme: new Date().toISOString() }); senk(); };
  let kapali = false, aynaGuncelle = null;
  const kapat = () => { if (kapali) return; kapali = true; durumYaz = () => {}; senk(); flush(); document.body.classList.remove('not-acik'); el.remove(); S.yenile(); };
  const git = (view, id = null) => { nb.view = view; nb.id = id; ciz(); const g = $('.not-govde', el); if (g) g.scrollTop = 0; };
  katmanKaydet(el, kapat, () => { if (nb.view === 'liste') return false; const g = $('#nbGeri', el); if (g) g.click(); else git('liste'); return true; });   // geri tuşu: nottan listeye, listeden kapat

  function snack(yazi, geriAl) {
    $('.nb-snack', el)?.remove();
    const s = document.createElement('div'); s.className = 'nb-snack'; s.innerHTML = `<span>${esc(yazi)}</span><button type="button">Geri al</button>`;
    el.appendChild(s); const t = setTimeout(() => s.remove(), 6000);
    $('button', s).onclick = () => { clearTimeout(t); s.remove(); geriAl(); };
  }
  function notSil(n) {
    const planKopya = planOku().filter(p => p.notId === n.id), say = planKopya.filter(p => p.durum === 'bekliyor').length;
    onayKutusu('Bu not silinsin mi?', 'Not tablondan da silinir.' + (say ? ` Bu nottan çevrilmiş ve henüz onaylamadığın ${say} harcama da kalkar.` : '') + ' Silince kısa bir süre geri alabilirsin.', () => {
      planYaz(planOku().filter(p => p.notId !== n.id)); nb.notlar = nb.notlar.filter(x => x.id !== n.id); senk(); yama(n.id, { sil: true });
      if (nb.view !== 'liste') git('liste'); else ciz();
      snack('Not silindi', () => { nb.notlar.push(n); planYaz([...planOku(), ...planKopya]); senk(); delete bekle[n.id]; yama(n.id, { metin: n.metin, sabit: n.sabit }); ciz(); toast('Not geri geldi 📝'); });
    }, { evetYazi: 'Evet, sil', tehlike: true });
  }
  function adDegistir(n, sonra) {
    const s = sheet(`<h3>İsmi değiştir</h3><label class="etiket" for="rnAd">Not adı</label><input id="rnAd" maxlength="80" value="${esc(baslikOf(n.metin) === 'Yeni not' ? '' : baslikOf(n.metin))}" autocomplete="off"><button class="blok" id="rnOk" style="margin-top:12px">Kaydet</button>`);
    const tamam = () => {
      const yeni = $('#rnAd', s).value.trim().replace(/\s+/g, ' '); if (!yeni) return toast('Bir ad yaz');
      const satirlar = String(n.metin || '').split('\n'), ix = satirlar.findIndex(x => x.trim());
      if (ix >= 0 && !/\d/.test(satirlar[ix])) satirlar[ix] = yeni; else if (ix >= 0) satirlar.unshift(yeni); else satirlar.push(yeni);
      yerel(n, { metin: satirlar.join('\n') }); yama(n.id, { metin: n.metin }); s.remove(); toast('İsim değişti ✏️'); (sonra || ciz)();
    };
    $('#rnOk', s).onclick = tamam; $('#rnAd', s).onkeydown = e => { if (e.key === 'Enter') tamam(); };
  }
  function notMenu(n, editorde) {
    const s = sheet(`<h3>${esc(baslikOf(n.metin))}</h3>
      ${editorde ? `<button class="blok ikinci" id="mKapat">${ic('carpi')} Notları kapat</button>` : ''}
      <button class="blok ikinci" id="mAd">${ic('duzenle')} İsmi değiştir</button>
      <button class="blok ikinci" id="mSabit">${ic('sabit')} ${n.sabit ? 'Sabitlemeyi kaldır' : 'Başa sabitle'}</button>
      <button class="blok tehlike" id="mSil">${ic('cop')} Sil</button>`);
    if ($('#mKapat', s)) $('#mKapat', s).onclick = () => { s.remove(); bitir(n); kapat(); };
    $('#mAd', s).onclick = () => { s.remove(); adDegistir(n, editorde ? () => git('not', n.id) : null); };
    $('#mSabit', s).onclick = () => { yerel(n, { sabit: !n.sabit }); yama(n.id, { sabit: n.sabit }); s.remove(); if (!editorde) ciz(); };
    $('#mSil', s).onclick = () => { s.remove(); notSil(n); };
  }
  const bitir = n => { if (n && !n.metin.trim() && !planListe(n.id).length) { nb.notlar = nb.notlar.filter(x => x.id !== n.id); senk(); yama(n.id, { sil: true }); } };
  function ciz() { durumYaz = () => {}; aynaGuncelle = null; return nb.view === 'liste' ? listeCiz() : editorCiz(); }

  function listeCiz() {
    const q = trFold(nb.ara), liste = sirali().filter(n => !q || trFold(n.metin).includes(q));
    kok.innerHTML = `<div class="not-ust"><button type="button" class="not-geri" id="nbKapat">${ic('geri', 18)} Kapat</button><span></span><button type="button" class="not-btn" id="nbYeni">${ic('arti', 16)} Yeni not</button></div>
      <div class="not-govde">
        <h1 class="not-baslik">Notlar</h1>
        <input class="not-ara" id="nbAra" type="search" placeholder="Notlarda ara" value="${esc(nb.ara)}" autocomplete="off">
        ${liste.length ? liste.map(n => `<div class="not-satir" data-nid="${esc(n.id)}" role="button" tabindex="0"><div class="ns-metin"><div class="ns-baslik">${n.sabit ? `<span class="ns-pin">${ic('sabit', 14)}</span>` : ''}${esc(baslikOf(n.metin))}${planListe(n.id).length ? `<span class="ns-rozet">📋 ${planListe(n.id).length}</span>` : ''}</div><div class="ns-alt"><span>${esc(zamanYazi(n.guncelleme))}</span><span class="ns-onizleme">${esc(onizleme(n.metin))}</span></div></div><button type="button" class="ikon-btn" data-nmenu="${esc(n.id)}" aria-label="Not işlemleri">${ic('nokta', 20)}</button></div>`).join('') : `<div class="not-bos">${q ? 'Bu aramayla not bulunamadı.' : 'Henüz not yok. Sağ üstten yeni not açabilirsin.<br><br>Örnek: “Market 1.500”, “Kira 18.000”, “Özel ders akşam 16:30”'}</div>`}
        <div class="mini ortala" style="margin-top:14px">${nb.notlar.length} not</div>
      </div>`;
    $('#nbKapat', el).onclick = kapat;
    $('#nbYeni', el).onclick = () => { const n = { id: 'n' + uid(), metin: '', guncelleme: new Date().toISOString(), sabit: false }; nb.notlar.push(n); senk(); git('not', n.id); setTimeout(() => $('#nbMetin', el)?.focus(), 60); };
    $('#nbAra', el).oninput = e => { nb.ara = e.target.value; const pos = e.target.selectionStart; listeCiz(); const i = $('#nbAra', el); i.focus(); i.setSelectionRange(pos, pos); };
    $$('[data-nmenu]', el).forEach(b => b.onclick = e => { e.stopPropagation(); const n = nb.notlar.find(x => x.id === b.dataset.nmenu); if (n) notMenu(n); });
    $$('[data-nid]', el).forEach(b => {
      let t = null, uzun = false, sx = 0, sy = 0;
      b.addEventListener('pointerdown', e => { uzun = false; sx = e.clientX; sy = e.clientY; if (e.target.closest('[data-nmenu]')) return; t = setTimeout(() => { uzun = true; try { navigator.vibrate?.(15); } catch { /* geç */ } const n = nb.notlar.find(x => x.id === b.dataset.nid); if (n) notMenu(n); }, 520); });
      b.addEventListener('pointermove', e => { if (Math.hypot(e.clientX - sx, e.clientY - sy) > 10) clearTimeout(t); });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach(o => b.addEventListener(o, () => clearTimeout(t)));
      b.addEventListener('contextmenu', e => e.preventDefault());
      b.onclick = e => { if (uzun || e.target.closest('[data-nmenu]')) return; git('not', b.dataset.nid); };
    });
  }

  // ---------- Notun altındaki liste ----------
  function listeHTML(nid) {
    const liste = planListe(nid), eklenen = planEklenen(nid), etki = planEtki(ym, nid), h = ayHesap(ym), tahmin = h.kalan - bekleyenToplam(ym, h.temel);
    if (!liste.length && !eklenen.length) return '';
    const ikonu = p => p.tur === 'temel' ? '📋' : p.tur === 'satis' ? '📈' : katIkon(p.kategori || 'Diğer');
    const tut = p => num(p.tutar) > 0 ? '≈ ' + money(p.tutar) : 'tutar sor';
    const katSec = p => p.tur === 'ek' ? `<select class="pl-sec" data-pkat="${p.id}" aria-label="Kategori">${katSecenek(p.kategori || 'Diğer')}</select>` : '';
    const bekleyen = liste.length ? `<div class="not-lbas"><span>Bekleyen</span><span>${liste.length} · −${money(liste.filter(p => p.tur !== 'satis').reduce((t, p) => t + num(p.tutar), 0), 0)}</span></div>
      ${liste.map(p => `<div class="pl-satir">
        <div class="satir"><span class="bosluk pl-ad">${ikonu(p)} ${esc(p.ad)}</span><span class="tutar">${tut(p)}${p.orj ? `<small class="mini"> ${esc(num(p.orj.t).toLocaleString('tr-TR'))} ${PARA_SIM[p.orj.p] || ''}</small>` : ''}</span></div>
        <div class="satir pl-alt"><span class="bosluk satir" style="gap:6px;flex-wrap:wrap"><select class="pl-sec" data-ptur="${p.id}" aria-label="Gider türü">${PLAN_TUR.map(([k, ad]) => `<option value="${k}" ${p.tur === k ? 'selected' : ''}>${ad}</option>`).join('')}</select>${katSec(p)}</span>
          <button type="button" class="ikon-btn" data-pduz="${p.id}" aria-label="Düzenle">${ic('duzenle', 16)}</button><button type="button" class="ikon-btn" data-psil="${p.id}" aria-label="Listeden çıkar">${ic('cop', 16)}</button><button type="button" class="ikon-btn pl-ok" data-pok="${p.id}" aria-label="Gerçekleşti">${ic('tik', 18)}</button></div>
      </div>`).join('')}
      <button type="button" class="pl-ekle" data-pekle>${ic('arti', 14)} Ekle</button>
      <div class="mini">Bu liste Gelir-Gider sayfasında da “onay bekleyen” olarak görünür; ✓ ikisinde de aynı işi yapar.</div>
      <div class="pl-ozet"><span>Ay sonuna etkisi <b>−${money(etki, 0)}</b></span><span>Tahmini ay sonu <b class="${tahmin >= 0 ? 'artı' : 'eksi'}">${tahmin >= 0 ? '+' : '−'}${money(Math.abs(tahmin), 0)}</b></span></div>`
      : `<div class="not-lbas"><span>Bekleyen</span><span>0</span></div><div class="mini">${eklenen.length ? 'Hepsi eklendi ✓' : 'Bekleyen harcama yok'}</div><button type="button" class="pl-ekle" data-pekle>${ic('arti', 14)} Ekle</button>`;
    const ekl = eklenen.length ? `<div class="not-lbas" style="margin-top:14px"><span>Eklenen</span><span>✓ ${eklenen.length}</span></div>
      ${eklenen.map(p => `<div class="pl-satir pl-eklendi"><div class="satir"><span class="bosluk pl-ad"><span class="artı">${ic('tik', 15)}</span> ${ikonu(p)} ${esc(p.ad)}</span><span class="tutar">${tut(p)}</span></div>
        <div class="satir pl-alt"><span class="bosluk mini">${esc(zamanYazi(p.eklenme))}${p.tur === 'satis' ? ' · satış' : p.tur === 'temel' ? ' · temel gider' : ''}</span>${p.tur === 'satis' ? '<span class="mini">Varlıklar’dan düzeltilir</span>' : `<button type="button" class="kucuk-btn ikinci" data-pgeri="${p.id}">${ic('geriAl', 14)} Geri al</button>`}</div></div>`).join('')}` : '';
    return bekleyen + ekl;
  }
  function planYenile() { const l = $('#ntListe', el); if (l) { l.innerHTML = listeHTML(nb.id); planBagla(); } aynaGuncelle?.(); }
  function planEkle() {
    const temelAdlar = butceAy(ym).map(b => b.kalem);
    const s = sheet(`<h3>Listeye harcama ekle</h3>
      <label class="etiket" for="peAd">Ne için?</label><input id="peAd" maxlength="60" placeholder="ör. Bayram hediyesi" list="peAdlar" autocomplete="off"><datalist id="peAdlar">${temelAdlar.map(x => `<option value="${esc(x)}">`).join('')}</datalist>
      <label class="etiket" for="peT">Tutar</label>${tutarAlan('peT')}
      <label class="etiket" for="peTur">Türü</label><select id="peTur">${PLAN_TUR.filter(x => x[0] !== 'satis').map(([k, ad]) => `<option value="${k}" ${k === 'ek' ? 'selected' : ''}>${ad}</option>`).join('')}</select>
      <div id="peKatK"><label class="etiket" for="peKat">Kategori</label><select id="peKat">${katSecenek('Diğer')}</select></div>
      <button class="blok" id="peGo" style="margin-top:14px">Listeye ekle</button>`);
    const kat = () => { $('#peKatK', s).classList.toggle('hidden', $('#peTur', s).value !== 'ek'); const ad = trFold($('#peAd', s).value); if (ad) { const b = kategoriBulYardim(ad.split(' ')); if ([...$('#peKat', s).options].some(o => o.value === b)) $('#peKat', s).value = b; } };
    $('#peKat', s).onchange = () => { const sel = $('#peKat', s); if (sel.value !== '__yeni') { sel.dataset.son = sel.value; return; } const son = sel.dataset.son || 'Diğer'; yeniKatSor(kod => { sel.innerHTML = katSecenek(kod); sel.value = kod; }, () => { sel.value = son; }); };
    $('#peTur', s).onchange = kat;
    $('#peAd', s).onchange = () => { if (temelAdlar.includes($('#peAd', s).value)) $('#peTur', s).value = 'temel'; kat(); };
    kat();
    $('#peGo', s).onclick = () => {
      const ad = $('#peAd', s).value.trim(), tur = $('#peTur', s).value, tutar = girdi($('#peT', s).value);
      if (!ad) return toast('Ne için olduğunu yaz ✍️');
      if (!(tutar > 0)) return toast('Tutarı gir');
      planYaz([...planOku(), { id: uid(), notId: nb.id, donem: ym, ad: buyukIlk(ad), tutar, orj: null, tur, kategori: tur === 'ek' ? $('#peKat', s).value : '', varlik: '', durum: 'bekliyor' }]);
      s.remove(); planYenile(); toast('Listeye eklendi 📝');
    };
  }
  const planBul = id => planListe().find(p => p.id === id);
  function planBagla() {
    $$('[data-pekle]', el).forEach(b => b.onclick = planEkle);
    const g = (id, f) => { planYaz(planOku().map(x => x.id === id ? { ...x, ...f } : x)); planYenile(); };
    $$('[data-ptur]', el).forEach(s => s.onchange = () => { const p = planBul(s.dataset.ptur); if (!p) return; g(p.id, { tur: s.value, varlik: s.value === 'satis' ? p.varlik : '', kategori: s.value === 'ek' ? kategoriBulYardim(trFold(p.ad).split(' ')) : '' }); });
    $$('[data-pkat]', el).forEach(s => s.onchange = () => { if (s.value !== '__yeni') return g(s.dataset.pkat, { kategori: s.value }); yeniKatSor(kod => g(s.dataset.pkat, { kategori: kod }), () => planYenile()); });
    $$('[data-pgeri]', el).forEach(b => b.onclick = () => { const p = planOku().find(x => x.id === b.dataset.pgeri && x.durum === 'eklendi'); if (p) planGeriAl(p, planYenile); });
    $$('[data-psil]', el).forEach(b => b.onclick = () => { planYaz(planOku().filter(x => x.id !== b.dataset.psil)); planYenile(); });
    $$('[data-pduz]', el).forEach(b => b.onclick = () => {
      const p = planBul(b.dataset.pduz); if (!p) return;
      const s = sheet(`<h3>Planı düzenle</h3><label class="etiket" for="pdAd">Ad</label><input id="pdAd" value="${esc(p.ad)}" maxlength="60"><label class="etiket" for="pdT">Tutar</label>${tutarAlan('pdT', '0', fmtIn(p.tutar))}<button class="blok" id="pdOk" style="margin-top:12px">Kaydet</button>`);
      $('#pdOk', s).onclick = () => { const t = girdi($('#pdT', s).value); if (!(t > 0) && p.tur !== 'satis') return toast('Tutar gir'); g(p.id, { ad: $('#pdAd', s).value.trim() || p.ad, tutar: t || 0, orj: t === num(p.tutar) ? p.orj : null }); s.remove(); };
    });
    $$('[data-pok]', el).forEach(b => b.onclick = () => { const p = planBul(b.dataset.pok); if (p) planOnayla(p, planYenile); });
  }

  // ---------- Not ekranı ----------
  function editorCiz() {
    const n = nb.notlar.find(x => x.id === nb.id);
    if (!n) return git('liste');
    lsSet(NOT_SON, n.id);
    kok.innerHTML = `<div class="not-ust"><button type="button" class="not-geri" id="nbGeri">${ic('geri', 18)} Notlar</button><span class="mini" id="nbDurum">${esc(zamanYazi(n.guncelleme))}</span><span class="satir" style="gap:6px"><button type="button" class="not-btn" id="nbCevir">Listeye çevir</button><button type="button" class="ikon-btn" id="nbMenu" aria-label="Seçenekler">${ic('nokta', 22)}</button></span></div>
      <div class="not-govde"><div class="not-yaz"><div class="not-ayna" id="nbAyna" aria-hidden="true"></div><textarea id="nbMetin" class="not-alan" placeholder="Başlık&#10;Market 1.500&#10;Kira 18.000&#10;Özel ders akşam 16:30" aria-label="Not">${esc(n.metin)}</textarea></div>
      <div id="nbTakvim"></div>
      <div class="not-toplam" id="nbToplam"></div>
      <div id="ntListe">${listeHTML(n.id)}</div></div>`;
    const metin = $('#nbMetin', el), durum = $('#nbDurum', el), ayna = $('#nbAyna', el);
    const aynaCiz = () => {
      ayna.innerHTML = metin.value.split('\n').map(s => {
        const anahtar = s.trim(), d = anahtar ? satirDurum(anahtar, n.id) : null;
        const isaret = d === 'bekliyor' ? '<span class="ay-nokta" title="Bekliyor"><i></i><i></i><i></i></span>' : d === 'eklendi' ? `<span class="ay-tik">${ic('tik', 15)}</span>` : '';
        return `<div class="ay-satir">${esc(s) || '&#8203;'}${isaret}</div>`;
      }).join('');
    };
    aynaGuncelle = aynaCiz;
    planBagla();
    durumYaz = t => { if (durum.isConnected) durum.textContent = t; };
    const boyut = () => { const gv = $('.not-govde', el), st = gv ? gv.scrollTop : 0; metin.style.height = 'auto'; metin.style.height = Math.max(metin.scrollHeight, innerHeight * 0.32) + 'px'; if (gv) gv.scrollTop = st; };
    const takvimCiz = () => {
      const kutu = $('#nbTakvim', el); if (!kutu) return;
      const eklenen = new Set(lsGet(TAKVIM_LS, []));
      const bulunan = metin.value.split('\n').map(s => s.trim()).filter(Boolean).map(s => ({ s, z: zamanBul(s) })).filter(x => x.z).slice(0, 6);
      kutu.innerHTML = bulunan.length ? `<div class="takvim-kutu">${bulunan.map((x, i) => `<button type="button" class="takvim-btn ${eklenen.has(trFold(x.s)) ? 'ok' : ''}" data-tk="${i}">${ic('alarm', 16)}<span class="bosluk"><b>${esc(x.z.baslik)}</b><span class="mini"> · ${x.z.tarih.toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric', month: 'short' })} ${x.z.tarih.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span></span><span class="mini">${eklenen.has(trFold(x.s)) ? 'Eklendi ✓' : 'Takvime ekle'}</span></button>`).join('')}</div>` : '';
      $$('[data-tk]', kutu).forEach(b => b.onclick = () => { const x = bulunan[Number(b.dataset.tk)]; takvimSheet(x.s, x.z, takvimCiz); });
    };
    const toplam = () => {
      const kutu = $('#nbToplam', el); if (!kutu) return;
      const { isler: l } = isler(metin.value, ym, n.id), h = l.filter(x => x.tur !== 'not' && x.tur !== 'satis' && x.tutar > 0 && !x.supheli), s = l.filter(x => x.tur === 'satis').length;
      const p = []; if (h.length) p.push(`${h.length} harcama · ≈ ${money(h.reduce((t, x) => t + x.tutar, 0), 0)}`); if (s) p.push(`${s} satış`);
      kutu.innerHTML = p.length ? `<div class="nt-yeni">✨ Çevrilmeyi bekleyen: ${esc(p.join(' · '))}</div>` : '';
    };
    // Çevrilmiş bir satırın tutarı değişince listedeki kayıt da güncellenir
    const planSenk = () => {
      const anahtarlar = metin.value.split('\n').map(s => s.trim()), liste = planOku(), keySet = new Set(anahtarlar);
      const yetim = liste.filter(p => p.notId === n.id && p.durum === 'bekliyor' && p.satir && !keySet.has(p.satir));
      if (!yetim.length) return;
      const kullanilan = new Set(); let degisti = false;
      yetim.forEach(p => {
        const adaylar = anahtarlar.map((k, i) => i).filter(i => anahtarlar[i] && !kullanilan.has(i) && !satirDurum(anahtarlar[i], n.id));
        const ayni = adaylar.find(i => i === p.satirNo);
        const li = ayni !== undefined ? ayni : adaylar.find(i => { const c = satirCoz(anahtarlar[i], ym); return c.tur !== 'not' && trFold(c.ad) === trFold(p.ad); });
        if (li === undefined) return;
        const c = satirCoz(anahtarlar[li], ym); if (c.tur === 'not' || !(c.tutar > 0)) return;
        kullanilan.add(li); Object.assign(p, { satir: anahtarlar[li], satirNo: li, tutar: c.tutar, orj: c.orj || null }, ayni !== undefined && trFold(c.ad) !== trFold(p.ad) ? { ad: c.ad } : {}); degisti = true;
      });
      if (degisti) { planYaz(liste); planYenile(); }
    };
    let ts = null;
    const degisti = () => { clearTimeout(ts); ts = setTimeout(() => { planSenk(); toplam(); takvimCiz(); }, 600); yerel(n, { metin: metin.value }); yama(n.id, { metin: metin.value }); durumYaz('Yazıyor…'); boyut(); aynaCiz(); };
    metin.oninput = degisti;
    boyut(); aynaCiz(); toplam(); takvimCiz();
    $('#nbGeri', el).onclick = () => { bitir(n); git('liste'); };
    $('#nbMenu', el).onclick = () => notMenu(n, true);
    $('#nbCevir', el).onclick = async () => {
      const btn = $('#nbCevir', el); btn.disabled = true; btn.textContent = 'Düşünüyorum…';
      try {
        $('.nb-snack', el)?.remove(); metin.blur();
        const { satirlar, isler: l } = isler(metin.value, ym, n.id);
        if (!l.filter(x => x.tur !== 'not').length) { toast(pick(['Listeye çevrilecek yeni harcama yok, hepsi zaten listede 👍', 'Yeni harcama yok dude, notların olduğu gibi duruyor 📝'])); return; }
        // Kuralların emin olmadığı satırlar için yapay zekadan yardım (tek istek, kullanıcının kendi Gemini anahtarıyla)
        const belirsiz = l.filter(x => !x.emin);
        if (belirsiz.length && AI.getKey() && !isDemo()) {
          try {
            const r = await AI.jsonSor({ key: AI.getKey(), model: AI.getModel(), prompt: yorumPrompt(belirsiz.map(x => x.pc)) });
            (Array.isArray(r) ? r : []).forEach(s => {
              const x = belirsiz[s.i]; if (!x) return;
              x.supheli = false; x.tur = ['temel', 'ek', 'satis', 'not'].includes(s.tur) ? s.tur : 'ek'; x.ad = s.eslesen || s.ad || x.ad;
              if (x.tur === 'ek') x.kategori = birlesikKat().some(([k]) => k === s.kategori) ? s.kategori : (x.kategori || 'Diğer');
              if (!(x.tutar > 0) && s.tutar > 0) x.tutar = cevir(Number(s.tutar) || 0, s.para && s.para !== 'YOK' ? s.para : null);
              if (s.varlik) x.varlik = s.varlik;
            });
          } catch (e) { console.warn('yapay zeka', e); }
        }
        l.forEach(x => { if (x.supheli) x.tur = 'not'; });
        const harcamalar = l.filter(x => x.tur !== 'not'), tamam = harcamalar.filter(x => x.tutar > 0 || x.tur === 'satis');
        if (!tamam.length) { toast(harcamalar.some(x => x.kurYok) ? 'Kur henüz gelmedi, biraz sonra tekrar dene ↻' : 'Tutarlı satır bulamadım. Örn: Market 1.500'); return; }
        const sim = Date.now().toString(36), guncelKeys = new Set(satirlar.map(s => s.trim()));
        const yetim = planOku().filter(p => p.notId === n.id && p.durum === 'bekliyor' && p.satir && !guncelKeys.has(p.satir));
        const eslesen = new Map(), yeniler = [];
        tamam.forEach(x => { const e = yetim.find(p => !eslesen.has(p.id) && (trFold(p.ad) === trFold(x.ad) || p.satirNo === x.li)); if (e) eslesen.set(e.id, x); else yeniler.push(x); });
        const alanlar = x => ({ satir: x.satir, satirNo: x.li, ad: x.ad, tutar: x.tutar || 0, orj: x.orj || null, tur: x.tur, kategori: x.tur === 'ek' ? (x.kategori || 'Diğer') : '', varlik: x.varlik || '' });
        planYaz([...planOku().map(p => eslesen.has(p.id) ? { ...p, ...alanlar(eslesen.get(p.id)) } : p), ...yeniler.map((x, k) => ({ id: sim + k + Math.random().toString(36).slice(2, 5), notId: n.id, donem: ym, ...alanlar(x), durum: 'bekliyor' }))]);
        degisti(); planYenile();
      } finally { btn.disabled = false; btn.textContent = 'Listeye çevir'; }
    };
  }
  // Kaydırma: listede sola = kapat, notta sağa = geri
  let x0 = null;
  el.addEventListener('touchstart', e => { x0 = e.target.closest('textarea, select, input') ? null : e.touches[0].clientX; }, { passive: true });
  el.addEventListener('touchend', e => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (dx < -90 && nb.view === 'liste') kapat(); else if (dx > 90 && nb.view !== 'liste') $('#nbGeri', el)?.click(); }, { passive: true });
  planYaz(planOku().filter(p => p.durum === 'bekliyor' || (p.durum === 'eklendi' && Date.now() - Date.parse(p.eklenme || 0) < 30 * 864e5)));
  if (Object.keys(bekle).length) flush();
  const son = lsGet(NOT_SON, null), hedef = nb.notlar.find(n => n.id === son) || sirali()[0];
  if (hedef) { nb.view = 'not'; nb.id = hedef.id; }
  ciz();
}

function yorumPrompt(satirlar) {
  const temel = butceAy(buAy()).map(b => b.kalem), vl = varliklar().map(x => ({ sembol: x.p['Sembol'], ad: x.p['Ad'] }));
  const katlar = birlesikKat().map(([k]) => katAd(k));
  return `Bir kişinin telefon notlarındaki aylık harcama planı satırlarını sınıflandır. Her satır için:
- ad: kısa, düzgün yazılmış harcama adı (Türkçe, ilk harf büyük)
- tutar: satırda yazan sayı, para birimine DOKUNMADAN (yazıyla yazılmışsa çevir: "üç yüz" = 300; "1,5 bin" = 1500); tutar yoksa null
- para: "TRY" | "USD" | "EUR" | "GBP" ya da belirtilmemişse "YOK"
- kategori: tur "ek" ise şunlardan biri: ${JSON.stringify(katlar)} (emin değilsen Diğer)
- tur: "temel" | "ek" | "satis" | "not"
  - not: harcama planı DEĞİL; sıradan not, randevu, hatırlatma (ör. "Özel ders akşam 16:30", "cuma 20:30 doktor"). Sayı saat/tarih/adet ise "not"tur.
  - temel: sadece aşağıdaki TEMEL GİDERLER listesindeki bir kalemin aynısıysa ya da açıkça eş anlamlısıysa. "eslesen" alanına listedeki adı AYNEN yaz. Satırda kişi/yer adı gibi ek bir ifade varsa (ör. "annemin kirası") temel DEĞİL, "ek" yap.
  - satis: hisse, kripto, altın gibi bir varlığı satma/bozdurma. Bilinen varlıklardan biriyse "varlik" alanına sembolünü yaz.
  - ek: tek seferlik harcama. "satın al / aldım" satış DEĞİLDİR.
TEMEL GİDERLER: ${JSON.stringify(temel)}
BİLİNEN VARLIKLAR: ${JSON.stringify(vl)}
SATIRLAR (sıra numarası 0'dan başlar): ${JSON.stringify(satirlar)}
Sadece şu JSON dizisini döndür: [{"i":0,"ad":"...","tutar":300,"para":"YOK","tur":"ek","kategori":"Diğer","eslesen":null,"varlik":null}]`;
}
