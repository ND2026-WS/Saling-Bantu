/* ============================================================
   SALING BANTU — main.js
   Header, footer, status login, lonceng notifikasi, navigasi
   ============================================================ */
(function () {
  "use strict";
  const S = SB;
  const cfg = window.SB_CONFIG;

  const NAV = [
    { id: "beranda", label: "Beranda", href: "index.html" },
    { id: "cari", label: "Cari Bantuan", href: "cari-bantuan.html" },
    { id: "membantu", label: "Ingin Membantu", href: "ingin-membantu.html" },
    { id: "ziswaf", label: "ZISWAF", href: "ziswaf.html" },
    { id: "cerita", label: "Cerita Kebaikan", href: "cerita-kebaikan.html" },
    { id: "galeri", label: "Galeri", href: "galeri.html" },
    { id: "tentang", label: "Tentang Kami", href: "tentang.html" }
  ];

  /* Logo aplikasi: pakai logo kustom bila admin sudah mengunggahnya (Isi
     Website -> Identitas), selain itu ikon hati tangan bawaan. */
  function logoSvg(size) {
    const kustom = (SB.teks && SB.teks("app_logo")) || "";
    if (kustom) {
      const px = (size || 21) + 8;
      return '<img src="' + S.esc(kustom) + '" alt="Logo" style="width:' + px + 'px;height:' + px +
        'px;object-fit:contain;border-radius:9px;background:rgba(255,255,255,.92);padding:2px"/>';
    }
    return S.icon("heartHand", size || 21);
  }

  function perbaruiFavicon() {
    const kustom = (SB.teks && SB.teks("app_logo")) || "";
    if (!kustom) return;
    const f = document.querySelector('link[rel="icon"]');
    if (f) f.href = kustom;
  }

  function renderHeader() {
    const mount = document.getElementById("app-header");
    if (!mount) return;
    const page = document.body.getAttribute("data-page") || "";
    const links = NAV.map((n) =>
      '<a href="' + n.href + '" class="' + (page === n.id ? "active" : "") + '">' + n.label + "</a>").join("");
    mount.innerHTML =
      '<header class="sb-header"><div class="container sb-header-in">' +
      '<a class="brand" href="index.html"><span class="brand-logo">' + logoSvg(21) + "</span>" +
      '<span class="brand-txt"><b>' + S.esc(SB.teks ? SB.teks("app_nama") : cfg.APP_NAME) + "</b><small>" + S.esc(SB.teks ? SB.teks("app_tagline") : cfg.APP_TAGLINE) + "</small></span></a>" +
      '<nav class="nav" id="main-nav">' + links + "</nav>" +
      '<div class="header-actions" id="header-actions"></div>' +
      '<button class="nav-toggle" id="nav-toggle" aria-label="Menu">' + S.icon("menu", 20) + "</button>" +
      "</div></header>";
    document.getElementById("nav-toggle").addEventListener("click", () => {
      document.getElementById("main-nav").classList.toggle("open");
    });
    perbaruiFavicon();
    renderAuthArea();
  }

  function renderAuthArea() {
    const box = document.getElementById("header-actions");
    if (!box) return;
    S.store.currentUser().then((user) => {
      window.SB_USER = user || null;
      document.dispatchEvent(new CustomEvent("sb-user-ready", { detail: user }));
      if (!user) {
        box.innerHTML =
          '<a class="btn btn-ghost btn-sm" href="masuk.html">Masuk</a>' +
          '<a class="btn btn-primary btn-sm" href="daftar.html">Daftar</a>';
        return;
      }
      const adminLink = user.peran === "admin"
        ? '<a href="admin.html">' + S.icon("shield", 15) + " Panel Admin</a>" : "";
      box.innerHTML =
        '<div class="notif-wrap" style="position:relative">' +
        '<button class="notif-btn" id="notif-btn" aria-label="Notifikasi">' + S.icon("bell", 18) +
        '<span class="notif-dot" id="notif-dot" style="display:none">0</span></button></div>' +
        '<div class="user-menu">' +
        '<div class="user-chip" id="user-chip">' + S.avatar(user.nama, 30) +
        '<span class="u-name">' + S.esc(user.nama.split(" ")[0]) + "</span>" + S.icon("chevron", 14) + "</div>" +
        '<div class="dropdown" id="user-dd">' +
        '<a href="dashboard.html">' + S.icon("sliders", 15) + " Dashboard Saya</a>" + adminLink +
        '<a href="ajukan-bantuan.html">' + S.icon("file", 15) + " Ajukan Bantuan</a>" +
        '<div class="dd-sep"></div><button id="btn-logout">' + S.icon("logout", 15) + " Keluar</button>" +
        "</div></div>";
      const chip = document.getElementById("user-chip");
      const dd = document.getElementById("user-dd");
      chip.addEventListener("click", (e) => { e.stopPropagation(); dd.classList.toggle("open"); });
      document.addEventListener("click", () => dd.classList.remove("open"));
      document.getElementById("btn-logout").addEventListener("click", async () => {
        await S.store.signOut();
        S.toast("Anda telah keluar. Sampai jumpa!", "info");
        setTimeout(() => { location.href = "index.html"; }, 600);
      });
      const nb = document.getElementById("notif-btn");
      nb.addEventListener("click", (e) => { e.stopPropagation(); toggleNotifPanel(nb.parentElement); });
      refreshNotifDot();
    });
  }

  async function refreshNotifDot() {
    const dot = document.getElementById("notif-dot");
    if (!dot) return;
    try {
      const n = await S.store.unreadCount();
      dot.style.display = n > 0 ? "grid" : "none";
      dot.textContent = n > 99 ? "99+" : n;
    } catch (e) { /* diam */ }
  }

  async function toggleNotifPanel(wrap) {
    const ada = document.getElementById("notif-panel");
    if (ada) { ada.remove(); return; }
    const panel = document.createElement("div");
    panel.className = "notif-panel"; panel.id = "notif-panel";
    panel.innerHTML = '<div class="np-head">Notifikasi <button class="btn-link" id="np-all" style="border:none;background:none;color:var(--biru);font-weight:700;font-size:12px;cursor:pointer">Tandai dibaca</button></div><div class="notif-list" id="np-list"><div style="padding:18px;color:var(--abu);font-size:13px">Memuat...</div></div>';
    wrap.appendChild(panel);
    panel.addEventListener("click", (e) => e.stopPropagation());
    document.addEventListener("click", () => { const p = document.getElementById("notif-panel"); if (p) p.remove(); }, { once: true });
    document.getElementById("np-all").addEventListener("click", async () => {
      await S.store.markAllRead(); refreshNotifDot();
      const l = document.getElementById("np-list"); if (l) l.innerHTML = '<div style="padding:18px;color:var(--abu);font-size:13px">Semua notifikasi telah dibaca.</div>';
    });
    const list = await S.store.myNotifications();
    const box = document.getElementById("np-list");
    if (!list.length) { box.innerHTML = '<div style="padding:18px;color:var(--abu);font-size:13px">Belum ada notifikasi.</div>'; return; }
    box.innerHTML = list.slice(0, 7).map((n) => {
      const m = S.JENIS_NOTIF[n.jenis] || { icon: "bell" };
      return '<div class="notif-item ' + (n.baca ? "" : "unread") + '" data-id="' + n.id + '" data-link="' + S.esc(n.link || "") + '">' +
        '<span class="notif-ic">' + S.icon(m.icon, 15) + "</span>" +
        "<div><b>" + S.esc(n.judul) + "</b><p>" + S.esc(n.pesan) + "</p><time>" + S.waktuLalu(n.tanggal) + "</time></div></div>";
    }).join("");
    box.querySelectorAll(".notif-item").forEach((el) => {
      el.addEventListener("click", async () => {
        await S.store.markRead(el.dataset.id);
        refreshNotifDot();
        if (el.dataset.link) location.href = el.dataset.link;
      });
    });
  }

  function renderFooter() {
    const mount = document.getElementById("app-footer");
    if (!mount) return;
    const cats = Object.entries(S.KATEGORI).map(([k, m]) =>
      '<a href="cari-bantuan.html?kategori=' + k + '">' + S.esc(m.label) + "</a>").join("");
    mount.innerHTML =
      '<footer class="sb-footer"><div class="container">' +
      '<div class="footer-in">' +
      "<div>" +
      '<div class="f-brand"><span class="brand-logo">' + logoSvg(20) + '</span><span class="brand-txt"><b style="color:#fff">' + S.esc(SB.teks ? SB.teks("app_nama") : cfg.APP_NAME) + '</b><small style="color:#94a3b8">' + S.esc(SB.teks ? SB.teks("app_tagline") : cfg.APP_TAGLINE) + "</small></span></div>" +
      "<p>" + S.esc(SB.teks ? SB.teks("footer_tentang") : "Platform gotong royong digital yang menghubungkan mereka yang membutuhkan bantuan dengan hati-hati yang ingin membantu. Setiap rupiah dan setiap tenaga tercatat transparan.") + "</p>" +
      "</div>" +
      "<div><h4>Jelajahi</h4><a href=\"index.html\">Beranda</a><a href=\"cari-bantuan.html\">Cari Bantuan</a><a href=\"ingin-membantu.html\">Ingin Membantu</a><a href=\"ziswaf.html\">ZISWAF</a><a href=\"cerita-kebaikan.html\">Cerita Kebaikan</a><a href=\"galeri.html\">Galeri</a><a href=\"transparansi.html\">Transparansi</a><a href=\"tentang.html\">Tentang Kami</a></div>" +
      "<div><h4>Kategori Bantuan</h4>" + cats + "</div>" +
      "<div><h4>Hubungi Kami</h4><p>" + S.icon("message", 14) + " " + S.esc(SB.teks ? SB.teks("email_kontak") : cfg.EMAIL_KONTAK) + "</p><p>" + S.icon("bell", 14) + " " + S.esc(SB.teks ? SB.teks("wa_kontak") : cfg.WA_KONTAK) + "</p>" +
      ((SB.teks && SB.teks("app_alamat")) ? '<p style="margin-top:8px">' + S.icon("home", 14) + " " + S.esc(SB.teks("app_alamat")) + "</p>" : "") +
      ((SB.teks && SB.teks("app_website")) ? '<p style="margin-top:4px">' + S.icon("home", 14) + ' <a href="' + S.esc(SB.teks("app_website")) + '" target="_blank" rel="noopener" style="color:#86efac">' + S.esc(SB.teks("app_website").replace(/^https?:\/\//, "")) + "</a></p>" : "") +
      '<p style="margin-top:10px">Lihat laporan dana publik kami di halaman <a href="transparansi.html" style="color:#86efac">Transparansi</a>.</p></div>' +
      "</div>" +
      '<div class="f-bottom"><span>' + S.esc(SB.teks ? SB.teks("footer_copyright") : "© 2026 " + cfg.APP_NAME + " — Gotong royong untuk Indonesia.") + "</span><span>" + S.esc(SB.teks ? SB.teks("footer_credit") : "Dibuat dengan kepedulian di Indonesia") + "</span></div>" +
      "</div></footer>";
  }

  /* Helper halaman */
  SB.needLogin = function (pesan) {
    S.store.currentUser().then((u) => {
      if (u) return;
      S.toast(pesan || "Silakan masuk terlebih dahulu.", "info");
      setTimeout(() => { location.href = "masuk.html?next=" + encodeURIComponent(location.pathname.split("/").pop() + location.search); }, 900);
    });
  };
  SB.refreshNotif = refreshNotifDot;
  /* Render ulang header + footer (dipakai CMS "Isi Website" setelah simpan) */
  SB.renderKerangka = function () { renderHeader(); renderFooter(); };

  document.addEventListener("DOMContentLoaded", async () => {
    if (SB.muatKonten) await SB.muatKonten(); /* muat teks CMS sebelum render */
    renderHeader();
    renderFooter();
    if (SB.terapkanKonten) SB.terapkanKonten();

    /* Realtime: titik notifikasi ikut segar saat ada data baru
       (donasi masuk, pengajuan diverifikasi, pengumuman, dsb). */
    if (SB.watchData) {
      let jadwal = null;
      SB.watchData((info) => {
        if (info && info.tabel && info.tabel !== "notifications") return;
        clearTimeout(jadwal);
        jadwal = setTimeout(() => refreshNotifDot(), 500);
      });
    }
  });
})();
