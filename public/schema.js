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
  {
    to: 2,
    title: 'Gelir-gider, notlar, borçlar, mal varlığı',
    changes: [
      '➕ "Gelir", "Giderler", "Bütçe", "Onay", "Kategori" sekmeleri (gelir-gider takibi)',
      '➕ "Notlar" sekmesi',
      '➕ "Borçlar" ve "Borç hareketleri" sekmeleri (kredi kartları)',
      '➕ "Geçmiş" sekmesi (günlük mal varlığı grafiği)',
      '➕ "Portföy"e "Yıllık artış" ve "Hedef" sütunları (ev/araba değer artışı, hedefe bağlama)',
    ],
    async run(db) {
      await db.ensureSheet('Gelir', ['Kimlik', 'Tarih', 'Tutar', 'Not']);
      await db.ensureSheet('Giderler', ['Kimlik', 'Tarih', 'Kalem', 'Kategori', 'Tutar', 'Birikimden', 'Not', 'İkon']);
      await db.ensureSheet('Bütçe', ['Ay', 'Kalem', 'Kategori', 'Tutar', 'İkon']);
      await db.ensureSheet('Onay', ['Ay', 'Kalem', 'Tarih']);
      await db.ensureSheet('Kategori', ['Kod', 'Ad', 'İkon', 'Silindi']);
      await db.ensureSheet('Notlar', ['Kimlik', 'Metin', 'Güncelleme', 'Sabit']);
      await db.ensureSheet('Borçlar', ['Kimlik', 'Tür', 'Ad', 'Banka', 'Limit', 'Borç', 'Asgari', 'Kesim', 'Son ödeme', 'Not']);
      await db.ensureSheet('Borç hareketleri', ['Kimlik', 'Borç', 'Tarih', 'Tür', 'Tutar', 'Not']);
      await db.ensureSheet('Geçmiş', ['Tarih', 'Nakit', 'Varlık', 'Borç', 'Toplam']);
      await db.ensureSheet('Portföy', ['Yıllık artış', 'Hedef']);
      await db.ensureSheet('Kayıtlar', ['Bağ']);
    },
  },
  {
    to: 3,
    title: 'Değişiklik günlüğü',
    changes: ['➕ "Günlük" sekmesi (eklenen, değişen ve silinen kayıtlar, eski hâliyle)'],
    async run(db) {
      await db.ensureSheet('Günlük', ['Zaman', 'İşlem', 'Sekme', 'Özet', 'Eski']);
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
