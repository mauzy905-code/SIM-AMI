/* ==========================================================================
   SIM-AMI - Kartu tautan ber-QR (Survei Kepuasan Masyarakat + Pengaduan)
   --------------------------------------------------------------------------
   Menampilkan kartu berisi:
     1. Kode QR  -> tautan resmi (dipindai HP pasien)
     2. Tombol   -> membuka tautan yang sama di tab baru

   Dua kartu didukung:
     - `window.SIMAMI_SKM`       -> kartu Survei Kepuasan Masyarakat (default)
     - `window.SIMAMI_PENGADUAN` -> kartu Pengaduan & Saran (opsional)

   Catatan penting:
   - Halaman tujuan TIDAK BISA dimuat di dalam iframe/overlay karena servernya
     mengirim `X-Frame-Options: SAMEORIGIN`. Satu-satunya jalan: tab baru.
   - Konfigurasi diambil dari variabel global yang di-set di tiap halaman mesin,
     jadi URL/teks tidak perlu diubah di banyak tempat.

   Pemakaian di halaman mesin:
     <div id="skmWidget"></div>
     <div id="pengaduanWidget"></div>
     <script>
       window.SIMAMI_SKM = { perangkatDaerah: 151 };
       window.SIMAMI_PENGADUAN = {};   // boleh kosong, pakai default
     </script>
     <script src="assets/js/skm-widget.js?v=20261119-pengaduan"></script>
   ========================================================================== */

