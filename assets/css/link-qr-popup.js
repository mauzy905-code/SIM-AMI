/* ==========================================================================
   SIM-AMI - Popup Tautan QR (Survey Kepuasan Masyarakat & Pengaduan)
   --------------------------------------------------------------------------
   Komponen generik: satu popup di tengah layar berisi:
     1. Kode QR   -> berisi tautan tujuan (dipindai HP pasien)
     2. Tombol    -> membuka tautan yang sama di tab baru
     3. Tombol    -> TUTUP

   Dipakai di `mesin-antrian.html` (halaman "Pilih Unit Tujuan Pasien").
   Tombol pemicu cukup punya atribut:

     <button data-link-popup="skm">...</button>
     <button data-link-popup="pengaduan">...</button>

   lalu konfigurasi tiap jenis didefinisikan di `window.SIMAMI_LINK_POPUP`:

     window.SIMAMI_LINK_POPUP = {
       skm:       { title: '...', url: 'https://...' },
       pengaduan: { title: '...', url: 'https://...' }
     };

   Catatan penting:
   - Form SKM & kanal pengaduan pemerintah TIDAK BISA dimuat di iframe
     (header `X-Frame-Options: SAMEORIGIN`), jadi satu-satunya cara adalah
     membuka tab baru (window.open). Popup ini hanya menampilkan QR + tombol.
   - Pustaka QR: qrcodejs (`window.QRCode`), sama seperti `skm-widget.js`.
     Versi lain (`qrcode@1.5.3`) 404 di CDN — jangan dipakai.
   - Pola `window.open` mengikuti §15D PROJECT_CONTEXT: jangan pakai
     `'noopener'` di windowFeatures (mengembalikan null -> halaman pindah).
   ========================================================================== */

(function () {
    'use strict';

    var DEFAULT_CONFIG = {
        mountId: 'linkQrPopup',
        qrSize: 240,
        // Jenis popup yang dikenal. `url` wajib diisi dari halaman.
        types: {
            skm: {
                title: 'Survei Kepuasan Masyarakat (SKM)',
                desc: 'Pindai kode QR dengan kamera HP Anda, atau tekan tombol untuk membuka form survey resmi.',
                icon: '&#9733;',
                button: 'Buka Form Survey',
                note: 'Layanan ini bersifat sukarela - terima kasih atas penilaian Anda',
                url: ''
            },
            pengaduan: {
                title: 'Pengaduan, Saran & Masukan',
                desc: 'Pindai kode QR dengan kamera HP Anda, atau tekan tombol untuk membuka kanal pengaduan resmi RSUD AMI.',
                icon: '&#9993;',
                button: 'Buka Kanal Pengaduan',
                note: 'Sampaikan pengaduan, saran, atau masukan Anda secara resmi',
                url: ''
            }
        }
    };

    var state = null;

    function getConfig() {
        var user = (typeof window !== 'undefined' && window.SIMAMI_LINK_POPUP) ? window.SIMAMI_LINK_POPUP : {};
        var cfg = { mountId: DEFAULT_CONFIG.mountId, qrSize: DEFAULT_CONFIG.qrSize, types: {} };

        for (var key in DEFAULT_CONFIG.types) {
            if (!Object.prototype.hasOwnProperty.call(DEFAULT_CONFIG.types, key)) continue;
            var base = DEFAULT_CONFIG.types[key];
            var override = (user.types && user.types[key]) || {};
            var merged = {};

            for (var field in base) {
                if (!Object.prototype.hasOwnProperty.call(base, field)) continue;
                merged[field] = Object.prototype.hasOwnProperty.call(override, field) ? override[field] : base[field];
            }

            cfg.types[key] = merged;
        }

        if (user.mountId) cfg.mountId = user.mountId;
        if (user.qrSize) cfg.qrSize = parseInt(user.qrSize, 10) || DEFAULT_CONFIG.qrSize;

        return cfg;
    }

    function openLink(url) {
        // 'noopener' sengaja TIDAK dipakai di windowFeatures (lihat header file).
        var win = window.open(url, '_blank');

        if (win) {
            try {
                win.opener = null;
            } catch (err) {
                /* diabaikan */
            }
            return true;
        }

        // Jalan terakhir bila popup diblokir peramban kiosk.
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
            console.error('[LinkQRPopup] Gagal membuat kode QR:', err);
            return false;
        }
    }

    function closePopup() {
        if (!state || !state.mount) return;
        state.mount.classList.add('hidden');
        var card = state.mount.querySelector('.lqp-card');
        if (card) card.classList.remove('lqp-card--in');
        state.activeType = null;
    }

    function openPopup(type) {
        if (!state) return;

        var cfg = state.cfg;
        var item = cfg.types[type];
        if (!item || !item.url) {
            console.error('[LinkQRPopup] Jenis popup tidak dikenal atau URL kosong:', type);
            return;
        }

        var mount = state.mount;
        var qrWrap = mount.querySelector('#lqpQrBox');

        mount.querySelector('#lqpTitle').textContent = item.title;
        mount.querySelector('#lqpDesc').textContent = item.desc;
        mount.querySelector('#lqpNote').textContent = item.note;
        mount.querySelector('#lqpIcon').innerHTML = item.icon;

        var btn = mount.querySelector('#lqpOpenBtn');
        btn.querySelector('.lqp-btn-label').textContent = item.button;

        qrWrap.innerHTML = '';
        var ok = renderQr(qrWrap, item.url, cfg.qrSize);
        if (!ok) {
            qrWrap.innerHTML = '<div class="lqp-fallback">Kode QR tidak dapat dimuat.<br>' +
                'Silakan buka tautan berikut:<br><span>' + item.url + '</span></div>';
        }

        mount.setAttribute('data-lqp-active', type);
        mount.setAttribute('data-lqp-url', item.url);
        mount.classList.remove('hidden');

        var card = mount.querySelector('.lqp-card');
        if (card) {
            card.classList.remove('lqp-card--in');
            // paksa reflow agar animasi masuk berjalan ulang
            void card.offsetWidth;
            card.classList.add('lqp-card--in');
        }

        state.activeType = type;
    }

    function init() {
        var cfg = getConfig();
        var mount = document.getElementById(cfg.mountId);
        if (!mount) return; // halaman ini tidak memakai popup tautan QR

        state = { cfg: cfg, mount: mount, activeType: null };

        // Tombol tutup + klik area luar + tombol Esc.
        mount.querySelector('#lqpCloseBtn').addEventListener('click', closePopup);
        mount.addEventListener('click', function (e) {
            if (e.target === mount || e.target === mount.firstElementChild) closePopup();
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') closePopup();
        });

        // Tombol "Buka ..." di dalam popup membuka tautan jenis yang aktif.
        mount.querySelector('#lqpOpenBtn').addEventListener('click', function () {
            if (!state || !state.activeType) return;
            openLink(state.cfg.types[state.activeType].url);
        });

        // Tombol pemicu: semua elemen ber-atribut data-link-popup.
        var triggers = document.querySelectorAll('[data-link-popup]');
        Array.prototype.forEach.call(triggers, function (btn) {
            btn.addEventListener('click', function () {
                openPopup(btn.getAttribute('data-link-popup'));
            });
        });
    }

    // Diekspos untuk keperluan uji/debug di konsol peramban.
    window.SimamiLinkPopup = {
        config: getConfig,
        open: openPopup,
        close: closePopup,
        openLink: openLink,
        init: init
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
