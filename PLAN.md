# PLAN — Scale Lab

Dokumen kerja untuk siapa pun (manusia atau model AI) yang melanjutkan proyek ini.
**Baca seluruh dokumen ini sebelum menulis kode atau lesson baru.** Ikuti polanya. Kalau mau
menyimpang, ubah dulu dokumen ini dan jelaskan alasannya.

---

## 1. Apa proyek ini

Kursus system design interaktif. Setiap lesson adalah diagram isometrik yang dijalani step demi step:
request mengalir, server tumbang, metrik berubah, dan teks di panel kanan menjelaskan kenapa.
Inspirasinya [Designed to Scale](https://designed-to-scale.vercel.app/). **Semua teks, angka, dan
skenario harus ditulis sendiri**, jangan menyalin dari situs itu atau dari sumber lain.

- Stack saat ini: Next.js App Router + React + TypeScript + next-intl; engine tetap SVG imperatif tanpa
  Canvas/WebGL. Detail migrasi dan batasannya ada di [bagian 8](#8-migrasi-ke-nextjs).
- Materi utama berbahasa **Inggris**. Terjemahan **Bahasa Indonesia** wajib untuk setiap lesson.
- Tidak ada backend. Progres disimpan di `localStorage` dengan prefix `stl:`.

Perintah:

```sh
npm install
npm run dev          # http://localhost:3000
npm run typecheck
npm run build        # static export ke out/
npm run preview      # sajikan out/ lewat Python 3
npm run check:i18n   # validasi terjemahan
npm run test         # tes pesan UI, pluralisasi, dan model lab
npm run test:i18n    # tes pesan UI dan pluralisasi saja
npm run check:export # periksa HTML lesson setelah build
```

---

## 2. Status (checklist)

### Fondasi
- [x] Next.js App Router + TypeScript strict (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`)
- [x] Engine isometrik: proyeksi, bentuk, depth sort, link yang dipotong di tepi entitas, paket data
- [x] Transisi antar-scene: diff berdasarkan id, entitas meluncur, muncul, dan memudar
- [x] Kamera: auto-fit, tetap diam kalau scene muat, zoom (scroll/dblclick), pan (drag), Fit
- [x] Kontrol: ← → step, Space pause, R replay, F fit
- [x] Dark mode (semua warna lewat CSS variable)
- [x] Opsi `size` untuk membesarkan bentuk (misalnya server yang di-scale up)
- [x] Bentuk: `user`, `client` (laptop), `server`, `service`, `db`, `cache`, `lb`, `queue`, `worker`, `cdn`, `card`
- [x] Label pil di garis (`label`, `labelTone`) + panah (`arrow`); pil digambar di atas paket
- [x] Meter di entitas (`meter: { label, value, tone }`), ikon di permukaan atas (`icon`)
- [x] Panel "What changed" (catatan `changes` + selisih metrik otomatis)
- [x] Interaktif (4.5): tebak dulu (`predict`), lab slider (`src/lessons/labs/`), rusak sistemnya (`chaos`) —
      baru dipakai di `request-lifecycle`

### Struktur kursus dan UI
- [x] 9 modul / 40 lesson di `src/course.ts`; lesson yang belum ditulis tampil "soon"
- [x] Layout 3 kolom: sidebar kursus | stage + metrik + timeline | panel step + "You'll learn"
- [x] Home: hero animasi + kartu lesson per modul + progres
- [x] Responsif: drawer sidebar ≤1280px, satu kolom ≤980px
- [x] i18n EN/ID: next-intl untuk pesan UI dan URL berawalan locale; overlay lesson tetap terpisah

### Tooling
- [x] `npm run check:i18n` ([scripts/check-i18n.ts](scripts/check-i18n.ts))
- [x] `npm run test:i18n` dan `npm run check:export` untuk pesan UI dan HTML lesson berbahasa
- [x] Pemeriksa tumpang-tindih di browser ([scripts/check-layout.browser.js](scripts/check-layout.browser.js))

### Lesson (EN + ID)
| # | Modul | Lesson | id | Status |
|---|---|---|---|---|
| 01 | Foundations | How a Request Works | `request-lifecycle` | [x] |
| 01 | Foundations | Latency & Throughput | `latency-throughput` | [x] |
| 01 | Foundations | Napkin Math | `napkin-math` | [x] |
| 02 | Scaling | Vertical vs Horizontal Scaling | `vertical-horizontal` | [x] |
| 02 | Scaling | Load Balancing | `load-balancing` | [x] |
| 02 | Scaling | Stateless Services | `stateless` | [x] |
| 02 | Scaling | Caching | `caching` | [x] |
| 02 | Scaling | CDNs | `cdn` | [x] |
| 09 | Whole Systems | Design a URL Shortener | `url-shortener` | [x] |
| 03 | Data & Storage | SQL vs NoSQL | `sql-nosql` | [x] |
| 03 | Data & Storage | Indexes | `indexes` | [x] |
| 03 | Data & Storage | Storage Engines | `storage-engines` | [x] |
| 03 | Data & Storage | Replication | `replication` | [x] |
| 03 | Data & Storage | Sharding | `sharding` | [x] |

**14 / 40 selesai.** Sisanya ada di bagian 6.

### Riwayat revisi penting
- `replication` pilot **lebih baik dari referensi**: step 1 satu DB tanpa replica, kartu on-call,
  `predict` (step 2 & 6), `chaos` (step 3), metrik `reads on primary`, glosarium stale read / RYW / split brain.
- `request-lifecycle` jadi **lesson acuan visual (4.1b + 4.1c + 4.1d)**: konteks tetap tampil, label di garis,
  meter CPU, metrik yang menjumlah ke total, catatan `changes`, **kartu runtime `trace`** dengan sorotan
  baris aktif (`> `), serta **micro-beats (`step.beats` + `Flow.once`)** agar proses internal bertahap
  (DNS cache → OS → resolver → TTL, TCP lalu TLS, query DB bertahap, TTFB, gelombang HTTP/2, dan loop N+1)
  bergerak selaras dengan narasi YouTube (`?record=1`). Lesson lain belum memakai standar penuh ini (lihat 6).
- `request-lifecycle` ditulis ulang (EN + ID). Sekarang dibuka dengan masalah, tanpa load balancer/CDN,
  dengan case N+1 query dan pembaca jauh, dan recap yang merujuk ke lesson lain.
- `latency-throughput`: load balancer di step 6–10 diganti satu antrean bersama + 4 worker.
- `napkin-math`: load balancer, CDN, dan cache digambar sebagai ghost, dengan rujukan "(Module 02)" di teks.
- Lihat prinsip di bagian 4.1a.

---

## 3. Peta kode

```
app/                       Route statis, metadata, dan pengalihan URL lama
components/                Antarmuka React dan integrasi Stage
src/
  types.ts                 Tipe data: Entity, Link, Flow, Scene, Step, Lesson, LessonOverlay
  course.ts                Daftar modul & lesson (judul EN/ID, warna modul, ready/soon)
  style.css                Semua style; warna lewat CSS variable (light + dark)
  engine/
    iso.ts                 project(x,y,z), convexHull, rayExit
    shapes.ts              Gambar setiap kind + label/sub/badge → { hull, center }
    stage.ts               Stage: setScene (diff + tween), link, paket, kamera, zoom/pan
    svg.ts                 helper svg(), textWidth() via canvas
  i18n/
    en.ts, id.ts           Pesan UI bertingkat; kunci ID disesuaikan dengan EN melalui TypeScript
    routing.ts             Locale dan prefix URL next-intl
    request.ts             Konfigurasi locale dan pemuatan pesan di server
    navigation.ts          Pembentukan URL berbahasa melalui next-intl
    index.ts               Tipe locale dan opsi pemilih bahasa
  lessons/
    helpers.ts             at(u,v), users(), server(), db(), cache(), lb(), queue(), worker(), cdn(), service(), card(), link(), spread()
    localize.ts            Menerapkan overlay terjemahan
    <lesson-id>.ts         Satu file per lesson (sumber EN)
    i18n/id/<lesson-id>.ts Terjemahan Indonesia
  ui/store.ts              Penyimpanan progres dan tema yang kompatibel dengan versi lama
  glossary/
    entries.ts             Kamus istilah EN/ID + lessonId/step (rencana 4.6)
    enrich.ts              Bungkus istilah di HTML prosa step (rencana 4.6)
  engine/shapes.ts         kind `tree` untuk diagram B-tree indeks
scripts/
  check-i18n.ts            node, dijalankan lewat npm run check:i18n
  test-i18n.ts             tes ICU dan error pesan UI
  check-export.ts          validasi HTML statis seluruh lesson dan locale setelah build
  check-layout.browser.js  ditempel di console browser
```

---

## 4. Pola wajib

### 4.1 Struktur sebuah lesson

Setiap lesson = satu `Lesson` di `src/lessons/<id>.ts` (lihat [caching.ts](src/lessons/caching.ts)
sebagai contoh paling lengkap).

- **8–12 step.** Step pertama `setup`, step terakhir `recap`.
- **Alur naratif: masalah → solusi.** Tunjukkan sistemnya gagal atau kesulitan dulu (`problem`, judul
  diawali `Case: …` untuk skenario spesifik), baru teknik/solusinya. Selipkan `tradeoff` dan `insight`.
  Chapter yang tersedia: `setup`, `problem`, `technique`, `solution`, `tradeoff`, `insight`, `recap`.
- **Satu skenario konkret per lesson** (toko tiket, aplikasi resep, situs PR, dan seterusnya), dengan nama
  dan angka yang konsisten dari awal sampai akhir. Jangan pakai skenario yang sama dengan lesson lain.
- **`body`: 2–3 paragraf pendek per step.** Mengalir seperti naskah narator tutorial YouTube yang santai dan
  tidak kaku (lihat standar gaya kalimat di 4.1a #8). Boleh memakai HTML `<b> <i> <code>`, dan
  `<table class="compare">` dengan sel `class="good|bad"`. Jumlah paragraf EN dan ID harus sama persis.
- **`callout`** (opsional, maksimal satu per step): `insight` / `tip` / `warning`, satu sampai dua kalimat.
- **Recap:** satu kalimat pengantar → `<table class="compare">` → paragraf
  `Check yourself: … (jawaban singkat dalam kurung.)`
- **`goals`:** 5 poin, masing-masing menunjuk ke step yang membahasnya (nomor step mulai dari 1).
- **`metrics`:** 3–5 metrik di level lesson. Setiap step hanya menulis nilai yang **berubah**, karena
  nilai lama otomatis terbawa. Pakai `{ v, tone: 'good' | 'bad' | 'warn' }` untuk memberi warna.
- **Angka harus benar.** Hitung ulang setiap perhitungan (kalkulator atau `python3 -c`). Kalau angkanya
  ilustratif, tulis "illustrative".
- `minutes` sekitar 10–15, `level` biasanya `beginner` (modul awal) atau `intermediate`.
- `short` (label timeline) 1–2 kata.

### 4.1a Prinsip pedagogi (hasil review — wajib)

Lesson pertama (`request-lifecycle`) pernah ditulis ulang karena melanggar prinsip-prinsip ini.
Periksa setiap lesson baru terhadap daftar berikut:

1. **Buka dengan masalah atau pertanyaan.** Step 1 harus menunjukkan kenapa topik ini penting
   (keluhan user, sistem yang kewalahan, angka yang tidak masuk akal). Jangan dibuka dengan definisi.
2. **Satu step = satu konsep.** Step mengikuti mekanisme dalam urutan alaminya. Jangan menyelipkan
   konsep sampingan di tengah alur.
3. **Jangan menampilkan komponen dari modul yang belum dipelajari sebagai kotak "nyata".**
   Contoh: load balancer dan CDN tidak boleh muncul di lesson Modul 01 sebagai bagian dari desain.
   Kalau hitungan memang menuntutnya (seperti di Napkin Math), gambar sebagai `ghost: true` dan sebut
   modulnya di teks, misalnya "(Module 02)".
4. **Case (`problem`) harus mewakili penyebab yang mendasar** dan menjadi alasan untuk lesson
   berikutnya. Contohnya "kerja di server" (N+1 query) dan "jarak" (pembaca jauh). Hindari case yang
   terlalu spesifik atau tidak berhubungan dengan topik utama lesson.
5. **Recap menghubungkan ke lesson lain** bila relevan (kolom "see" / "lihat" di tabel).
6. **Model mental harus benar secara teknis.** Contoh: "menambah worker" di teori antrean digambar
   sebagai satu antrean bersama untuk banyak worker (M/M/c), bukan load balancer.
7. **Jangan menghindari struktur yang bagus hanya supaya terlihat berbeda.** Urutan alami sebuah topik
   (misalnya DNS → connect → request → server → response) memang sama di mana-mana dan boleh dipakai.
   Keaslian ada di teks, skenario, nama, angka, dan detail case. Semua itu wajib ditulis sendiri.
8. **Gaya bahasa narator YouTube yang santai, mengalir, dan tidak kaku (standar wajib semua lesson EN + ID).**
   Tulis seolah-olah sedang menjelaskan langsung ke penonton di YouTube — hangat, akrab, mudah dicerna orang
   awam, dan selalu **ditulis orisinal**:
   - **Bahasa Indonesia (`id`):** pakai gaya obrolan yang natural dan hidup (*"lama banget"*, *"padahal waktu kamu
     buka..."*, *"nah, kok bisa..."*, *"biar kita tahu..."*, *"kita bakal lihat satu per satu..."*, sapaan
     *"kamu"* / *"kita"*). Hindari terjemahan kaku/buku teks (*"untuk mengetahui mengapa..."*, *"lacak satu klik..."*).
   - **Bahasa Inggris (`en`):** pakai gaya narasi lisan yang sama mengalirnya (*"takes forever to load"*,
     *"So how can..."*, *"let’s follow a single click..."*, *"we’ll watch what happens behind the scenes..."*).
   - **Ritme antar-paragraf:** buka dengan situasi nyata → selipkan kalimat transisi/pertanyaan pancingan yang
     bikin penasaran (mis. *"Nah, kok bisa beda sejauh itu?"*) → arahkan mata penonton ke diagram di atasnya.
   - Istilah glosarium (`DNS`, `TTL`, `TCP`, `TLS`, `RTT`, `TTFB`, `N+1`, dll.) tetap muncul wajar di teks agar
     tooltip tetap aktif, selalu disertai penjelasan singkat yang membumi.

### 4.1b Diagram harus bercerita (wajib untuk lesson baru)

Acuannya [request-lifecycle.ts](src/lessons/request-lifecycle.ts). Pesan sebuah step harus bisa
ditangkap **dari diagramnya saja**, tanpa membaca teks:

1. **Konteks tetap tampil.** Komponen yang sudah diperkenalkan tetap di stage pada step-step berikutnya,
   dengan status terbarunya (misalnya resolver dengan label `cached · 5 min`). Buang hanya kalau memang
   tidak relevan lagi dengan cerita.
2. **Anotasi di tempat kejadian.** Gunakan label di garis untuk apa yang lewat (`GET /storm-warning`,
   `SELECT author × 40` dengan `labelTone: 'bad'`), badge untuk status entitas (`41 queries · 410 ms`),
   dan `meter` untuk utilisasi (CPU, antrean, memori). Satu step maksimal sekitar 3–4 anotasi.
3. **Tunjukkan kontras penyebab.** Kalau case-nya "yang lambat bukan X", buat X terlihat sehat
   (misalnya meter CPU rendah dan hijau) sementara Y merah.
4. **`arrow: true`** pada garis yang membawa trafik. Engine memilih sendiri: **⟷ dua arah** kalau ada flow
   yang bolak-balik di garis itu (`bounce`, atau hop `~` terbalik), **→ satu arah** kalau tidak.
   Bisa dipaksa dengan `arrow: 'end'` atau `arrow: 'both'`. Jangan pasang panah satu arah pada alur
   request/response.
   Label garis otomatis diletakkan **di samping garis** (digeser tegak lurus ke sisi atas), tidak pernah
   menimpa garis atau paket. Jadi jangan mengakali posisi label dengan spasi atau karakter tambahan.
5. **Metrik yang menjumlah.** Kalau topiknya biaya atau waktu, susun metrik sebagai komponen + total
   (contoh: DNS + connect + request/server + download = page ready), dan pastikan angkanya benar-benar
   menjumlah.
6. **`changes`** di setiap step (kecuali step 1): 1–3 catatan kualitatif berawalan `+ ` / `~ ` / `- `.
   Perubahan metrik sudah otomatis ditampilkan, jadi jangan ditulis ulang di sini.
7. **Trafik tenang.** Sekitar 1–3 paket/detik per flow. Di step case, kurangi trafik normal supaya trafik
   bermasalah (`slow`, `fail`) yang menonjol.
8. Pakai `client` (laptop) untuk browser atau user tunggal, dan `users` untuk kerumunan.
   Pakai `icon` (`globe`, `server`, `database`, `bolt`) untuk membantu mengenali bentuk.
9. Label di garis sebaiknya pendek (≤ 22 karakter) dan jarak antar-entitas cukup lebar (`u` ≥ 18–20)
   supaya pilnya tidak menutupi seluruh garis.

### 4.1c Visual Mental Modeling & Runtime Trace (Standar Tutorial YouTube / `?record=1`)

Karena materi dipakai untuk tutorial YouTube (terutama mode `?record=1` yang menyembunyikan panel kanan
dan hanya menampilkan judul, metrik, dan stage), **hal-hal internal runtime yang biasanya tak terlihat**
harus divisualkan secara presisi di atas stage:

1. **Buat proses internal runtime eksplisit (bukan kotak hitam).** Gunakan kartu `card` dengan id konsisten
   (misalnya `trace`) yang posisinya stabil antar-step (di `request-lifecycle`: `(24, 21–22)`, bergeser ke
   `(30, 23–24)` hanya saat ada entitas tambahan di bawah) agar mata penonton tetap terkunci pada "panel
   eksekusi runtime": rantai cache miss DNS, pesan handshake per RTT, tumpukan kerja server per milidetik,
   rincian TTFB, gelombang waterfall HTTP/2, atau loop N+1 query.
2. **Sorot baris eksekusi aktif dengan prefiks `> `.** Kartu mendukung 4 prefiks warna/sorot: `! ` (merah/masalah),
   `✓ ` (hijau/selesai), `# ` (abu-abu/catatan), dan `> ` (biru + strip sorot untuk langkah/kesimpulan yang
   sedang aktif). Jangan mengubah perataan kolom monospace.
3. **Arah dan ritme paket harus jujur terhadap mekanisme.** Setiap step harus punya pembeda visual yang jelas
   dari step sebelumnya: saat membahas response kembali (TTFB), alirkan paket satu arah ke client
   (`route: ['~bw'], kind: 'res'`) dan buat link database `dashed: true, label: 'idle'`, bukan mengulang flow
   bolak-balik yang identik dengan step query.
4. **Perlihatkan sebab-akibat angka langsung di diagram.** Kontras seperti "CPU turun ke 15% padahal waktu
   server naik ke 440 ms karena I/O wait" atau "99% waktu pembaca jauh habis di jarak, kerja server tetap 25 ms"
   wajib terlihat dari kombinasi badge + meter + kartu `trace` tanpa perlu membaca paragraf kanan.
5. **Sinkronkan kartu runtime dengan Lab (`src/lessons/labs/`).** Bila step memiliki lab slider, perbarui
   kartu `trace` di `compute()` agar persamaan/breakdown ikut bergerak live bersama metrik dan kecepatan paket.

### 4.1d Micro-beats di Dalam Step (`step.beats` & `Flow.once`)

Agar satu step yang menjelaskan beberapa fase berurutan tidak terasa kaku atau diam membeku saat dinarasikan:

1. **Gunakan `step.beats?: SceneBeat[]`** (`src/types.ts`, diselesaikan lewat `resolveBeat` di `src/lessons/beats.ts`).
   - Setiap beat menimpa sebagian properti `step.scene` (`entities`, `links`, `flows`, `metrics`, `duration`, `label`)
     tanpa memecah sidebar/timeline jadi puluhan step.
   - `step.scene` dan `step.metrics` tetap menyimpan **state akhir yang lengkap** dari step tersebut agar
     perhitungan metrik step berikutnya, `chaos`, `lab`, dan SSR tetap konsisten.
2. **Gunakan `Flow.once`** (`once?: number`) untuk alur sekuensial satu kali tembak (misalnya 1× handshake TCP,
   1× byte pertama TTFB, atau 3× query database), bukan berputar terus-menerus seperti screensaver.
3. **Kontrol perekaman YouTube (`?record=1` & mode lebar) & pembaca web:**
   - Di browser normal, `.beat-card` tampil di pojok kiri bawah panel kanan (tepat di bawah `.learn-card`
     "Yang akan kamu pelajari") agar tidak mengurangi tinggi visualisasi diagram.
   - Tombol **Wide / Lebar** di header atas (atau shortcut `[`) menyembunyikan sidebar kiri kursus,
     menyembunyikan kartu *Rusak sistemnya* (`ChaosCard`) dan lab *Coba sendiri* (`LabCard`), serta memadatkan
     timeline *"Di pelajaran ini"* menjadi satu baris pil ringkas agar ruang visualisasi graph maksimal saat
     screen recording. Class `is-wide` di `<html>` menyembunyikan pill
     durasi/level/step, ringkasan lesson, tombol ulang/jeda/pas, hint stage, dan beat-card (shortcut beat tetap aktif).
   - Mode `?record=1` menyembunyikan elemen yang sama di area lesson plus seluruh header, sidebar, dan panel step.
   - Beat **tidak** auto-advance: pembaca (dan narator) memajukan beat manual lewat tombol/dot di `.beat-card`,
     **`↓` / `.`** (berikutnya), **`↑` / `,`** (sebelumnya), atau **`R`** (ulang dari beat pertama).
   - Di mode rekam `?record=1`, `.beat-card` disembunyikan; narator tetap memakai shortcut keyboard yang sama.
4. **Terjemahan beat (`i18n`):** semua `beat.label`, teks kartu/badge/link di dalam `beats` otomatis diterjemahkan
   lewat `labels` di `LessonOverlay` dan divalidasi oleh `npm run check:i18n` serta `npm run test`.
5. **Prosa panel kanan vs micro-beat (patokan YouTube).** Teks step **tidak** boleh menginstruksikan UI
   (jangan: "geser beat bar", "per micro-beat", "lihat baris berganti ✓"). Narasi harus bisa dibacakan seperti
   voice-over sambil beat dimajukan manual di keyboard. **Urutan kalimat** mengikuti fase beat yang sama;
   angka di prosa harus selaras dengan kartu `trace` dan metrik. Acuan resmi: **step 6 Response** di
   `request-lifecycle` (`body[0]`–`body[3]`, ID persis seperti di bawah; EN padanan struktur sama):

   - *Hook:* stopwatch sudah jalan sebelum byte HTML pertama sampai.
   - *Akumulasi:* DNS + TCP + TLS (~100 ms) → request + server (~40 ms) → 140 ms sebelum jawaban dikirim
     (beat 1–2 + baris trace).
   - *TTFB:* byte pertama pulang ~15 ms → total 155 ms; definisi TTFB tanpa meta UI (beat 3).
   - *Setelah TTFB:* browser gambar sambil download; teaser 40 file (beat 4–5).

   Cuplikan ID (`src/lessons/i18n/id/request-lifecycle.ts`, step Response):

   > Sejak kamu menekan Enter, stopwatch sudah berjalan, padahal belum ada satu byte HTML pun yang sampai.
   >
   > Pertama, ada DNS, jabat tangan TCP, dan TLS. Ketiganya memakan waktu sekitar 100 ms. Setelah itu browser
   > mengirim request, dan server memprosesnya di data center. Ini menambah sekitar 40 ms lagi. Jadi, 140 ms sudah
   > terpakai sebelum server mulai mengirim jawabannya.
   >
   > Lalu byte pertama dari HTML itu dikirim dan menempuh perjalanan pulang ke browser, sekitar 15 ms. Saat byte
   > itu tiba, total waktunya 155 ms. Angka inilah yang disebut TTFB, singkatan dari time to first byte: semua
   > waktu tunggu tadi, ditambah perjalanan pulang untuk satu byte pertama.
   >
   > Tapi browser tidak menunggu HTML-nya selesai diunduh. Begitu byte-byte pertama masuk, ia langsung mulai
   > membaca dan menggambar halaman. Nah, di dalam HTML itu ada rujukan ke 40 file lain. Itulah yang akan kita
   > bahas selanjutnya.

### 4.2 Scene dan layout

- Tulis posisi dengan `at(u, v)` lewat helper: `u` = kanan, `v` = bawah. Jangan pakai `x/y` isometrik mentah.
- **Jarak aman:**
  - Antar-kolom: `u` berjarak sekitar 10–14.
  - Server/kotak yang ditumpuk vertikal: **`v` minimal 17** kalau ada badge (DOWN, dan sejenisnya);
    15 kalau tanpa badge.
  - Kartu (`card`) diletakkan di area kosong, biasanya di atas (`v` −18 sampai −26) atau di kanan.
- **Pakai id entitas yang sama antar-step** supaya engine menganimasikan perpindahannya
  (misalnya `app` bergeser dari satu server ke tengah fleet). Id baru = muncul, id hilang = memudar.
- Buat **fungsi builder scene** per lesson (`fleet()`, `pool()`, `aside()`, `edges()`) supaya
  step-step memakai tata letak yang sama dan hanya berbeda di bagian yang berubah.
- Hindari garis yang menembus entitas lain: susun melengkung atau radial (lihat `BACKENDS` di
  [latency-throughput.ts](src/lessons/latency-throughput.ts) dan `GRID` di [napkin-math.ts](src/lessons/napkin-math.ts)).
- **Flow:**
  - `route` adalah urutan id link; awali dengan `~` untuk melewati link secara terbalik.
  - `bounce: true` = response kembali; `fail: 0–1` = peluang gagal saat tiba; `speed` dalam px/s.
  - `kind`: `req` (biru), `res` (hijau), `slow` (oranye), `write` (ungu), `fail` (merah), `poison` (magenta), `ping` (abu-abu).
  - Pakai `spread(routes, totalRate, opts)` untuk membagi trafik ke beberapa server.
  - Rate total per scene sekitar 2–5 paket/detik. Lebih dari itu jadi ramai.
- `legend` hanya berisi kind yang benar-benar muncul di lesson itu, dengan label kontekstual
  (misalnya `['slow', 'cache miss']`).
- Status visual: `down: true` (abu-abu + badge DOWN), `ghost: true` (garis putus-putus = belum ada/rencana),
  `badge: { text, tone }`, `size` untuk mesin yang lebih besar.

### 4.3 Terjemahan (wajib untuk setiap lesson)

- File: `src/lessons/i18n/id/<lesson-id>.ts`, `export default` sebuah `LessonOverlay`.
- **Prosa** dicocokkan **berdasarkan posisi**: `steps[i].body[j]`, `callout`, `goals[i]`, `metrics[i]`
  (label metrik). Jumlah paragraf **harus sama** dengan versi EN.
- **String diagram** dicocokkan **berdasarkan teks Inggris persis** lewat `labels`. Ini mencakup label,
  sub, judul kartu, baris kartu, badge, label garis, label meter, nilai metrik, dan label legend.
- **`changes`** diterjemahkan berdasarkan posisi (`steps[i].changes[j]`); jumlahnya harus sama.
  - Untuk baris kartu yang berawalan `! ` / `✓ ` / `# ` / `> `, kuncinya adalah teks **tanpa** prefiks.
  - Jaga perataan kolom di baris kartu (font monospace).
- Istilah teknis yang lazim tetap dalam bahasa Inggris: cache, load balancer, request, response,
  latency, throughput, shard, replica, queue, worker, deploy, dan sejenisnya.
- Format angka Indonesia: `1.500`, `0,5 ms`, `dtk`, `mnt`, `jt`, `rb`.
- Gaya bahasa: santai, akrab, dan mengalir seperti narator YouTube (sapaan "kamu"/"kita", transisi natural
  seperti *"nah"*, *"padahal"*, *"biar kita tahu"*) — bukan bahasa terjemahan kaku. Ikuti standar 4.1a #8 dan
  lihat contoh terbarunya di `src/lessons/i18n/id/request-lifecycle.ts`.
- Judul lesson di sidebar juga perlu versi ID di `course.ts` (`ready(lesson, 'Judul ID')`).
- Jalankan `npm run check:i18n` sampai hasilnya `OK`.

### 4.4 Engine dan UI

- Bentuk baru ditambahkan di `drawShape()` di [shapes.ts](src/engine/shapes.ts):
  - Tambahkan `kind` ke `EntityKind` di `types.ts`.
  - Warnanya berupa variabel `--k-<kind>` (light **dan** dark) plus kelas `.k-<kind>` di `style.css`.
  - Buat helper di `helpers.ts`.
  - Kembalikan `points` (untuk outline) dan `h` (tinggi). Label, badge, dan hull dibuat otomatis.
- Jangan menulis warna langsung di TS. Semua warna lewat CSS variable supaya dark mode tetap jalan.
- String UI baru: tambahkan ke `src/i18n/en.ts` **dan** `src/i18n/id.ts`.
- Jangan menambah dependency runtime. Kalau benar-benar perlu, diskusikan dulu.
- Komentar kode seperlunya saja (hanya untuk hal yang tidak jelas dari kodenya).

### 4.5 Fitur interaktif (pola percobaan: `request-lifecycle`)

Tujuannya agar pembaca **berpikir dan mencoba**, bukan hanya menonton. Pakai seperlunya: fitur ini
membantu kalau ada satu pertanyaan atau satu eksperimen yang jelas, bukan di setiap step.

**Tebak dulu (`step.predict`)** — data biasa di lesson.
- `{ question, options[], answer, explain }`. Selama belum dijawab, stage dan metrik menampilkan
  **step sebelumnya** dan isi step disembunyikan; setelah menjawab (atau "Lewati"), hasilnya terungkap.
- Pakai 2–3 per lesson, di step yang hasilnya **mengejutkan atau bisa dihitung** (contoh: CPU justru
  turun saat N+1). Jangan menanyakan definisi. Pengecoh harus masuk akal; jawaban benar harus konsisten
  dengan metrik step itu.
- Judul step tetap terlihat, jadi jangan sampai judulnya membocorkan jawaban.
- Jawaban tersimpan di `localStorage` (`stl:predict`). Tombol `1`–`n` memilih, `→` melewati.
- Overlay ID: `steps[i].predict = { question, options[], explain }` dengan jumlah opsi yang sama.

**Rusak sistemnya (`step.chaos`)** — data biasa di lesson.
- `{ <entityId>: { text, metrics? } }`. Entitas itu bisa diklik (atau lewat tombol di kartu) untuk
  dimatikan: tampil `down`, paket yang tiba di sana gagal, dan `metrics` menimpa nilai step.
- Engine: `Stage.setChaos(breakable, broken)` bersifat opt-in, jadi lesson lain tidak terpengaruh.
- Tulis `text` yang menjelaskan **akibat dan alasannya**, termasuk kasus "belum terjadi apa-apa"
  (contoh: resolver mati tapi jawabannya masih di-cache). Pilih step yang semua komponennya tampil.
- Overlay ID: `steps[i].chaos = { <entityId>: 'teks' }` dengan kunci yang sama; nilai `metrics` lewat `labels`.

**Lab slider (`src/lessons/labs/<lesson-id>.ts`)** — kode, bukan data lesson.
- Lesson dikirim dari server ke client sebagai props, jadi **tidak boleh berisi fungsi**. Lab didaftarkan
  di [labs/index.ts](src/lessons/labs/index.ts) dan dicari dengan `labFor(lessonId, step)`.
- `compute(values, locale, baseScene)` mengembalikan `metrics`, `scene` (turunan dari scene step yang sudah
  diterjemahkan, supaya label tetap berbahasa benar), dan satu kalimat `note`.
- **Model harus sama dengan angka step statis.** Tulis tes yang membandingkan rumus dengan metrik
  step (lihat [scripts/test-labs.ts](scripts/test-labs.ts)). Tandai rumus yang ilustratif.
- Metrik berubah langsung saat slider digeser; diagram menyusul ±180 ms supaya paket tidak terus di-reset.
- Lab paling cocok di recap atau step "kenapa", dan sebaiknya bisa menjawab pertanyaan "Check yourself".

Layout: step dengan kartu lab/chaos memberi diagram tinggi tetap (`.center.has-play`) dan kolomnya bisa
di-scroll, supaya diagram tidak tertekan.

### 4.6 Glosarium saat hover (tooltip istilah)

**Tujuan:** Istilah seperti RTT, p99, atau N+1 menampilkan **definisi singkat** dan **tautan ke lesson
terkait** saat hover (dan fokus keyboard), tanpa menambah paragraf penjelasan di teks lesson. Pemula
dapat mengecek arti istilah; pembaca lanjutan tidak terganggu.

**Prinsip:**

1. **Satu kamus pusat** — jangan menulis definisi panjang di setiap `body` step. Teks lesson tetap
   mengikuti 4.1 (2 paragraf); glosarium hanya lapisan UI.
2. **Definisi pendek** — kira-kira satu kalimat (maks. ~120 karakter EN / ~140 karakter ID). Detail
   ada di lesson yang ditautkan.
3. **Jangan paksa markup di lesson** — deteksi otomatis dari teks yang sudah ada; markup eksplisit
   hanya untuk edge case (lihat di bawah).
4. **Selaras i18n** — definisi EN/ID di kamus; istilah teknis yang lazim (cache, latency, …) boleh
   tetap Inggris di overlay ID, sama seperti 4.3.
5. **Tanpa dependency baru** — tooltip pakai CSS + sedikit React (atau HTML setelah enrich), accessible
   dengan `:focus-within` / `tabindex="0"`.

**Model data** (`src/glossary/entries.ts`):

```ts
export type GlossaryEntry = {
  /** Kunci stabil, misalnya `rtt` */
  id: string;
  /** String yang dicocokkan (case-insensitive), urutkan panjang dulu saat regex */
  match: string[];
  definition: { en: string; id: string };
  /** Kepanjangan singkatan (DNS → Domain Name System); tampil di tooltip sebelum definisi. */
  expansion?: { en: string; id: string };
  /** Lesson siap di `course.ts`; kalau `soon`, tautan hanya judul modul / "belum tersedia" */
  lessonId?: string;
  /** Step opsional (1-based) — langkah yang paling mengajarkan istilah itu */
  step?: number;
};
```

Contoh entri awal (isi boleh disesuaikan saat implementasi):

| id | match (contoh) | lessonId | step |
|---|---|---|---|
| `rtt` | RTT, round-trip time | `request-lifecycle` | 4 |
| `n-plus-one` | N+1, N+1 query | `request-lifecycle` | 8 |
| `p99` | p99, p95, percentile | `latency-throughput` | 7 |
| `throughput` | throughput | `latency-throughput` | 3 |
| `load-balancer` | load balancer, load balancing | `load-balancing` | 2 |
| `cache-hit` | cache hit, cache miss | `caching` | 4 |
| `cdn` | CDN | `cdn` | 2 |
| `stateless` | stateless | `stateless` | 3 |

Tambah entri seiring lesson baru; jangan mendefinisikan istilah untuk modul yang belum `ready`.

**Alur render** (panel step, predict explain, chaos text, callout — **bukan** label diagram/SVG):

1. Lesson tetap string HTML seperti sekarang (`dangerouslySetInnerHTML` di [ScaleLab.tsx](components/ScaleLab.tsx)).
2. Sebelum render, jalankan `enrichGlossary(html, locale)`:
   - Parse ringan atau scan dengan regex **hanya di node teks** (skip tag `code`, isi atribut).
   - Untuk setiap `match`, gunakan word boundary; urutkan pola dari yang terpanjang agar `round-trip time`
     tidak terpotong jadi `RTT` + sisa.
   - Bungkus ke `<span class="gloss" data-gloss="rtt" tabindex="0">…</span>` (class untuk gaya + tooltip).
3. Tooltip: popover dengan `expansion` + `definition` (locale aktif) + link lesson.
4. **Daftar singkatan di stage** (pojok kanan atas, di atas legend paket): `glossaryInProse()` memindai
   judul + body + callout step; tiap entri yang punya `expansion` tampil sebagai `TCP (Transmission Control Protocol)`.
   `/{locale}/lessons/{lessonId}/{step}/` memakai pola yang sama dengan `lessonPath` di ScaleLab.
4. Jika `lessonId` belum punya `lesson` di course → tampilkan definisi saja, atau link ke halaman modul
   tanpa step (keputusan implementasi; catat di checklist).

**Markup eksplisit (opsional, jarang):**

- Jika auto-match salah (misalnya akronim di dalam nama produk), tulis di lesson EN:
  `<span data-gloss="rtt">RTT</span>` dan biarkan enrich hanya mengisi yang belum dibungkus.
- Jangan pakai markup wajib di semua lesson — itu melanggar prinsip (3).

**CSS** ([src/style.css](src/style.css)):

- `.gloss`: garis bawah putus-putus atau titik, cursor `help`, warna `--text-muted`.
- Tooltip: posisi di atas teks di desktop; di bawah kalau tidak muat (heuristik viewport sederhana atau
  `position: fixed` pada hover — hindari tooltip terpotong `.step-card` `overflow`).
- Link di tooltip memakai style `.learn a` atau varian kecil; kontras light + dark.
- **Touch:** tap pertama fokus + buka tooltip; tap di luar menutup (listener ringan di client).

**Pengujian:**

- Unit: `enrichGlossary` tidak mengubah isi `<code>`, tidak merusak `<table class="compare">`, tidak
  match substring di dalam kata (`app` ≠ `application` kecuali ada entri).
- `npm run check:i18n`: tidak wajib untuk kamus (bilingual di entri), kecuali ada string UI baru
  (`glossary.openLesson`, `glossary.soon`).
- Visual: step ramai (`request-lifecycle` step 8, `latency-throughput` recap) EN + ID, tooltip tidak
  menabrak sidebar.

**Rollout:**

1. Implementasi kamus + enrich + CSS.
2. Uji pada lesson yang sudah `ready` (9 lesson); perbaiki false positive.
3. Centang di bagian 2.
4. Nanti **Search ⌘K** dapat mengindeks `id`, `match`, dan `lessonId` dari file yang sama.

**Tidak termasuk (v1):** glosarium di label SVG stage, di home hero, atau definisi panjang multi-paragraf.

---

## 5. Alur kerja menambah satu lesson (Definition of Done)

1. Tulis `src/lessons/<id>.ts` (EN) mengikuti 4.1, **4.1a**, **4.1b**, dan 4.2.
2. Di `src/course.ts`: import lesson-nya, lalu ganti `soon('<id>', …)` dengan `ready(<lesson>, '<Judul ID>')`.
3. `npm run typecheck` harus bersih.
4. Buka `npm run dev` → `/en/lessons/<id>/1/` dan `/id/lessons/<id>/1/`, jalankan semua step, dan pastikan tidak ada error di console.
5. Tempel [scripts/check-layout.browser.js](scripts/check-layout.browser.js) di console dengan
   `?lang=en` sampai `Layout OK`. Perbaiki posisi kalau ada tumpang-tindih.
6. Tulis `src/lessons/i18n/id/<id>.ts` mengikuti 4.3 → `npm run check:i18n` harus `OK`.
7. Ulangi langkah 5 dengan `?lang=id`, karena label Indonesia biasanya lebih lebar.
8. Lihat sendiri minimal step yang paling ramai, di light dan dark mode.
9. `npm run build` harus lolos.
10. Centang lesson itu di bagian 2 dan 6 dokumen ini.
11. Setelah glosarium (4.6) ada: tambahkan entri kamus untuk istilah baru yang muncul di lesson itu
    (definisi singkat + `lessonId` / `step`).

---

## 6. Roadmap

Urutan pengerjaan yang disarankan: modul 03 → 04 → 05 → 06 → 07 → 08 → 09.
Skenario di bawah ini hanya usulan. Boleh diganti, asalkan tetap satu skenario konkret per lesson dan
tidak sama dengan lesson lain. Kolom "Engine" mencatat bentuk atau fitur yang mungkin perlu ditambahkan.

### 03 · Data & Storage (5/11)
| Lesson | id | Usulan skenario / poin | Engine |
|---|---|---|---|
| [x] SQL vs NoSQL | `sql-nosql` | Aplikasi event/tiket: relasi & transaksi vs dokumen/key-value; pola akses menentukan pilihan | — |
| [x] Indexes | `indexes` | Pencarian pesanan per email: full scan vs B-tree, index komposit, biaya tulis | bentuk **tree/B-tree** (node bertingkat) |
| [x] Storage Engines | `storage-engines` | B-tree vs LSM (memtable, SSTable, compaction), write vs read amplification | bentuk **tumpukan file/level** (`stack`) |
| [x] Replication | `replication` | Leader + follower, read replica, replication lag, failover, sinkron vs asinkron | — |
| [x] Sharding | `sharding` | Framebag metadata foto: range vs hash, hot tenant, scatter-gather, resharding | — |
| [ ] Consistent Hashing | `consistent-hashing` | Cache cluster bertambah node: mod N vs ring, virtual node | bentuk **hash ring** |
| [ ] Unique IDs at Scale | `unique-ids` | Auto-increment vs UUID vs Snowflake (timestamp + node + seq), pengurutan | — |
| [ ] CAP & Consistency | `cap` | Partisi jaringan antar-region; CP vs AP; strong vs eventual; read-your-writes | link **terputus** (partition) |
| [ ] Consensus & Leaders | `consensus` | Pemilihan leader (Raft-like), quorum, split brain, term | — |
| [ ] Transactions & Isolation | `transactions` | Transfer saldo: ACID, anomali (lost update, dirty read), level isolasi | — |
| [ ] Files & Media | `files` | Upload video: object storage, presigned URL, transcoding async, CDN | — |

### 04 · Communication (0/4)
| Lesson | id | Usulan skenario / poin | Engine |
|---|---|---|---|
| [ ] REST, RPC & GraphQL | `apis` | Aplikasi mobile + backend: resource vs RPC vs query; over/under-fetching; versioning | — |
| [ ] Message Queues | `queues` | Pemrosesan pesanan: decoupling, buffering lonjakan, ack, retry, dead-letter queue | — |
| [ ] Pub/Sub & Events | `pubsub` | Event "order placed" ke banyak konsumen; fan-out; event vs command; ordering | — |
| [ ] Real-time Updates | `realtime` | Skor pertandingan live: polling vs long-polling vs SSE vs WebSocket; koneksi per server | — |

### 05 · Reliability (0/4)
| Lesson | id | Usulan skenario / poin | Engine |
|---|---|---|---|
| [ ] Redundancy & Failover | `redundancy` | Multi-AZ, active-passive vs active-active, RPO/RTO | bentuk **zona/region** (area latar) |
| [ ] Rate Limiting | `rate-limiting` | API publik: token bucket, sliding window, per user/IP, 429 | — |
| [ ] Timeouts & Retries | `timeouts-retries` | Dependency lambat: timeout, retry storm, exponential backoff + jitter, circuit breaker | — |
| [ ] Observability | `observability` | Insiden checkout: metrics, logs, traces, SLO & error budget | — |

### 06 · Architecture (0/4)
| Lesson | id | Usulan skenario / poin | Engine |
|---|---|---|---|
| [ ] Monolith vs Microservices | `microservices` | Startup yang tumbuh: batas tim, deploy independen, biaya jaringan & operasional | — |
| [ ] Service Discovery | `service-discovery` | Instance naik-turun: registry, DNS, health, client vs server-side discovery | — |
| [ ] Sagas | `sagas` | Booking perjalanan (hotel+pesawat): 2PC vs saga, kompensasi, orkestrasi vs koreografi | — |
| [ ] Batch vs Stream | `batch-stream` | Laporan penjualan: batch harian vs stream real-time, windowing, late events | — |

### 07 · Security (0/3)
| Lesson | id | Usulan skenario / poin | Engine |
|---|---|---|---|
| [ ] Authentication | `authn` | Login: password hashing, session vs token, MFA, OAuth/OIDC | — |
| [ ] Authorization | `authz` | SaaS multi-tenant: RBAC vs ABAC, cek di server, IDOR | — |
| [ ] Encryption & Keys | `encryption` | TLS in transit, at rest, KMS, envelope encryption, rotasi kunci | — |

### 08 · Shipping (0/2)
| Lesson | id | Usulan skenario / poin | Engine |
|---|---|---|---|
| [ ] Testing | `testing` | Piramida test, contract test, test di production (canary) | — |
| [ ] CI/CD & Deploys | `deploys` | Pipeline, rolling vs blue-green vs canary, feature flag, rollback, migrasi DB aman | — |

### 09 · Whole Systems (1/4)
| Lesson | id | Usulan skenario / poin | Engine |
|---|---|---|---|
| [ ] HLD & LLD | `hld-lld` | Dari kebutuhan ke diagram tingkat tinggi lalu detail komponen | — |
| [x] Design a URL Shortener | `url-shortener` | — | — |
| [ ] Design a News Feed | `news-feed` | Fan-out on write vs read, akun selebriti, ranking, cache timeline | — |
| [ ] Design a Chat System | `chat` | WebSocket gateway, presence, urutan pesan, offline delivery, reconnect storm | — |

### Upgrade visual lesson lama (ke standar 4.1b + 4.1c)
- [x] `request-lifecycle` (4.1b + 4.1c + 4.1d: kartu runtime `trace`, prefiks `> `, micro-beats + `Flow.once`, arah respon `~bw`, lab sync)
- [ ] `latency-throughput` (meter utilisasi di worker, label antrean, kartu runtime antrean M/M/c)
- [ ] `napkin-math`
- [ ] `vertical-horizontal` (meter CPU di server, kartu runtime kapasitas)
- [ ] `load-balancing` (meter per server, label algoritme, state health check)
- [ ] `stateless` (visual state session di memori vs external store)
- [ ] `caching` (label hit/miss di garis, meter hit rate, runtime lookup path)
- [ ] `cdn` (label RTT di garis, kartu breakdown edge hit vs origin miss)
- [ ] `url-shortener`

### Platform
- [x] Migrasi UI ke Next.js (bagian 8).
- [x] **Glosarium hover (4.6):** `entries.ts` + `enrich.ts` + style tooltip; panel step (+ callout / predict / chaos)

### Fitur interaktif (4.5) — sebarkan ke lesson lain setelah diuji di `request-lifecycle`
- [x] `request-lifecycle`: predict di step 3, 8, 9; chaos di step 5; lab di step 10
- [ ] Evaluasi dengan pembaca dulu (apakah pertanyaan dan lab membantu?) sebelum menyebarkan
- [ ] `latency-throughput` (lab: arrival rate vs jumlah worker → antrean), `load-balancing` (chaos: matikan server),
      `caching` (lab: hit rate → beban DB), `cdn` (lab: jarak pembaca)

### Ide fitur (opsional, setelah lesson)
- [ ] Search ⌘K (judul lesson, step, istilah dari kamus 4.6)
- [ ] Deploy ke Vercel / GitHub Pages
- [ ] Bahasa ketiga (routing dan `LOCALES`, kamus UI, judul di `course.ts`, overlay per lesson)
- [ ] Jadikan pemeriksa layout perintah `npm` (misalnya dengan Playwright) supaya bisa jalan di CI

---

## 7. Catatan dan jebakan yang sudah diketahui

- **Screenshot dari browser otomatis kadang menampilkan frame lama** karena `requestAnimationFrame`
  di-throttle. Sebelum screenshot, jalankan frame dulu sekitar 1 detik. Verifikasi state lewat DOM
  (opacity `1` di `.layer-ents > g`), jangan hanya dari gambar.
- Kalau di `scaled()`/builder ada `extra`, gabungkan `extra` **paling akhir** supaya bisa menimpa
  entitas bawaan. Pernah ada bug karena urutan ini.
- Label Indonesia lebih panjang. Kartu yang pas di EN bisa menabrak di ID, jadi selalu cek kedua bahasa.
- `exactOptionalPropertyTypes` aktif. Untuk properti opsional kondisional, pakai
  `...(cond && { prop })`, jangan `prop: cond ? x : undefined`.
- Periksa port sebelum menjalankan server tambahan; jangan hentikan server milik user.
- Pil label garis ada di layer tersendiri (`layer-labels`), di atas paket dan di bawah entitas. Kalau
  menambah elemen per-link lain, ingat untuk ikut menghapusnya saat link dibuang.
- Jangan ubah `.stage-card` menjadi `flex-basis: auto`: ukuran intrinsik SVG membuat kartu membesar dan
  timeline terdorong ke bawah di lesson lain. Atur tinggi khusus lewat `.center.has-play`.

---

## 8. Migrasi ke Next.js

Status: **implementasi App Router dan static export selesai**. Backend, Practice, Design Lab,
search, glosarium (4.6), dan OG image khusus masih pekerjaan mendatang.

### Pola implementasi

- `app/(entry)/` memilih bahasa dan menerjemahkan URL hash lama di client. URL baru berbentuk
  `/en/lessons/<id>/<step>/` dan `/id/lessons/<id>/<step>/`.
- next-intl mengelola pesan UI dan pembentukan URL. Tidak ada middleware pada static export;
  layout memvalidasi locale lalu memanggil `setRequestLocale` sebelum memuat pesan.
- `app/[lang]/` membuat halaman statis untuk setiap lesson siap dan setiap step. Metadata judul,
  deskripsi, dan bahasa alternatif dibuat per halaman; teks lesson ada di HTML hasil build.
- `components/ScaleLab.tsx` mengelola UI React. `Stage` tetap imperatif, dibuat di effect dan
  dihancurkan saat unmount. Animasi dan koordinat per frame tidak disimpan dalam state React.
- Lesson dan overlay tetap data terpisah. `localize.ts` memuat overlay di server; saat menambah
  terjemahan, daftarkan loader di sana dan jalankan `npm run check:i18n`.
- Kunci progres dan preferensi tetap `stl:visited`, `stl:last`, `stl:theme`, dan `stl:lang`.
  Progres berasal dari `localStorage` setelah hydration; angka awal dapat sebentar terlihat kosong.
  Storage terikat origin termasuk port: untuk memakai progres dari `localhost:5173`, hentikan Vite
  dan jalankan `npm run dev -- --port 5173`; `localhost:3000` memiliki storage terpisah.
- Static export tidak menyediakan route handler, server action, atau redirect server dinamis.
  Backend nanti memerlukan pilihan deployment dan perubahan konfigurasi serta implementasi,
  bukan sekadar menghapus `output: 'export'`. Deployment di subpath memerlukan konfigurasi tambahan.
- `scripts/check-layout.browser.js` adalah pemeriksa heuristik, bukan pengganti review visual.
  Jalankan di origin pengujian: script mengunjungi seluruh step dan sementara mengubah progres.

### Checklist

- [x] Setup Next.js, static export, routing EN/ID dan metadata.
- [x] Migrasi shell, player, keyboard, tema dan integrasi SVG ke React.
- [x] Pengalihan URL hash lama dan kompatibilitas kunci progres.
- [x] Perbarui pemeriksa i18n dan layout serta hapus entry point Vite.
- [ ] Ukur performa dan ukuran bundle sebelum mengklaim peningkatan atau target FPS tertentu.
- [ ] Terus audit tampilan semua step pada berbagai viewport dan tema saat lesson berubah.
- [x] Glosarium hover (spesifikasi 4.6): kamus, enrich HTML prosa, tooltip + tautan lesson, uji EN/ID.
