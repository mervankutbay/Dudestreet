// Dudestreet — Varlıklar: hisse, kripto, altın, döviz, nakit, ev, arsa, araba, MBKAYO payı…
import { S, $, $$, esc, num, gunluk, money, moneyHam, gosterSimge, fmt, fiyatFmt, yuzde, today, uid, toast, sheet, onayKutusu, guard, ekle, tazele, ikon, pick, tutarAlan, fmtIn, kapatBtn, paraKod, pb, evet, tarihFmt, girdi } from './core.js';
import { VARLIK_TURLERI, turBilgi, canliMi, varliklar, malVarligi, ARTIS_KAYNAK, GRUP_RENK, fiyatAnahtar, buyumeli } from './hesap.js';

const ic = (k, s = 18) => ikon(k, 'currentColor', s);
export const kisaSembol = p => (p['Tür'] === 'Altın (gram)' ? 'ALTIN' : p['Tür'] === 'Gümüş (gram)' ? 'GÜMÜŞ' : p['Tür'] === 'MBKAYO payı' ? 'MBK' : String(p['Sembol'] || '').replace(/\.IS$/, '').replace(/-USD$/, '').toUpperCase());
const rozetIc = p => { const b = turBilgi(p['Tür']); return b.canli && !['MBKAYO payı'].includes(p['Tür']) ? esc(kisaSembol(p).slice(0, 5)) : b.ikon; };