(function () {
    'use strict';

    var DEFAULT_SKM = {
        // ID Perangkat Daerah RSUD Aji Muhammad Idris pada aplikasi SKM Kukar.
        perangkatDaerah: 151,
        // Basis tautan form survey responden (publik, tanpa login).
        baseUrl: 'https://survei.kukarkab.go.id/isi-survei/layanan',
        // Elemen tempat kartu dirender.
        mountId: 'skmWidget',
        // Resolusi native gambar QR (diperkecil oleh CSS agar tetap tajam).
        qrSize: 200,
        // Tata letak kartu:
        //   'stack'   -> vertikal (QR di tengah, teks & tombol di bawah)
        //   'compact' -> horizontal (QR kecil di kiri, teks & tombol di kanan)
        layout: 'stack',
        enabled: true
    };

    var SKM_TEXT = {
        title: 'Survei Kepuasan Masyarakat (SKM)',
        desc: 'Pindai kode QR dengan kamera HP untuk membuka formulir survei resmi.',
        descShort: 'Pindai QR dengan HP atau tekan tombol untuk mengisi survey.',
        button: 'Buka Formulir SKM',
        buttonShort: 'Isi SKM',
        note: 'survei.kukarkab.go.id',
        noteIsUrl: true,
        fallback: 'Kode QR tidak dapat dimuat. Silakan ketik tautan berikut di peramban:',
        qrLabel: 'Kode QR survei kepuasan masyarakat'
    };

    // Kartu Pengaduan & Saran. Sengaja tanpa badge ikon dan tanpa kalimat
    // basi ("kami menghargai masukan Anda"); isinya hanya yang bisa ditindak.
    var DEFAULT_PENGADUAN = {
        mountId: 'pengaduanWidget',
        url: 'https://bit.ly/kanalpengaduanresmiRSUDAMI',
        title: 'Pengaduan & Saran',
        desc: 'Pindai kode QR dengan kamera HP untuk membuka kanal pengaduan resmi RSUD.',
        button: 'Buka Kanal Pengaduan',
        note: 'bit.ly/kanalpengaduanresmiRSUDAMI',
        noteIsUrl: true,
        qrLabel: 'Kode QR pengaduan dan saran',
        qrSize: 200,
        enabled: true
    };

    function esc(value) {
        return String(value == null ? '' : value).replace(/[&<>"]/g, function (ch) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch];
        });
    }

    // Gabungkan konfigurasi user dengan default (key default yang tidak diisi
    // akan memakai nilai default).
    function pick(userConfig, defaults) {
        var cfg = {};
        var source = userConfig || {};

        for (var key in defaults) {
            if (Object.prototype.hasOwnProperty.call(defaults, key)) {
                cfg[key] = Object.prototype.hasOwnProperty.call(source, key)
                    ? source[key]
                    : defaults[key];
            }
        }

        return cfg;
    }

    function getSkmConfig() {
        var cfg = pick(window.SIMAMI_SKM, DEFAULT_SKM);

        cfg.perangkatDaerah = parseInt(cfg.perangkatDaerah, 10) || DEFAULT_SKM.perangkatDaerah;
        cfg.mountId = cfg.mountId || DEFAULT_SKM.mountId;
        cfg.qrSize = parseInt(cfg.qrSize, 10) || DEFAULT_SKM.qrSize;
        cfg.layout = cfg.layout === 'compact' ? 'compact' : 'stack';

        return cfg;
    }

    // Bangun tautan form SKM.
    //
    // Catatan: parameter `layanan=[...]` sengaja TIDAK dipakai. Aplikasi SKM
    // Kukar mengabaikannya (daftar layanan tetap tampil lengkap), sehingga
    // parameter itu hanya memperpanjang URL dan memadatkan kode QR.
    function buildUrl(cfg) {
        return cfg.baseUrl + '?perangkat_daerah=' + encodeURIComponent(cfg.perangkatDaerah);
    }

    function openTab(url) {
        // Catatan: fitur 'noopener' sengaja TIDAK dipakai di argumen windowFeatures,
        // karena browser akan mengembalikan null walau popup berhasil dibuka —
        // akibatnya fallback di bawah selalu ikut jalan dan halaman mesin berpindah.
        var win = window.open(url, '_blank');

        if (win) {
            try {
                win.opener = null; // setara noopener, tapi tetap tahu popup berhasil
            } catch (err) {
                /* diabaikan */
            }
            return true;
        }

        // Sebagian peramban kiosk memblokir popup; ini jalan terakhirnya.
        window.location.href = url;
        return false;
    }

    function renderQr(container, url, size) {
        if (typeof window.QRCode === 'undefined') {
            return false;
        }

        try {
            new window.QRCode(container, {
                text: url,
                width: size,
                height: size,
                colorDark: '#0f172a',
                colorLight: '#ffffff',
                correctLevel: window.QRCode.CorrectLevel.M
            });
            return true;
        } catch (err) {
            console.error('[QR] Gagal membuat kode QR:', err);
            return false;
        }
    }

    // Susun markup kartu. Dua tata letak didukung:
    //  - 'stack'   : judul, QR (tengah), deskripsi, tombol
    //  - 'compact' : QR kecil di kiri; judul, deskripsi, tombol di kanan
    //
    // Selector memakai class (bukan id) karena satu halaman bisa memuat lebih
    // dari satu kartu — id kembar akan membuat `querySelector` salah sasaran.
    function buildMarkup(card) {
        var isCompact = card.layout === 'compact';

        var head =
            '<div class="skm-head">' +
                '<h2 class="skm-title">' + esc(card.title) + '</h2>' +
            '</div>';

        var qrBox =
            '<div class="skm-qr" role="img" aria-label="' + esc(card.qrLabel) + '"></div>';

        var button =
            '<button type="button" class="skm-btn">' +
                '<span class="skm-btn-label">' + esc(isCompact ? card.buttonShort : card.button) + '</span>' +
            '</button>';

        var note =
            '<div class="skm-note' + (card.noteIsUrl ? ' skm-note--link' : '') + '">' +
                esc(card.note) +
            '</div>';

        if (isCompact) {
            return '<div class="skm-qr-wrap">' + qrBox + '</div>' +
                   '<div class="skm-compact-body">' +
                       head +
                       '<p class="skm-desc">' + esc(card.descShort) + '</p>' +
                       button +
                   '</div>';
        }

        return head +
               '<div class="skm-qr-wrap">' + qrBox + '</div>' +
               '<p class="skm-desc">' + esc(card.desc) + '</p>' +
               button +
               (card.note ? note : '');
    }

    function render(mount, card) {
        mount.classList.add('skm-card');
        if (card.variant) {
            mount.classList.add('skm-card--' + card.variant);
        }
        if (card.layout === 'compact') {
            mount.classList.add('skm-card--compact');
        }
        if (card.compactBtn) {
            mount.classList.add('skm-card--btn-sm');
        }
        mount.innerHTML = buildMarkup(card);

        var qrBox = mount.querySelector('.skm-qr');
        var ok = renderQr(qrBox, card.url, card.qrSize);

        if (!ok) {
            var fallback = document.createElement('div');
            fallback.className = 'skm-fallback';
            fallback.textContent = card.fallback + ' ' + card.url;
            mount.appendChild(fallback);
        }

        mount.querySelector('.skm-btn').addEventListener('click', function () {
            openTab(card.url);
        });

        mount.setAttribute('data-link-url', card.url);
    }

    function renderSkm(cfg) {
        var mount = document.getElementById(cfg.mountId);
        if (!mount) {
            return; // Halaman ini tidak memakai kartu SKM.
        }

        render(mount, {
            url: buildUrl(cfg),
            layout: cfg.layout,
            qrSize: cfg.qrSize,
            title: SKM_TEXT.title,
            desc: SKM_TEXT.desc,
            descShort: SKM_TEXT.descShort,
            button: SKM_TEXT.button,
            buttonShort: SKM_TEXT.buttonShort,
            note: SKM_TEXT.note,
            noteIsUrl: SKM_TEXT.noteIsUrl,
            fallback: SKM_TEXT.fallback,
            qrLabel: SKM_TEXT.qrLabel,
            variant: 'skm'
        });
    }

    function renderPengaduan(cfg) {
        var mount = document.getElementById(cfg.mountId);
        if (!mount) {
            return; // Halaman ini tidak memakai kartu Pengaduan.
        }

        render(mount, {
            url: cfg.url,
            layout: 'stack',
            qrSize: parseInt(cfg.qrSize, 10) || DEFAULT_PENGADUAN.qrSize,
            title: cfg.title,
            desc: cfg.desc,
            button: cfg.button,
            note: cfg.note,
            noteIsUrl: cfg.noteIsUrl !== false,
            fallback: 'Kode QR tidak dapat dimuat. Silakan ketik tautan berikut di peramban:',
            qrLabel: cfg.qrLabel,
            variant: 'pengaduan',
            compactBtn: true
        });
    }

    function init() {
        var skm = getSkmConfig();
        if (skm.enabled) {
            renderSkm(skm);
        }

        var pengaduan = pick(window.SIMAMI_PENGADUAN, DEFAULT_PENGADUAN);
        if (pengaduan.enabled) {
            renderPengaduan(pengaduan);
        }
    }

    // Diekspos untuk keperluan uji/debug di konsol peramban.
    window.SimamiSkm = {
        config: getSkmConfig,
        buildUrl: buildUrl,
        url: function () {
            return buildUrl(getSkmConfig());
        },
        openSurvey: openTab,
        init: init
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
