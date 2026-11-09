// Dudestreet — sayfa çerçevesi yardımcıları (sihirbaz/ana görünüm, adım çubuğu, başlıklar)
import { S, $, $$, ikon, isDemo, gorunumKaydet } from './core.js';
import * as G from './google.js';

export function chrome(mod) { // 'sihirbaz' | 'ana'
  gorunumKaydet(S.view);
  const ana = mod === 'ana';
  $('#sekmeler').classList.toggle('hidden', !ana);
  $('#ust').classList.toggle('hidden', !ana);
  $('#bant').classList.toggle('hidden', !ana);
  $('#app').classList.toggle('sihirbaz', !ana);
  const sekme = { persona: 'dude' }[S.view] || S.view;
  $$('#sekmeler button').forEach(b => b.classList.toggle('on', b.dataset.view === sekme));
  $$('.ust-btn').forEach(b => b.classList.toggle('on', b.dataset.view === sekme));
  $('#ustDurum').textContent = isDemo() ? 'Demo' : '';
  $('#ustDurum').title = isDemo() ? 'Demo modu' : G.userEmail();
}
const ADIMLAR = { google: 1, tablo: 2, gemini: 3, hedef: 4, persona: 5 };
export function adimCubugu(ad, geri) {
  const n = ADIMLAR[ad];
  return `<div class="adim">${geri ? `<button class="geri-btn" id="geri" aria-label="Geri">${ikon('geri', 'currentColor', 20)}</button>` : '<div style="width:40px"></div>'}
    <div class="noktalar">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</div><span class="sayac">${n}/5</span></div>`;
}
export const baslik = (ust, h, alt) => `<div class="baslik-blok"><span class="ust-etiket">${ust}</span><h1>${h}</h1>${alt ? `<p>${alt}</p>` : ''}</div>`;
export const madde = (ik, b, a) => `<div class="madde"><div class="ik">${ikon(ik, 'var(--acik)')}</div><div><b>${b}</b><span>${a}</span></div></div>`;