// ---------- Fiyatlar ----------
export async function fiyatlariGetir(sessiz = true) {
  const liste = S.portfoy.filter(p => canliMi(p) && p['Tür'] !== 'MBKAYO payı').map(p => ({ tur: p['Tür'], sembol: p['Sembol'] }));
  // Notlardaki dövizli tutarlar için kurlar da birlikte gelir
  ['USD', 'EUR', 'GBP'].forEach(s => liste.push({ tur: 'Döviz', sembol: s }));
  const isler = [fetch('/api/fiyatlar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ liste, para: paraKod() }) }).then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.hata || 'Fiyatlar alınamadı'); return j; })];
  const mbk = S.portfoy.some(p => p['Tür'] === 'MBKAYO payı');
  if (mbk) isler.push(fetch('/api/mbkayo?para=' + paraKod()).then(r => r.json()).catch(e => ({ hata: e.message })));
  try {
    const [j, m] = await Promise.all(isler);
    S.fiyat = { ...j, hata: null };
    ['USD', 'EUR', 'GBP'].forEach(s => { const f = j.fiyatlar?.[`Döviz|${s}`]; if (f && !f.hata) S.kurlar[s] = f.fiyat; });
    S.kurlar[paraKod()] = 1;
    if (mbk) S.mbkayo = m;
  } catch (e) {
    S.fiyat.hata = e.message;
    if (!sessiz) toast('⚠️ ' + esc(e.message));
  }
  S.fiyatGeldi?.();
}

// ---------- Varlıklar sayfası ----------
export function renderVarliklar() {
  const mv = malVarligi(), v = mv.v.slice().sort((a, b) => b.deger - a.deger);
  const yatirim = v.filter(x => x.grup === 'Yatırım'), alis = yatirim.reduce((s, x) => s + x.alis, 0), deger = yatirim.reduce((s, x) => s + x.deger, 0), kar = deger - alis;
  const zaman = S.fiyat.zaman ? new Date(S.fiyat.zaman).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : null;
  const gruplar = ['Yatırım', 'Nakit', 'Gayrimenkul', 'Araç', 'Diğer'];
  const grupBaslik = { 'Yatırım': '📈 Yatırımlar', 'Nakit': '🏦 Nakit ve banka', 'Gayrimenkul': '🏠 Gayrimenkul', 'Araç': '🚗 Araçlar', 'Diğer': '📦 Diğer' };
  const satir = x => `<li data-varlik="${esc(x.p['Kimlik'])}" class="tikla">
      <span class="varlik-ik">${rozetIc(x.p)}</span>
      <span class="bosluk"><b>${esc(x.p['Ad'] || x.p['Sembol'])}</b>${x.hedefte ? ' <span class="rozet vurgu-rozet">🎯 hedefte</span>' : ''}<div class="mini">${x.canli && x.p['Tür'] !== 'MBKAYO payı' ? `${fmt(x.adet, x.adet % 1 ? 4 : 0)} × ${fiyatFmt(x.fiyat)} ${gosterSimge()}` : x.p['Tür'] === 'MBKAYO payı' ? (x.canli ? 'canlı · toplam bakiye ÷ 6' : x.hata ? 'bakiye alınamadı' : 'bakiye geliyor…') : x.tahmini ? `tahmini · yıllık %${fmt(x.oran, 1)} artış` : esc(x.p['Tür'])}${!x.canli && canliMi(x.p) && x.p['Tür'] !== 'MBKAYO payı' ? ` <span class="rozet">${x.hata ? 'fiyat yok' : '…'}</span>` : ''}</div></span>
      <span class="sag"><div class="tutar">${money(x.deger)}</div><div class="mini ${x.canli ? (x.gunluk >= 0 ? 'artı' : 'eksi') : x.kar >= 0 ? 'artı' : 'eksi'}">${x.canli && x.p['Tür'] !== 'MBKAYO payı' ? `${yuzde(x.gunluk, 2)} bugün` : x.alis && Math.abs(x.kar) > 0.5 ? `${x.kar >= 0 ? '+' : '−'}${money(Math.abs(x.kar))}` : ''}</div></span>
    </li>`;
  $('#app').innerHTML = `
    <div class="kart">
      <div class="satir"><span class="ust-etiket">Varlıkların</span><span class="bosluk"></span><button class="ikon-btn" id="yenile" aria-label="Fiyatları yenile" title="Fiyatları yenile">${ic('yenile', 18)}</button></div>
      <div class="buyuk-rakam">${money(mv.varlik)}</div>
      ${yatirim.length ? `<div class="satir kucuk"><span class="${kar >= 0 ? 'artı' : 'eksi'}">Yatırım ${kar >= 0 ? '+' : '−'}${money(Math.abs(kar))} (${yuzde(alis ? kar / alis * 100 : 0)})</span><span class="bosluk"></span><span class="${mv.gunluk >= 0 ? 'artı' : 'eksi'}">${mv.gunluk >= 0 ? '+' : '−'}${money(Math.abs(mv.gunluk))} bugün</span></div>` : ''}
      <div class="mini">${S.fiyat.hata ? `⚠️ Canlı fiyat alınamadı: ${esc(S.fiyat.hata)}` : zaman ? `Fiyatlar ${zaman} itibarıyla · ${gosterSimge()} cinsinden · birikim hesabın Hedef sekmesinde` : v.length ? 'Fiyatlar yükleniyor…' : 'Hisseden eve, kriptodan arabaya her şeyini ekle; hepsi tek yerde toplansın.'}</div>
    </div>
    <button class="blok buyuk" id="varlikEkle">${ic('arti', 20)} Varlık ekle</button>
    ${gruplar.map(g => { const l = v.filter(x => x.grup === g); return l.length ? `<div class="kart"><div class="satir"><h3 class="bosluk">${grupBaslik[g]}</h3><b class="tutar">${money(l.reduce((s, x) => s + x.deger, 0))}</b></div><ul class="liste">${l.map(satir).join('')}</ul></div>` : ''; }).join('')}
    <p class="mini ortala">Borsa/kripto fiyatları Yahoo Finance’tan, birkaç dakika gecikmeli olabilir. Ev, arsa ve araba değerleri tahminidir. Yatırım tavsiyesi değildir.</p>`;
  $('#yenile').onclick = () => { $('#yenile').disabled = true; fiyatlariGetir(false); };
  $('#varlikEkle').onclick = () => varlikEkle();
  $$('[data-varlik]').forEach(li => li.onclick = () => varlikDetay(li.dataset.varlik));
}

// ---------- Varlık ekleme ----------
export function varlikEkle(baslangicTur = 'Hisse') {
  let secim = null, tur = baslangicTur;
  const el = sheet(`<div class="satir"><h3 class="bosluk">Varlık ekle</h3>${kapatBtn()}</div>
    <div class="cipler" id="vTur">${VARLIK_TURLERI.map(t => `<button type="button" class="cip ${t.tur === tur ? 'on' : ''}" data-t="${esc(t.tur)}">${t.ikon} ${esc(t.tur)}</button>`).join('')}</div>
    <div id="vIc"></div>`, { genis: true });
  $('#kapat', el).onclick = () => el.remove();
  const ic2 = $('#vIc', el);

  const canliForm = () => {
    const gram = tur.includes('gram'), mbk = tur === 'MBKAYO payı';
    ic2.innerHTML = `
      ${!gram && !mbk && !secim ? `<input id="vAra" placeholder="${{ Hisse: 'Ara: THYAO, Aselsan, Apple…', Kripto: 'Ara: Bitcoin, ETH, Solana…', 'Fon / ETF': 'Ara: S&P 500, QQQ, altın fonu…' }[tur] || 'Ara'}" autocomplete="off" aria-label="Varlık ara"><div class="arama-sonuc" id="vSonuc"></div>` : ''}
      ${secim || gram || mbk ? `<div class="kart vurgu satir" style="margin-top:12px"><span class="varlik-ik">${mbk ? '🐺' : esc(kisaSembol({ 'Tür': tur, 'Sembol': secim?.sembol || '' }).slice(0, 5))}</span><span class="bosluk"><b>${esc(mbk ? 'MBKAYO bireysel bakiye' : secim.ad)}</b><div class="mini">${mbk ? 'Fonun canlı toplam bakiyesi ÷ 6' : esc(secim.sembol) + (secim.borsa ? ' · ' + esc(secim.borsa) : '')}</div><div class="mini" id="vCanli">Güncel değer getiriliyor…</div></span>${!gram && !mbk ? `<button class="ikon-btn" id="vDegis" aria-label="Değiştir">${ic('carpi', 16)}</button>` : ''}</div>
      ${mbk ? '' : `<div class="iki"><div><label class="etiket" for="vAdet">${gram ? 'Kaç gram?' : 'Adet / miktar'}</label><input id="vAdet" inputmode="decimal" placeholder="${gram ? 'ör. 10' : tur === 'Kripto' ? 'ör. 0,015' : 'ör. 10'}"></div>
        <div><label class="etiket" for="vMaliyet">${gram ? 'Gram alış fiyatı' : 'Birim alış fiyatı'}</label>${tutarAlan('vMaliyet')}</div></div>`}
      ${mbk ? `<label class="etiket" for="vMaliyet">Bugüne kadar fona koyduğun para (isteğe bağlı)</label>${tutarAlan('vMaliyet', 'ör. 36.000')}<p class="mini">Kâr/zararı görmek için. Boş bırakabilirsin.</p>` : ''}
      <label class="etiket" for="vTarih">Alış tarihi</label><input id="vTarih" type="date" value="${today()}">
      ${mbk ? '' : '<label class="onay"><input type="checkbox" id="vDus"><span>Parasını birikim hesabımdan düş<br><span class="mini">Birikimle aldıysan işaretle; kural ihlali sayılmaz, para portföyde durmaya devam eder.</span></span></label>'}
      <button class="blok buyuk" id="vKaydet" style="margin-top:14px">Ekle</button>` : ''}`;
    if ($('#vDegis', el)) $('#vDegis', el).onclick = () => { secim = null; canliForm(); $('#vAra', el)?.focus(); };
    if (mbk) {
      fetch('/api/mbkayo?para=' + paraKod()).then(r => r.json()).then(j => { if (!$('#vCanli', el)) return; $('#vCanli', el).innerHTML = j.hata ? '⚠️ ' + esc(j.hata) : `Şu an <b>${moneyHam(j.kisiBasi, 0)}</b> · fon toplamı ${moneyHam(j.toplam, 0)}`; }).catch(() => { if ($('#vCanli', el)) $('#vCanli', el).textContent = 'Bakiye alınamadı, sonra yenilenir.'; });
    } else if (secim) {
      fetch('/api/fiyatlar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ liste: [{ tur, sembol: secim.sembol }], para: paraKod() }) })
        .then(r => r.json()).then(j => {
          const f = j.fiyatlar?.[`${tur}|${secim.sembol}`]; if (!$('#vCanli', el)) return;
          if (!f || f.hata) { $('#vCanli', el).textContent = 'Canlı fiyat alınamadı; alış fiyatını sen gir.'; return; }
          $('#vCanli', el).innerHTML = `Şu an <b>${moneyHam(f.fiyat, f.fiyat >= 1000 ? 0 : 2)}</b> <span class="${f.degisim >= 0 ? 'artı' : 'eksi'}">${yuzde(f.degisim, 2)}</span>`;
          if (!$('#vMaliyet', el).value) $('#vMaliyet', el).value = String(Number(f.fiyat.toPrecision(6))).replace('.', ',');
        }).catch(() => { if ($('#vCanli', el)) $('#vCanli', el).textContent = 'Canlı fiyat alınamadı; alış fiyatını sen gir.'; });
    }
    const ara = $('#vAra', el);
    if (ara) {
      let zam;
      ara.oninput = () => {
        clearTimeout(zam); const q = ara.value.trim();
        if (q.length < 2) { $('#vSonuc', el).innerHTML = ''; return; }
        zam = setTimeout(async () => {
          $('#vSonuc', el).innerHTML = '<div class="mini">Aranıyor…</div>';
          try {
            const r = await fetch('/api/ara?q=' + encodeURIComponent(tur === 'Kripto' && !/usd|eur|try/i.test(q) ? q + ' usd' : q));
            const j = await r.json(); if (!r.ok) throw new Error(j.hata || 'Arama yapılamadı');
            let s = j.sonuclar || [];
            s = s.filter(x => tur === 'Kripto' ? x.tur === 'Kripto' : tur === 'Fon / ETF' ? x.tur === 'Fon / ETF' : x.tur === 'Hisse');
            $('#vSonuc', el).innerHTML = s.length ? s.map((x, i) => `<button data-i="${i}"><b>${esc(x.sembol)}</b><span class="bosluk kes">${esc(x.ad)}</span><span class="mini">${esc(x.borsa)}</span></button>`).join('') : '<div class="mini">Bulunamadı. Borsa İstanbul hisseleri için sonuna .IS ekleyebilirsin (ör. THYAO.IS).</div>';
            $$('#vSonuc button', el).forEach(b => b.onclick = () => { const x = s[b.dataset.i]; secim = { sembol: tur === 'Kripto' ? x.sembol.replace(/-USD$/, '') : x.sembol, ad: x.ad.replace(/ USD$/, ''), borsa: x.borsa }; canliForm(); });
          } catch (e) { $('#vSonuc', el).innerHTML = `<div class="mini">⚠️ ${esc(e.message)}</div>`; }
        }, 350);
      };
      setTimeout(() => ara.focus(), 50);
    }
    const k = $('#vKaydet', el); if (k) k.onclick = () => kaydet({ elle: false, gram, mbk });
  };

  const dovizForm = () => {
    ic2.innerHTML = `<div class="arama-sonuc" style="margin-top:12px">${['USD|Amerikan doları', 'EUR|Euro', 'GBP|İngiliz sterlini', 'CHF|İsviçre frangı'].map(x => { const [s, a] = x.split('|'); return `<button data-s="${s}" data-a="${a}" class="${secim?.sembol === s ? 'on' : ''}"><b>${s}</b><span class="bosluk">${a}</span></button>`; }).join('')}</div>`;
    $$('.arama-sonuc button', ic2).forEach(b => b.onclick = () => { secim = { sembol: b.dataset.s, ad: b.dataset.a }; canliForm(); });
  };

  const elleForm = () => {
    const b = turBilgi(tur), nakit = tur === 'Nakit / Banka';
    const ph = { 'Ev / Daire': 'ör. Kadıköy 2+1', 'Arsa / Tarla': 'ör. Mersin tarla', 'Araba': 'ör. 2019 Corolla', 'Nakit / Banka': 'ör. Ziraat vadesiz', 'Diğer': 'ör. Saat koleksiyonu' }[tur];
    ic2.innerHTML = `
      <label class="etiket" for="vAd">Adı</label><input id="vAd" maxlength="40" placeholder="${ph}">
      <label class="etiket" for="vMaliyet">${nakit ? 'Bakiye' : 'Bugünkü değeri'}</label>${tutarAlan('vMaliyet', tur === 'Ev / Daire' ? 'ör. 2.500.000' : tur === 'Araba' ? 'ör. 1.200.000' : '0')}
      ${nakit ? '' : `<div class="iki"><div><label class="etiket" for="vTarih">Bu değer hangi tarihte?</label><input id="vTarih" type="date" value="${today()}"></div>
        <div><label class="etiket" for="vOran">Yıllık değer artışı</label><div class="alan-ek"><input id="vOran" inputmode="decimal" value="${fmt(b.artis || 0, 1)}"><span>%</span></div></div></div>
        <p class="mini">${ARTIS_KAYNAK[tur] ? `Varsayılan oran: ${ARTIS_KAYNAK[tur]}. ` : ''}Değeri her gün bu orana göre otomatik büyütürüm; istersen değiştir ya da 0 yap. Tahmindir, fikir vermesi için.</p>`}
      <button class="blok buyuk" id="vKaydet" style="margin-top:14px">Ekle</button>`;
    $('#vKaydet', el).onclick = () => kaydet({ elle: true, nakit });
    setTimeout(() => $('#vAd', el)?.focus(), 50);
  };

  const kaydet = ({ elle, gram, mbk, nakit }) => guard(async () => {
    const maliyet = girdi($('#vMaliyet', el)?.value);
    const adet = elle || mbk ? 1 : girdi($('#vAdet', el).value);
    const ad = elle ? $('#vAd', el).value.trim() : mbk ? 'MBKAYO bireysel bakiye' : secim?.ad;
    if (!elle && !mbk && !secim && !gram) return toast('Önce varlığı seç');
    if (elle && !ad) return toast('Bir ad yaz');
    if (!(adet > 0)) return toast('Adet gir');
    if (!mbk && !(maliyet > 0)) return toast(elle ? 'Değerini gir' : 'Fiyat gir');
    S.busy = true; $('#vKaydet', el).disabled = true;
    try {
      const tarih = $('#vTarih', el)?.value || today();
      const sembol = mbk ? 'MBKAYO' : elle ? ad.toLocaleUpperCase('tr').slice(0, 14) : gram ? (tur.startsWith('Altın') ? 'ALTIN' : 'GUMUS') : secim.sembol;
      const oran = elle && !nakit ? String(girdi($('#vOran', el).value)) : '';
      await ekle('Portföy', { Kimlik: uid(), 'Tür': tur, Sembol: sembol, Ad: ad || (gram ? (tur.startsWith('Altın') ? 'Gram altın' : 'Gram gümüş') : sembol), Adet: String(adet), Maliyet: String(maliyet || 0), Tarih: tarih, Not: '', 'Yıllık artış': oran, Hedef: '' });
      const dus = $('#vDus', el)?.checked;
      // Nakitsiz eklenen varlık bugün portföye "giriyor": grafikte yatırım hariç çizgi zıplamasın diye bugünkü değeriyle yazılır
      const bugunkuDeger = elle && oran ? adet * buyumeli(maliyet, num(oran), tarih) : adet * maliyet;
      await ekle('Kayıtlar', { Kimlik: uid(), Tarih: dus ? tarih : today(), 'Tür': dus ? 'Varlık alımı' : 'Varlık girişi', Tutar: String(Math.round(bugunkuDeger * 100) / 100), Kategori: sembol, Not: `${ad || sembol} eklendi` });
    } finally { S.busy = false; }
    el.remove();
    toast(pick(['🛒 Eklendi. Kurt gibi yatırımcı 🐺', '📈 Portföy büyüyor, hayırlı olsun dude.', '🔔 Varlık borsaya girdi.']));
    S.go('varliklar'); fiyatlariGetir();
  });

  const turSec = t => {
    tur = t; secim = null;
    $$('#vTur .cip', el).forEach(x => x.classList.toggle('on', x.dataset.t === t));
    if (t.includes('gram')) { secim = { sembol: t.startsWith('Altın') ? 'ALTIN' : 'GUMUS', ad: t.startsWith('Altın') ? 'Gram altın' : 'Gram gümüş' }; canliForm(); }
    else if (t === 'Döviz') dovizForm();
    else if (turBilgi(t).canli) canliForm();
    else elleForm();
  };
  $$('#vTur .cip', el).forEach(b => b.onclick = () => turSec(b.dataset.t));
  turSec(tur);
}

// ---------- Varlık detayı: değer güncelle, hedefe bağla, sat, kaldır ----------
export function varlikDetay(kimlik) {
  const x = varliklar().find(y => y.p['Kimlik'] === kimlik);
  if (!x) return;
  const p = x.p, elle = !canliMi(p), mbk = p['Tür'] === 'MBKAYO payı';
  const el = sheet(`<div class="satir"><span class="varlik-ik">${rozetIc(p)}</span><div class="bosluk"><h3>${esc(p['Ad'] || p['Sembol'])}</h3><div class="mini">${esc(p['Tür'])}${!elle && !mbk ? ' · ' + esc(p['Sembol']) : ''}</div></div>${kapatBtn()}</div>
    <div class="istatistik">
      <div><span class="mini">Değer${x.tahmini ? ' (tahmini)' : ''}</span><b>${money(x.deger)}</b><span class="mini">${elle ? (x.tahmini ? `${tarihFmt(p['Tarih'])}: ${money(x.alis)}` : '') : mbk ? 'fon ÷ 6' : `${fmt(x.adet, x.adet % 1 ? 4 : 0)} × ${fiyatFmt(x.fiyat)}`}</span></div>
      <div><span class="mini">${elle ? 'Değer değişimi' : 'Kâr / zarar'}</span><b class="${x.kar >= 0 ? 'artı' : 'eksi'}">${x.alis ? `${x.kar >= 0 ? '+' : '−'}${money(Math.abs(x.kar))}` : '–'}</b><span class="mini">${x.alis ? yuzde(x.karYuzde) : ''}${elle && x.tahmini ? ` · yıllık %${fmt(x.oran, 1)}` : ''}</span></div>
    </div>
    <label class="onay"><input type="checkbox" id="dHedef" ${x.hedefte ? 'checked' : ''}><span><b>🎯 Hedefime say</b><br><span class="mini">Bu varlığın değeri Hedef sekmesindeki birikime eklenir.</span></span></label>
    ${elle ? `<div class="ust-etiket" style="margin-top:16px">Değeri güncelle</div>
      <div class="iki"><div><label class="etiket" for="dDeger">${p['Tür'] === 'Nakit / Banka' ? 'Bakiye' : 'Bugünkü değeri'}</label>${tutarAlan('dDeger', '0', fmtIn(Math.round(x.fiyat)))}</div>
      ${p['Tür'] === 'Nakit / Banka' ? '<div></div>' : `<div><label class="etiket" for="dOran">Yıllık artış</label><div class="alan-ek"><input id="dOran" inputmode="decimal" value="${fmt(x.oran, 1)}"><span>%</span></div></div>`}</div>
      <button class="blok ikinci" id="dDegerKaydet" style="margin-top:10px">Değeri kaydet</button>` : ''}
    ${mbk ? `<label class="etiket" for="dMal">Fona koyduğun toplam para</label>${tutarAlan('dMal', '0', fmtIn(x.maliyet))}<button class="blok ikinci" id="dMalKaydet" style="margin-top:10px">Kaydet</button>` : ''}
    ${!elle && !mbk ? `<div class="ust-etiket" style="margin-top:16px">Sat</div>
      <div class="iki"><div><label class="etiket" for="dAdet">Adet</label><input id="dAdet" inputmode="decimal" value="${String(x.adet).replace('.', ',')}"></div>
      <div><label class="etiket" for="dFiyat">Birim satış fiyatı</label>${tutarAlan('dFiyat', '0', String(Number(x.fiyat.toPrecision(6))).replace('.', ','))}</div></div>
      <label class="onay"><input type="checkbox" id="dNakit" checked><span>Satış tutarını birikim hesabıma ekle</span></label>
      <button class="blok" id="dSat" style="margin-top:12px">Sat</button>` : ''}
    <button class="blok hayalet" id="dSil">${elle || mbk ? 'Varlığı kaldır' : 'Satış kaydı olmadan kaldır'}</button>`);
  $('#kapat', el).onclick = () => el.remove();
  const satirYaz = async yeni => {
    const guncel = await S.db.table('Portföy'), h = guncel.find(y => y['Kimlik'] === p['Kimlik']);
    if (!h) throw new Error('Varlık tabloda bulunamadı, sayfayı yenile');
    if (yeni === null) { await S.db.deleteRow('Portföy', h._row); gunluk('Silindi', 'Portföy', `${h['Ad']} (${h['Tür']}) · adet ${h['Adet']}`, `${h['Ad']} · maliyet ${h['Maliyet']}`); }
    else { const { _row, ...o } = h; await S.db.writeObj('Portföy', _row, { ...o, ...yeni }); gunluk('Değişti', 'Portföy', `${h['Ad']} → ${Object.entries(yeni).map(([k, v]) => `${k}: ${v}`).join(' · ')}`, Object.keys(yeni).map(k => `${k}: ${h[k]}`).join(' · ')); }
    await tazele('Portföy');
  };
  const islem = fn => guard(async () => { S.busy = true; $$('button', el).forEach(b => (b.disabled = true)); try { await fn(); } finally { S.busy = false; } el.remove(); S.go('varliklar'); });
  $('#dHedef', el).onchange = e => guard(async () => { await satirYaz({ Hedef: e.target.checked ? 'evet' : '' }); toast(e.target.checked ? '🎯 Hedefine eklendi' : 'Hedeften çıkarıldı'); S.yenile(); });
  if ($('#dDegerKaydet', el)) $('#dDegerKaydet', el).onclick = () => { const d = girdi($('#dDeger', el).value); if (!(d > 0)) return toast('Değer gir'); islem(async () => {
    // Yeni değer bugünden itibaren geçerli: eski değerle fark "Varlık girişi/çıkışı" olarak yazılır (grafikte yatırım hariç hesabı bozulmasın)
    const fark = d - x.fiyat;
    await satirYaz({ Maliyet: String(d), Tarih: today(), 'Yıllık artış': $('#dOran', el) ? String(girdi($('#dOran', el).value)) : p['Yıllık artış'] });
    if (Math.abs(fark) > 0.5) await ekle('Kayıtlar', { Kimlik: uid(), Tarih: today(), 'Tür': fark > 0 ? 'Varlık girişi' : 'Varlık çıkışı', Tutar: String(Math.abs(fark)), Kategori: p['Sembol'], Not: `${p['Ad']} değeri güncellendi` });
    toast('✅ Değer güncellendi');
  }); };
  if ($('#dMalKaydet', el)) $('#dMalKaydet', el).onclick = () => islem(async () => { await satirYaz({ Maliyet: String(girdi($('#dMal', el).value)) }); toast('✅ Kaydedildi'); });
  if ($('#dSat', el)) $('#dSat', el).onclick = () => {
    const adet = Math.min(girdi($('#dAdet', el).value), x.adet), fiyat = girdi($('#dFiyat', el).value);
    if (adet <= 0 || fiyat <= 0) return toast('Adet ve fiyat gir');
    const nakde = $('#dNakit', el).checked;
    islem(async () => {
      const kalan = x.adet - adet;
      await satirYaz(kalan > 1e-9 ? { Adet: String(Number(kalan.toPrecision(10))) } : null);
      await ekle('Kayıtlar', { Kimlik: uid(), Tarih: today(), 'Tür': nakde ? 'Varlık satışı' : 'Varlık çıkışı', Tutar: String(adet * fiyat), Kategori: p['Sembol'], Not: `${p['Ad'] || p['Sembol']} satıldı` });
      const kar = adet * (fiyat - x.maliyet);
      toast(kar >= 0 ? `💰 Satıldı! ${money(kar)} kârla çıktın, Wolf of Dudestreet 🐺` : `🏷️ Satıldı. ${money(-kar)} zarar… olur böyle şeyler dude.`, 5000);
    });
  };
  $('#dSil', el).onclick = () => onayKutusu('Portföyden kaldırılsın mı?', 'Satış kaydı yazılmaz; sadece listeden çıkar.', () => islem(async () => {
    await satirYaz(null);
    await ekle('Kayıtlar', { Kimlik: uid(), Tarih: today(), 'Tür': 'Varlık çıkışı', Tutar: String(x.deger), Kategori: p['Sembol'], Not: `${p['Ad'] || p['Sembol']} kaldırıldı` });
    toast('Kaldırıldı');
  }), { evetYazi: 'Kaldır', tehlike: true });
}
export { GRUP_RENK, fiyatAnahtar };
