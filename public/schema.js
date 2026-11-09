// Tablo şeması ve sürüm geçişleri (migration).
// Kurallar:
//  - Sadece EKLEME yap (sekme/sütun). Silme, taşıma, yeniden adlandırma yok.
//  - Her adım tekrar çalıştırılsa da güvenli olmalı (ensureSheet/ensureColumn öyle).
//  - Yeni adım eklerken config.js'teki SCHEMA_VERSION'ı artır.

export const MIGRATIONS = [
  {
    to: 1,
    title: 'Temel yapı',
    changes: [
      '➕ "Ayarlar" sekmesi (hedef, para birimi)',
      '➕ "Kayıtlar" sekmesi (birikim, harcama, varlık alım/satım)',
      '➕ "Portföy" sekmesi (hisse, kripto, altın…)',
      '➕ "Persona" sekmesi (Future Dude kişiliği)',
      '➕ "Hafıza" sekmesi (Future Dude\'un seni hatırladıkları)',
    ],
    async run(db) {
      await db.ensureSheet('Ayarlar', ['Anahtar', 'Değer']);
      await db.ensureSheet('Kayıtlar', ['Kimlik', 'Tarih', 'Tür', 'Tutar', 'Kategori', 'Not']);
      await db.ensureSheet('Portföy', ['Kimlik', 'Tür', 'Sembol', 'Ad', 'Adet', 'Maliyet', 'Tarih', 'Not']);
      await db.ensureSheet('Persona', ['Anahtar', 'Değer']);
      await db.ensureSheet('Hafıza', ['Tarih', 'Not', 'Kaynak']);
    },
  },
];

export const pendingMigrations = current => MIGRATIONS.filter(m => m.to > current);

export async function runMigrations(db, current, onStep) {
  for (const m of pendingMigrations(current)) {
    onStep?.(m);
    await m.run(db);
    await db.setKV('_meta', { sema: m.to, son_guncelleme: new Date().toISOString() });
  }
}
