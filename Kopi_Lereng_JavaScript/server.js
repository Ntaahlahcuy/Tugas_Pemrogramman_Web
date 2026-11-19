/**
 * REST API + server web Kopi Lereng (Node.js, tanpa npm install).
 * Jalankan: node server.js; buka http://localhost:3000
 * API sengaja hanya untuk DEMO lokal, bukan sistem transaksi produksi.
 */
"use strict";

const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const MAX_BODY_BYTES = 16 * 1024;
const FILES = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/index.html", ["index.html", "text/html; charset=utf-8"]],
  ["/tentang.html", ["tentang.html", "text/html; charset=utf-8"]],
  ["/style.css", ["style.css", "text/css; charset=utf-8"]],
  ["/script.js", ["script.js", "text/javascript; charset=utf-8"]]
]);

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function kirimJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(data));
}

async function bacaJson(req) {
  if (!/^application\/json(?:;|$)/i.test(req.headers["content-type"] || "")) {
    throw new HttpError(415, "Gunakan Content-Type: application/json.");
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new HttpError(413, "Data terlalu besar.");
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "Format JSON tidak valid.");
  }
}

function buatServer({ menuFile = path.join(DATA_DIR, "menu.json"), pesananFile = path.join(DATA_DIR, "pesanan.jsonl") } = {}) {
  // Antrian mencegah beberapa proses penulisan pesanan berjalan bersamaan.
  let antrianSimpan = Promise.resolve();

  async function bacaMenu() {
    const menu = JSON.parse(await fs.readFile(menuFile, "utf8"));
    if (!Array.isArray(menu)) throw new Error("Format data/menu.json tidak valid.");
    return menu;
  }

  return http.createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    try {
      const alamat = new URL(req.url, "http://localhost");
      const pathname = alamat.pathname;

      if (pathname === "/api/health" && req.method === "GET") {
        return kirimJson(res, 200, { status: "ok", aplikasi: "Kopi Lereng API" });
      }

      if (pathname === "/api/menu" && req.method === "GET") {
        const kategori = alamat.searchParams.get("kategori");
        if (kategori && !["panas", "dingin"].includes(kategori)) {
          throw new HttpError(400, "Kategori hanya boleh panas atau dingin.");
        }
        const menu = await bacaMenu();
        return kirimJson(res, 200, { data: kategori ? menu.filter((m) => m.kategori === kategori) : menu });
      }

      if (pathname.startsWith("/api/menu/") && req.method === "GET") {
        const id = pathname.slice("/api/menu/".length);
        const menu = (await bacaMenu()).find((m) => m.id === id);
        if (!menu) throw new HttpError(404, "Menu tidak ditemukan.");
        return kirimJson(res, 200, { data: menu });
      }

      if (pathname === "/api/pesanan" && req.method === "POST") {
        const isi = await bacaJson(req);
        if (!isi || !Array.isArray(isi.items) || isi.items.length === 0 || isi.items.length > 20) {
          throw new HttpError(400, "Isi items harus berupa daftar menu yang dipilih (1–20 item).");
        }
        const menu = await bacaMenu();
        const indeksMenu = new Map(menu.map((m) => [m.id, m]));
        const idTerpakai = new Set();
        let jumlahTotal = 0;
        const items = isi.items.map((item) => {
          if (!item || typeof item.id !== "string" || !Number.isInteger(item.jumlah) || item.jumlah < 1 || item.jumlah > 99) {
            throw new HttpError(400, "Setiap item harus memiliki id dan jumlah bulat dari 1 sampai 99.");
          }
          const produk = indeksMenu.get(item.id);
          if (!produk || idTerpakai.has(item.id)) throw new HttpError(400, "ID menu tidak dikenal atau terduplikasi.");
          idTerpakai.add(item.id);
          jumlahTotal += item.jumlah;
          if (jumlahTotal > 200) throw new HttpError(400, "Maksimal 200 minuman per pesanan.");
          return {
            id: produk.id,
            nama: produk.nama,
            jumlah: item.jumlah,
            harga: produk.harga,
            subtotal: produk.harga * item.jumlah
          };
        });
        const pesanan = {
          id: randomUUID(),
          dibuatPada: new Date().toISOString(),
          status: "demo_tersimpan",
          items,
          jumlahTotal,
          total: items.reduce((total, item) => total + item.subtotal, 0)
        };
        // Harga dan total dihitung ulang oleh server, tidak menerima total dari browser.
        const tugasSimpan = antrianSimpan.then(async () => {
          await fs.mkdir(path.dirname(pesananFile), { recursive: true });
          await fs.appendFile(pesananFile, JSON.stringify(pesanan) + "\n", "utf8");
        });
        antrianSimpan = tugasSimpan.catch(() => {});
        await tugasSimpan;
        return kirimJson(res, 201, { pesan: "Pesanan demo berhasil disimpan.", data: pesanan });
      }

      if (pathname.startsWith("/api/pesanan/") && req.method === "GET") {
        const id = pathname.slice("/api/pesanan/".length);
        if (!/^[a-f0-9-]{36}$/.test(id)) throw new HttpError(404, "Pesanan tidak ditemukan.");
        let isi;
        try {
          isi = await fs.readFile(pesananFile, "utf8");
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
          isi = "";
        }
        const catatan = isi.trim().split("\n").filter(Boolean);
        const pesanan = catatan.map((baris) => JSON.parse(baris)).find((p) => p.id === id);
        if (!pesanan) throw new HttpError(404, "Pesanan tidak ditemukan.");
        return kirimJson(res, 200, { data: pesanan });
      }

      if (req.method === "GET" && FILES.has(pathname)) {
        const [namaFile, tipe] = FILES.get(pathname);
        const konten = await fs.readFile(path.join(ROOT, namaFile));
        res.writeHead(200, { "Content-Type": tipe, "Cache-Control": "no-cache" });
        return res.end(konten);
      }
      throw new HttpError(404, "Alamat tidak ditemukan.");
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500;
      if (status === 500) console.error("Kesalahan server:", error);
      if (!res.headersSent) kirimJson(res, status, { error: status === 500 ? "Terjadi kesalahan pada server." : error.message });
      else res.end();
    }
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || "127.0.0.1";
  const server = buatServer();
  server.listen(port, host, () => {
    console.log(`Kopi Lereng aktif: http://${host}:${port}`);
    console.log(`API menu: http://${host}:${port}/api/menu`);
  });
}

module.exports = { buatServer };
