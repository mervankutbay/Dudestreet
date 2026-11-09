// Dudestreet — Hedef: aylık birikim hedefi, birikim hesabı (yatır/çek), hedefe bağlı varlıklar
import { S, $, $$, esc, num, money, fmt, today, buAy, ymOf, uid, toast, sheet, onayKutusu, guard, ekle, sil, ikon, pick, tutarAlan, fmtIn, kapatBtn, tarihFmt, ayKisa, girdi } from './core.js';
import { hedefHesap, varliklar, SAYILAN, NAKIT } from './hesap.js';
import { buildPersona } from './persona.js';
import { varlikDetay } from './varliklar.js';

const ic = (k, s = 18) => ikon(k, 'currentColor', s);
export const HEDEFLER = [['ev', 'Ev'], ['araba', 'Araba'], ['ucak', 'Seyahat'], ['yuzuk', 'Düğün'], ['kitap', 'Eğitim'], ['hedef', 'Başka']];

// Hedef formu: kurulumda sayfa olarak, sonra pencere olarak açılır
export function hedefFormHTML(ust = '') {
  const a = S.ayar, tur = a.hedef_tur || 'ev', para = a.para_birimi || '₺';
  return `${ust}
    <div class="hedef-izgara" id="hTur">${HEDEFLER.map(([k, t]) => `<button type="button" data-k="${k}" class="${k === tur ? 'on' : ''}">${ikon(k, 'currentColor', 24)}${t}</button>`).join('')}</div>
    <div id="ozelKutu" class="${tur === 'hedef' ? '' : 'hidden'}"><label class="etiket" for="hOzel">Hedefin ne?</label><input id="hOzel" value="${esc(tur === 'hedef' ? a.hedef_ne || '' : '')}" placeholder="ör. Kendi işimi kurmak"></div>
    <div><span class="etiket">Para birimi</span><div class="seg" id="hPara">${['₺', '€', '$', '£'].map(p => `<button type="button" data-p="${p}" class="${p === para ? 'on' : ''}">${p} ${{ '₺': 'TL', '€': 'Euro', '$': 'Dolar', '£': 'Sterlin' }[p]}</button>`).join('')}</div></div>
    <div><label class="etiket" for="hTutar">Hedef tutar</label><div class="alan-ek"><input id="hTutar" inputmode="decimal" value="${esc(fmtIn(a.hedef_tutar))}" placeholder="ör. 1.500.000"><span class="pbe">${para}</span></div></div>
    <div class="iki">
      <div><label class="etiket" for="hMin">Her ay en az</label><div class="alan-ek"><input id="hMin" inputmode="decimal" value="${esc(fmtIn(a.aylik_min))}" placeholder="ör. 10.000"><span class="pbe">${para}</span></div></div>
      <div><label class="etiket" for="hTarih">Hedef tarih</label><input id="hTarih" type="month" value="${esc(a.hedef_tarih || '')}"></div>
    </div>`;
}
export function hedefFormBagla(kok, { bitti, zorunlu = false }) {
  let tur = S.ayar.hedef_tur || 'ev', para = S.ayar.para_birimi || '₺';
  $$('#hTur button', kok).forEach(b => b.onclick = () => { tur = b.dataset.k; $$('#hTur button', kok).forEach(x => x.classList.toggle('on', x === b)); $('#ozelKutu', kok).classList.toggle('hidden', tur !== 'hedef'); });
  $$('#hPara button', kok).forEach(b => b.onclick = () => { para = b.dataset.p; $$('#hPara button', kok).forEach(x => x.classList.toggle('on', x === b)); $$('.pbe', kok).forEach(s => (s.textContent = para)); });
  return async () => {
    const ne = tur === 'hedef' ? $('#hOzel', kok).value.trim() : HEDEFLER.find(h => h[0] === tur)[1];
    if (!ne) return toast('Hedefini bir kelimeyle yaz');
    const tutar = girdi($('#hTutar', kok).value);
    if (!tutar && zorunlu) return toast('Hedef tutarı gir (sonra değiştirebilirsin)');
    const paraDegisti = para !== (S.ayar.para_birimi || '₺');
    await S.db.setKV('Ayarlar', { hedef_ne: ne, hedef_tur: tur, hedef_tutar: String(tutar || ''), aylik_min: String(girdi($('#hMin', kok).value) || ''), para_birimi: para, hedef_tarih: $('#hTarih', kok).value || '' });
    S.ayar = await S.db.kv('Ayarlar');
    if (S.persona.cevapObj && S.persona.kaynak === 'anket') { const prompt = buildPersona({ ...S.persona.cevapObj, ...S.ayar }); await S.db.setKV('Persona', { prompt }); S.persona.prompt = prompt; }
    if (paraDegisti) S.fiyat = { para: '', fiyatlar: {}, zaman: null, hata: null };
    bitti?.(paraDegisti);
  };
}
export function hedefDuzenle() {
  const el = sheet(`<div class="satir"><h3 class="bosluk">🎯 Hedefin</h3>${kapatBtn()}</div>${hedefFormHTML()}<button class="blok" id="hKaydet" style="margin-top:14px">Kaydet</button>`, { genis: true });
  $('#kapat', el).onclick = () => el.remove();
  const kaydet = hedefFormBagla(el, { bitti: degisti => { el.remove(); toast('🎯 Hedef güncellendi'); S.go(S.view); if (degisti) S.fiyatYenile?.(); } });
  $('#hKaydet', el).onclick = () => guard(async () => { $('#hKaydet', el).disabled = true; try { await kaydet(); } finally { if ($('#hKaydet', el)) $('#hKaydet', el).disabled = false; } });
}

