// Dudestreet — Gelir-Gider (Nébula'daki sistemin aynısı): ay ay gelir, temel giderler (✓ onay), ek giderler, birikim, rapor
import { S, $, $$, esc, num, money, fmt, today, buAy, ymOf, ymAdd, ymAdi, tarihFmt, uid, toast, sheet, onayKutusu, guard, ekle, sil, guncelle, chips, chipBagla, chipVal, tutarAlan, fmtIn, ikon, pick, kapatBtn, lsGet, lsSet, evet, girdi } from './core.js';
import { ayHesap, butceAy, butceGruplari, butceIkon, temelOnayli, onayKaydi, onayBasla, ilkAy, birlesikKat, katAd, katIkon, kalemIkon, kalemSerbest, katSilindiMi, katKayit, katBekleyen, katBekleYaz, katAnahtar, KAT_KORUMALI, EMOJI_LISTE, BUTCE_KAT, GIDER_KAT } from './hesap.js';
import { planListe, planYaz, planOku, planOnayla, bekleyenToplam, onayDegistir, butceAyYaz, giderEkle, giderSil, giderGuncelle } from './plan.js';

const app = () => $('#app');
const ic = (k, s = 16) => ikon(k, 'currentColor', s);

// ---------- kategori yardımcıları (çipler, yeni kategori, uzun basma menüsü) ----------
const katChips = (ad, liste, sec) => `<div class="cipler" data-chips="${ad}">${liste.map(([k, i]) => `<button type="button" class="cip ${k === sec ? 'on' : ''}" data-k="${esc(k)}">${i} ${esc(katAd(k))}</button>`).join('')}<button type="button" class="cip" data-k="__yeni">＋ Yeni kategori</button></div>`;
const katSecenek = sec => (sec && katSilindiMi(sec) ? '<option value="" selected disabled>❗ Kategorisiz, seç</option>' : '') + birlesikKat().map(([k, i]) => `<option value="${esc(k)}" ${k === sec ? 'selected' : ''}>${i} ${esc(katAd(k))}</option>`).join('') + '<option value="__yeni">＋ Yeni kategori…</option>';
export { katSecenek };

