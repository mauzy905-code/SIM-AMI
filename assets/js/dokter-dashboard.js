(() => {
    function createDokterDashboardModule(config) {
        const containerEl = config?.containerEl || null;
        if (!containerEl) {
            return {
                render: () => {}
            };
        }

        let mounted = false;
        let els = {};
        let modalState = {
            open: false,
            query: '',
            debounceTimer: null,
            lastRequestId: 0
        };

        function getStaffNameValue() {
            const name = String(config?.getCurrentOperatorName?.() || '').trim();
            return name || 'Petugas';
        }

        function getRoleLabelValue() {
            const label = String(config?.getRoleLabel?.() || '').trim();
            return label || 'Dokter';
        }

        function getEmailValue() {
            const value = String(config?.getCurrentAdminEmail?.() || '').trim();
            return value || '-';
        }

        function getAksesValue() {
            return 'Asesmen UGD, Rekap Pasien';
        }

        function ensureMounted() {
            if (mounted) return;

            containerEl.innerHTML = [
                '<div class="dokter-dashboard space-y-5">',
                '  <div class="overflow-hidden rounded-[32px] border border-white/70 bg-white/85 shadow-[0_28px_80px_-28px_rgba(15,23,42,0.28)] backdrop-blur-xl">',
                '    <div class="dokter-dashboard-hero px-5 py-5 md:px-6">',
                '      <div class="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">',
                '        <div class="max-w-3xl">',
                '          <div class="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.24em] text-white/95">Panel Dokter</div>',
                '          <div class="mt-3 text-2xl md:text-3xl font-black tracking-tight text-white">Dashboard Dokter</div>',
                '          <div class="mt-2 text-sm md:text-base font-semibold leading-relaxed text-white/90">Akses cepat untuk asesmen UGD dan rekap pasien.</div>',
                '          <div class="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">',
                '            <div class="rounded-2xl border border-white/15 bg-white/10 px-3.5 py-3.5 text-white">',
                '              <div class="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">Petugas Aktif</div>',
                '              <div id="dokterDashStaffName" class="mt-1.5 text-base font-black">-</div>',
                '            </div>',
                '            <div class="rounded-2xl border border-white/15 bg-white/10 px-3.5 py-3.5 text-white">',
                '              <div class="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">Peran</div>',
                '              <div id="dokterDashRoleLabel" class="mt-1.5 text-base font-black">-</div>',
                '            </div>',
                '            <div class="rounded-2xl border border-white/15 bg-white/10 px-3.5 py-3.5 text-white">',
                '              <div class="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">Akses</div>',
                '              <div id="dokterDashAccessLabel" class="mt-1.5 text-base font-black">-</div>',
                '            </div>',
                '          </div>',
                '        </div>',
                '        <div class="min-w-full xl:min-w-[380px] space-y-2.5">',
                '          <div class="rounded-2xl border border-white/15 bg-white/10 px-3.5 py-3.5 text-white">',
                '            <div class="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">Email Akun</div>',
                '            <div id="dokterDashEmail" class="mt-1.5 text-sm font-black break-all">-</div>',
                '          </div>',
                '          <div class="rounded-2xl border border-white/15 bg-white/10 px-3.5 py-3.5">',
                '            <div class="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">Ganti Petugas</div>',
                '            <div class="mt-2 text-sm font-semibold leading-6 text-white/85">Gunakan tombol <span class="dokter-dashboard-inline-pill">Ganti Petugas</span> di pojok kanan atas untuk mengganti nama petugas aktif.</div>',
                '          </div>',
                '        </div>',
                '      </div>',
                '    </div>',
                '  </div>',
                '  <div class="grid grid-cols-1 gap-4 md:grid-cols-2">',
                '    <button id="dokterDashMenuAssessment" type="button" class="dokter-dashboard-tile is-asses">',
                '      <div class="dokter-dashboard-icon is-asses" aria-hidden="true">',
                '        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">',
                '          <path d="M12 21s-7-4.35-7-11a4 4 0 0 1 7-2.65A4 4 0 0 1 19 10c0 6.65-7 11-7 11z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
                '          <path d="M12 8v5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
                '          <path d="M9.5 10.5h5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
                '        </svg>',
                '      </div>',
                '      <div class="dokter-dashboard-tile-content">',
                '        <div class="dokter-dashboard-tile-title">Asesmen UGD</div>',
                '        <div class="dokter-dashboard-tile-desc">Cari pasien UGD dan buka asesmen tanpa harus masuk menu rekap.</div>',
                '      </div>',
                '    </button>',
                '    <button id="dokterDashMenuRekap" type="button" class="dokter-dashboard-tile is-rekap">',
                '      <div class="dokter-dashboard-icon is-rekap" aria-hidden="true">',
                '        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">',
                '          <path d="M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" stroke="currentColor" stroke-width="2"/>',
                '          <path d="M9 7h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
                '          <path d="M9 11h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
                '          <path d="M9 15h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
                '        </svg>',
                '      </div>',
                '      <div class="dokter-dashboard-tile-content">',
                '        <div class="dokter-dashboard-tile-title">Rekap Pasien</div>',
                '        <div class="dokter-dashboard-tile-desc">Buka daftar pasien dan lihat detail kunjungan.</div>',
                '      </div>',
                '    </button>',
                '  </div>',
                '  <div id="dokterDashAssessmentModal" class="dokter-dashboard-modal hidden" aria-hidden="true">',
                '    <div class="dokter-dashboard-modal-overlay"></div>',
                '    <div class="dokter-dashboard-modal-panel" role="dialog" aria-modal="true">',
                '      <div class="dokter-dashboard-modal-head">',
                '        <div>',
                '          <div class="dokter-dashboard-modal-title">Cari Pasien UGD</div>',
                '          <div class="dokter-dashboard-modal-subtitle">Ketik No RM, No Registrasi, atau Nama pasien.</div>',
                '        </div>',
                '        <button id="dokterDashAssessmentClose" type="button" class="dokter-dashboard-modal-close">Tutup</button>',
                '      </div>',
                '      <div class="dokter-dashboard-modal-body">',
                '        <div class="dokter-dashboard-search-row">',
                '          <input id="dokterDashAssessmentQuery" type="text" class="dokter-dashboard-search-input" placeholder="Contoh: 000123 / REG-000114 / Jihan">',
                '          <button id="dokterDashAssessmentRefresh" type="button" class="dokter-dashboard-search-btn">Terbaru</button>',
                '        </div>',
                '        <div id="dokterDashAssessmentStatus" class="dokter-dashboard-search-status hidden"></div>',
                '        <div class="dokter-dashboard-results">',
                '          <div class="dokter-dashboard-results-head">Hasil</div>',
                '          <div id="dokterDashAssessmentResults" class="dokter-dashboard-results-list"></div>',
                '        </div>',
                '      </div>',
                '    </div>',
                '  </div>',
                '</div>'
            ].join('');

            els = {
                staffName: containerEl.querySelector('#dokterDashStaffName'),
                roleLabel: containerEl.querySelector('#dokterDashRoleLabel'),
                accessLabel: containerEl.querySelector('#dokterDashAccessLabel'),
                email: containerEl.querySelector('#dokterDashEmail'),
                menuAssessmentBtn: containerEl.querySelector('#dokterDashMenuAssessment'),
                menuRekapBtn: containerEl.querySelector('#dokterDashMenuRekap'),
                modal: containerEl.querySelector('#dokterDashAssessmentModal'),
                modalOverlay: containerEl.querySelector('.dokter-dashboard-modal-overlay'),
                modalCloseBtn: containerEl.querySelector('#dokterDashAssessmentClose'),
                queryInput: containerEl.querySelector('#dokterDashAssessmentQuery'),
                refreshBtn: containerEl.querySelector('#dokterDashAssessmentRefresh'),
                statusEl: containerEl.querySelector('#dokterDashAssessmentStatus'),
                resultsEl: containerEl.querySelector('#dokterDashAssessmentResults')
            };

            els.menuAssessmentBtn?.addEventListener('click', () => openAssessmentSearch());
            els.menuRekapBtn?.addEventListener('click', async () => {
                await Promise.resolve(config?.openRekap?.());
            });

            els.modalOverlay?.addEventListener('click', () => closeAssessmentSearch());
            els.modalCloseBtn?.addEventListener('click', () => closeAssessmentSearch());
            els.refreshBtn?.addEventListener('click', () => loadLatestUgdPatients());
            els.queryInput?.addEventListener('input', () => onSearchQueryChanged());
            els.queryInput?.addEventListener('keydown', (ev) => {
                if (ev.key === 'Escape') {
                    ev.preventDefault();
                    closeAssessmentSearch();
                }
            });

            mounted = true;
        }

        function setSearchStatus(message) {
            if (!els.statusEl) return;
            const text = String(message || '').trim();
            els.statusEl.textContent = text;
            els.statusEl.classList.toggle('hidden', !text);
        }

        function setResultsHtml(html) {
            if (!els.resultsEl) return;
            els.resultsEl.innerHTML = html || '';
        }

        function escapeHtml(value) {
            return String(value ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        function formatPatientRow(row) {
            return {
                id: row?.id,
                no_rm: row?.no_rm || '',
                no_registrasi: row?.no_registrasi || '',
                nama_pasien: row?.nama_pasien || '',
                jenis_kelamin: row?.jenis_kelamin || '',
                tanggal_lahir: row?.tanggal_lahir || '',
                umur: row?.umur || '',
                unit: row?.unit || '',
                no_antrian: row?.no_antrian || ''
            };
        }

        function renderResults(rows) {
            const list = Array.isArray(rows) ? rows : [];
            if (!list.length) {
                setResultsHtml('<div class="dokter-dashboard-results-empty">Tidak ada hasil.</div>');
                return;
            }

            const html = list.map((row) => {
                const payload = formatPatientRow(row);
                const subtitleParts = [
                    payload.no_registrasi ? `REG ${payload.no_registrasi}` : '',
                    payload.no_antrian ? `Antrian ${payload.no_antrian}` : '',
                    payload.umur ? `Umur ${payload.umur}` : ''
                ].filter(Boolean);
                return [
                    '<button type="button" class="dokter-dashboard-result-item" data-payload="',
                    escapeHtml(JSON.stringify(payload)),
                    '">',
                    '<div class="dokter-dashboard-result-main">',
                    '<div class="dokter-dashboard-result-title">',
                    escapeHtml(payload.nama_pasien || '-'),
                    '</div>',
                    '<div class="dokter-dashboard-result-subtitle">',
                    escapeHtml(subtitleParts.join(' • ') || '-'),
                    '</div>',
                    '</div>',
                    '<div class="dokter-dashboard-result-meta">',
                    '<div class="dokter-dashboard-result-rm">RM ',
                    escapeHtml(payload.no_rm || '-'),
                    '</div>',
                    '<div class="dokter-dashboard-result-action">Buka</div>',
                    '</div>',
                    '</button>'
                ].join('');
            }).join('');
            setResultsHtml(html);

            els.resultsEl.querySelectorAll('.dokter-dashboard-result-item').forEach((btn) => {
                btn.addEventListener('click', async () => {
                    const raw = btn.getAttribute('data-payload') || '';
                    try {
                        const payload = JSON.parse(raw);
                        closeAssessmentSearch();
                        await Promise.resolve(config?.openAssessment?.(payload));
                    } catch (_err) {
                        setSearchStatus('Gagal membuka asesmen. Payload pasien tidak valid.');
                    }
                });
            });
        }

        function openAssessmentSearch() {
            if (!config?.isDokterRole?.()) return;
            ensureMounted();
            modalState.open = true;
            els.modal?.classList.remove('hidden');
            els.modal?.setAttribute('aria-hidden', 'false');
            setSearchStatus('');
            if (els.queryInput) {
                els.queryInput.value = '';
                window.setTimeout(() => els.queryInput?.focus(), 40);
            }
            loadLatestUgdPatients();
        }

        function closeAssessmentSearch() {
            modalState.open = false;
            window.clearTimeout(modalState.debounceTimer);
            modalState.debounceTimer = null;
            els.modal?.classList.add('hidden');
            els.modal?.setAttribute('aria-hidden', 'true');
        }

        function onSearchQueryChanged() {
            const value = String(els.queryInput?.value || '').trim();
            modalState.query = value;
            window.clearTimeout(modalState.debounceTimer);
            modalState.debounceTimer = window.setTimeout(() => {
                if (!modalState.open) return;
                if (!value) {
                    loadLatestUgdPatients();
                    return;
                }
                searchPatients(value);
            }, 450);
        }

        async function loadLatestUgdPatients() {
            if (!config?.supabaseClient) {
                setSearchStatus('Supabase belum siap.');
                return;
            }
            const requestId = ++modalState.lastRequestId;
            setSearchStatus('Memuat pasien UGD terbaru...');
            try {
                const result = await config.supabaseClient
                    .from('pasien')
                    .select('id,no_rm,no_registrasi,nama_pasien,jenis_kelamin,tanggal_lahir,umur,unit,no_antrian,created_at')
                    .eq('unit', 'UGD')
                    .order('created_at', { ascending: false })
                    .limit(20);
                if (requestId !== modalState.lastRequestId) return;
                if (result?.error) throw new Error(result.error.message);
                setSearchStatus('');
                renderResults(result?.data || []);
            } catch (err) {
                if (requestId !== modalState.lastRequestId) return;
                setSearchStatus('Gagal memuat data: ' + (err?.message || String(err)));
                renderResults([]);
            }
        }

        async function searchPatients(query) {
            if (!config?.supabaseClient) {
                setSearchStatus('Supabase belum siap.');
                return;
            }
            const cleaned = String(query || '').trim().replace(/%/g, '');
            if (!cleaned) {
                loadLatestUgdPatients();
                return;
            }
            const requestId = ++modalState.lastRequestId;
            setSearchStatus('Mencari...');
            try {
                const filter = `no_rm.ilike.%${cleaned}%,no_registrasi.ilike.%${cleaned}%,nama_pasien.ilike.%${cleaned}%`;
                const result = await config.supabaseClient
                    .from('pasien')
                    .select('id,no_rm,no_registrasi,nama_pasien,jenis_kelamin,tanggal_lahir,umur,unit,no_antrian,created_at')
                    .eq('unit', 'UGD')
                    .or(filter)
                    .order('created_at', { ascending: false })
                    .limit(30);
                if (requestId !== modalState.lastRequestId) return;
                if (result?.error) throw new Error(result.error.message);
                setSearchStatus('');
                renderResults(result?.data || []);
            } catch (err) {
                if (requestId !== modalState.lastRequestId) return;
                setSearchStatus('Gagal mencari: ' + (err?.message || String(err)));
                renderResults([]);
            }
        }

        function render() {
            if (!config?.isDokterRole?.()) {
                containerEl.classList.add('hidden');
                return;
            }
            ensureMounted();
            containerEl.classList.remove('hidden');
            if (els.staffName) els.staffName.textContent = getStaffNameValue();
            if (els.roleLabel) els.roleLabel.textContent = getRoleLabelValue();
            if (els.accessLabel) els.accessLabel.textContent = getAksesValue();
            if (els.email) els.email.textContent = getEmailValue();
        }

        return {
            render
        };
    }

    window.createDokterDashboardModule = createDokterDashboardModule;
})();