// ---------- Hedef sekmesi ----------
export function renderHedef() {
  const c = hedefHesap();
  if (!c.var) {
    $('#app').innerHTML = `<div class="kart ortala" style="padding:28px 18px"><div style="font-size:44px">🎯</div><h2>Bir hedef koy</h2><p class="soluk">Ev, araba, seyahat… Aylık birikim hedefini belirle; birikim hesabını burada tut, varlıklarından istediklerini hedefe say. Future Dude da seni buna göre takip etsin.</p><button class="blok buyuk" id="hKoy">Hedef koy</button></div>`;
    $('#hKoy').onclick = hedefDuzenle;
    return;
  }
  const kayitlar = c.k.filter(r => NAKIT[r.tur]).slice(-8).reverse();
  const bagli = c.v;
  app().innerHTML = `
    <div class="kart">
      <div class="satir"><span class="ust-etiket">${esc(S.ayar.hedef_ne)}</span><span class="bosluk"></span><button class="ikinci kucuk-btn" id="hDuz">${ic('duzenle', 14)} Düzenle</button></div>
      <div class="buyuk-rakam">${money(c.toplam)}</div>
      ${c.hedef ? `<div class="cubuk" role="progressbar" aria-valuenow="${Math.round(c.ilerleme * 100)}" aria-valuemin="0" aria-valuemax="100"><div style="width:${(c.ilerleme * 100).toFixed(1)}%"></div></div>
      <div class="satir mini"><span>%${fmt(c.ilerleme * 100, 1)} tamam</span><span class="bosluk"></span><span>Hedef ${money(c.hedef)} · kalan ${money(c.kalan)}</span></div>` : '<p class="mini">Hedef tutarı girersen ilerlemeni gösteririm.</p>'}
      ${c.bagli ? `<div class="satir mini"><span>💰 Birikim hesabı ${money(c.nakit)}</span><span class="bosluk"></span><span>🎯 Bağlı varlıklar ${money(c.bagli)}</span></div>` : ''}
      <div class="istatistik">
        <div><span class="mini">Bu ay biriken</span><b class="${c.durum === 'Hedefte' ? 'artı' : c.durum === '-' ? '' : 'eksi'}">${c.buAy >= 0 ? '' : '−'}${money(Math.abs(c.buAy))}</b><span class="mini">${c.min ? (c.buAy >= c.min ? 'Aylık hedefte ✅' : `${money(c.min - c.buAy)} daha`) : 'Aylık hedef koymadın'}</span></div>
        <div><span class="mini">Tahmini varış</span><b>${esc(c.varis || '–')}</b><span class="mini">${c.gereken !== null ? `Tarihe yetişmek için ayda ${money(c.gereken)}` : c.ort ? `Ortalama ayda ${money(c.ort)}` : 'Kayıt girdikçe hesaplanır'}</span></div>
      </div>
    </div>
    <div class="kart">
      <h3>Birikim hesabı</h3>
      <div class="seg" id="kTur"><button class="on" data-t="Birikim">💰 Birikim yatır</button><button data-t="Harcama">💸 Birikimden çek</button></div>
      <div class="iki"><div>${tutarAlan('kTutar', 'Tutar')}</div><input id="kTarih" type="date" value="${today()}" aria-label="Tarih"></div>
      <input id="kNot" placeholder="Not (isteğe bağlı)" aria-label="Not">
      <button class="blok" id="kEkle">Ekle</button>
      <p class="mini">Yatırdıkların Gelir-Gider’de “Hedefe birikim” olarak da görünür. Çektiklerin kural ihlali sayılır ve o ayın birikiminden düşer.</p>
    </div>
    ${Object.keys(c.aylar).length ? `<div class="kart grafik"><div class="satir"><h3 class="bosluk">Aylık birikim</h3>${c.min ? `<span class="mini"><b class="altin">┄</b> en az ${money(c.min)}</span>` : ''}</div>${aylikGrafik(c)}</div>` : ''}
    <div class="kart">
      <div class="satir"><h3 class="bosluk">🎯 Hedefe bağlı varlıklar</h3><b class="tutar">${money(c.bagli)}</b></div>
      ${bagli.length ? `<ul class="liste">${bagli.map(x => `<li class="tikla" data-v="${esc(x.p['Kimlik'])}"><span class="varlik-ik">${x.b.ikon}</span><span class="bosluk"><b>${esc(x.p['Ad'] || x.p['Sembol'])}</b><div class="mini">${esc(x.p['Tür'])}</div></span><span class="tutar">${money(x.deger)}</span></li>`).join('')}</ul>` : '<p class="mini">Henüz yok. Varlıklar sekmesinde bir varlığa dokunup “🎯 Hedefime say”ı işaretle; örneğin altınların ya da bir yatırım fonun.</p>'}
      ${varliklar().some(x => !x.hedefte) ? '<button class="blok ikinci" id="hBagla">Varlık bağla</button>' : ''}
    </div>
    <div class="kart">
      <h3>Hesap hareketleri</h3>
      ${kayitlar.length ? `<ul class="liste">${kayitlar.map(r => { const art = NAKIT[r.tur] > 0, ik = { 'Birikim': '💰', 'Harcama': '💸', 'Varlık alımı': '🛒', 'Varlık satışı': '🏷️' }[r.tur]; return `<li><span class="kayit-ik">${ik}</span><span class="bosluk"><div class="kes">${esc(r['Not'] || r['Kategori'] || r.tur)}</div><div class="mini">${tarihFmt(r['Tarih'])} · ${esc(r.tur)}</div></span><span class="tutar ${r.tur === 'Birikim' ? 'artı' : r.tur === 'Harcama' ? 'eksi' : 'soluk'}">${art ? '+' : '−'}${money(r.tutar)}</span>${SAYILAN[r.tur] && !r['Bağ'] ? `<button class="ikon-btn" data-ksil="${esc(r['Kimlik'])}" aria-label="Kaydı sil">${ic('cop', 15)}</button>` : ''}</li>`; }).join('')}</ul>` : '<p class="mini">İlk birikimini ekle, borsa açılsın 🔔</p>'}
    </div>`;
  let tur = 'Birikim';
  $$('#kTur button').forEach(b => b.onclick = () => { tur = b.dataset.t; $$('#kTur button').forEach(x => x.classList.toggle('on', x === b)); });
  $('#hDuz').onclick = hedefDuzenle;
  $$('[data-v]').forEach(li => li.onclick = () => varlikDetay(li.dataset.v));
  if ($('#hBagla')) $('#hBagla').onclick = () => {
    const l = varliklar().filter(x => !x.hedefte);
    const el = sheet(`<div class="satir"><h3 class="bosluk">Hedefe varlık bağla</h3>${kapatBtn()}</div><ul class="liste">${l.map(x => `<li class="tikla" data-b="${esc(x.p['Kimlik'])}"><span class="varlik-ik">${x.b.ikon}</span><span class="bosluk"><b>${esc(x.p['Ad'] || x.p['Sembol'])}</b><div class="mini">${esc(x.p['Tür'])}</div></span><span class="tutar">${money(x.deger)}</span></li>`).join('')}</ul>`);
    $('#kapat', el).onclick = () => el.remove();
    $$('[data-b]', el).forEach(li => li.onclick = () => guard(async () => { const { guncelle } = await import('./core.js'); await guncelle('Portföy', li.dataset.b, { Hedef: 'evet' }); el.remove(); toast('🎯 Hedefine eklendi'); renderHedef(); }));
  };
  $$('[data-ksil]').forEach(b => b.onclick = () => onayKutusu('Kaydı sil?', 'Tablondan da silinir.', () => guard(async () => { await sil('Kayıtlar', b.dataset.ksil); toast('🗑️ Silindi'); renderHedef(); }), { evetYazi: 'Sil', tehlike: true }));
  $('#kTutar').onkeydown = e => { if (e.key === 'Enter') $('#kEkle').click(); };
  $('#kEkle').onclick = () => guard(async () => {
    const tutar = girdi($('#kTutar').value);
    if (tutar <= 0) return toast('Tutar gir');
    const kaydet = async () => {
      $('#kEkle').disabled = true;
      await ekle('Kayıtlar', { Kimlik: uid(), Tarih: $('#kTarih').value || today(), 'Tür': tur, Tutar: String(tutar), Kategori: tur === 'Birikim' ? 'Birikim' : 'Birikimden çekiş', Not: $('#kNot').value.trim() });
      toast(tur === 'Harcama' ? pick(['😤 Kaydedildi… Future Dude bunu gördü.', '📉 Kaçamak borsaya işlendi.']) : pick(['📈 Kaydedildi! Hisseler yükselişte.', '💰 Helal! Borsa yeşil yanıyor.', '🔔 Zil çaldı, birikim eklendi.']));
      renderHedef(); S.bant?.();
    };
    if (tur === 'Harcama') onayKutusu(pick(['Birikimden mi çekiyorsun? 😤', 'Birikime mi dokunuyoruz?']), `${money(tutar)} bu ayın birikiminden düşülecek.`, () => guard(kaydet), { evetYazi: 'Evet, çek', tehlike: true });
    else await kaydet();
  });
}
const app = () => $('#app');

