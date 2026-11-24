import type { LessonOverlay } from '../../../types.ts';

const overlay: LessonOverlay = {
  title: 'Indexes',
  summary:
    'Agen support di marketplace craft mencari jutaan pesanan lewat email — indeks mengubah full-table scan jadi langkah singkat di B-tree, asal cocok dengan cara kamu query.',
  metrics: ['baris dibaca', 'waktu lookup', 'biaya tulis'],
  goals: [
    'Melihat biaya full-table scan dalam skala besar',
    'Menghubungkan level B-tree dengan lebih sedikit baris dibaca',
    'Membuat indeks komposit yang cocok dengan filter',
    'Membayar pemeliharaan indeks di setiap insert',
    'Memilih indeks dari bentuk query nyata, bukan kebiasaan',
  ],
  labels: {
    'full scan': 'full scan',
    'support desk': 'meja support',
    'orders API': 'API pesanan',
    'orders DB': 'DB pesanan',
    'heap table': 'tabel heap',
    'email index': 'indeks email',
    'B-tree': 'B-tree',
    '4M rows': '4 jt baris',
    'disk read': 'baca disk',
    'seq scan': 'seq scan',
    'WHERE email': 'WHERE email',
    'Two structures': 'Dua struktur',
    'heap table   rows in insert order': 'tabel heap   baris urutan insert',
    'index        keys sorted for lookup': 'indeks        kunci terurut untuk lookup',
    'arrows → row ids (pointers)': 'panah → id baris (pointer)',
    'depth 3': 'kedalaman 3',
    'fetch row': 'ambil baris',
    'seek email': 'cari email',
    seek: 'cari',
    '(email,status)': '(email,status)',
    'composite B-tree': 'B-tree komposit',
    'both columns': 'kedua kolom',
    'email AND open': 'email AND open',
    'Index column order': 'Urutan kolom indeks',
    '(email, status)  ✓ filter as written': '(email, status)  ✓ filter seperti ditulis',
    '(status, email)  ✗ seeks wrong half': '(status, email)  ✗ seek bagian salah',
    '(status,email)': '(status,email)',
    mismatch: 'tidak cocok',
    INSERT: 'INSERT',
    '+1 key': '+1 kunci',
    'INSERT order': 'INSERT pesanan',
    'maintain index': 'maintain indeks',
    'PatchCraft indexes': 'Indeks PatchCraft',
    'orders(email)': 'orders(email)',
    'orders(email,status)': 'orders(email,status)',
    'shipments(tracking)': 'shipments(tracking)',
    'no index on nickname': 'tanpa indeks di nickname',
    'keys sorted': 'kunci terurut',
    'rows stay': 'baris tetap',
    '4M?': '4 jt?',
    '~8 s': '~8 dtk',
    '?': '?',
    '~4M / lookup': '~4 jt / lookup',
    'grows with table': 'naik dengan tabel',
    'table only': 'hanya tabel',
    '~3 pages': '~3 halaman',
    '~15 ms': '~15 ms',
    '4–12 rows': '4–12 baris',
    '800k / lookup': '800 rb / lookup',
    '~900 ms': '~900 ms',
    'heap + B-tree': 'heap + B-tree',
    '3 indexes': '3 indeks',
  },
  steps: [
    {
      short: 'Lambat',
      title: '“Cari pesanan pakai email”',
      body: [
        'Meja support PatchCraft menangani refund. Agen mengetik email pelanggan di tool admin dan mengharapkan pesanan cocok dalam satu detik. Dengan 4 juta pesanan, halaman sering berputar delapan detik — cukup lama untuk membuka tiga tab dan membandingkan hasil.',
        'Tabel pesanan sehat: insert dan checkout tetap jalan. Yang sakit adalah satu pola baca yang makin berat seiring toko tumbuh.',
      ],
    },
    {
      short: 'Full scan',
      title: 'Kasus: setiap lookup menjelajah tabel',
      body: [
        'API menjalankan <code>SELECT * FROM orders WHERE email = ?</code>. Tanpa struktur yang membantu, database melakukan <b>full table scan</b>: membaca baris demi baris sampai menemukan cocok — jutaan untuk domain email umum.',
        'CPU dan disk sibuk meski agen hanya butuh beberapa pesanan. Biayanya skala dengan ukuran tabel, bukan dengan seberapa selektif email-nya.',
      ],
      callout: 'Kalau baris diperiksa ≫ baris dikembalikan, kamu membayar bandwidth storage untuk menemukan ulang data yang mesin sudah simpan.',
      changes: ['+ lookup support by email', '~ query membaca seluruh heap'],
    },
    {
      short: 'Heap',
      title: 'Urutan tabel bukan urutan lookup',
      body: [
        'Baris di disk mengikuti urutan insert — bagus untuk append, buruk untuk “cari by email”. <b>Indeks</b> adalah struktur terpisah yang mengurutkan kunci cara kamu query, lalu menunjuk kembali ke baris di heap.',
        'Kamu tetap punya satu tabel; menambah struktur samping yang dipelihara database. Baca bisa pakai indeks; tulis harus update keduanya.',
      ],
      changes: ['+ indeks terpisah dari heap', '~ lookup ikut urutan indeks, bukan insert'],
    },
    {
      short: 'B-tree',
      title: 'B-tree untuk email',
      body: [
        'PostgreSQL membangun indeks <b>B-tree</b> di <code>email</code>. Secara internal bentuknya pohon dangkal dari kunci terurut — biasanya tiga level untuk jutaan baris — jadi tiap lookup menyentuh hanya beberapa halaman.',
        'Diagram menunjukkan bentuknya: satu root, beberapa cabang, leaf berisi email terurut dan pointer ke baris.',
      ],
      callout: 'B-tree menjaga kedalaman rendah dengan banyak kunci per halaman — itu kenapa mereka indeks sekunder default di database SQL.',
      changes: ['+ CREATE INDEX di email', '+ B-tree di samping heap'],
    },
    {
      short: 'Cepat',
      title: 'Seek, lalu fetch',
      body: [
        'Query agen jadi dua hop: jalan B-tree ke kunci cocok, lalu ikuti pointer ke segelintir baris di heap. Meter baca disk ambruk karena mesin tidak lagi menyentuh halaman asing.',
        'Itu kenapa tabel yang sama bisa layani insert checkout dan pencarian support kilat — jalur berbeda untuk bentuk berbeda.',
      ],
      changes: ['~ baca skala dengan cocokan, bukan ukuran tabel'],
    },
    {
      short: 'Komposit',
      title: 'Filter email dan status',
      body: [
        'Produk menambah filter: “pesanan open untuk email ini”. Query menambah <code>AND status = ’open’</code>. Indeks tunggal di email tetap menemukan semua pesanan alamat itu — lalu database menyaring status per baris.',
        '<b>Indeks komposit</b> di <code>(email, status)</code> cocok dengan urutan filter: seek rentang email, lalu hanya irisan <code>open</code> di dalamnya.',
      ],
      changes: ['+ filter status', '+ indeks komposit (email, status)'],
    },
    {
      short: 'Salah urut',
      title: 'Kasus: urutan kolom indeks penting',
      body: [
        'Seseorang membangun <code>(status, email)</code>. Query tetap filter email dulu, tapi indeks diurutkan utama oleh status — “open”, “shipped”, “refunded” — dengan email tersebar di tiap bucket. Planner jatuh ke scan irisan status besar.',
        'Indeks komposit bukan sihir: prefix paling kiri harus cocok dengan cara klausa <code>WHERE</code> bekerja.',
      ],
      callout: 'Tulis filter yang sering kamu pakai, lalu cerminkan urutannya di indeks.',
      changes: ['~ urutan kolom salah → range scan lebar'],
    },
    {
      short: 'Tulis',
      title: 'Setiap insert memperbarui indeks',
      body: [
        'Checkout tetap insert satu baris per pesanan. Database menulis halaman heap <i>dan</i> memasukkan email ke B-tree — I/O acak ekstra agar indeks tetap terurut. Itu <b>write amplification</b> indeks.',
        'Beberapa indeks yang dipilih dengan baik murah. Puluhan indeks di tabel yang sama membuat setiap insert menyebar ke semuanya.',
      ],
      changes: ['+ INSERT menyentuh heap + tiap indeks', '~ latency tulis naik dengan jumlah indeks'],
    },
    {
      short: 'Pilih',
      title: 'Indekskan yang kamu query',
      body: [
        'Samakan indeks dengan workload nyata: support butuh <code>email</code>; dashboard yang iris <code>status + date</code> butuh komposit sendiri. Hindari indeks di kolom yang tidak pernah difilter atau di-join.',
        'Saat query panas, tangkap plannya — <code>EXPLAIN</code> menunjukkan kena indeks atau scan seluruh dunia.',
      ],
    },
    {
      short: 'Recap',
      title: 'Recap',
      body: [
        'Keputusan indeks PatchCraft:',
        `<table class="compare"><thead><tr><th>situasi</th><th>pendekatan</th><th>waspada</th><th>lihat</th></tr></thead><tbody>
          <tr><td>cari by email</td><td class="good">B-tree di email</td><td>full scan skala besar</td><td>lesson ini</td></tr>
          <tr><td>email + status</td><td class="good">indeks komposit</td><td>urutan kolom</td><td>lesson ini</td></tr>
          <tr><td>insert berat</td><td>sedikit indeks</td><td>write amplification</td><td>storage engines</td></tr>
          <tr><td>indeks duplikat</td><td>buang yang redundan</td><td>tulis ekstra</td><td>lesson ini</td></tr></tbody></table>`,
        'Check yourself: agen cari by email; finance memfilter rentang <code>created_at</code>. Satu indeks atau dua, di kolom apa? (Minimal dua: <code>email</code> untuk support; <code>created_at</code> atau <code>(created_at, …)</code> untuk laporan — hanya jika query itu ada.)',
      ],
    },
  ],
};

export default overlay;