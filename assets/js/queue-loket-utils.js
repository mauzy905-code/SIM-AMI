(function() {
    function normalizeRaw(value) {
        return String(value || '').trim().toUpperCase();
    }

    function normalizeCompact(value) {
        return normalizeRaw(value).replace(/[^A-Z0-9]+/g, '');
    }

    function isFarmasiRole(role) {
        const value = String(role || '').trim().toLowerCase();
        return value === 'admin_farmasi' || value === 'petugas_farmasi' || value === 'petugas farmasi';
    }

    function isFarmasiContext(options) {
        const unit = String(options?.unit || '').trim().toUpperCase();
        if (unit === 'FARMASI') return true;
        return isFarmasiRole(options?.role);
    }

    function normalizeQueueLoketCode(value, options) {
        const raw = normalizeRaw(value);
        const compact = normalizeCompact(value);
        if (!raw) return '';
        if (raw === 'SUPERVISOR') return 'SUPERVISOR';

        if (compact === 'FARMASI1' || compact === 'FARMASILOKET1' || compact === 'LOKETFARMASI1') return 'FARMASI_1';
        if (compact === 'FARMASI2' || compact === 'FARMASILOKET2' || compact === 'LOKETFARMASI2') return 'FARMASI_2';

        if (compact === 'A' || compact === 'LOKETA') return 'A';
        if (compact === 'B' || compact === 'LOKETB') return 'B';
        if (compact === 'C' || compact === 'LOKETC') return 'C';

        if (compact === '1' || compact === 'LOKET1') {
            return isFarmasiContext(options) ? 'FARMASI_1' : 'A';
        }
        if (compact === '2' || compact === 'LOKET2') {
            return isFarmasiContext(options) ? 'FARMASI_2' : 'B';
        }
        if (compact === '3' || compact === 'LOKET3') {
            return 'C';
        }

        const match = raw.match(/\b([ABC])\b/);
        return match ? match[1] : raw;
    }

    function formatQueueLoketLabel(value, options) {
        const code = normalizeQueueLoketCode(value, options);
        if (!code) return '-';
        if (code === 'SUPERVISOR') return 'Supervisor';
        if (code === 'FARMASI_1') return 'Loket 1';
        if (code === 'FARMASI_2') return 'Loket 2';
        if (code === 'A') return 'Loket A';
        if (code === 'B') return 'Loket B';
        if (code === 'C') return 'Loket C';
        return code.replace(/_/g, ' ');
    }

    function getQueueLoketAliases(value, options) {
        const code = normalizeQueueLoketCode(value, options);
        if (!code || code === 'SUPERVISOR') return [];
        if (code === 'FARMASI_1') return ['FARMASI_1', 'FARMASI1', 'LOKET_FARMASI_1', 'LOKET_1', 'LOKET1', '1'];
        if (code === 'FARMASI_2') return ['FARMASI_2', 'FARMASI2', 'LOKET_FARMASI_2', 'LOKET_2', 'LOKET2', '2'];
        if (code === 'A') return ['A', 'LOKET_1', 'LOKET1', 'LOKET_A'];
        if (code === 'B') return ['B', 'LOKET_2', 'LOKET2', 'LOKET_B'];
        if (code === 'C') return ['C', 'LOKET_3', 'LOKET3', 'LOKET_C'];
        return [code];
    }

    function getQueueLoketTargetLabel(value, options) {
        const label = formatQueueLoketLabel(value, options);
        return label === '-' ? '' : 'Menuju ' + label;
    }

    function getQueueLoketAudioTokens(value, options) {
        const code = normalizeQueueLoketCode(value, options);
        if (code === 'FARMASI_1') return ['1'];
        if (code === 'FARMASI_2') return ['2'];
        if (code === 'A' || code === 'B' || code === 'C') return [code];
        return [];
    }

    function getDefaultQueueLoket(role, currentLoket) {
        const normalized = normalizeQueueLoketCode(currentLoket, { role: role });
        if (normalized) return normalized;
        return isFarmasiRole(role) ? 'FARMASI_1' : '';
    }

    window.queueLoketUtils = {
        isFarmasiRole: isFarmasiRole,
        normalizeCode: normalizeQueueLoketCode,
        formatLabel: formatQueueLoketLabel,
        getAliases: getQueueLoketAliases,
        getTargetLabel: getQueueLoketTargetLabel,
        getAudioTokens: getQueueLoketAudioTokens,
        getDefaultLoket: getDefaultQueueLoket
    };
})();
