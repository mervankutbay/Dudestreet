// Dudestreet — Borçlar: kredi kartları (limit, borç, asgari, hesap kesim ve son ödeme günü), krediler, kişilere borçlar
import { S, $, $$, esc, num, money, fmt, today, uid, toast, sheet, onayKutusu, guard, ekle, guncelle, sil, tazele, ikon, pick, tutarAlan, fmtIn, kapatBtn, tarihFmt, gunFark, girdi } from './core.js';
import { borclar } from './hesap.js';
import { giderEkle } from './plan.js';

const ic = (k, s = 18) => ikon(k, 'currentColor', s);
const TURLER = [['Kredi kartı', '💳'], ['Kredi', '🏦'], ['Kişiye borç', '🤝'], ['Diğer', '🧾']];
const turIkon = t => (TURLER.find(x => x[0] === t) || TURLER[3])[1];
const kalanYazi = n => n === null ? '' : n === 0 ? 'bugün!' : n === 1 ? 'yarın' : `${n} gün kaldı`;

export function renderBorclar() {
  const l = borclar().sort((a, b) => (a.kalanGun ?? 999) - (b.kalanGun ?? 999));
  const toplam = l.reduce((s, x) => s + x.borc, 0), asgari = l.reduce((s, x) => s + (x.borc > 0 ? Math.min(x.asgari || x.borc, x.borc) : 0), 0);
  const kartlar = l.filter(x => x.b['Tür'] === 'Kredi kartı'), limit = kartlar.reduce((s, x) => s + x.limit, 0), kartBorc = kartlar.reduce((s, x) => s + x.borc, 0);
  const yakin = l.filter(x => x.borc > 0 && x.kalanGun !== null && x.kalanGun <= 5);
  $('#app').innerHTML = `
    <div class="kart">
      <span class="ust-etiket">Toplam borç</span>
      <div class="buyuk-rakam ${toplam > 0 ? 'eksi' : ''}">${money(toplam)}</div>
      ${limit ? `<div class="cubuk kirmizi" role="progressbar" aria-valuenow="${Math.round(kartBorc / limit * 100)}" aria-valuemin="0" aria-valuemax="100"><div style="width:${Math.min(100, kartBorc / limit * 100).toFixed(1)}%"></div></div>
      <div class="satir mini"><span>Kart limitlerinin %${fmt(kartBorc / limit * 100, 0)}’i dolu</span><span class="bosluk"></span><span>Kullanılabilir ${money(Math.max(0, limit - kartBorc))}</span></div>` : ''}
      ${asgari ? `<div class="mini">Bu dönem en az ödenmesi gereken: <b>${money(asgari)}</b></div>` : ''}
    </div>
    ${yakin.length ? `<div class="uyari">⏰ ${yakin.map(x => `<b>${esc(x.b['Ad'])}</b> son ödeme ${kalanYazi(x.kalanGun)} (${money(x.asgari && x.asgari < x.borc ? x.asgari : x.borc)}${x.asgari && x.asgari < x.borc ? ' asgari' : ''})`).join(' · ')}</div>` : ''}
    <button class="blok buyuk" id="borcEkle">${ic('arti', 20)} Kart ya da borç ekle</button>
    ${l.length ? l.map(x => {
      const b = x.b, kart = b['Tür'] === 'Kredi kartı', gecikme = x.kalanGun !== null && x.kalanGun <= 3 && x.borc > 0;
      return `<button class="kart borc-kart ${kart ? 'kredi' : ''}" data-borc="${esc(b['Kimlik'])}">
        <div class="satir"><span class="varlik-ik">${turIkon(b['Tür'])}</span><span class="bosluk"><b>${esc(b['Ad'])}</b><div class="mini">${esc(b['Banka'] || b['Tür'])}</div></span><span class="sag"><div class="tutar ${x.borc > 0 ? 'eksi' : 'artı'}">${x.borc > 0 ? money(x.borc) : 'Borç yok ✓'}</div>${x.asgari && x.borc > 0 ? `<div class="mini">asgari ${money(Math.min(x.asgari, x.borc))}</div>` : ''}</span></div>
        ${kart && x.limit ? `<div class="cubuk ince kirmizi"><div style="width:${(x.doluluk * 100).toFixed(1)}%"></div></div><div class="satir mini"><span>Limit ${money(x.limit)}</span><span class="bosluk"></span><span>Kullanılabilir ${money(x.kullanilabilir)}</span></div>` : ''}
        <div class="satir mini">${x.son ? `<span class="${gecikme ? 'eksi' : ''}">📅 Son ödeme ${tarihFmt(x.son)} · ${kalanYazi(x.kalanGun)}</span>` : '<span>Son ödeme günü girilmedi</span>'}<span class="bosluk"></span>${x.kesim ? `<span>✂️ Kesim ${tarihFmt(x.kesim)}</span>` : ''}</div>
      </button>`;
    }).join('') : '<div class="kart"><p class="soluk" style="margin:0">Henüz borç eklemedin. Kredi kartlarını ekle; son ödeme gününü hatırlatayım, limitini takip edeyim 💳</p></div>'}
    <p class="mini ortala">Borçlar Özet’teki toplam mal varlığından düşülür.</p>`;
  $('#borcEkle').onclick = () => borcForm();
  $$('[data-borc]').forEach(b => b.onclick = () => borcDetay(b.dataset.borc));
}

