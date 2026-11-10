/* ============================================================
   SALING BANTU — auth.js (logika masuk & daftar)
   ============================================================ */
(function () {
  "use strict";
  const S = SB;
  const halaman = document.body.querySelector("#form-masuk") ? "masuk" : "daftar";
  const $ = (sel) => document.querySelector(sel);

  function tampilError(msg) {
    const box = $("#auth-err");
    box.textContent = msg;
    box.style.display = "flex";
  }
  function sembunyiError() { $("#auth-err").style.display = "none"; }

  /* ---------- Modal koneksi Supabase (bisa diakses TANPA login) ---------- */
  function modalKoneksi() {
    const cfg = window.SB_CONFIG || {};
    S.modal({
      judul: "Koneksi Supabase",
      isi:
        '<div class="alert alert-warn" style="margin-bottom:12px">' + S.icon("shield", 15) +
        "<span>Gunakan HANYA <i>anon public key</i> — service role key dilarang keras di frontend.</span></div>" +
        '<div class="field"><label>Supabase Project URL</label><input id="kx-url" type="url" placeholder="https://abcdefgh.supabase.co" value="' + S.esc(cfg.SUPABASE_URL || "") + '"/></div>' +
        '<p class="hint" style="margin:-4px 0 10px">Format: <b>https://xxxxx.supabase.co</b> — salin dari Dashboard Supabase → Project Settings → API. <b>Bukan</b> email atau kata sandi akun Anda.</p>' +
        '<div class="field"><label>Anon Public Key</label><input id="kx-key" type="password" placeholder="eyJhbGciOi..." value="' + S.esc(cfg.SUPABASE_ANON_KEY || "") + '"/></div>' +
        '<p class="hint">Tersimpan di browser ini (localStorage "sb_koneksi") dan langsung berlaku di semua halaman. Kosongkan kedua kolom lalu simpan untuk kembali ke Mode Demo. Pastikan <b>sql/supabase_schema.sql</b> sudah dijalankan di SQL Editor proyek Supabase Anda.</p>',
      footer: '<button class="btn btn-ghost" id="kx-batal">Batal</button><button class="btn btn-primary" id="kx-simpan">Simpan & Muat Ulang</button>'
    });
    document.getElementById("kx-batal").onclick = S.modalClose;
    document.getElementById("kx-simpan").onclick = () => {
      const url = document.getElementById("kx-url").value.trim();
      const key = document.getElementById("kx-key").value.trim();
      if (/@/.test(url) && !/^https:\/\//.test(url)) {
        S.toast("Kolom Project URL diisi https://xxxxx.supabase.co — BUKAN alamat email. Salin dari Dashboard Supabase → Project Settings → API.", "gagal");
        return;
      }
      if ((url && !key) || (!url && key)) { S.toast("URL dan anon key harus diisi berpasangan (atau keduanya kosong).", "gagal"); return; }
      if (url && !/^https:\/\/.+/.test(url)) { S.toast("URL harus dimulai dengan https://", "gagal"); return; }
      try { localStorage.setItem("sb_koneksi", JSON.stringify({ SUPABASE_URL: url, SUPABASE_ANON_KEY: key })); }
      catch (e) { S.toast("Gagal menyimpan: " + e.message, "gagal"); return; }
      S.toast(url ? "Tersimpan. Menghubungkan ke Supabase..." : "Tersimpan. Kembali ke Mode Demo...", "sukses");
      setTimeout(() => location.reload(), 600);
    };
  }

  /* ---------- Banner status mode di atas form ---------- */
  function bannerMode(halaman) {
    const form = $(halaman === "masuk" ? "#form-masuk" : "#form-daftar");
    if (!form) return;
    const el = document.createElement("div");
    el.className = "alert alert-warn";
    el.style.marginBottom = "14px";
    if (SB.MODE === "demo") {
      el.innerHTML = S.icon("bell", 16) + (halaman === "masuk"
        ? '<span><b>Mode Demo aktif</b> — aplikasi belum terhubung ke Supabase, sehingga akun yang terdaftar di Supabase <b>tidak bisa</b> dipakai di sini (data hanya di browser ini). Gunakan akun demo di bawah, atau <a href="#" id="lk-koneksi" style="font-weight:700"><b>atur koneksi Supabase</b></a> (URL + anon key).</span>'
        : '<span><b>Mode Demo aktif</b> — akun baru akan disimpan di browser ini, bukan di Supabase. <a href="#" id="lk-koneksi" style="font-weight:700"><b>Atur koneksi Supabase</b></a> bila ingin data tersimpan di server.</span>');
      form.parentNode.insertBefore(el, form);
      el.querySelector("#lk-koneksi").addEventListener("click", (e) => { e.preventDefault(); modalKoneksi(); });
    } else if (S.store && S.store.mode === "demo") {
      el.innerHTML = S.icon("bell", 16) + "<span><b>Konfigurasi Supabase terbaca</b>, tetapi pustaka supabase-js gagal dimuat (periksa koneksi internet / CDN). Sementara ini memakai Mode Demo.</span>";
      form.parentNode.insertBefore(el, form);
    }
  }

  function tandaiField(input, ok) {
    const f = input.closest(".field");
    if (f) f.classList.toggle("has-err", !ok);
    return ok;
  }
  function tujuan() {
    const next = S.param("next");
    return next ? next : "dashboard.html";
  }
  function alihkan(user) {
    const depan = user && user.nama ? user.nama.split(" ")[0] : "Sahabat";
    S.toast("Halo, " + depan + "! Berhasil masuk.", "sukses");
    setTimeout(() => {
      if (user && user.peran === "admin" && !S.param("next")) location.href = "admin.html";
      else location.href = tujuan();
    }, 700);
  }

  /* ---------- Halaman MASUK ---------- */
  if (halaman === "masuk") {
    if (SB.MODE === "demo") document.getElementById("demo-box").style.display = "block";
    bannerMode("masuk");

    document.querySelectorAll("[data-demo]").forEach((b) => {
      b.addEventListener("click", async () => {
        const email = b.dataset.demo;
        $("#m-email").value = email;
        $("#m-sandi").value = "demo1234";
        $("#form-masuk").requestSubmit();
      });
    });

    $("#form-masuk").addEventListener("submit", async (e) => {
      e.preventDefault();
      sembunyiError();
      const email = $("#m-email").value.trim();
      const sandi = $("#m-sandi").value;
      const okEmail = tandaiField($("#m-email"), /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
      const okSandi = tandaiField($("#m-sandi"), sandi.length > 0);
      if (!okEmail || !okSandi) return;

      const btn = $("#btn-masuk");
      btn.disabled = true; btn.textContent = "Memproses...";
      try {
        const user = await S.store.signIn(email, sandi);
        document.dispatchEvent(new CustomEvent("sb-auth"));
        alihkan(user);
      } catch (err) {
        tampilError(err.message || "Gagal masuk. Coba lagi.");
        btn.disabled = false; btn.textContent = "Masuk";
      }
    });
  }

  /* ---------- Halaman DAFTAR ---------- */
  else {
    bannerMode("daftar");
    let peranDipilih = "penerima";
    document.querySelectorAll("#peran-group .pill").forEach((p) => {
      p.addEventListener("click", () => {
        document.querySelectorAll("#peran-group .pill").forEach((x) => x.classList.remove("on"));
        p.classList.add("on");
        peranDipilih = p.dataset.peran;
      });
    });

    $("#form-daftar").addEventListener("submit", async (e) => {
      e.preventDefault();
      sembunyiError();
      const nama = $("#d-nama").value.trim();
      const email = $("#d-email").value.trim();
      const telp = $("#d-telp").value.trim();
      const sandi = $("#d-sandi").value;
      const sandi2 = $("#d-sandi2").value;
      const setuju = $("#d-setuju").checked;

      const okNama = tandaiField($("#d-nama"), nama.length >= 3);
      const okEmail = tandaiField($("#d-email"), /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
      const okTelp = tandaiField($("#d-telp"), telp.length >= 8);
      const okSandi = tandaiField($("#d-sandi"), sandi.length >= 8);
      const okSandi2 = tandaiField($("#d-sandi2"), sandi === sandi2 && sandi2.length > 0);
      if (!okNama || !okEmail || !okTelp || !okSandi || !okSandi2) return;
      if (!setuju) { tampilError("Centang persetujuan ketentuan layanan terlebih dahulu."); return; }

      const btn = $("#btn-daftar");
      btn.disabled = true; btn.textContent = "Membuat akun...";
      try {
        const user = await S.store.signUp({ nama, email, telepon: telp, sandi, peran: peranDipilih });
        S.toast("Akun berhasil dibuat. Selamat bergabung!", "sukses");
        setTimeout(() => {
          if (user && user.id) location.href = "dashboard.html";
          else location.href = "masuk.html";
        }, 900);
      } catch (err) {
        tampilError(err.message || "Gagal mendaftar.");
        btn.disabled = false; btn.textContent = "Buat Akun";
      }
    });
  }
})();
