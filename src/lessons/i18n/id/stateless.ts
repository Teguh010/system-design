import type { LessonOverlay } from '../../../types.ts';

const overlay: LessonOverlay = {
  title: 'Layanan Stateless',
  summary: 'Kenapa server yang tidak mengingat apa pun di antara request adalah kunci untuk scale out, dan ke mana state-nya dipindahkan.',
  metrics: ['session disimpan di', 'server mati →', 'tambah server'],
  goals: [
    'Mengenali state yang bersembunyi di web server',
    'Melihat kenapa sticky session hanya setengah berhasil',
    'Memindahkan session ke penyimpanan bersama',
    'Membawa state di token yang ditandatangani',
    'Tahu di mana state tetap harus tinggal',
  ],
  labels: {
    'lost session': 'session hilang',
    shoppers: 'pembeli',
    'web server': 'web server',
    'carts in RAM': 'keranjang di RAM',
    'has your cart': 'punya keranjangmu',
    'who are you?': 'kamu siapa?',
    'your server': 'servermu',
    'session store': 'penyimpanan session',
    'Redis, replicated': 'Redis, direplikasi',
    'signed token': 'token bertanda tangan',
    'Token payload': 'Isi token',
    'signed — tamper-evident': 'ditandatangani — ketahuan kalau diubah',
    'added at 09:00': 'ditambah 09.00',
    'orders db': 'db pesanan',
    'Hidden state checklist': 'Checklist state tersembunyi',
    'sessions      → session store': 'session       → penyimpanan session',
    'uploads       → object storage': 'upload        → object storage',
    'local caches  → shared cache': 'cache lokal   → cache bersama',
    'cron jobs     → one scheduler': 'cron job      → satu scheduler',
    'web server RAM': 'RAM web server',
    'each server’s RAM': 'RAM tiap server',
    'breaks carts': 'keranjang rusak',
    'slow to help': 'lambat membantu',
    'its carts are lost': 'keranjangnya hilang',
    'nothing lost': 'tidak ada yang hilang',
    'just add one': 'tinggal tambah',
    'token + store': 'token + store',
    'autoscale freely': 'autoscale bebas',
  },
  steps: [
    {
      short: 'Keranjang',
      title: 'Di mana keranjang belanja disimpan?',
      body: [
        'Sebuah toko online kecil berjalan di satu web server. Saat kamu menambah ketel ke keranjang, server menyimpan keranjang itu di memorinya sendiri, dengan kunci berupa cookie session di browsermu. Sederhana dan cepat.',
        'Memori itu adalah <b>state</b>: informasi yang harus diingat server di antara request-requestmu. Selama servernya hanya satu, tidak ada yang sadar.',
      ],
    },
    {
      short: 'Server kedua',
      title: 'Kasus: server kedua tidak mengenalmu',
      body: [
        'Black Friday mendekat, jadi toko menambah server kedua di belakang load balancer. Request pertamamu — “tambah ketel” — mendarat di web 1. Request berikutnya — “lihat keranjang” — mendarat di web 2, yang belum pernah mendengar tentangmu. Keranjangmu kosong.',
        'Tidak ada yang crash. Server-servernya hanya tidak bisa saling menggantikan, padahal load balancer menganggap mereka bisa.',
      ],
      callout: 'Kalau server menyimpan data per user di memori atau disk lokal, kamu tidak bisa bebas menambah, membuang, atau mengganti server itu.',
    },
    {
      short: 'Sticky',
      title: 'Sticky session: sebuah tambalan',
      body: [
        'Perbaikan cepat: minta load balancer selalu mengirimmu ke server yang memegang session-mu (cookie <b>sticky</b> atau affinity). Keranjang tidak hilang lagi.',
        'Tapi balancer tidak lagi bisa menyebar beban dengan bebas: pembeli berat tetap terkunci di satu server, dan server yang baru ditambahkan hanya mendapat pengunjung baru, jadi nyaris tidak membantu saat lonjakan.',
      ],
    },
    {
      short: 'Restart',
      title: 'Kasus: sebuah server restart',
      body: [
        'Saat diskon berlangsung, web 1 kehabisan memori dan restart. Setiap keranjang yang ia pegang hilang. Balancer mengirim para pembeli itu ke web 2, yang tidak tahu apa-apa tentang mereka — mereka mulai dari awal atau pergi.',
        'Deploy punya efek yang sama: setiap server yang kamu restart untuk merilis kode baru menghapus session user-nya. Sticky menyembunyikan masalah state; tidak menghilangkannya.',
      ],
    },
    {
      short: 'Pindahkan',
      title: 'Pindahkan state keluar',
      body: [
        'Solusinya adalah menyimpan session di tempat yang bisa dijangkau semua server: sebuah <b>penyimpanan session</b> seperti Redis, direplikasi supaya tetap hidup saat satu node gagal. Setiap request membawa ID session; server mana pun yang menerimanya memuat keranjang, memperbaruinya, lalu menyimpannya kembali.',
        'Web server sekarang <b>stateless</b>: tidak menyimpan apa pun yang bertahan melewati satu request. Server mana pun bisa menangani request mana pun, jadi balancer bisa kembali memakai least connections biasa tanpa sticky.',
      ],
      callout: 'Stateless bukan berarti sistemnya tanpa state. Artinya state itu tinggal di tempat yang memang dirancang untuk menyimpannya.',
    },
    {
      short: 'Token',
      title: 'Atau bawa di dalam token',
      body: [
        'Pilihan lain adalah menyimpan state kecil di sisi client: <b>token yang ditandatangani</b> (misalnya JWT atau cookie terenkripsi) berisi ID user, role, dan waktu kedaluwarsa. Server mana pun bisa memverifikasi tanda tangannya dan memercayai isinya tanpa bertanya ke siapa pun.',
        'Trade-off-nya: token ikut di setiap request, jadi buat sekecil mungkin; dan token sulit dicabut sebelum kedaluwarsa, sehingga pencabutan butuh masa berlaku pendek atau daftar blokir. Keranjang biasanya terlalu besar dan terlalu sering berubah — tetap disimpan di server.',
      ],
    },
    {
      short: 'Scaling membosankan',
      title: 'Stateless membuat scaling jadi membosankan',
      body: [
        'Karena tidak ada yang bisa hilang, server menjadi sekali pakai. Autoscaler bisa menambah tiga server saat diskon dimulai dan membuangnya tengah malam. Deploy bergulir ke seluruh armada satu server demi satu. Server yang crash diganti, bukan diperbaiki.',
        'Rasa bosan itulah tujuannya. Setiap bagian sistem yang menarik dan sulit di-scale sekarang terkumpul di beberapa tempat yang memang dibangun untuk itu: penyimpanan session dan database.',
      ],
    },
    {
      short: 'Tetap ada state',
      title: 'State-nya tetap tinggal di suatu tempat',
      body: [
        'Memindahkan state berarti memindahkan tanggung jawabnya juga. Penyimpanan session harus direplikasi dan dipantau; kalau ia mati, semua server terdampak sekaligus. Database menyimpan pesanan dan harus di-backup serta di-scale dengan caranya sendiri.',
        'Waspadai state yang bersembunyi di sudut lain: file upload yang ditulis ke disk lokal server (taruh di object storage), cache di memori yang harus saling sepakat, dan job terjadwal yang seharusnya berjalan di tepat satu mesin.',
      ],
    },
    {
      short: 'Rangkuman',
      title: 'Rangkuman',
      body: [
        'Di mana kamu menaruh state menentukan seberapa mudah kamu bisa scaling:',
        `<table class="compare"><thead><tr><th>state di…</th><th>scale out</th><th>server mati</th></tr></thead><tbody>
          <tr><td>memori server</td><td class="bad">session rusak</td><td class="bad">session hilang</td></tr>
          <tr><td>memori + sticky</td><td>lambat membantu</td><td class="bad">session-nya hilang</td></tr>
          <tr><td>penyimpanan bersama</td><td class="good">tambah server bebas</td><td class="good">tidak ada yang hilang</td></tr>
          <tr><td>token bertanda tangan</td><td class="good">tanpa lookup</td><td class="good">tidak ada yang hilang</td></tr></tbody></table>`,
        'Uji dirimu: sebuah server menulis foto profil ke <code>/var/uploads</code>. Apa yang salah saat kamu menambah server kedua, dan apa solusinya? (Separuh request tidak menemukan file-nya; simpan upload di object storage bersama.)',
      ],
    },
  ],
};

export default overlay;
