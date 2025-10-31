# TODO

Bu dosya, geliştirme sırasında takip edeceğimiz işleri içerir. Her maddeye benzersiz bir kod atanır, oluşturulma/tamamlanma tarihleri ve bağımlılıklar belirtilir.

## Aktif İşler

## Tamamlananlar

- [x] T-008 — Entity isimlerini dashboard'da özelleştirme
  - Oluşturulma: 2025-10-31
  - Tamamlanma: 2025-10-31
  - Bağımlılıklar: —
  - Mevcut: Dashboard'da entity isimleri Home Assistant'daki `friendly_name` kullanıyor, değiştirilemiyor
  - Hedef: Dashboard'da entity isimlerini özelleştirebilme (HA entity isimlerini değiştirmeden)
  - Tercih: Edit Mode'da entity ismi üzerine tıklayınca inline edit veya modal ile isim değiştirme
  - Alternatif: En basit UI yöntemi (örn. Home Settings'te entity seçimi + isim input)
  - Kapsam:
    - CustomizationManager'a entity custom name kaydetme/okuma metotları (`setEntityCustomName`, `getEntityCustomName`)
    - Customizations yapısına `entities: { [entityId]: { custom_name: string } }` eklendi
    - AppleHomeCard'da öncelik sırası: `custom_name` → `this.name` → `friendly_name` → entity_id
    - Edit Mode'da entity card'ın isim kısmına tıklayınca inline edit input açılıyor (preferred)
    - Tüm sayfalarda custom name desteği eklendi (HomePage, RoomPage, GroupPage, ScenesPage, CamerasPage, tüm section'lar)
    - Custom name ayarlandığında sadece o dashboard'da görünür (kalıcı saklama)
    - Custom name silme/kaldırma seçeneği (boş/orijinal isme dönme)
    - Çeviri anahtarları eklendi (`edit.rename_entity`, `edit.custom_name`) - tüm dillere
  - Kabul Kriterleri:
    - ✅ Edit Mode'da entity ismi üzerine tıklayınca isim edit edilebilir
    - ✅ Değiştirilen isimler sadece bu dashboard'da görünür (HA entity isimleri değişmez)
    - ✅ Custom name ayarı kalıcı olarak saklanır (reload sonrası korunur)
    - ✅ Tüm sayfalarda (Home, Room, Group, Scenes, Cameras) custom name görünür
    - ✅ Custom name kaldırıldığında orijinal friendly_name görünür
    - ✅ Build ve lint hatasız tamamlandı

- [x] T-007 — Home Settings popup altında sürüm numarasını göster
  - Oluşturulma: 2025-10-31
  - Tamamlanma: 2025-10-31
  - Bağımlılıklar: —
  - Mevcut: Home Settings ile açılan popup’ta sürüm bilgisi görünmüyor
  - Hedef: Popup’ın en altında mevcut paket sürümünü (package.json version) göster
  - Kapsam:
    - `HomeSettingsManager` popup render’ında alt kısma sürüm etiketi eklendi
    - Sürüm `package.json` içinden import edilerek kullanıldı (tek kaynak)
    - Stil: küçük, ikincil/metin rengi; sağ altta
    - Çeviri: `settings.version_label` anahtarı tüm dillere eklendi
  - Kabul Kriterleri:
    - Home Settings popup’ında alt kısımda “Version: x.y.z” görünür
    - Tüm dillerde etiket çevrilidir
    - Build temiz

- [x] T-006 — Security chip altında kameralar her zaman görünsün
  - Oluşturulma: 2025-10-31
  - Tamamlanma: 2025-10-31
  - Bağımlılıklar: —
  - Mevcut: Kameralar Home ekranında "Reorder Sections" ile gizlenince, Security chip'e basıldığında da görünmüyor
  - Hedef: Security chip (Security filtresi) aktifken kameralar daima listelensin; Home görünümünde gizlenmiş olsa bile
  - Kapsam:
    - Security chip (filtresi) aktifken sadece kameralar için özel kural: `cameras_section` gizli olsa bile Security'de görünür olmalı
    - Diğer gizlenen bölümler Security'de de gizli kalmaya devam eder (genel override yok, sadece kameralar için özel durum)
    - `GroupPage.ts` içinde Security filtresi/State'i yakalayarak `CamerasSection` render koşullarını güncelle
    - `hiddenSections` kontrolünde Security filtresi aktifken `cameras_section` için istisna uygula
    - Çeviri anahtarı gerekmiyor (mevcut başlık/etiketler kullanılacak)
  - Kabul Kriterleri:
    - Home'da Cameras bölümü gizlense de Security chip'e basıldığında kameralar görünür
    - Build ve lint hatasız tamamlanır

- [x] T-005 — Commonly Used section (Manuel tracking)
  - Oluşturulma: 2025-10-30
  - Tamamlanma: 2025-10-30
  - Bağımlılıklar: —
  - Mevcut: Home ekranında sadece Favorites, Status, Rooms, Groups, Scenes, Cameras bölümleri var
  - Hedef: Son 24 saatte sık kullanılan varlıkları gösteren "Commonly Used" bölümü eklenmeli
  - Kapsam:
    - `UsageTracker` utility sınıfı: etkileşim tracking ve sıralama (Home Assistant storage)
    - `CommonlyUsedSection` component: FavoritesSection benzeri yapı
    - `AppleHomeCard.ts`: `handleCardClick` ve `handleIconClick` içine tracking ekleme
    - Action types: tap, toggle, more-info açma
    - **Filtreleme kriterleri:**
      - Minimum kullanım eşiği: Son 24 saatte en az 2-3 kez kullanılmış olmalı
      - Tek seferlik kullanımlar bölüme eklenmemeli
      - Sıralama: Kullanım sıklığı (ağırlık) + son kullanım zamanı (ağırlık) kombinasyonu
    - Son 24 saatteki etkileşimleri filtreleme ve sıralama algoritması
    - `HomePage.ts`: CommonlyUsedSection render'ı ekleme
    - Section sıralama ve gizleme desteği
    - Çeviri anahtarları (tüm dillerde): `section_titles.commonly_used`
    - Varsayılan sıralama: Favorites → Commonly Used → Cameras → Scenes → Areas
  - Kabul Kriterleri:
    - Son 24 saatte **sık kullanılan** (en az eşik değer kadar) varlıklar "Commonly Used" bölümünde görünür
    - Tek seferlik kullanımlar bölüme eklenmez
    - En çok kullanılanlar üstte, az kullanılanlar altta sıralanır
    - Boş olduğunda (eşik değeri aşan varlık yoksa) bölüm otomatik gizlenir
    - Etkileşimler kalıcı olarak saklanır (yeniden yüklemede korunur)
    - Build ve lint temiz

- [x] T-002 — Home Wallpaper kaldırma seçeneği
  - Oluşturulma: 2025-10-30
  - Tamamlanma: 2025-10-30
  - Bağımlılıklar: —
  - Mevcut: "Home Settings" içinde duvar kâğıdı olarak bir resim seçilebiliyor
  - Hedef: Arka plan resmini tamamen kaldır (theme varsayılan arka planına dön) seçeneği eklenebilmeli
  - Kapsam:
    - Home Settings UI'ına "Remove wallpaper" / "Clear background" seçeneği eklenmesi
    - `BackgroundManager`'a `removeWallpaper()` metodu eklenmesi
    - Theme varsayılan arka planı: `https://raw.githubusercontent.com/Stormrage-DJ/ha_theme_star_wars_light/main/assets/star_wars_light_bg.png`
    - Theme background CSS: `top center / auto no-repeat url(...) fixed`
    - Arka plan temizlendiğinde theme background'unun uygulanması
    - `CustomizationManager` üzerinde theme durumunun kalıcı saklanması
    - Uygulandığında anında görünümün güncellenmesi ve reload sonrası kalıcılık
  - Kabul Kriterleri:
    - Kullanıcı ayardan arka planı kaldırdığında theme varsayılan arka planı uygulanır
    - Theme background CSS özellikleri doğru uygulanır (position: top center, size: auto, no-repeat, fixed)
    - Ayar kalıcıdır, yeniden yüklemede korunur
    - Build ve lint temiz

## Tamamlananlar

- [x] T-004 — Tam rebranding: Smart Home
  - Oluşturulma: 2025-10-30
  - Tamamlanma: 2025-10-30
  - Bağımlılıklar: —
  - Kapsam:
    - Strategy tipi: `custom:smart-home-strategy` (kayıt ve README örnekleri güncellendi)
    - Görünüm tipi: `custom:smart-home-view`, custom element: `smart-home-view`
    - HACS adı ve dosya adı: `Smart Home Dashboard Strategy`, `smart-home-dashboard.js`
    - Webpack çıktı adı ve paket `main`: `smart-home-dashboard.js`
    - README kaynak URL’leri ve yönergeler Smart Home olarak güncellendi
  - Kabul Kriterleri:
    - Kullanıcıya görünen ad/etiket ve kaynak adları “Smart Home” olarak geçiyor
    - HACS kaydı ve dosya adı tutarlı: `smart-home-dashboard.js`
    - Strategy tipi/yaml örnekleri `custom:smart-home-strategy`
    - Build ve lint temiz

- [x] T-001 — Görünüm adı değişikliği
  - Oluşturulma: 2025-10-30
  - Tamamlanma: 2025-10-30
  - Bağımlılıklar: —
  - Mevcut: `custom:apple-home-view`
  - Hedef: `custom:smart-home-view`
  - Kapsam:
    - Strategy konfigürasyon üretiminde kart tipinin `custom:smart-home-view` olarak kullanılması
    - Web component kayıt adının güncellenmesi (custom element tanımı)
    - İlgili import/usage noktalarının uyarlanması
    - Eski ad tamamen kaldırıldı; herhangi bir alias/geriye uyumluluk yok
  - Kabul Kriterleri:
    - Strategy ile oluşturulan tüm sayfalar `custom:smart-home-view` ile render ediliyor
    - Kod tabanında `custom:apple-home-view` referansı kalmadı
    - Konsolda hata yok, build ve lint temiz

- [x] T-003 — Türkçe ve Hollandaca çeviriler
  - Oluşturulma: 2025-10-30
  - Tamamlanma: 2025-10-30
  - Bağımlılıklar: —
  - Mevcut: `src/translations` altında dil dosyaları mevcut
  - Hedef: Türkçe (`tr.json`) eklenmesi ve Hollandaca (`nl.json`) içeriğinin gözden geçirilmesi/güncellenmesi
  - Kapsam:
    - `tr.json` dosyasının oluşturulması (tüm anahtarlar için çeviri)
    - `nl.json` eksik/yanlış kalemlerin tamamlanması
    - `LocalizationService` ile bütünleşik çalıştığının doğrulanması
  - Kabul Kriterleri:
    - Dil `tr` seçildiğinde tüm etiketler Türkçe görüntülenir
    - Dil `nl` seçildiğinde eksik etiket kalmaz
    - Build ve lint temiz
