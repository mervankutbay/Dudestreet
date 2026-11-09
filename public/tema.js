// Dudestreet — koyu temalar. Seçim bu cihazda saklanır; açılışta sayfa çizilmeden uygulanır (index.html'deki küçük betik).
export const TEMALAR = [
  { id: 'wallstreet', ad: 'Wall Street', alt: 'Para yeşili + altın', renk: ['#050a07', '#19c37d', '#f5c542'] },
  { id: 'gece', ad: 'Gece Yarısı', alt: 'Lacivert + buz mavisi', renk: ['#050814', '#38bdf8', '#a78bfa'] },
  { id: 'neon', ad: 'Neon Boğa', alt: 'Mor + pembe neon', renk: ['#0b0614', '#ec4899', '#22d3ee'] },
  { id: 'matrix', ad: 'Matrix', alt: 'Siyah + terminal yeşili', renk: ['#000805', '#22ff66', '#d9f99d'] },
  { id: 'bordo', ad: 'Bordo & Altın', alt: 'Şarap kırmızısı + altın', renk: ['#0f0608', '#e11d48', '#f5c542'] },
  { id: 'amoled', ad: 'Saf Siyah', alt: 'AMOLED, pil dostu', renk: ['#000000', '#f4f4f5', '#fbbf24'] },
];
const LS = 'ds_tema';
export const aktifTema = () => { try { return localStorage.getItem(LS) || 'wallstreet'; } catch { return 'wallstreet'; } };
export function temaUygula(id) {
  const t = TEMALAR.find(x => x.id === id) || TEMALAR[0];
  document.documentElement.dataset.tema = t.id;
  try { localStorage.setItem(LS, t.id); } catch { /* geç */ }
  const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = t.renk[0];
  return t;
}