// Sheet'e henüz yazılmamış yeni kategorileri yazar (bir harcama/kalem kaydedilirken)
export async function katBekleyenYaz() {
  for (const r of katBekleyen()) if (!katKayit(r.kod)) await ekle('Kategori', { Kod: r.kod, Ad: r.ad || r.kod, 'İkon': r.ikon || '', Silindi: '' });
  katBekleYaz([]);
}
async function katKaydet(kod, { ad, ikon: ik, silindi = false }) {
  if (!katKayit(kod) && katBekleyen().some(r => r.kod === kod)) { katBekleYaz(silindi ? katBekleyen().filter(r => r.kod !== kod) : katBekleyen().map(r => r.kod === kod ? { ...r, ad, ikon: ik } : r)); return; }
  const item = { Kod: kod, Ad: ad, 'İkon': ik, Silindi: silindi ? '1' : '' };
  if (katKayit(kod)) await guncelle('Kategori', kod, item, 'Kod'); else await ekle('Kategori', item);
}
export function yeniKatSor(cb, iptal) {
  let sec = '🏷️', bitti = false;
  const el = sheet(`<h3>Yeni kategori</h3>
    <label class="etiket" for="ykAd">Adı</label><input id="ykAd" maxlength="24" placeholder="ör. Spor salonu" autocomplete="off">
    <label class="etiket">Simgesi</label><div class="emo-izgara">${EMOJI_LISTE.map(e => `<button type="button" data-e="${e}">${e}</button>`).join('')}</div>
    <button class="blok" id="ykOk" style="margin-top:12px">Ekle</button>`);
  $$('[data-e]', el).forEach(b => b.onclick = () => { sec = b.dataset.e; $$('[data-e]', el).forEach(x => x.classList.toggle('on', x === b)); });
  $('#ykOk', el).onclick = () => {
    const ad = $('#ykAd', el).value.trim(); if (!ad) { toast('Bir ad yaz ✍️'); return; }
    const var_ = birlesikKat().find(([k]) => katAd(k).toLocaleLowerCase('tr') === ad.toLocaleLowerCase('tr'));
    let kod, ik;
    if (var_) { [kod, ik] = var_; }
    else {
      kod = (katKayit(ad) || [...BUTCE_KAT, ...GIDER_KAT].some(x => x[0] === ad) || katBekleyen().some(r => r.kod === ad)) ? `${ad}~${Date.now().toString(36)}` : ad;
      ik = sec; katBekleYaz([...katBekleyen(), { kod, ad, ikon: ik }]);
    }
    bitti = true; el.remove(); cb(kod, ik);
  };
  new MutationObserver((_, o) => { if (!document.body.contains(el)) { o.disconnect(); if (!bitti) iptal?.(); } }).observe(document.body, { childList: true, subtree: true });
}
function katMenu(kod, sonra) {
  const korumali = KAT_KORUMALI.includes(kod);
  const el = sheet(`<h3>${esc(katIkon(kod))} ${esc(katAd(kod))}</h3>
    <button class="blok ikinci" id="kmEd">✏️ Düzenle</button>
    ${korumali ? '<p class="mini">Bu kategori silinemez, ama adını ve simgesini değiştirebilirsin.</p>' : '<button class="blok tehlike" id="kmSil">🗑️ Sil</button>'}`);
  $('#kmEd', el).onclick = () => { el.remove(); katDuzenle(kod, sonra); };
  const s = $('#kmSil', el);
  if (s) s.onclick = () => {
    el.remove();
    const n = S.giderler.filter(g => g['Kategori'] === kod).length + butceAy(buAy()).filter(b => b.kategori === kod).length;
    onayKutusu(`“${katAd(kod)}” silinsin mi?`, `${n ? `Bu kategorideki ${n} harcama kategorisiz kalır ve yanlarında ❗ görünür. ` : ''}O kalemleri ✏️ ile yeni bir kategoriye alabilirsin.`,
      () => guard(async () => { await katKaydet(kod, { ad: katAd(kod), ikon: katIkon(kod), silindi: true }); toast('Kategori silindi'); sonra?.(); }), { evetYazi: 'Evet, sil', tehlike: true });
  };
}
function katDuzenle(kod, sonra) {
  let sec = katIkon(kod);
  const el = sheet(`<h3>Kategoriyi düzenle</h3>
    <label class="etiket" for="kdzAd">Adı</label><input id="kdzAd" maxlength="24" value="${esc(katAd(kod))}" autocomplete="off">
    <label class="etiket">Simgesi</label><div class="emo-izgara">${[...new Set([sec, ...EMOJI_LISTE])].map(e => `<button type="button" data-e="${e}" class="${e === sec ? 'on' : ''}">${e}</button>`).join('')}</div>
    <button class="blok" id="kdzOk" style="margin-top:12px">Kaydet</button>`);
  $$('[data-e]', el).forEach(b => b.onclick = () => { sec = b.dataset.e; $$('[data-e]', el).forEach(x => x.classList.toggle('on', x === b)); });
  $('#kdzOk', el).onclick = () => {
    const ad = $('#kdzAd', el).value.trim(); if (!ad) { toast('Bir ad yaz ✍️'); return; }
    if (birlesikKat().some(([k]) => k !== kod && katAd(k).toLocaleLowerCase('tr') === ad.toLocaleLowerCase('tr'))) { toast('Bu adda başka bir kategori var'); return; }
    el.remove();
    guard(async () => { await katKaydet(kod, { ad, ikon: sec }); toast('Güncellendi ✏️'); sonra?.(); });
  };
}
// Çip grubu: dokun = seç, "＋ Yeni" = yeni kategori, basılı tut = düzenle/sil
export function katCipBagla(kok, ad, sonra) {
  const g = $(`[data-chips="${ad}"]`, kok); if (!g) return;
  const sec = c => { $$('.cip', g).forEach(x => x.classList.toggle('on', x === c)); };
  $$('.cip', g).forEach(c => {
    if (c.dataset.k === '__yeni') {
      c.onclick = () => yeniKatSor((kod, ik) => {
        let y = $$('.cip', g).find(x => x.dataset.k === kod);
        if (!y) { y = document.createElement('button'); y.type = 'button'; y.className = 'cip'; y.dataset.k = kod; y.textContent = `${ik} ${katAd(kod)}`; g.insertBefore(y, c); y.onclick = () => sec(y); }
        sec(y);
      });
      return;
    }
    let t = null, x0 = 0, y0 = 0, uzun = false;
    c.addEventListener('pointerdown', e => { uzun = false; x0 = e.clientX; y0 = e.clientY; clearTimeout(t); t = setTimeout(() => { uzun = true; try { navigator.vibrate?.(15); } catch { /* geç */ } katMenu(c.dataset.k, sonra); }, 480); });
    c.addEventListener('pointermove', e => { if (Math.hypot(e.clientX - x0, e.clientY - y0) > 10) clearTimeout(t); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(o => c.addEventListener(o, () => clearTimeout(t)));
    c.addEventListener('contextmenu', e => e.preventDefault());
    c.onclick = () => { if (uzun) { uzun = false; return; } sec(c); };
  });
}
const katYenile = (kok, ad) => { const g = $(`[data-chips="${ad}"]`, kok); if (!g) return; const s = chipVal(kok, ad); g.outerHTML = katChips(ad, birlesikKat(), birlesikKat().some(([k]) => k === s) ? s : ''); katCipBagla(kok, ad, () => katYenile(kok, ad)); };

// Ortak kalem düzenleyici: ad + kategori + tutar
function kalemDuzenle({ baslik, ipucu = '', ad, kategori, tutar, tutarKilit = '', kaydet }) {
  const secili = katSilindiMi(kategori) ? '' : (kategori || 'Diğer');
  const el = sheet(`<h3>${esc(baslik)}</h3>${ipucu ? `<p class="mini">${ipucu}</p>` : ''}
    <label class="etiket" for="kdAd">Adı</label><input id="kdAd" maxlength="40" value="${esc(ad)}" autocomplete="off">
    <label class="etiket">Kategori ${secili ? '' : '<span class="altin">❗ kategorisiz, bir kategori seç</span>'}</label>${katChips('kdkat', birlesikKat(), secili)}
    <label class="etiket" for="kdTutar">Tutar</label>${tutarKilit ? `<p class="mini">${esc(tutarKilit)}</p>` : tutarAlan('kdTutar', '0', fmtIn(tutar))}
    <button class="blok" id="kdOk" style="margin-top:14px">Kaydet</button>`);
  katCipBagla(el, 'kdkat', () => katYenile(el, 'kdkat'));
  $('#kdOk', el).onclick = () => {
    const yAd = $('#kdAd', el).value.trim(), yKat = chipVal(el, 'kdkat'), yTutar = tutarKilit ? num(tutar) : girdi($('#kdTutar', el).value);
    if (!yAd) return toast('Bir ad yaz ✍️');
    if (!yKat) return toast('Bir kategori seç 👆');
    if (!(yTutar > 0)) return toast('Tutar gir');
    el.remove();
    guard(async () => { await katBekleyenYaz(); await kaydet({ ad: yAd, kategori: yKat, tutar: yTutar }); renderGelirGider(); });
  };
}

// Kalem adları aynı ay içinde benzersiz olmalı (onaylar ada göre tutulur)
const adAnahtar = a => String(a || '').trim().toLocaleLowerCase('tr');
function benzersizAd(ad, kullanilan) {
  const kok = String(ad || '').trim(); if (!kok) return kok;
  let a = kok, n = 2; while (kullanilan.has(adAnahtar(a))) a = `${kok} ${n++}`;
  kullanilan.add(adAnahtar(a)); return a;
}

// ---------- Temel giderler (bütçe) penceresi ----------
export function butceSheet(ym = buAy()) {
  const ilkAdlar = new Set();
  let items = butceAy(ym).map(b => ({ ...b, eski: b.kalem, kalem: benzersizAd(b.kalem, ilkAdlar) }));   // eskiden aynı adı alan kalemler 'Ad 2' olarak ayrılır
  const grup = butceGruplari(), sonraki = Object.keys(grup).sort().find(a => a > ym);
  const kapsam = sonraki ? `${ymAdi(ym)} – ${ymAdi(ymAdd(sonraki, -1))}` : `${ymAdi(ym)} ve sonrası`;
  const el = sheet(`<div class="satir"><h3 class="bosluk">Temel giderler</h3>${kapatBtn('bKapat')}</div>
    <p class="mini">Her ay geçen ayın tutarlarıyla gelir. Burada değiştirdiğin tutarlar <b>${esc(kapsam)}</b> için geçerli, önceki aylar değişmez. Simgeye dokunarak değiştirebilirsin.</p>
    <label class="etiket" for="bMaas">Beklenen aylık maaş / gelir</label>${tutarAlan('bMaas', '0', fmtIn(S.ayar.aylik_gelir))}
    <div class="ust-etiket" style="margin-top:16px">Sabit giderler</div>
    <div id="bSatirlar"></div>
    <div class="satir" style="margin-top:8px"><select id="bYeniKat" class="bosluk">${katSecenek('Kira')}</select><button type="button" class="ikinci kucuk-btn" id="bEkle">＋ Kalem</button></div>
    <div class="satir kucuk" style="margin-top:12px"><span class="soluk">Serbest kalan</span><span class="bosluk"></span><b class="tutar" id="bSerbest"></b></div>
    <button class="blok" id="bKaydet" style="margin-top:12px">Kaydet</button>`, { genis: true });
  $('#bKapat', el).onclick = () => el.remove();
  const sync = () => {
    $$('.butce-satir', el).forEach(r => { const it = items[Number(r.dataset.i)]; it.kalem = $('[data-f=kalem]', r).value.trim(); it.tutar = girdi($('[data-f=tutar]', r).value); });
    const sv = girdi($('#bMaas', el).value) - items.reduce((t, x) => t + num(x.tutar), 0) - num(S.ayar.aylik_min);
    $('#bSerbest', el).textContent = money(sv);
    $('#bSerbest', el).className = 'tutar ' + (sv < 0 ? 'eksi' : 'artı');
  };
  const ciz = () => {
    $('#bSatirlar', el).innerHTML = items.map((it, i) => `<div class="butce-satir" data-i="${i}">
      <button type="button" class="emo-btn" data-emo="${i}" aria-label="Simge değiştir">${esc(butceIkon(it))}</button>
      <div class="bkalem"><input data-f="kalem" value="${esc(it.kalem)}" maxlength="40" placeholder="${it.kategori === 'Diğer' ? 'Ne için? (ör. spor salonu)' : esc(katAd(it.kategori))}" aria-label="Kalem adı"><span class="mini">${esc(katAd(it.kategori))}</span></div>
      <input data-f="tutar" class="b-tutar" inputmode="decimal" value="${fmtIn(it.tutar)}" placeholder="0">
      <button type="button" class="ikon-btn" data-rm="${i}" aria-label="Kaldır">${ic('carpi')}</button></div>`).join('') || '<p class="mini">Kalem yok</p>';
    $$('[data-rm]', el).forEach(b => b.onclick = () => { sync(); items.splice(Number(b.dataset.rm), 1); ciz(); });
    $$('[data-emo]', el).forEach(b => b.onclick = () => { sync(); const s = sheet(`<h3>Simge seç</h3><div class="emo-izgara">${EMOJI_LISTE.map(e => `<button type="button" data-e="${e}">${e}</button>`).join('')}</div>`); $$('[data-e]', s).forEach(x => x.onclick = () => { items[Number(b.dataset.emo)].ikon = x.dataset.e; s.remove(); ciz(); }); });
    $$('#bSatirlar input', el).forEach(i => i.oninput = sync);
    sync();
  };
  $('#bMaas', el).oninput = sync;
  const katSel = $('#bYeniKat', el);
  katSel.onchange = () => { if (katSel.value !== '__yeni') return; yeniKatSor(kod => { katSel.innerHTML = katSecenek(kod); katSel.value = kod; }, () => { katSel.value = 'Kira'; }); };
  $('#bEkle', el).onclick = () => { sync(); const k = katSel.value; if (k === '__yeni') return katSel.onchange(); const ad = k === 'Diğer' ? '' : benzersizAd(katAd(k), new Set(items.map(x => adAnahtar(x.kalem))));
    items.push({ kalem: ad, kategori: k, tutar: 0, ikon: BUTCE_KAT.some(x => x[0] === k) ? '' : katIkon(k) }); ciz();
    const r = $$('.butce-satir', el).pop(), inp = $('[data-f=kalem]', r); inp.focus(); inp.select(); };
  $('#bKaydet', el).onclick = () => guard(async () => {
    sync();
    const dolu = items.filter(x => num(x.tutar) > 0);
    if (dolu.some(x => !x.kalem)) return toast('Her kaleme bir ad yaz ✍️');
    const gorulen = new Set(), ayni = dolu.find(x => { const a = adAnahtar(x.kalem); if (gorulen.has(a)) return true; gorulen.add(a); return false; });
    if (ayni) return toast(`İki kalemin adı aynı: “${ayni.kalem}”. Birini değiştir ✏️`);
    S.busy = true; $('#bKaydet', el).disabled = true;
    try {
      await katBekleyenYaz();
      await butceAyYaz(ym, items.map(({ eski, ...x }) => x));
      // Adı değişen kalemin bu ayki onayı yeni adına taşınır
      if (ym >= onayBasla()) for (const x of dolu) if (x.eski && x.eski !== x.kalem && onayKaydi(ym, x.eski) && !dolu.some(y => y.kalem === x.eski)) { await onayDegistir(ym, x.eski, false); await onayDegistir(ym, x.kalem, true); }
      await S.db.setKV('Ayarlar', { aylik_gelir: String(girdi($('#bMaas', el).value) || '') });
      S.ayar = await S.db.kv('Ayarlar');
    } finally { S.busy = false; }
    el.remove(); toast(pick(['📋 Bütçe kaydedildi', '📋 Temel giderler güncellendi, borsa hazır'])); renderGelirGider();
  });
  ciz();
}

// ---------- Gelir-Gider sayfası ----------
export function renderGelirGider() {
  const bu = buAy(), ym = S.ggAy || bu; S.ggAy = ym;
  const h = ayHesap(ym), seg = S.ggSeg || 'gelir', ilk = ilkAy();
  const onayAktif = ym >= onayBasla(), buPlan = ym === bu ? planListe() : [];
  const temelPlan = kalem => buPlan.find(p => p.tur === 'temel' && p.ad === kalem);
  const satir = (sol, sag, cls = '') => `<div class="gg-satir ${cls}"><span>${sol}</span><span class="tutar">${sag}</span></div>`;
  const edBtn = (attr, deger) => `<button type="button" class="gg-ed" ${attr}="${esc(deger)}" aria-label="Düzenle">${ic('duzenle', 14)}</button>`;
  const okBtn = (attr, deger, acik, yazi) => `<button type="button" class="gg-ok ${acik ? 'on' : ''}" ${attr}="${esc(deger)}" aria-label="${yazi}">${ic('tik', 15)}</button>`;
  const silBtn = (attr, deger) => `<button type="button" class="gg-sil" ${attr}="${esc(deger)}" aria-label="Sil">${ic('carpi', 13)}</button>`;
  const ikonu = i => `<span class="gg-ik">${esc(i)}</span>`;
  const sabitList = h.temel.map((b, i) => {
    const ok = temelOnayli(ym, b.kalem), pl = ok ? null : temelPlan(b.kalem);
    if (!onayAktif) return satir(`${ikonu(butceIkon(b))}${esc(b.kalem)}`, `${edBtn('data-ted', i)}−${money(b.tutar)}`, 'alt');
    return `<div class="gg-satir alt ${ok ? '' : 'bek'}"><span>${ikonu(butceIkon(b))}${esc(b.kalem)}${pl && num(pl.tutar) > 0 && Math.abs(num(pl.tutar) - b.tutar) > 0.004 ? ` <span class="mini">notta ${money(pl.tutar)}</span>` : ''}</span><span class="tutar">${edBtn('data-ted', i)}−${money(pl && num(pl.tutar) > 0 ? pl.tutar : b.tutar)} ${ok ? okBtn('data-tgeri', b.kalem, true, 'Onayı geri al') : okBtn('data-tonay', b.kalem, false, 'Onayla')}</span></div>`;
  }).join('');
  const bekPlan = buPlan.filter(p => p.tur !== 'satis' && !(p.tur === 'temel' && h.temel.some(b => b.kalem === p.ad && !temelOnayli(ym, b.kalem))));
  const planIkon = p => p.tur === 'temel' ? '📋' : katIkon(p.kategori || 'Diğer');
  const planList = bekPlan.map(p => `<div class="gg-satir alt bek"><span>${ikonu(planIkon(p))}${esc(p.ad)}</span><span class="tutar">${edBtn('data-gped', p.id)}${num(p.tutar) > 0 ? '−' + money(p.tutar) : 'tutar sor'} ${okBtn('data-gplan', p.id, false, 'Onayla')}</span></div>`).join('');
  const bekToplam = bekleyenToplam(ym, h.temel), tahmin = h.kalan - bekToplam;
  const gelirList = h.gelirler.map(g => `<div class="gg-satir alt"><span>${esc(tarihFmt(g['Tarih']))} · ${esc(g['Not'] || 'Gelir')}</span><span class="tutar">+${money(num(g['Tutar']))} ${silBtn('data-gelsil', g['Kimlik'])}</span></div>`).join('');
  const giderList = h.giderler.map(g => `<div class="gg-satir alt"><span>${ikonu(kalemIkon(g))}${esc(g['Kalem'] || katAd(g['Kategori']))}${g['Not'] ? ' · ' + esc(g['Not']) : ''}${evet(g['Birikimden']) ? ' <span class="etiket-kirmizi">birikimden</span>' : ''}</span><span class="tutar">${edBtn('data-ged', g['Kimlik'])}−${money(num(g['Tutar']))} ${silBtn('data-gsil', g['Kimlik'])}</span></div>`).join('');
  const beklenen = !h.gelir && ym === bu && num(S.ayar.aylik_gelir);
  const gecmis = []; for (let m = bu, i = 0; i < 12 && m >= ilk; i++, m = ymAdd(m, -1)) gecmis.push(ayHesap(m));
  const form = seg === 'gelir' ? `
      <label class="etiket" for="ggTutar">Gelen tutar (maaş, ek gelir…)</label>${tutarAlan('ggTutar', '0', num(S.ayar.aylik_gelir) && !h.gelir ? fmtIn(S.ayar.aylik_gelir) : '')}
      <div class="iki"><div><label class="etiket" for="ggTarih">Tarih</label><input type="date" id="ggTarih" value="${ym === bu ? today() : ym + '-01'}"></div>
      <div><label class="etiket" for="ggNot">Not</label><input id="ggNot" maxlength="80" placeholder="ör. ${esc(ymAdi(ym).split(' ')[0].toLocaleLowerCase('tr'))} maaşı"></div></div>
      <button class="blok" id="ggKaydet" style="margin-top:14px">Geliri kaydet 💼</button>` : `
      <p class="mini">Temel bütçe dışında, sadece bu aya özel bir harcama.</p>
      <label class="etiket">Ne için?</label>${katChips('ggKat', birlesikKat(), 'Alışveriş')}<p class="mini" style="margin-top:6px">Kategoriyi düzenlemek ya da silmek için üzerine basılı tut.</p>
      <label class="etiket" for="ggTutar">Tutar</label>${tutarAlan('ggTutar')}
      <div class="iki"><div><label class="etiket" for="ggTarih">Tarih</label><input type="date" id="ggTarih" value="${ym === bu ? today() : ym + '-01'}"></div>
      <div><label class="etiket" for="ggNot">Açıklama</label><input id="ggNot" maxlength="80" placeholder="ör. kış montu"></div></div>
      <label class="onay"><input type="checkbox" id="ggBirikim"><span><b>Birikimden ödedim</b><br><span class="mini">İşaretlersen birikim hesabından çıkmış sayılır ve bu ayın birikiminden düşülür. Boşsa maaştan ödenmiş sayılır.</span></span></label>
      <button class="blok" id="ggKaydet" style="margin-top:14px">Ek gideri kaydet 🧾</button>`;
  app().innerHTML = `
    <div class="kart gg-ozet">
      <div class="gg-nav"><button class="ikon-btn" data-ay="-1" ${ym <= ilk ? 'disabled' : ''} aria-label="Önceki ay">${ic('geri', 18)}</button>
        <div class="ortala"><b>${esc(ymAdi(ym))}</b><div class="mini">${ym === bu ? 'bu ay' : 'geçmiş ay'}</div></div>
        <button class="ikon-btn" data-ay="1" ${ym >= bu ? 'disabled' : ''} aria-label="Sonraki ay">${ic('ileri', 18)}</button></div>
      <div class="ortala"><div class="mini">Ay sonu durumu</div><div class="buyuk-rakam ${h.kalan >= 0 ? 'artı' : 'eksi'}">${h.kalan >= 0 ? '+' : '−'}${money(Math.abs(h.kalan), 0)}</div></div>
      <div class="uclu">
        <div><span class="mini">Gelir</span><b class="artı">${money(h.gelir, 0)}</b></div>
        <div><span class="mini">Gider</span><b class="eksi">−${money(h.gider, 0)}</b></div>
        <div><span class="mini">Birikim</span><b class="vurgu">−${money(h.yatirilan, 0)}</b></div>
      </div>
      ${h.gelir ? '' : '<div class="mini ortala">bu ay için henüz gelir girilmedi</div>'}
      ${bekToplam > 0.004 ? `<div class="gg-bek-ozet mini">⏳ Onay bekleyen <b>−${money(bekToplam, 0)}</b> · hepsi onaylanırsa ay sonu <b class="${tahmin >= 0 ? 'artı' : 'eksi'}">${tahmin >= 0 ? '+' : '−'}${money(Math.abs(tahmin), 0)}</b></div>` : ''}
    </div>
    <div class="kart gg-kart">
      ${satir('💼 Gelir', '+' + money(h.gelir), 'bas')}${gelirList}
      ${beklenen ? `<div class="mini alt-bosluk">Beklenen maaş ${money(S.ayar.aylik_gelir, 0)} · aşağıdan ekle</div>` : ''}
      <div class="gg-satir bas"><span>📋 Temel giderler <button class="kucuk-btn ikinci" id="ggButce">Düzenle</button></span><span class="tutar">−${money(h.sabit)}</span></div>
      ${!h.temel.length ? '<div class="mini alt-bosluk">Kira, fatura, abonelik gibi her ay tekrar edenleri “Düzenle”den ekle.</div>' : ''}
      ${onayAktif && h.sabitBekleyen > 0.004 ? `<div class="mini alt-bosluk">✓ ile onayladıkların düşer · ⏳ ${money(h.sabitBekleyen)} onay bekliyor</div>` : ''}${sabitList}
      ${planList ? satir('⏳ Notlardan onay bekleyenler', '−' + money(bekPlan.reduce((t, p) => t + num(p.tutar), 0)), 'bas') + '<div class="mini alt-bosluk">Not defterinde hazırladığın liste. ✓ gerçek gidere çevirir, notlardan da onaylayabilirsin.</div>' + planList : ''}
      ${satir('🧾 Ek giderler', '−' + money(h.giderler.reduce((t, g) => t + num(g['Tutar']), 0)), 'bas')}${giderList || '<div class="mini alt-bosluk">Bu ay ek gider yok</div>'}
      ${satir('🎯 Hedefe birikim', '−' + money(h.yatirilan), 'bas')}${h.birikimler.map(b => satir(`${esc(tarihFmt(b['Tarih']))} · ${esc(b['Not'] || 'Birikim')}`, money(num(b['Tutar'])), 'alt')).join('')}
      ${h.harcanan ? `<div class="uyari" style="margin-top:10px">😤 Bu ay birikimden <b>${money(h.harcanan)}</b> çıkmış. Bu tutar birikim hesabından düşer.</div>` : ''}
    </div>
    <div class="kart">
      <div class="seg" style="margin-bottom:6px"><button type="button" data-gs="gelir" class="${seg === 'gelir' ? 'on' : ''}">💼 Gelir ekle</button><button type="button" data-gs="gider" class="${seg === 'gider' ? 'on' : ''}">🧾 Ek gider ekle</button></div>
      ${form}
    </div>
    ${raporKartHTML()}
    <div class="kart"><h3>Önceki aylar</h3>
      ${gecmis.map(m => `<button class="gg-gecmis ${m.ym === ym ? 'on' : ''}" data-ym="${m.ym}"><div><b>${esc(ymAdi(m.ym))}</b><div class="mini">gelir ${money(m.gelir, 0)} · gider ${money(m.gider, 0)} · birikim ${money(m.yatirilan, 0)}</div></div><div class="tutar ${m.kalan >= 0 ? 'artı' : 'eksi'}">${m.gelir ? (m.kalan >= 0 ? '+' : '−') + money(Math.abs(m.kalan), 0) : '—'}</div></button>`).join('')}
    </div>`;
  const v = app();
  $$('[data-gs]', v).forEach(b => b.onclick = () => { S.ggSeg = b.dataset.gs; renderGelirGider(); });
  $$('[data-ay]', v).forEach(b => b.onclick = () => { S.ggAy = ymAdd(ym, Number(b.dataset.ay)); renderGelirGider(); });
  $$('[data-ym]', v).forEach(b => b.onclick = () => { S.ggAy = b.dataset.ym; renderGelirGider(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
  $('#ggButce', v).onclick = () => butceSheet(ym);
  if (seg === 'gider') katCipBagla(v, 'ggKat', () => katYenile(v, 'ggKat'));
  raporBagla(v);
  $$('[data-ted]', v).forEach(b => b.onclick = () => { const i = Number(b.dataset.ted); if (h.temel[i]) temelDuzenle(ym, i); });
  $$('[data-ged]', v).forEach(b => b.onclick = () => { const g = h.giderler.find(x => x['Kimlik'] === b.dataset.ged); if (g) kalemDuzenle({ baslik: 'Harcamayı düzenle', ad: g['Kalem'] || g['Kategori'], kategori: g['Kategori'], tutar: num(g['Tutar']), tutarKilit: evet(g['Birikimden']) ? 'Birikimden ödendiği için tutar burada değişmez. Tutar yanlışsa silip yeniden ekle.' : '', kaydet: ({ ad, kategori, tutar }) => giderGuncelle(g, { Kalem: ad, Kategori: kategori, Tutar: String(tutar), 'İkon': kategori === g['Kategori'] ? g['İkon'] : katIkon(kategori) }) }); });
  $$('[data-gped]', v).forEach(b => b.onclick = () => { const p = planListe().find(x => x.id === b.dataset.gped); if (p) kalemDuzenle({ baslik: 'Planı düzenle', ad: p.ad, kategori: p.kategori || 'Diğer', tutar: p.tutar, kaydet: async ({ ad, kategori, tutar }) => { planYaz(planOku().map(x => x.id === p.id ? { ...x, ad, kategori, tutar } : x)); } }); });
  $$('[data-tonay]', v).forEach(b => b.onclick = () => { const k = b.dataset.tonay, pl = temelPlan(k); if (pl) return planOnayla(pl, renderGelirGider); b.disabled = true; b.classList.add('on'); guard(async () => { await onayDegistir(ym, k, true); renderGelirGider(); }); });
  $$('[data-tgeri]', v).forEach(b => b.onclick = () => { b.disabled = true; b.classList.remove('on'); guard(async () => { await onayDegistir(ym, b.dataset.tgeri, false); renderGelirGider(); }); });
  $$('[data-gplan]', v).forEach(b => b.onclick = () => { const p = planListe().find(x => x.id === b.dataset.gplan); if (p) planOnayla(p, renderGelirGider); });
  $$('[data-gsil]', v).forEach(b => b.onclick = () => { const g = S.giderler.find(x => x['Kimlik'] === b.dataset.gsil); if (!g) return; onayKutusu(pick(['Bu gideri silelim mi?', 'Silinsin mi?']), evet(g['Birikimden']) ? 'Birikimden ödendiği için ona bağlı birikim çıkışı da silinecek.' : '', () => guard(async () => { await giderSil(g); toast('🗑️ Silindi'); renderGelirGider(); }), { evetYazi: 'Sil', tehlike: true }); });
  $$('[data-gelsil]', v).forEach(b => b.onclick = () => onayKutusu('Bu gelir silinsin mi?', '', () => guard(async () => { await sil('Gelir', b.dataset.gelsil); toast('🗑️ Silindi'); renderGelirGider(); }), { evetYazi: 'Sil', tehlike: true }));
  $('#ggTutar', v).onkeydown = e => { if (e.key === 'Enter') $('#ggKaydet', v).click(); };
  $('#ggKaydet', v).onclick = () => guard(async () => {
    const tutar = girdi($('#ggTutar', v).value);
    if (!(tutar > 0)) return toast('Tutar gir');
    const btn = $('#ggKaydet', v); btn.disabled = true;
    const tarih = $('#ggTarih', v).value || today(), not = $('#ggNot', v).value.trim();
    if (seg === 'gelir') {
      await ekle('Gelir', { Kimlik: uid(), Tarih: tarih, Tutar: String(tutar), Not: not });
      S.ggAy = ymOf(tarih) || ym;
      toast(pick(['💼 Maaş yattı, borsa yeşil! 📈', '💼 Gelir kaydedildi. Şimdi birikimi unutma 😎', '💰 Kasa doldu, Dude mutlu.']));
      return renderGelirGider();
    }
    const kategori = chipVal(v, 'ggKat') || 'Diğer', birikimden = $('#ggBirikim', v).checked;
    const kaydet = async () => {
      await katBekleyenYaz();
      await giderEkle({ tarih, kalem: not || katAd(kategori), kategori, tutar, birikimden });
      S.ggAy = ymOf(tarih) || ym;
      toast(birikimden ? pick(['😤 Birikimden çıktı… Future Dude bunu gördü.', '📉 Kaçamak borsaya işlendi.']) : pick(['🧾 Gider kaydedildi', '🧾 Not edildi, cüzdan biraz hafifledi']));
      renderGelirGider();
    };
    if (birikimden) { btn.disabled = false; onayKutusu(pick(['Birikimden mi ödedin? 😤', 'Birikime mi dokunduk?']), `${money(tutar)} birikimden çıkmış sayılacak ve bu ayın birikiminden düşülecek.`, () => guard(kaydet), { evetYazi: 'Evet, kaydet', tehlike: true, hayirFn: () => toast('Akıllıca seçim 😎') }); }
    else await kaydet();
  });
}

// Temel giderin bu ayki tutarını düzenle (bu ay ve sonrası değişir)
function temelDuzenle(ym, idx) {
  const b = butceAy(ym)[idx]; if (!b) return;
  kalemDuzenle({ baslik: 'Kalemi düzenle', ipucu: `${esc(ymAdi(ym))} ve sonrası için değişir, önceki aylar bozulmaz.`, ad: b.kalem, kategori: b.kategori, tutar: b.tutar, kaydet: async ({ ad, kategori, tutar }) => {
    const liste = butceAy(ym);
    if (liste.some((x, i) => i !== idx && adAnahtar(x.kalem) === adAnahtar(ad))) return toast('Bu adda başka bir kalem var, farklı bir ad yaz');
    const onayliydi = temelOnayli(ym, b.kalem) && ym >= onayBasla();
    const items = liste.map((x, i) => i === idx ? { kalem: ad, kategori, tutar, ikon: kategori === x.kategori ? x.ikon : katIkon(kategori) } : x);
    await butceAyYaz(ym, items);
    if (onayliydi && ad !== b.kalem) {
      if (!items.some(x => x.kalem === b.kalem)) await onayDegistir(ym, b.kalem, false);   // aynı eski adı taşıyan başka kalem kaldıysa onu bozma
      await onayDegistir(ym, ad, true);
    }
    toast('Güncellendi ✏️');
  } });
}

// ---------- Harcama raporu ----------
function raporAralik() {
  const a = S.raporAralik || (S.raporAralik = { elle: false });
  if (!a.elle) { a.bas = ilkAy() + '-01'; a.bit = today(); }
  return a;
}
function raporHesap(bas, bit) {
  const temel = {}, ek = {};
  const tEkle = (k, kalem, tutar, ay) => {
    if (!(tutar > 0)) return;
    const c = temel[k] || (temel[k] = { ad: k, toplam: 0, kalemler: {} });
    const key = String(kalem || k).trim().toLocaleLowerCase('tr');
    const i = c.kalemler[key] || (c.kalemler[key] = { ad: String(kalem || k).trim(), toplam: 0, aylar: new Set() });
    c.toplam += tutar; i.toplam += tutar; i.aylar.add(ay);
  };
  let eBirikimden = 0;
  const eEkle = (k, kalem, tutar, tarih, birikimden) => {
    if (!(tutar > 0)) return;
    const c = ek[k] || (ek[k] = { ad: k, toplam: 0, kayitlar: [] });
    c.toplam += tutar; c.kayitlar.push({ ad: String(kalem || k).trim(), tutar, tarih });
    if (birikimden) eBirikimden += tutar;
  };
  const icinde = t => { t = String(t || '').slice(0, 10); return t >= bas && t <= bit; };
  const aylar = []; for (let m = bas.slice(0, 7); m <= bit.slice(0, 7); m = ymAdd(m, 1)) if (m + '-01' >= bas && m + '-01' <= bit) aylar.push(m);
  aylar.forEach(m => butceAy(m).filter(b => temelOnayli(m, b.kalem)).forEach(b => tEkle(katAnahtar(b.kategori), b.kalem, b.tutar, m)));
  S.giderler.filter(g => icinde(g['Tarih'])).forEach(g => eEkle(katAnahtar(g['Kategori']), g['Kalem'] || katAd(g['Kategori']), num(g['Tutar']), g['Tarih'], evet(g['Birikimden'])));
  const topla = a => a.filter(r => icinde(r['Tarih'])).reduce((t, r) => t + num(r['Tutar']), 0);
  const sirala = o => Object.values(o).sort((x, y) => y.toplam - x.toplam);
  const tListe = sirala(temel), eListe = sirala(ek);
  const tToplam = tListe.reduce((t, c) => t + c.toplam, 0), eToplam = eListe.reduce((t, c) => t + c.toplam, 0);
  const gun = Math.round((new Date(bit) - new Date(bas)) / 864e5) + 1;
  let gelirsiz = 0;
  for (let m = bas.slice(0, 7); m <= bit.slice(0, 7); m = ymAdd(m, 1)) if (!S.gelir.some(g => icinde(g['Tarih']) && ymOf(g['Tarih']) === m)) gelirsiz++;
  return { gelirsiz, eBirikimden, n: Math.max(1, aylar.length), gun, gelir: topla(S.gelir), birikim: topla(S.kayitlar.filter(r => r['Tür'] === 'Birikim')), tListe, eListe, tToplam, eToplam, gider: tToplam + eToplam };
}
function raporKartHTML() {
  const r = raporAralik();
  return `<div class="kart" id="rpKart"><h3>Harcama raporu</h3>
    <div class="iki"><div><label class="etiket" for="rpBas">Başlangıç</label><input type="date" id="rpBas" value="${esc(r.bas)}"></div>
    <div><label class="etiket" for="rpBit">Bitiş</label><input type="date" id="rpBit" value="${esc(r.bit)}"></div></div>
    <div id="rpIc"></div></div>`;
}
const KAT_RENK = ['var(--k1)', 'var(--k2)', 'var(--k3)', 'var(--k4)', 'var(--k5)', 'var(--k6)', 'var(--k7)', 'var(--k8)'];
function raporBagla(v) {
  const kart = $('#rpKart', v); if (!kart) return;
  S.raporBolum ||= { temel: false, ek: false };
  const kapali = S.raporKapali || (S.raporKapali = []);
  const ciz = () => {
    const a = raporAralik(), icx = $('#rpIc', kart);
    if (!a.bas || !a.bit || a.bas > a.bit) { icx.innerHTML = '<p class="mini">Başlangıç tarihi bitişten sonra olamaz 🗓️</p>'; return; }
    const r = raporHesap(a.bas, a.bit), cebe = r.gelir - r.tToplam - (r.eToplam - r.eBirikimden) - r.birikim;
    const tum = {};
    r.tListe.concat(r.eListe).forEach(c => { const x = tum[c.ad] || (tum[c.ad] = { ad: c.ad, toplam: 0 }); x.toplam += c.toplam; });
    const katlar = Object.values(tum).sort((x, y) => y.toplam - x.toplam);
    const renk = i => KAT_RENK[i] || 'var(--soluk)';
    const acik = katlar.filter(c => !kapali.includes(c.ad)), acikTop = acik.reduce((t, c) => t + c.toplam, 0);
    let ofs = 0;
    const dilim = acik.map(c => { const pay = c.toplam / acikTop * 100, g = acik.length > 1 ? 0.8 : 0; const html = `<circle r="15.9155" cx="21" cy="21" fill="none" style="stroke:${renk(katlar.indexOf(c))}" stroke-width="5.5" stroke-dasharray="${Math.max(0, pay - g).toFixed(2)} ${(100 - pay + g).toFixed(2)}" stroke-dashoffset="${(-ofs).toFixed(2)}" transform="rotate(-90 21 21)"/>`; ofs += pay; return html; }).join('');
    const kalemleri = ad => { const t = r.tListe.find(x => x.ad === ad), e = r.eListe.find(x => x.ad === ad); return [...(t ? Object.values(t.kalemler).map(i => ({ ad: i.ad, tutar: i.toplam, alt: i.aylar.size > 1 ? i.aylar.size + ' ay' : '' })) : []), ...(e ? e.kayitlar.map(i => ({ ad: i.ad, tutar: i.tutar, alt: tarihFmt(i.tarih) })) : [])].sort((x, y) => y.tutar - x.tutar); };
    const grafik = !katlar.length ? '<p class="mini" style="margin-top:12px">Bu aralıkta gider yok.</p>' : `
      <div class="ust-etiket" style="margin-top:14px">Nelere harcıyorum?</div>
      <div class="cipler" id="rpCip">${katlar.map((c, i) => `<button type="button" class="cip ${kapali.includes(c.ad) ? '' : 'on'}" data-kat="${esc(c.ad)}"><i class="nokta" style="background:${renk(i)}"></i>${katIkon(c.ad)} ${esc(katAd(c.ad))}</button>`).join('')}</div>
      <div class="mini"><button type="button" class="link-btn" id="rpHepsi">Hepsi</button> · <button type="button" class="link-btn" id="rpHic">Hiçbiri</button></div>
      ${acik.length ? `<div class="donut"><svg viewBox="0 0 42 42" role="img" aria-label="Harcama dağılımı"><circle r="15.9155" cx="21" cy="21" fill="none" stroke="rgba(255,255,255,.07)" stroke-width="5.5"/>${dilim}</svg>
        <div class="donut-ic"><b>${money(acikTop, 0)}</b><span class="mini">${acik.length === katlar.length ? 'toplam' : 'seçilenler'}</span></div></div>
      <div class="lejant">${acik.map(c => { const ac = S.raporKatAcik === c.ad; return `<div class="lj ${ac ? 'on' : ''}"><button type="button" class="lj-bas" data-lk="${esc(c.ad)}"><span><i class="nokta" style="background:${renk(katlar.indexOf(c))}"></i>${katIkon(c.ad)} ${esc(katAd(c.ad))}</span><span class="tutar">%${Math.round(c.toplam / acikTop * 100)} · ${money(c.toplam, 0)}</span></button>
        ${ac ? `<div class="lj-alt">${kalemleri(c.ad).map(i => `<div class="satir kucuk"><span class="bosluk">${esc(i.ad)}${i.alt ? ` <span class="mini">· ${esc(i.alt)}</span>` : ''}</span><b class="tutar">${money(i.tutar, 0)}</b></div>`).join('')}</div>` : ''}</div>`; }).join('')}</div>` : '<p class="mini">Yukarıdan bir kategori seç 👆</p>'}
      <p class="mini">Onay bekleyen (sarı) giderler dahil değil. Çipe dokunarak kategoriyi grafiğe katıp çıkarabilirsin; örneğin Kira'yı kapatınca "kira hariç" görürsün.</p>`;
    const bolum = (k, baslik, ipucu, toplam, liste, satirFn, bosMetin) => `
      <button type="button" class="rp-ac ${S.raporBolum[k] ? 'on' : ''}" data-b="${k}"><span>${baslik} <span class="mini">· ${money(toplam, 0)}</span></span>${ic('asagi', 16)}</button>
      ${S.raporBolum[k] ? `<div class="rp-liste"><p class="mini">${ipucu}</p>${liste.map(satirFn).join('') || `<p class="mini">${bosMetin}</p>`}</div>` : ''}`;
    const tavan = l => l[0] ? l[0].toplam : 1;
    const tSatir = c => `<div class="rp-kat"><div class="satir"><span class="bosluk">${katIkon(c.ad)} ${esc(katAd(c.ad))}</span><b class="tutar">${money(c.toplam, 0)}</b></div><div class="cubuk ince"><div style="width:${(c.toplam / tavan(r.tListe) * 100).toFixed(1)}%"></div></div><div class="mini">%${r.tToplam ? Math.round(c.toplam / r.tToplam * 100) : 0} · ayda ort. ${money(c.toplam / r.n, 0)} · yılda ${money(c.toplam / r.n * 12, 0)}</div></div>`;
    const eSatir = c => `<div class="rp-kat"><div class="satir"><span class="bosluk">${katIkon(c.ad)} ${esc(katAd(c.ad))}</span><b class="tutar">${money(c.toplam, 0)}</b></div><div class="cubuk ince ek"><div style="width:${(c.toplam / tavan(r.eListe) * 100).toFixed(1)}%"></div></div><div class="mini">%${r.eToplam ? Math.round(c.toplam / r.eToplam * 100) : 0} · ${c.kayitlar.length} kayıt</div></div>`;
    icx.innerHTML = `
      <div class="uclu" style="margin-top:12px">
        <div><span class="mini">Gelir</span><b class="artı">${money(r.gelir, 0)}</b></div>
        <div><span class="mini">Gider</span><b class="eksi">−${money(r.gider, 0)}</b></div>
        <div><span class="mini">Birikim</span><b class="vurgu">−${money(r.birikim, 0)}</b></div>
      </div>
      ${grafik}
      <p class="mini">${r.gun} gün · ${r.n} aylık temel gider sayıldı</p>
      ${bolum('temel', 'Temel giderler', 'Her ay tekrar eden kalemler. Ayda ortalama ve yıllık karşılığı bunlar için anlamlı.', r.tToplam, r.tListe, tSatir, 'Bu aralıkta temel gider sayılmadı.')}
      ${bolum('ek', 'Ek giderler', 'Tek seferlik harcamalar; aylık ortalama ya da yıllık tahmin yazmıyorum.', r.eToplam, r.eListe, eSatir, 'Bu aralıkta ek gider kaydı yok.')}
      <div class="rp-cep ${cebe >= 0 ? 'arti' : 'eksi'}">
        <div class="satir"><span class="bosluk">💰 Cebine kalan</span><b class="tutar ${cebe >= 0 ? 'artı' : 'eksi'}">${cebe >= 0 ? '+' : '−'}${money(Math.abs(cebe), 0)}</b></div>
        <div class="mini">ayda ortalama <b>${cebe >= 0 ? '+' : '−'}${money(Math.abs(cebe / r.n), 0)}</b> · gelir − gider − birikim${r.eBirikimden ? ` · birikimden ödenen ${money(r.eBirikimden, 0)} hariç` : ''}</div>
        ${r.gelirsiz ? `<div class="mini altin">⚠️ ${r.gelirsiz} ayda gelir girilmemiş, ortalama olduğundan düşük çıkabilir.</div>` : ''}
      </div>`;
    $$('#rpCip .cip', icx).forEach(c => c.onclick = () => { const k = c.dataset.kat, i = kapali.indexOf(k); if (i >= 0) kapali.splice(i, 1); else kapali.push(k); ciz(); });
    $$('[data-lk]', icx).forEach(l => l.onclick = () => { S.raporKatAcik = S.raporKatAcik === l.dataset.lk ? null : l.dataset.lk; ciz(); });
    const hepsi = $('#rpHepsi', icx), hic = $('#rpHic', icx);
    if (hepsi) hepsi.onclick = () => { kapali.length = 0; ciz(); };
    if (hic) hic.onclick = () => { kapali.length = 0; katlar.forEach(c => kapali.push(c.ad)); ciz(); };
    $$('.rp-ac', icx).forEach(b => b.onclick = () => { S.raporBolum[b.dataset.b] = !S.raporBolum[b.dataset.b]; ciz(); });
  };
  const oku = () => { const a = raporAralik(); a.elle = true; a.bas = $('#rpBas', kart).value; a.bit = $('#rpBit', kart).value; ciz(); };
  $('#rpBas', kart).onchange = oku; $('#rpBit', kart).onchange = oku;
  ciz();
}