function aylikGrafik(c) {
  const d = new Date(), aylar = [];
  for (let i = 5; i >= 0; i--) { const t = new Date(d.getFullYear(), d.getMonth() - i, 1); aylar.push(`${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`); }
  const deg = aylar.map(a => c.aylar[a] || 0);
  const W = 340, H = 150, ust = 14, alt = 24, sol = 6;
  const maks = Math.max(1, c.min, ...deg.map(Math.abs)), minDeg = Math.min(0, ...deg);
  const olcek = (H - ust - alt) / (maks - minDeg || 1), sifir = ust + maks * olcek, bw = (W - sol * 2) / aylar.length;
  const bars = aylar.map((a, i) => {
    const v = deg[i], h = Math.abs(v) * olcek, x = sol + i * bw + bw * 0.2, y = v >= 0 ? sifir - h : sifir;
    const renk = v < 0 ? 'var(--eksi)' : c.min && v < c.min ? 'var(--altin)' : 'var(--vurgu)';
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(bw * 0.6).toFixed(1)}" height="${Math.max(1.5, h).toFixed(1)}" rx="5" style="fill:${renk}" opacity="${a === buAy() ? 1 : 0.85}"><title>${ayKisa(a)}: ${money(v)}</title></rect><text x="${(x + bw * 0.3).toFixed(1)}" y="${H - 7}" text-anchor="middle" font-size="11" class="eksen">${ayKisa(a)}</text>`;
  }).join('');
  const minC = c.min ? `<line x1="${sol}" x2="${W - sol}" y1="${(sifir - c.min * olcek).toFixed(1)}" y2="${(sifir - c.min * olcek).toFixed(1)}" style="stroke:var(--altin)" stroke-dasharray="4 4" stroke-width="1.2" opacity=".8"/>` : '';
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Son 6 ayın birikimi"><line x1="${sol}" x2="${W - sol}" y1="${sifir.toFixed(1)}" y2="${sifir.toFixed(1)}" stroke="rgba(255,255,255,.12)"/>${bars}${minC}</svg>`;
}
export { ymOf };
