"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { buatServer } = require("../server.js");

let server;
let base;
let folderSementara;

test.before(async () => {
  folderSementara = await fs.mkdtemp(path.join(os.tmpdir(), "kopi-lereng-"));
  server = buatServer({
    menuFile: path.join(__dirname, "..", "data", "menu.json"),
    pesananFile: path.join(folderSementara, "pesanan.jsonl")
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await fs.rm(folderSementara, { recursive: true, force: true });
});

test("health dan halaman utama berjalan", async () => {
  const health = await fetch(base + "/api/health");
  assert.equal(health.status, 200);
  assert.equal((await health.json()).status, "ok");
  const web = await fetch(base + "/");
  assert.equal(web.status, 200);
  assert.match(await web.text(), /Kopi Lereng/);
});

test("GET menu dan filter kategori", async () => {
  const semua = await (await fetch(base + "/api/menu")).json();
  assert.equal(semua.data.length, 3);
  const panas = await (await fetch(base + "/api/menu?kategori=panas")).json();
  assert.equal(panas.data.length, 2);
  assert.ok(panas.data.every((item) => item.kategori === "panas"));
  const satu = await (await fetch(base + "/api/menu/kopi-tubruk")).json();
  assert.equal(satu.data.harga, 15000);
});

test("POST pesanan menyimpan transaksi demo dan menghitung total di server", async () => {
  const response = await fetch(base + "/api/pesanan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items: [
      { id: "kopi-tubruk", jumlah: 2 },
      { id: "es-kopi-susu", jumlah: 1 }
    ], total: 1 })
  });
  assert.equal(response.status, 201);
  const json = await response.json();
  assert.equal(json.data.total, 52000);
  assert.equal(json.data.jumlahTotal, 3);
  assert.equal(json.data.items[0].subtotal, 30000);
  const detail = await fetch(`${base}/api/pesanan/${json.data.id}`);
  assert.equal(detail.status, 200);
  assert.equal((await detail.json()).data.total, 52000);
});

test("validasi pesanan ditolak bila tidak sah", async () => {
  for (const items of [[], [{ id: "tidak-ada", jumlah: 1 }], [{ id: "kopi-tubruk", jumlah: -2 }]]) {
    const respons = await fetch(base + "/api/pesanan", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items })
    });
    assert.equal(respons.status, 400);
  }
  const tidakAda = await fetch(base + "/api/menu/tidak-ada");
  assert.equal(tidakAda.status, 404);
  const pathRahasia = await fetch(base + "/README.txt");
  assert.equal(pathRahasia.status, 404);
});
