# Kopi Lereng — Website dan REST API JavaScript (Node.js)

Proyek **Kopi Lereng** merupakan website kedai kopi sederhana yang dibangun menggunakan HTML, CSS, JavaScript, serta REST API berbasis Node.js. Website menyediakan informasi menu kopi dan simulasi pemesanan demo yang mengirim data ke server lokal.

## Teknologi yang Digunakan
- **HTML** — struktur halaman website.
- **CSS** — tampilan, tata letak, responsivitas, dan tema.
- **JavaScript** — interaksi pengguna, filter menu, jumlah pesanan, perhitungan total, dan komunikasi API menggunakan `fetch()`.
- **Node.js** — menjalankan server lokal dan REST API.
- **JSON** — menyimpan data menu dan pesanan demo.

## Fitur
- Halaman beranda dan Tentang Kami.
- Daftar menu diambil dari server.
- Filter kategori panas dan dingin.
- Pengaturan jumlah minuman dan perhitungan total.
- Pengiriman pesanan demo melalui REST API.
- Mode gelap dan terang.

## Dokumentasi Tampilan Website

### 1. Halaman Beranda
![Halaman Beranda Kopi Lereng](screenshots/01-beranda.png)

### 2. Daftar Menu dan Simulasi Pemesanan
![Daftar Menu dan Simulasi Pemesanan](screenshots/02-menu-dan-pemesanan.png)

### 3. Halaman Tentang Kami
![Halaman Tentang Kami](screenshots/03-tentang-kami.png)

### 4. Respons REST API Menu
![Respons REST API Menu](screenshots/04-rest-api-menu.png)

## Persyaratan
- Node.js versi 18 atau lebih baru.
- Browser modern.
- Visual Studio Code (disarankan).

Tidak diperlukan instalasi paket npm tambahan.

## Cara Menjalankan
1. Clone atau unduh repository ini.
2. Buka folder proyek di Visual Studio Code.
3. Pastikan Node.js versi 18 atau lebih baru sudah terpasang.
4. Buka terminal dan jalankan:

   ```bash
   node server.js
   ```

   Alternatif:

   ```bash
   npm start
   ```

5. Buka `http://localhost:3000` di browser.
6. Pilih menu dengan tombol `+` atau `−`, lalu klik **Simpan pesanan demo**.
7. Hentikan server dengan `Ctrl + C`.

> **Penting:** Jalankan `node server.js` agar endpoint API aktif. Membuka `index.html` langsung atau hanya menggunakan Live Server tidak akan menjalankan REST API.

## Endpoint REST API
| Metode | Endpoint | Fungsi |
|---|---|---|
| GET | `/api/health` | Memeriksa status API |
| GET | `/api/menu` | Mengambil seluruh menu |
| GET | `/api/menu?kategori=panas` | Mengambil menu panas |
| GET | `/api/menu?kategori=dingin` | Mengambil menu dingin |
| GET | `/api/menu/kopi-tubruk` | Mengambil detail menu |
| POST | `/api/pesanan` | Mengirim pesanan demo |
| GET | `/api/pesanan/<id>` | Mengambil detail pesanan |

### Contoh Body POST `/api/pesanan`
Gunakan header `Content-Type: application/json`:

```json
{
  "items": [
    { "id": "kopi-tubruk", "jumlah": 2 },
    { "id": "es-kopi-susu", "jumlah": 1 }
  ]
}
```

Harga dan total dihitung ulang di backend berdasarkan `data/menu.json`. Pesanan demo dicatat ke `data/pesanan.jsonl`, yang dibuat otomatis saat pesanan pertama disimpan.

## Pengujian API
Jalankan:

```bash
npm test
```

## Batasan Proyek
- Demo lokal untuk pembelajaran, bukan sistem transaksi produksi.
- Tidak tersedia pembayaran sungguhan, autentikasi, atau database SQL.
- Server secara default hanya mendengarkan pada `127.0.0.1`.
- Alamat dan kontak di halaman Tentang Kami merupakan data contoh.
