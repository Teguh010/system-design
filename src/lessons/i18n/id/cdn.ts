import type { LessonOverlay } from '../../../types.ts';

const overlay: LessonOverlay = {
  title: 'CDN',
  summary: 'Taruh salinan kontenmu beberapa milidetik dari setiap user, dan pelajari response mana yang tidak boleh dibagikan.',
  metrics: ['RTT dari Jakarta', 'hit rate edge', 'req origin / s', 'egress origin'],
  goals: [
    'Kenapa jarak mendominasi bagi user yang jauh',
    'Bagaimana edge menyajikan salinan dari cache',
    'Mengatur caching dengan Cache-Control',
    'Melindungi origin dengan shield',
    'Jangan pernah cache response privat',
  ],
  labels: {
    'edge miss → origin': 'edge miss → origin',
    'serves everything': 'melayani semuanya',
    'origin shield': 'origin shield',
    'edge Jakarta': 'edge Jakarta',
    'old app.js': 'app.js lama',
    'Uncacheable request': 'Request yang tak bisa di-cache',
    'TLS handshake   at the edge': 'TLS handshake   di edge',
    'edge → origin   warm connection': 'edge → origin   koneksi hangat',
    'saves ~2 long round trips': 'hemat ~2 round trip jauh',
    'sees Ana’s page': 'melihat halaman Ana',
    'cached /account': '/account ter-cache',
    '8 ms (edge)': '8 ms (edge)',
    '3,000': '3.000',
    '4 Gbit/s': '4 Gbit/s',
    '0.3 Gbit/s': '0,3 Gbit/s',
    '0.05 Gbit/s': '0,05 Gbit/s',
    '8 ms + backbone': '8 ms + backbone',
  },
  steps: [
    {
      short: 'Jauh',
      title: 'Jauh dari rumah',
      body: [
        'Sebuah situs berbagi foto berjalan di satu data center di Virginia (us-east). Pembaca di Frankfurt berjarak sekitar 90 ms, São Paulo sekitar 120 ms, Jakarta sekitar 230 ms per round trip. Satu halaman butuh beberapa round trip ditambah puluhan gambar, jadi Jakarta menunggu beberapa detik untuk sesuatu yang di Virginia tampil sekejap.',
        'Kecepatan cahaya di serat optik tidak bertambah dengan server yang lebih besar. Satu-satunya obat untuk jarak adalah menaruh kontennya lebih dekat.',
      ],
    },
    {
      short: 'Edge',
      title: 'Edge di dekat user',
      body: [
        '<b>CDN</b> (content delivery network) menjalankan ratusan server cache — <b>edge</b> — di kota-kota di seluruh dunia. DNS atau routing anycast mengirim setiap user ke edge terdekat.',
        'Request pertama untuk <code>/img/sunset.jpg</code> di Jakarta miss: edge mengambilnya dari origin, menyimpannya, lalu mengembalikannya. Setiap request berikutnya di wilayah itu dilayani dari Jakarta dalam beberapa milidetik, dan origin tidak pernah melihatnya.',
      ],
      callout: 'CDN adalah cache yang sekaligus menyelesaikan masalah geografi.',
    },
    {
      short: 'Cache-Control',
      title: 'Cache-Control yang menentukan',
      body: [
        'Origin memberi tahu setiap cache apa yang boleh dilakukan lewat header response <code>Cache-Control</code>. <code>max-age=31536000, immutable</code> berarti “simpan ini setahun, tidak akan pernah berubah”. <code>max-age=60</code> mengizinkan satu menit. <code>no-store</code> melarang caching sama sekali.',
        'Pembagian yang umum: aset statis (gambar, skrip, font) di-cache lama; halaman HTML beberapa detik saja atau divalidasi ulang setiap kali; response API pribadi tidak pernah di-cache oleh cache bersama.',
      ],
    },
    {
      short: 'Bug tersangkut',
      title: 'Kasus: bug yang ter-cache setahun',
      body: [
        'Sebuah rilis mengirim <code>/assets/app.js</code> yang rusak dengan <code>max-age=1y</code>. Tim memperbaikinya dalam hitungan menit, tapi edge dan browser terus menyajikan file rusak yang ter-cache. Purge CDN membantu edge — bukan browser yang sudah terlanjur menyimpannya.',
        'Solusi standarnya adalah membuat nama file yang di-cache lama ikut berubah sesuai isinya: <code>app.3f9a2c.js</code>. Rilis baru merujuk nama baru, jadi tidak ada lagi yang meminta file basi. Setelah itu “cache selamanya” jadi aman.',
      ],
      callout: 'TTL panjang hanya untuk nama file yang mengandung hash isinya. TTL pendek (atau validasi ulang) untuk apa pun yang URL-nya tetap.',
    },
    {
      short: 'Shield',
      title: 'Origin shield',
      body: [
        'Dengan ratusan edge, masing-masing bisa miss secara terpisah: gambar baru bisa diambil dari origin ratusan kali. <b>Origin shield</b> adalah lapisan cache tengah yang ditanya lebih dulu oleh semua edge, sehingga origin hanya melihat sekitar satu pengambilan per objek, bukan satu per edge.',
        'Shield juga menyerap badai purge dan lonjakan trafik, dan membuat origin yang kecil bisa bertahan saat peluncuran global.',
      ],
    },
    {
      short: 'Dinamis',
      title: 'Tetap lebih cepat walau tak bisa di-cache',
      body: [
        'Halaman pribadi tidak bisa di-cache, tapi tetap diuntungkan. TLS handshake user berakhir di edge terdekat (dua round trip pendek, bukan dua round trip jauh), dan edge menjaga koneksi hangat berumur panjang ke origin lewat backbone milik penyedia.',
        'Banyak CDN juga menjalankan program kecil di edge — redirect, pembagian A/B, pengecekan autentikasi — sehingga sebagian request tidak pernah perlu pergi ke origin sama sekali.',
      ],
    },
    {
      short: 'Key salah',
      title: 'Kasus: halaman akun milik orang lain',
      body: [
        'Seorang engineer menambahkan <code>max-age=300</code> ke <code>/account</code> untuk mengurangi beban. CDN melakukan cache berdasarkan URL. Ana di Jakarta membuka halaman akunnya; beberapa detik kemudian Budi membuka <code>/account</code> dan edge menyajikan halaman <b>milik Ana</b> — nama, alamat, dan riwayat pesanan.',
        'Response yang bergantung pada siapa yang meminta harus menyatakannya: <code>Cache-Control: private</code> atau <code>no-store</code>, atau cache key yang menyertakan user-nya. Perlakukan konfigurasi CDN sebagai kode yang sensitif terhadap keamanan.',
      ],
      callout: 'Menyimpan response privat di cache bersama adalah kebocoran data, bukan bug performa.',
    },
    {
      short: 'Rangkuman',
      title: 'Rangkuman',
      body: [
        'CDN memindahkan salinan ke dekat user dan memindahkan beban menjauh dari origin:',
        `<table class="compare"><thead><tr><th>topik</th><th>aturan praktis</th></tr></thead><tbody>
          <tr><td>aset statis</td><td>nama ber-hash isi, di-cache setahun</td></tr>
          <tr><td>HTML / API publik</td><td>max-age pendek atau validasi ulang</td></tr>
          <tr><td>data pribadi</td><td>private / no-store — jangan di cache bersama</td></tr>
          <tr><td>banyak edge</td><td>origin shield untuk meringkas miss</td></tr>
          <tr><td>tak bisa di-cache</td><td>tetap untung dari TLS di edge dan koneksi hangat</td></tr></tbody></table>`,
        'Uji dirimu: sebuah gambar diminta 1.000 kali per menit dari 50 edge dan di-cache sehari. Kira-kira berapa pengambilan ke origin per hari dengan dan tanpa shield? (Tanpa: sekitar 50, satu per edge. Dengan shield: sekitar 1.)',
      ],
    },
  ],
};

export default overlay;
