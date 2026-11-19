/* Kopi Lereng: mode gelap, filter menu, kalkulasi, dan integrasi REST API. */
(() => {
  "use strict";

  const formatRupiah = new Intl.NumberFormat("id-ID", {
    style: "currency", currency: "IDR", maximumFractionDigits: 0
  });

  function siapkanTema() {
    const tombolTema = document.querySelector("#tombol-tema");
    if (!tombolTema) return;
    let temaTersimpan = "terang";
    try { temaTersimpan = localStorage.getItem("kopi-lereng-tema") || "terang"; } catch { /* boleh tanpa penyimpanan */ }

    function terapkanTema(tema) {
      const gelap = tema === "gelap";
      document.documentElement.dataset.tema = gelap ? "gelap" : "terang";
      tombolTema.textContent = gelap ? "Mode terang" : "Mode gelap";
      tombolTema.setAttribute("aria-pressed", String(gelap));
    }
    terapkanTema(temaTersimpan);
    tombolTema.addEventListener("click", () => {
      const temaBaru = document.documentElement.dataset.tema === "gelap" ? "terang" : "gelap";
      terapkanTema(temaBaru);
      try { localStorage.setItem("kopi-lereng-tema", temaBaru); } catch { /* mode tetap berfungsi */ }
    });
  }

  async function mintaJson(url, opsi = {}) {
    const respons = await fetch(url, opsi);
    const data = await respons.json();
    if (!respons.ok) throw new Error(data.error || `Gagal mengakses API (${respons.status}).`);
    return data;
  }

  // Teks dari API dimasukkan memakai textContent, bukan innerHTML.
  function buatKartuMenu(produk) {
    const kartu = document.createElement("article");
    kartu.dataset.id = produk.id;
    kartu.dataset.nama = produk.nama;
    kartu.dataset.harga = String(produk.harga);
    kartu.dataset.kategori = produk.kategori;

    const kategori = document.createElement("span");
    kategori.className = "kategori";
    kategori.textContent = produk.kategori === "panas" ? "Panas" : "Dingin";
    const nama = document.createElement("h3");
    nama.textContent = produk.nama;
    const deskripsi = document.createElement("p");
    deskripsi.textContent = produk.deskripsi;
    const harga = document.createElement("p");
    harga.className = "harga";
    harga.textContent = formatRupiah.format(produk.harga);

    const kontrol = document.createElement("div");
    kontrol.className = "jumlah-pesanan";
    const teksJumlah = document.createElement("span");
    teksJumlah.textContent = "Jumlah";
    const wadahTombol = document.createElement("div");
    wadahTombol.className = "kontrol-jumlah";
    const kurang = document.createElement("button");
    kurang.type = "button";
    kurang.dataset.aksi = "kurang";
    kurang.textContent = "−";
    kurang.setAttribute("aria-label", `Kurangi ${produk.nama}`);
    kurang.disabled = true;
    const jumlah = document.createElement("output");
    jumlah.className = "jumlah";
    jumlah.textContent = "0";
    jumlah.setAttribute("aria-label", `Jumlah ${produk.nama}`);
    const tambah = document.createElement("button");
    tambah.type = "button";
    tambah.dataset.aksi = "tambah";
    tambah.textContent = "+";
    tambah.setAttribute("aria-label", `Tambah ${produk.nama}`);
    wadahTombol.append(kurang, jumlah, tambah);
    kontrol.append(teksJumlah, wadahTombol);
    kartu.append(kategori, nama, deskripsi, harga, kontrol);
    return kartu;
  }

  async function siapkanMenu() {
    const wadahMenu = document.querySelector("#daftar-menu");
    if (!wadahMenu) return;

    const tombolFilter = document.querySelectorAll("[data-filter]");
    const statusMenu = document.querySelector("#status-menu");
    const statusApi = document.querySelector("#status-api");
    const hasilPesanan = document.querySelector("#hasil-pesanan");
    const rincianPesanan = document.querySelector("#rincian-pesanan");
    const jumlahMinuman = document.querySelector("#jumlah-minuman");
    const totalHarga = document.querySelector("#total-harga");
    const hapusPesanan = document.querySelector("#hapus-pesanan");
    const kirimPesanan = document.querySelector("#kirim-pesanan");
    const batasJumlah = 99;
    let apiAktif = false;
    let sedangMengirim = false;

    // Apabila dibuka lewat file:// atau Live Server terpisah, menu HTML tetap tampil.
    if (location.protocol === "file:") {
      statusApi.textContent = "Mode offline: menu contoh tetap bisa disimulasikan. Untuk menyimpan pesanan demo, jalankan node server.js lalu buka http://localhost:3000.";
    } else {
      statusApi.textContent = "Menghubungkan ke API menu...";
      try {
        const respons = await mintaJson("/api/menu");
        if (!Array.isArray(respons.data) || !respons.data.length || !respons.data.every((item) =>
          typeof item.id === "string" && typeof item.nama === "string" &&
          typeof item.deskripsi === "string" && ["panas", "dingin"].includes(item.kategori) &&
          Number.isSafeInteger(item.harga) && item.harga >= 0
        )) throw new Error("Format data menu API tidak sesuai.");
        wadahMenu.replaceChildren(...respons.data.map(buatKartuMenu));
        apiAktif = true;
        statusApi.textContent = "API terhubung. Menu diambil dari server; pesanan demo dapat disimpan ke server lokal.";
      } catch {
        statusApi.textContent = "API belum tersedia. Menu contoh masih bisa digunakan untuk simulasi; jalankan node server.js agar tombol simpan aktif.";
      }
    }

    const daftarMenu = Array.from(wadahMenu.querySelectorAll("article")).map((kartu) => ({
      kartu,
      id: kartu.dataset.id,
      nama: kartu.dataset.nama,
      harga: Number(kartu.dataset.harga),
      kategori: kartu.dataset.kategori,
      jumlah: 0,
      tampilanJumlah: kartu.querySelector(".jumlah"),
      tombolKurang: kartu.querySelector('[data-aksi="kurang"]'),
      tombolTambah: kartu.querySelector('[data-aksi="tambah"]')
    }));

    function perbaruiPesanan() {
      let total = 0;
      let jumlah = 0;
      const rincian = [];
      daftarMenu.forEach((menu) => {
        total += menu.harga * menu.jumlah;
        jumlah += menu.jumlah;
        menu.tampilanJumlah.textContent = String(menu.jumlah);
        menu.tombolKurang.disabled = sedangMengirim || menu.jumlah === 0;
        menu.tombolTambah.disabled = sedangMengirim || menu.jumlah === batasJumlah;
        if (menu.jumlah > 0) rincian.push(`${menu.jumlah} × ${menu.nama}`);
      });
      jumlahMinuman.textContent = String(jumlah);
      totalHarga.textContent = formatRupiah.format(total);
      rincianPesanan.textContent = rincian.length ? rincian.join(" · ") : "Belum ada minuman yang dipilih.";
      hapusPesanan.disabled = sedangMengirim || jumlah === 0;
      kirimPesanan.disabled = sedangMengirim || !apiAktif || jumlah === 0;
    }

    daftarMenu.forEach((menu) => {
      menu.tombolTambah.addEventListener("click", () => {
        if (sedangMengirim || menu.jumlah >= batasJumlah) return;
        menu.jumlah += 1;
        hasilPesanan.textContent = "";
        perbaruiPesanan();
        statusMenu.textContent = `${menu.nama} ditambahkan. Jumlahnya sekarang ${menu.jumlah}.`;
      });
      menu.tombolKurang.addEventListener("click", () => {
        if (sedangMengirim || menu.jumlah <= 0) return;
        menu.jumlah -= 1;
        hasilPesanan.textContent = "";
        perbaruiPesanan();
        statusMenu.textContent = `${menu.nama} dikurangi. Jumlahnya sekarang ${menu.jumlah}.`;
      });
    });

    tombolFilter.forEach((tombol) => {
      tombol.addEventListener("click", () => {
        const kategori = tombol.dataset.filter;
        let jumlahTerlihat = 0;
        daftarMenu.forEach((menu) => {
          const terlihat = kategori === "semua" || menu.kategori === kategori;
          menu.kartu.hidden = !terlihat;
          if (terlihat) jumlahTerlihat += 1;
        });
        tombolFilter.forEach((pilihan) => {
          const aktif = pilihan === tombol;
          pilihan.classList.toggle("aktif", aktif);
          pilihan.setAttribute("aria-pressed", String(aktif));
        });
        statusMenu.textContent = `${jumlahTerlihat} menu ditampilkan untuk pilihan ${tombol.textContent.toLowerCase()}.`;
      });
    });

    hapusPesanan.addEventListener("click", () => {
      if (sedangMengirim) return;
      daftarMenu.forEach((menu) => { menu.jumlah = 0; });
      perbaruiPesanan();
      hasilPesanan.textContent = "";
      statusMenu.textContent = "Simulasi pesanan dikosongkan.";
    });

    kirimPesanan.addEventListener("click", async () => {
      if (sedangMengirim || !apiAktif) return;
      const items = daftarMenu.filter((menu) => menu.jumlah > 0).map((menu) => ({
        id: menu.id, jumlah: menu.jumlah
      }));
      if (!items.length) return;

      sedangMengirim = true;
      kirimPesanan.textContent = "Menyimpan...";
      perbaruiPesanan();
      hasilPesanan.textContent = "Sedang mengirim pesanan demo ke API...";
      try {
        const respons = await mintaJson("/api/pesanan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items })
        });
        const hasil = respons.data;
        hasilPesanan.textContent = `Berhasil disimpan! ID: ${hasil.id} · Total: ${formatRupiah.format(hasil.total)}. Ini hanya pesanan demo, bukan pesanan kedai sungguhan.`;
        daftarMenu.forEach((menu) => { menu.jumlah = 0; });
        statusMenu.textContent = "Pesanan demo selesai disimpan; pilihan direset.";
      } catch (error) {
        hasilPesanan.textContent = `Gagal mendapat konfirmasi dari API: ${error.message}. Periksa koneksi sebelum mencoba lagi, karena kiriman sebelumnya mungkin sudah tersimpan.`;
      } finally {
        sedangMengirim = false;
        kirimPesanan.textContent = "Simpan pesanan demo";
        perbaruiPesanan();
      }
    });
    perbaruiPesanan();
  }

  siapkanTema();
  document.querySelectorAll("[data-tahun]").forEach((elemen) => {
    elemen.textContent = String(new Date().getFullYear());
  });
  document.querySelectorAll("[data-interaktif]").forEach((elemen) => { elemen.hidden = false; });
  siapkanMenu().catch((error) => console.error("Gagal menyiapkan menu:", error));
})();
