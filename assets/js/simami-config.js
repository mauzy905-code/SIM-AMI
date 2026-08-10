(function () {
    'use strict';

    window.SIMAMI_CONFIG = window.SIMAMI_CONFIG || {};

    window.SIMAMI_CONFIG.ERESSEP = {
        baseUrl: 'https://script.google.com/macros/s/AKfycbwv-vBV07IgWmgHoEQ-mKNgLWI-N6paGVfO5f_57D6SiFSOBavWq5YDOMj-M3hND5Ippw/exec',
        directPasienTemplate: '{baseUrl}?no_rm={noRm}&no_reg={noReg}&nama={nama}&poli={poli}&t={t}'
    };

    window.SIMAMI_CONFIG.ERESSEP.openBase = function () {
        var base = String((window.SIMAMI_CONFIG.ERESSEP || {}).baseUrl || '').trim();
        if (!base) return null;
        var sep = base.indexOf('?') >= 0 ? '&' : '?';
        var url = base + sep + 't=' + encodeURIComponent(String(Date.now()));
        try {
            window.open(url, 'simami_eressep', 'noopener,noreferrer');
            return url;
        } catch (_e) {
            window.location.href = url;
            return url;
        }
    };

    window.SIMAMI_CONFIG.ERESSEP.openForPasien = function (pasien) {
        var cfg = window.SIMAMI_CONFIG.ERESSEP || {};
        var base = String(cfg.baseUrl || '').trim();
        if (!base) return null;
        if (!pasien || typeof pasien !== 'object') {
            return cfg.openBase();
        }
        var template = String(cfg.directPasienTemplate || '{baseUrl}?t={t}');
        var nama = String(pasien.nama_pasien || pasien.nama || '').trim();
        var mapping = {
            baseUrl: base,
            noRm: String(pasien.no_rm || pasien.noRm || '').trim(),
            noReg: String(pasien.no_registrasi || pasien.noReg || '').trim(),
            nama: nama,
            poli: String(pasien.poli_tujuan || pasien.poli || '').trim(),
            t: String(Date.now())
        };
        var url = template.replace(/\{(\w+)\}/g, function (_m, key) {
            return encodeURIComponent(String(mapping[key] != null ? mapping[key] : ''));
        });
        try {
            window.open(url, 'simami_eressep', 'noopener,noreferrer');
            return url;
        } catch (_e) {
            window.location.href = url;
            return url;
        }
    };
})();