function borcForm(mevcut) {
  const b = mevcut || {};
  let tur = b['Tür'] || 'Kredi kartı';
  const el = sheet(`<div class="satir"><h3 class="bosluk">${mevcut ? 'Düzenle' : 'Kart ya da borç ekle'}</h3>${kapatBtn()}</div>
    <div class="cipler" id="bTur">${TURLER.map(([t, i]) => `<button type="button" class="cip ${t === tur ? 'on' : ''}" data-t="${t}">${i} ${t}</button>`).join('')}</div>
    <div id="bIc"></div>`);
  $('#kapat', el).onclick = () => el.remove();
  const ciz = () => {
    const kart = tur === 'Kredi kartı', kredi = tur === 'Kredi';
    $('#bIc', el).innerHTML = `
      <div class="iki"><div><label class="etiket" for="bAd">${kart ? 'Kart adı' : 'Adı'}</label><input id="bAd" maxlength="40" value="${esc(b['Ad'] || '')}" placeholder="${kart ? 'ör. Bonus Platinum' : kredi ? 'ör. İhtiyaç kredisi' : 'ör. Ahmet’e borç'}"></div>
      <div><label class="etiket" for="bBanka">${kart || kredi ? 'Banka' : 'Kime / not'}</label><input id="bBanka" maxlength="40" value="${esc(b['Banka'] || '')}" placeholder="${kart || kredi ? 'ör. Garanti' : ''}"></div></div>
      <div class="iki"><div><label class="etiket" for="bBorc">${kart ? 'Güncel borç' : 'Kalan borç'}</label>${tutarAlan('bBorc', '0', fmtIn(b['Borç']))}</div>
      ${kart ? `<div><label class="etiket" for="bLimit">Limit</label>${tutarAlan('bLimit', '0', fmtIn(b['Limit']))}</div>` : `<div><label class="etiket" for="bAsgari">${kredi ? 'Aylık taksit' : 'Aylık ödeme'}</label>${tutarAlan('bAsgari', '0', fmtIn(b['Asgari']))}</div>`}</div>
      ${kart ? `<label class="etiket" for="bAsgari">Asgari ödeme (bu dönem)</label>${tutarAlan('bAsgari', 'ekstrede yazar', fmtIn(b['Asgari']))}` : ''}
      <div class="iki">${kart ? `<div><label class="etiket" for="bKesim">Hesap kesim günü</label><input id="bKesim" inputmode="numeric" maxlength="2" value="${esc(b['Kesim'] || '')}" placeholder="ör. 5"></div>` : '<div></div>'}
      <div><label class="etiket" for="bSon">${kart ? 'Son ödeme günü' : 'Ödeme günü'}</label><input id="bSon" inputmode="numeric" maxlength="2" value="${esc(b['Son ödeme'] || '')}" placeholder="ayın kaçı? ör. 15"></div></div>
      <button class="blok buyuk" id="bKaydet" style="margin-top:14px">Kaydet</button>`;
    $('#bKaydet', el).onclick = () => guard(async () => {
      const ad = $('#bAd', el).value.trim(); if (!ad) return toast('Bir ad yaz');
      const gun = id => { const v = $(id, el)?.value.trim(); if (!v) return ''; const n = Math.round(num(v)); if (!(n >= 1 && n <= 31)) throw new Error('Gün 1 ile 31 arasında olmalı'); return String(n); };
      const obj = { 'Tür': tur, Ad: ad, Banka: $('#bBanka', el).value.trim(), Borç: String(girdi($('#bBorc', el).value)), Limit: $('#bLimit', el) ? String(girdi($('#bLimit', el).value)) : '', Asgari: String(girdi($('#bAsgari', el)?.value)), Kesim: gun('#bKesim'), 'Son ödeme': gun('#bSon'), Not: b['Not'] || '' };
      S.busy = true; $('#bKaydet', el).disabled = true;
      try { if (mevcut) await guncelle('Borçlar', b['Kimlik'], obj); else await ekle('Borçlar', { Kimlik: uid(), ...obj }); } finally { S.busy = false; }
      el.remove(); toast(mevcut ? '✅ Güncellendi' : '💳 Eklendi, son ödeme gününü ben takip ederim'); S.go('borclar');
    });
  };
  $$('#bTur .cip', el).forEach(c => c.onclick = () => { tur = c.dataset.t; $$('#bTur .cip', el).forEach(x => x.classList.toggle('on', x === c)); ciz(); });
  ciz();
}

