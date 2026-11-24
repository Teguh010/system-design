import type { LessonOverlay } from '../../../types.ts';

const overlay: LessonOverlay = {
  title: 'Storage Engines',
  summary:
    'Pipeline telemetri armada menulis event sensor sepanjang hari — lihat kenapa halaman B-tree menyakitkan untuk ingest append-only, dan bagaimana LSM menukar kerja compaction untuk tulis sekuensial cepat.',
  metrics: ['laju tulis', 'write amplification', 'read amplification'],
  goals: [
    'Merasakan page split B-tree pada insert berat',
    'Menggabungkan tulis lewat memtable dan SSTable',
    'Mengikuti baca di memtable + level',
    'Melihat compaction menulis ulang data di disk',
    'Menyeimbangkan write vs read amplification',
  ],
  labels: {
    'random I/O': 'I/O acak',
    'ingest workers': 'worker ingest',
    'ingest API': 'API ingest',
    'append only': 'append only',
    PostgreSQL: 'PostgreSQL',
    'B-tree pages': 'halaman B-tree',
    memtable: 'memtable',
    'sorted RAM buffer': 'buffer RAM terurut',
    'SSTable levels': 'level SSTable',
    'L0 → L2': 'L0 → L2',
    'B-tree': 'B-tree',
    'page writes': 'tulis halaman',
    splits: 'split',
    'INSERT row': 'INSERT baris',
    'Access pattern': 'Pola akses',
    'writes   append-only': 'tulis   append-only',
    'reads    ranges + aggregates': 'baca    rentang + agregat',
    'updates rare': 'update jarang',
    'sorted buffer': 'buffer terurut',
    'L0 file': 'file L0',
    fill: 'isi',
    append: 'append',
    flush: 'flush',
    'merge read': 'baca gabung',
    files: 'file',
    compacting: 'compaction',
    Compaction: 'Compaction',
    'pick L0 files': 'pilih file L0',
    'merge sort keys': 'merge sort kunci',
    'delete inputs': 'hapus input',
    'hot writes': 'tulis panas',
    'cold files': 'file dingin',
    'Engine fit': 'Kesesuaian engine',
    'B-tree    OLTP · many indexes': 'B-tree    OLTP · banyak indeks',
    'LSM       logs · metrics · MV': 'LSM       log · metrik · MV',
    'same DB, different table engines possible': 'DB sama, engine tabel bisa beda',
    compacted: 'terkompak',
    '50k/s': '50 rb/dtk',
    '?': '?',
    '~15× bytes': '~15× byte',
    '12k/s cap': 'batas 12 rb/dtk',
    '48k/s': '48 rb/dtk',
    '~2× bytes': '~2× byte',
    '6 files': '6 file',
    '~5× bytes': '~5× byte',
    '2 files': '2 file',
    '5× (async)': '5× (async)',
    '2–6 files': '2–6 file',
  },
  steps: [
    {
      short: 'Banjir',
      title: '50 rb event per detik',
      body: [
        'FleetPulse mengingest bacaan GPS dan suhu dari van pengiriman — sekitar <b>50 ribu event per detik</b>, 24 jam. Setiap event jadi satu baris: timestamp, ID kendaraan, nilai. Dashboard membaca pelan; yang sakit adalah volume tulis.',
        'Tim mulai dari PostgreSQL biasa. CPU terlihat baik pada SELECT, tapi antrean disk melonjak dan lag ingest naik tiap jam sibuk.',
      ],
    },
    {
      short: 'Split',
      title: 'Kasus: halaman B-tree terus split',
      body: [
        'PostgreSQL menyimpan baris di halaman <b>B-tree</b> (lihat lesson <i>indexes</i>). Insert mendarat terurut oleh primary key, tapi indeks sekunder dan fill factor tetap memaksa tulis halaman acak dan split. Setiap ledakan insert menulis ulang node pohon tersebar di disk.',
        'Throughput mentok bukan karena CPU tidak bisa parse JSON, tapi karena tiap event bisa menyentuh beberapa halaman 8 KB dengan seek di antaranya — <b>write amplification</b> tersembunyi di dalam engine.',
      ],
      callout: 'Update in-place acak adalah yang paling dibenci disk berputar dan antrean NVMe; workload hampir append saja bertarung dengan mekanik B-tree.',
      changes: ['+ beban append berkelanjutan', '~ insert memperbarui halaman tersebar'],
    },
    {
      short: 'Pola',
      title: 'Append-only ingin I/O sekuensial',
      body: [
        'FleetPulse jarang update baris di tempat — hanya append. Pola aksesnya ingin <b>tulis sekuensial besar</b> dan penyortiran ditunda, bukan keseimbangan global segera.',
        'Engine storage untuk analitik dan log (RocksDB, LSM Cassandra, merge ClickHouse) berbagi satu ide: buffer di memori, flush file immutable, merge belakangan.',
      ],
      changes: ['~ workload insert-only', '+ penyortiran bisa asinkron'],
    },
    {
      short: 'Memtable',
      title: 'LSM: urutkan di RAM dulu',
      changes: ['+ tulis mendarat hanya di memtable', '~ engine pindah dari layout B-tree'],
      body: [
        '<b>LSM tree</b> (log-structured merge tree) menerima tulis ke <b>memtable</b> — buffer terurut di memori. Saat penuh, flush ke disk sebagai file <b>SSTable</b> immutable: append satu file sekuensial besar, tanpa edit in-place.',
        'Data lama tetap di file lebih tua sampai job <b>compaction</b> di background menggabungkannya ke level lebih dalam.',
      ],
    },
    {
      short: 'Flush',
      title: 'Flush ke level 0',
      body: [
        'Saat memtable mencapai ambang — misalnya 64 MB — engine membekukannya, menulis SSTable baru ke <b>level 0</b>, dan memulai memtable segar. Worker ingest melihat latency stabil; hanya flush yang berhenti sebentar.',
        'Tumpukan file di diagram adalah level itu: terbaru di bawah (L0), run terurut lebih besar di atas.',
      ],
      callout: 'Tulis menjadi append sekuensial besar; penyortiran sekali di RAM sebelum flush.',
      changes: ['+ memtable → file L0', '~ disk melihat tulis sekuensial besar'],
    },
    {
      short: 'Baca',
      title: 'Baca memeriksa setiap file aktif',
      body: [
        'Dashboard minta “kendaraan 42, satu jam terakhir”. Engine memeriksa memtable hidup, lalu setiap SSTable yang mungkin overlap — terbaru ke terlama — dan menggabungkan hit. Tidak ada yang hilang karena kunci hanya berpindah lewat file immutable.',
        'Itu <b>read amplification</b>: satu query logis bisa menyentuh beberapa file dan bloom filter. Biasanya OK saat tulis dominan dan baca di-batch.',
      ],
      changes: ['~ query scan memtable + file', '+ bloom filter bisa lewati file'],
    },
    {
      short: 'Kompak',
      title: 'Compaction menulis ulang data',
      body: [
        'Kalau L0 punya belasan file kecil, baca akan melambat selamanya. Job <b>compaction</b> memilih file overlap, menggabung ke file L1 lebih besar, dan menghapus input. Kemiringan dibenahi offline sementara ingest lanjut ke memtable baru.',
        'Compaction adalah bandwidth disk ekstra — write amplification kembali sebagai housekeeping. Tuner menukar agresivitas compaction vs kecepatan baca.',
      ],
      changes: ['+ job merge di background', '~ kunci sama ditulis ulang ke level lebih dalam'],
    },
    {
      short: 'Trade-off',
      title: 'Amplifikasi di kedua sisi',
      changes: ['~ write amp pindah ke jendela compaction', '~ read amp terikat jumlah file'],
      body: [
        'B-tree membayar write amplification di muka tiap insert; LSM menundanya ke compaction. Baca B-tree menyentuh satu pohon rapi; baca LSM bisa menyebar ke banyak file kecuali compaction menjaga level rapi.',
        'Tidak ada yang “lebih cepat” — mereka cocok untuk workload berbeda. FleetPulse memilih LSM karena ingest 100× lebih berat dari baca ad-hoc.',
      ],
    },
    {
      short: 'Pilih',
      title: 'Pilih engine sesuai pola',
      body: [
        'Condong ke B-tree saat butuh konsistensi baris tunggal kuat, banyak indeks sekunder, dan baca/tulis campuran pada baris yang sama — OLTP klasik. Condong ke LSM saat mengingest stream, toleran lag compaction, dan bisa batch baca.',
        'Beberapa database menyembunyikan keduanya (B-tree InnoDB MySQL, LSM Cassandra). Pelajarannya: sadari kamu berdiri di engine mana saat tuning disk atau beli hardware.',
      ],
    },
    {
      short: 'Recap',
      title: 'Recap',
      body: [
        'Pilihan storage FleetPulse:',
        `<table class="compare"><thead><tr><th>engine</th><th>tulis</th><th>baca</th><th>biaya belakangan</th><th>lihat</th></tr></thead><tbody>
          <tr><td>B-tree</td><td>halaman in-place</td><td class="good">sedikit sentuhan</td><td>page split</td><td>indexes</td></tr>
          <tr><td>LSM</td><td class="good">flush sekuensial</td><td>banyak file</td><td>compaction</td><td>lesson ini</td></tr></tbody></table>`,
        'Check yourself: kamu append bacaan sensor tapi kadang menulis ulang nilai terbaru per ID kendaraan. LSM append murni atau B-tree ramah update? (Update per kunci melawan append murni; pertimbangkan B-tree, atau LSM dengan upsert dan compaction hati-hati — kenali pola overwrite-mu.)',
      ],
    },
  ],
};

export default overlay;