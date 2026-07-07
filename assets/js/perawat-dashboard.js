(() => {
    function createPerawatDashboardModule(config) {
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
            loading: false,
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
            return label || 'Perawat';
        }

        function getEmailValue() {
            const value = String(config?.getCurrentAdminEmail?.() || '').trim();
            return value || '-';
        }

        function getAksesValue() {
            return 'Rekap Pasien, Draft Triase, Asesmen UGD';
        }

        function ensureMounted() {
            if (mounted) return;
            containerEl.innerHTML = [
                '<div class="perawat-dashboard space-y-5">',
                '  <div class="overflow-hidden rounded-[32px] border border-white/70 bg-white/85 shadow-[0_28px_80px_-28px_rgba(15,23,42,0.28)] backdrop-blur-xl">',
                '    <div class="bg-[linear-gradient(135deg,_#0f766e_0%,_#1d4ed8_100%)] px-5 py-5 md:px-6">',
                '      <div class="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">',
                '        <div class="max-w-3xl">',
                '          <div class="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.24em] text-emerald-50">Panel Perawat</div>',
                '          <div class="mt-3 text-2xl md:text-3xl font-black tracking-tight text-white">Dashboard Perawat</div>',
                '          <div class="mt-2 text-sm md:text-base font-semibold leading-relaxed text-emerald-50/95">Akses cepat untuk triase, asesmen UGD, dan rekap pasien.</div>',
                '          <div class="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">',
                '            <div class="rounded-2xl border border-white/15 bg-white/10 px-3.5 py-3.5 text-white">',
                '              <div class="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-100">Petugas Aktif</div>',
                '              <div id="perawatDashStaffName" class="mt-1.5 text-base font-black">-</div>',
                '            </div>',
                '            <div class="rounded-2xl border border-white/15 bg-white/10 px-3.5 py-3.5 text-white">',
                '              <div class="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-100">Peran</div>',
                '              <div id="perawatDashRoleLabel" class="mt-1.5 text-base font-black">-</div>',
                '            </div>',
                '            <div class="rounded-2xl border border-white/15 bg-white/10 px-3.5 py-3.5 text-white">',
                '              <div class="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-100">Akses</div>',
                '              <div id="perawatDashAccessLabel" class="mt-1.5 text-base font-black">-</div>',
                '            </div>',
                '          </div>',
                '        </div>',
                '        <div class="min-w-full xl:min-w-[380px] space-y-2.5">',
                '          <div class="rounded-2xl border border-white/15 bg-white/10 px-3.5 py-3.5 text-white">',
                '            <div class="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-100">Email Akun</div>',
                '            <div id="perawatDashEmail" class="mt-1.5 text-sm font-black break-all">-</div>',
                '          </div>',
                '          <div class="rounded-2xl border border-white/15 bg-white/10 px-3.5 py-3.5">',
                '            <div class="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-100">Ganti Petugas</div>',
                '            <div class="mt-2 text-sm font-semibold leading-6 text-emerald-50/90">Gunakan tombol <span class="perawat-dashboard-inline-pill">Ganti Petugas</span> di pojok kanan atas untuk mengganti nama petugas aktif.</div>',
                '          </div>',
                '        </div>',
                '      </div>',
                '    </div>',
                '  </div>',
                '  <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">',
                '    <button id="perawatDashMenuRekap" type="button" class="perawat-dashboard-tile is-rekap">',
                '      <div class="perawat-dashboard-icon is-rekap" aria-hidden="true">',
                '        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">',
                '          <path d="M7 3h8l4 4v14H7V3z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
                '          <path d="M15 3v5h5" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
                '          <path d="M9 12h8M9 16h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
                '        </svg>',
                '      </div>',
                '      <div class="perawat-dashboard-tile-content">',
                '        <div class="perawat-dashboard-tile-title">Rekap Pasien</div>',
                '        <div class="perawat-dashboard-tile-desc">Lihat daftar pasien UGD dan akses Triase/Asesmen dari tabel rekap.</div>',
                '      </div>',
                '    </button>',
                '    <button id="perawatDashMenuDraftTriase" type="button" class="perawat-dashboard-tile is-draft">',
                '      <div class="perawat-dashboard-icon is-draft" aria-hidden="true">',
                '        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">',
                '          <path d="M12 6v12M6 12h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
                '          <path d="M7 3h10a2 2 0 0 1 2 2v16H5V5a2 2 0 0 1 2-2z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
                '        </svg>',
                '      </div>',
                '      <div class="perawat-dashboard-tile-content">',
                '        <div class="perawat-dashboard-tile-title">Draft Triase</div>',
                '        <div class="perawat-dashboard-tile-desc">Buat draft triase pasien sebelum ditautkan ke registrasi UGD.</div>',
                '      </div>',
                '    </button>',
                '    <button id="perawatDashMenuAssessment" type="button" class="perawat-dashboard-tile is-note is-asses">',
                '      <div class="perawat-dashboard-icon is-asses" aria-hidden="true">',
                '        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">',
                '          <path d="M12 21s-7-4.35-7-11a4 4 0 0 1 7-2.65A4 4 0 0 1 19 10c0 6.65-7 11-7 11z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
                '          <path d="M12 8v5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
                '          <path d="M9.5 10.5h5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
                '        </svg>',
                '      </div>',
                '      <div class="perawat-dashboard-tile-content">',
                '        <div class="perawat-dashboard-tile-title">Asesmen UGD</div>',
                '        <div class="perawat-dashboard-tile-desc">Cari pasien UGD dan buka asesmen tanpa harus masuk menu rekap.</div>',
                '      </div>',
                '    </button>',
                '  </div>',
                '  <div id="perawatDashAssessmentModal" class="perawat-dashboard-modal hidden" aria-hidden="true">',
                '    <div class="perawat-dashboard-modal-overlay"></div>',
                '    <div class="perawat-dashboard-modal-panel" role="dialog" aria-modal="true">',
                '      <div class="perawat-dashboard-modal-head">',
                '        <div>',
                '          <div class="perawat-dashboard-modal-title">Cari Pasien UGD</div>',
                '          <div class="perawat-dashboard-modal-subtitle">Ketik No RM, No Registrasi, atau Nama pasien.</div>',
                '        </div>',
                '        <button id="perawatDashAssessmentClose" type="button" class="perawat-dashboard-modal-close">Tutup</button>',
                '      </div>',
                '      <div class="perawat-dashboard-modal-body">',
                '        <div class="perawat-dashboard-search-row">',
                '          <input id="perawatDashAssessmentQuery" type="text" class="perawat-dashboard-search-input" placeholder="Contoh: 000123 / REG-000114 / Jihan">',
                '          <button id="perawatDashAssessmentRefresh" type="button" class="perawat-dashboard-search-btn">Terbaru</button>',
                '        </div>',
                '        <div id="perawatDashAssessmentStatus" class="perawat-dashboard-search-status hidden"></div>',
                '        <div class="perawat-dashboard-results">',
                '          <div class="perawat-dashboard-results-head">Hasil</div>',
                '          <div id="perawatDashAssessmentResults" class="perawat-dashboard-results-list"></div>',
                '        </div>',
                '      </div>',
                '    </div>',
                '  </div>',
                '</div>'
            ].join('');

            els = {
                staffName: containerEl.querySelector('#perawatDashStaffName'),
                roleLabel: containerEl.querySelector('#perawatDashRoleLabel'),
                accessLabel: containerEl.querySelector('#perawatDashAccessLabel'),
                email: containerEl.querySelector('#perawatDashEmail'),
                menuRekapBtn: containerEl.querySelector('#perawatDashMenuRekap'),
                menuDraftBtn: containerEl.querySelector('#perawatDashMenuDraftTriase'),
                menuAssessmentBtn: containerEl.querySelector('#perawatDashMenuAssessment'),
                modal: containerEl.querySelector('#perawatDashAssessmentModal'),
                modalOverlay: containerEl.querySelector('.perawat-dashboard-modal-overlay'),
                modalCloseBtn: containerEl.querySelector('#perawatDashAssessmentClose'),
                queryInput: containerEl.querySelector('#perawatDashAssessmentQuery'),
                refreshBtn: containerEl.querySelector('#perawatDashAssessmentRefresh'),
                statusEl: containerEl.querySelector('#perawatDashAssessmentStatus'),
                resultsEl: containerEl.querySelector('#perawatDashAssessmentResults')
            };

            els.menuRekapBtn?.addEventListener('click', async () => {
                await Promise.resolve(config?.openRekap?.());
            });

            els.menuDraftBtn?.addEventListener('click', async () => {
                await Promise.resolve(config?.openDraftTriase?.());
            });

            els.menuAssessmentBtn?.addEventListener('click', () => {
                openAssessmentSearch();
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

        function escapeHtml(value) {
            return String(value ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        function renderResults(rows) {
            const list = Array.isArray(rows) ? rows : [];
            if (!list.length) {
                setResultsHtml('<div class="perawat-dashboard-results-empty">Tidak ada hasil.</div>');
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
                    '<button type="button" class="perawat-dashboard-result-item" data-payload="',
                    escapeHtml(JSON.stringify(payload)),
                    '">',
                    '<div class="perawat-dashboard-result-main">',
                    '<div class="perawat-dashboard-result-title">',
                    escapeHtml(payload.nama_pasien || '-'),
                    '</div>',
                    '<div class="perawat-dashboard-result-subtitle">',
                    escapeHtml(subtitleParts.join(' • ') || '-'),
                    '</div>',
                    '</div>',
                    '<div class="perawat-dashboard-result-meta">',
                    '<div class="perawat-dashboard-result-rm">RM ',
                    escapeHtml(payload.no_rm || '-'),
                    '</div>',
                    '<div class="perawat-dashboard-result-action">Buka</div>',
                    '</div>',
                    '</button>'
                ].join('');
            }).join('');
            setResultsHtml(html);

            els.resultsEl.querySelectorAll('.perawat-dashboard-result-item').forEach((btn) => {
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
            if (!config?.isPerawatRole?.()) return;
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
            if (!config?.isPerawatRole?.()) {
                containerEl.classList.add('hidden');
                return;
            }
            containerEl.classList.remove('hidden');
            ensureMounted();

            if (els.staffName) els.staffName.textContent = getStaffNameValue();
            if (els.roleLabel) els.roleLabel.textContent = getRoleLabelValue();
            if (els.accessLabel) els.accessLabel.textContent = getAksesValue();
            if (els.email) els.email.textContent = getEmailValue();
        }

        return {
            render
        };
    }

    window.createPerawatDashboardModule = createPerawatDashboardModule;
})();