function borcDetay(kimlik) {
  const x = borclar().find(y => y.b['Kimlik'] === kimlik); if (!x) return;
  const b = x.b, kart = b['Tür'] === 'Kredi kartı';
  const hareket = S.borcHareket.filter(h => h['Borç'] === kimlik).sort((a, c) => String(c['Tarih']).localeCompare(String(a['Tarih']))).slice(0, 12);
  const el = sheet(`<div class="satir"><span class="varlik-ik">${turIkon(b['Tür'])}</span><div class="bosluk"><h3>${esc(b['Ad'])}</h3><div class="mini">${esc(b['Banka'] || b['Tür'])}</div></div>${kapatBtn()}</div>
    <div class="istatistik">
      <div><span class="mini">Borç</span><b class="${x.borc > 0 ? 'eksi' : 'artı'}">${money(x.borc)}</b><span class="mini">${kart && x.limit ? `limit ${money(x.limit)}` : x.asgari ? `ayda ${money(x.asgari)}` : ''}</span></div>
      <div><span class="mini">Son ödeme</span><b>${x.son ? tarihFmt(x.son) : '–'}</b><span class="mini">${kalanYazi(x.kalanGun)}</span></div>
    </div>
    <div class="ust-etiket" style="margin-top:14px">Ödeme yap</div>
    <div class="iki"><div>${tutarAlan('oTutar', '0', fmtIn(x.asgari && x.asgari < x.borc ? x.asgari : x.borc))}</div><input type="date" id="oTarih" value="${today()}" aria-label="Ödeme tarihi"></div>
    ${x.asgari && x.borc > x.asgari ? `<div class="cipler"><button type="button" class="cip" data-o="${x.asgari}">Asgari ${money(x.asgari)}</button><button type="button" class="cip" data-o="${x.borc}">Tamamı ${money(x.borc)}</button></div>` : ''}
    <label class="onay"><input type="checkbox" id="oGider"><span>Gelir-Gider’e de gider olarak yaz<br><span class="mini">Kart harcamalarını zaten tek tek giriyorsan işaretleme, iki kez sayılmasın.</span></span></label>
    <button class="blok" id="oKaydet" style="margin-top:12px">Ödemeyi kaydet</button>
    ${kart ? `<div class="ust-etiket" style="margin-top:16px">Karta harcama ekle</div><div class="satir"><div class="bosluk">${tutarAlan('hTutar')}</div><button class="ikinci" id="hEkle">Ekle</button></div><p class="mini">Borca eklenir. Gelir-Gider’e ayrıca yazmak istersen oradan ekle.</p>` : ''}
    ${hareket.length ? `<div class="ust-etiket" style="margin-top:16px">Son hareketler</div><ul class="liste">${hareket.map(h => `<li><span class="bosluk">${esc(h['Tür'])}${h['Not'] ? ' · ' + esc(h['Not']) : ''}<div class="mini">${tarihFmt(h['Tarih'])}</div></span><span class="tutar ${h['Tür'] === 'Ödeme' ? 'artı' : 'eksi'}">${h['Tür'] === 'Ödeme' ? '−' : '+'}${money(num(h['Tutar']))}</span></li>`).join('')}</ul>` : ''}
    <div class="satir" style="margin-top:14px"><button class="ikinci bosluk" id="dDuz">${ic('duzenle', 16)} Düzenle</button><button class="tehlike bosluk" id="dSil">${ic('cop', 16)} Sil</button></div>`);
  $('#kapat', el).onclick = () => el.remove();
  $$('[data-o]', el).forEach(c => c.onclick = () => { $('#oTutar', el).value = fmtIn(c.dataset.o); });
  const islem = fn => guard(async () => { S.busy = true; $$('button', el).forEach(z => (z.disabled = true)); try { await fn(); } finally { S.busy = false; } el.remove(); S.go('borclar'); });
  $('#oKaydet', el).onclick = () => { const t = girdi($('#oTutar', el).value); if (!(t > 0)) return toast('Tutar gir'); const tarih = $('#oTarih', el).value || today(), gider = $('#oGider', el).checked; islem(async () => {
    await guncelle('Borçlar', kimlik, { Borç: String(Math.max(0, Math.round((x.borc - t) * 100) / 100)), Asgari: x.asgari ? String(Math.max(0, x.asgari - t)) : b['Asgari'] });
    await ekle('Borç hareketleri', { Kimlik: uid(), Borç: kimlik, Tarih: tarih, 'Tür': 'Ödeme', Tutar: String(t), Not: '' });
    if (gider) await giderEkle({ tarih, kalem: `${b['Ad']} ödemesi`, kategori: 'Kredi / taksit', tutar: t, birikimden: false });
    toast(x.borc - t <= 0 ? pick(['🎉 Borç kapandı! Özgürlük kokusu…', '✅ Sıfırlandı, banka üzgün 😎']) : '✅ Ödeme kaydedildi');
  }); };
  if ($('#hEkle', el)) $('#hEkle', el).onclick = () => { const t = girdi($('#hTutar', el).value); if (!(t > 0)) return toast('Tutar gir'); islem(async () => {
    await guncelle('Borçlar', kimlik, { Borç: String(Math.round((x.borc + t) * 100) / 100) });
    await ekle('Borç hareketleri', { Kimlik: uid(), Borç: kimlik, Tarih: today(), 'Tür': 'Harcama', Tutar: String(t), Not: '' });
    toast('💳 Karta eklendi');
  }); };
  $('#dDuz', el).onclick = () => { el.remove(); borcForm(b); };
  $('#dSil', el).onclick = () => onayKutusu(`${b['Ad']} silinsin mi?`, 'Hareket geçmişi de silinir.', () => islem(async () => {
    await sil('Borçlar', kimlik);
    const hs = await S.db.table('Borç hareketleri'), satirlar = hs.filter(h => h['Borç'] === kimlik).map(h => h._row);
    if (satirlar.length) await S.db.deleteRows('Borç hareketleri', satirlar);
    await tazele('Borç hareketleri'); toast('🗑️ Silindi');
  }), { evetYazi: 'Sil', tehlike: true });
}
export { gunFark };
