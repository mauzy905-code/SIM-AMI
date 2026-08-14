    (() => {
        function createNurseStationDashboardModule(config) {
            const containerEl = config?.containerEl || null;
            if (!containerEl) {
                return {
                    render: () => {},
                    refresh: async () => {}
                };
            }

            const supabaseClient = config?.supabaseClient || null;
            let mounted = false;
            let els = {};
            const state = {
                activeTab: 'pending',
                loading: false,
                rows: [],
                nsColumnAvailable: null,
                batalColumnAvailable: null,
                poliServiceColumnAvailable: null,
                message: '',
                messageTone: 'info',
                activePoliCard: null,
                selectedSubmenuSchemaId: null,
                selectedSubmenuTitle: null,
                selectedPoliKeyword: null,
                selectedPoliId: null
            };
            const STORAGE_PREFIX = 'sim-ami:nurse-station:';

            function getStaffName() {
                const value = String(config?.getCurrentOperatorName?.() || '').trim();
                return value || 'Petugas Nurse Station';
            }

            function getRoleLabel() {
                const value = String(config?.getRoleLabel?.() || '').trim();
                return value || 'Nurse Station';
            }

            function getLoketLabel() {
                const value = String(config?.getLoketLabel?.() || '').trim();
                return value || 'Nurse Station';
            }

            function getEmail() {
                const value = String(config?.getCurrentAdminEmail?.() || '').trim();
                return value || '-';
            }

            function getOperatorName() {
                return getStaffName();
            }

            function getOperatorEmail() {
                const value = String(config?.getCurrentAdminEmail?.() || '').trim();
                return value || '';
            }

            function escapeHtml(value) {
                return String(value ?? '')
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#39;');
            }

            function getDayBounds() {
                const now = new Date();
                const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
                const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
                return {
                    startIso: start.toISOString(),
                    endIso: end.toISOString()
                };
            }

            function normalizeQueueNo(noAntrian) {
                const value = String(noAntrian || '').trim();
                if (!value) return '';
                if (/^B-/i.test(value)) return `P-${value.slice(2)}`;
                if (/^A-/i.test(value)) return `C-${value.slice(2)}`;
                return value;
            }

            function isPriorityQueue(noAntrian) {
                return /^(P|B)-/i.test(String(noAntrian || '').trim());
            }

            function isPriorityRow(row) {
                return isPriorityQueue(row?.no_antrian || '');
            }

            function formatTime(value) {
                const date = new Date(value);
                if (Number.isNaN(date.getTime())) return '-';
                return date.toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit'
                });
            }

            function formatPoliLabel(value) {
                return String(config?.getPoliLabel?.(value) || '').trim() || 'Belum dipilih';
            }

            function formatDateTime(value) {
                if (!value) return '';
                const date = new Date(value);
                if (Number.isNaN(date.getTime())) return '';
                return date.toLocaleString('id-ID', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            }

            function setMessage(message, tone) {
                state.message = String(message || '').trim();
                state.messageTone = tone || 'info';
            }

            function getRegistrationQueueNo(row) {
                return normalizeQueueNo(row?.no_antrian || '');
            }

            function getEffectiveQueueNo(row, nsData) {
                const stored = normalizeQueueNo(nsData?.queue_no || row?.nsData?.queue_no || '');
                return stored || getRegistrationQueueNo(row);
            }

            function normalizeNsData(raw) {
                let value = raw;
                if (!value) return null;
                if (typeof value === 'string') {
                    try {
                        value = JSON.parse(value);
                    } catch (_err) {
                        return null;
                    }
                }
                if (!value || typeof value !== 'object') return null;
                const statusRaw = String(value.status || '').trim().toLowerCase();
                const status = statusRaw === 'selesai'
                    ? 'selesai'
                    : (statusRaw === 'dipanggil' ? 'dipanggil' : 'menunggu');
                return {
                    status,
                    queue_no: normalizeQueueNo(value.queue_no || ''),
                    called_at: String(value.called_at || '').trim(),
                    called_by_name: String(value.called_by_name || '').trim(),
                    called_by_email: String(value.called_by_email || '').trim(),
                    completed_at: String(value.completed_at || '').trim(),
                    completed_by_name: String(value.completed_by_name || '').trim(),
                    completed_by_email: String(value.completed_by_email || '').trim()
                };
            }

            function getStorageKey(row) {
                const patientId = String(row?.id || '').trim();
                return patientId ? `${STORAGE_PREFIX}${patientId}` : '';
            }

            function readLocalNsData(row) {
                const key = getStorageKey(row);
                if (!key) return null;
                try {
                    return normalizeNsData(window.localStorage.getItem(key));
                } catch (_err) {
                    return null;
                }
            }

            function writeLocalNsData(row, payload) {
                const key = getStorageKey(row);
                if (!key) return;
                try {
                    window.localStorage.setItem(key, JSON.stringify(payload || {}));
                } catch (_err) {}
            }

            async function detectNsColumn() {
                if (!supabaseClient) {
                    state.nsColumnAvailable = false;
                    return false;
                }
                if (typeof state.nsColumnAvailable === 'boolean') {
                    return state.nsColumnAvailable;
                }
                try {
                    const { error } = await supabaseClient
                        .from('pasien')
                        .select('nurse_station_data')
                        .limit(1);
                    state.nsColumnAvailable = !(error && /nurse_station_data/i.test(error.message || ''));
                } catch (_err) {
                    state.nsColumnAvailable = false;
                }
                return state.nsColumnAvailable;
            }

            async function detectPoliServiceColumn() {
                if (!supabaseClient) {
                    state.poliServiceColumnAvailable = false;
                    return false;
                }
                if (typeof state.poliServiceColumnAvailable === 'boolean') {
                    return state.poliServiceColumnAvailable;
                }
                try {
                    const { error } = await supabaseClient
                        .from('pasien')
                        .select('poli_service_data')
                        .limit(1);
                    state.poliServiceColumnAvailable = !(error && /poli_service_data/i.test(error.message || ''));
                } catch (_err) {
                    state.poliServiceColumnAvailable = false;
                }
                return state.poliServiceColumnAvailable;
            }

            async function detectBatalColumn() {
                if (!supabaseClient) {
                    state.batalColumnAvailable = false;
                    return false;
                }
                if (typeof state.batalColumnAvailable === 'boolean') {
                    return state.batalColumnAvailable;
                }
                try {
                    const { error } = await supabaseClient
                        .from('pasien')
                        .select('batal_berobat_data')
                        .limit(1);
                    state.batalColumnAvailable = !(error && /batal_berobat_data/i.test(error.message || ''));
                } catch (_err) {
                    state.batalColumnAvailable = false;
                }
                return state.batalColumnAvailable;
            }

            function normalizeBatalBerobatPayload(raw) {
                let payload = raw;
                if (!payload) return null;
                if (typeof payload === 'string') {
                    try {
                        payload = JSON.parse(payload);
                    } catch (_err) {
                        return null;
                    }
                }
                if (!payload || typeof payload !== 'object') return null;
                const status = String(payload.status || '').trim().toUpperCase();
                if (status !== 'BATAL_BEROBAT') return null;
                return payload;
            }

            function isCancelledRow(row) {
                if (!row) return false;
                if (typeof window !== 'undefined' && typeof window.isBatalBerobatRecord === 'function') {
                    try {
                        return Boolean(window.isBatalBerobatRecord(row));
                    } catch (_err) {}
                }
                return Boolean(normalizeBatalBerobatPayload(row?.batal_berobat_data || null));
            }

            function mergeNsData(row) {
                const fromRow = normalizeNsData(row?.nurse_station_data || null);
                const fromLocal = readLocalNsData(row);
                return fromRow || fromLocal || {
                    status: 'menunggu',
                    queue_no: getRegistrationQueueNo(row),
                    called_at: '',
                    called_by_name: '',
                    called_by_email: '',
                    completed_at: '',
                    completed_by_name: '',
                    completed_by_email: ''
                };
            }

            function sortRows(list) {
                return list.slice().sort((left, right) => {
                    const leftPriority = isPriorityRow(left) ? 0 : 1;
                    const rightPriority = isPriorityRow(right) ? 0 : 1;
                    if (leftPriority !== rightPriority) return leftPriority - rightPriority;

                    const leftDone = left.nsData?.status === 'selesai';
                    const rightDone = right.nsData?.status === 'selesai';
                    if (leftDone !== rightDone) return leftDone ? 1 : -1;

                    const leftCalled = left.nsData?.status === 'dipanggil';
                    const rightCalled = right.nsData?.status === 'dipanggil';
                    if (leftCalled !== rightCalled) return leftCalled ? -1 : 1;

                    const leftCreated = new Date(left.created_at || 0).getTime();
                    const rightCreated = new Date(right.created_at || 0).getTime();
                    if (leftCreated !== rightCreated) return leftCreated - rightCreated;
                    return String(left.id || '').localeCompare(String(right.id || ''));
                });
            }

            function getOpenCalledRow(excludeRowId = '') {
                const excluded = String(excludeRowId || '').trim();
                return (Array.isArray(state.rows) ? state.rows : []).find((item) => {
                    const rowId = String(item?.id || '').trim();
                    if (excluded && rowId === excluded) return false;
                    return item?.nsData?.status === 'dipanggil';
                }) || null;
            }

            function ensureMounted() {
                if (mounted) return;

                containerEl.innerHTML = [
                    '<div class="nurse-station-dashboard">',
                    '  <section class="nurse-station-dashboard-hero">',
                    '    <div class="nurse-station-dashboard-hero-main">',
                    '      <div class="nurse-station-dashboard-kicker">Nurse Station</div>',
                    '      <h2 class="nurse-station-dashboard-title">Dashboard Nurse Station</h2>',
                    '      <p class="nurse-station-dashboard-desc">SIM-AMI</p>',
                    '      <div class="nurse-station-dashboard-cards">',
                    '        <div class="nurse-station-dashboard-stat-card"><div class="nurse-station-dashboard-stat-label">Petugas Aktif</div><div id="nurseDashStaffName" class="nurse-station-dashboard-stat-value">-</div></div>',
                    '        <div class="nurse-station-dashboard-stat-card"><div class="nurse-station-dashboard-stat-label">Peran</div><div id="nurseDashRoleLabel" class="nurse-station-dashboard-stat-value">-</div></div>',
                    '        <div class="nurse-station-dashboard-stat-card"><div class="nurse-station-dashboard-stat-label">Loket</div><div id="nurseDashLoketLabel" class="nurse-station-dashboard-stat-value">-</div></div>',
                    '      </div>',
                    '    </div>',
                    '    <div class="nurse-station-dashboard-hero-side">',
                    '      <div class="nurse-station-dashboard-side-card"><div class="nurse-station-dashboard-stat-label">Email Akun</div><div id="nurseDashEmail" class="nurse-station-dashboard-side-value">-</div></div>',
                    '    </div>',
                    '  </section>',
                    '  <section class="nurse-station-dashboard-summary">',
                    '    <div class="nurse-station-dashboard-summary-card"><div class="nurse-station-dashboard-summary-label">Pasien Poli Hari Ini</div><div id="nurseDashTotalCount" class="nurse-station-dashboard-summary-value">0</div></div>',
                    '    <div class="nurse-station-dashboard-summary-card"><div class="nurse-station-dashboard-summary-label">Prioritas Terbaca</div><div id="nurseDashPriorityCount" class="nurse-station-dashboard-summary-value">0</div></div>',
                    '    <div class="nurse-station-dashboard-summary-card"><div class="nurse-station-dashboard-summary-label">Poli Tujuan Aktif</div><div id="nurseDashPoliCount" class="nurse-station-dashboard-summary-value">0</div></div>',
                    '  </section>',
                    '  <section class="nurse-station-dashboard-panel">',
                    '    <div class="nurse-station-dashboard-poli-grid">',
                    '      <div class="nurse-station-dashboard-poli-card is-expanded-dewasa" id="nurseDashPoliCardPenyakitDalam" data-poli-id="penyakit_dalam">',
                    '        <button type="button" class="nurse-station-dashboard-poli-card-header" data-action="toggle-poli" data-poli-id="penyakit_dalam">',
                    '          <span class="nurse-station-dashboard-poli-icon">🫀</span>',
                    '          <span class="nurse-station-dashboard-poli-title-wrap">',
                    '            <span class="nurse-station-dashboard-poli-title">Poliklinik Penyakit Dalam</span>',
                    '            <span class="nurse-station-dashboard-poli-subtitle">Poli Umum — Dewasa > 18 Tahun</span>',
                    '          </span>',
                    '          <span class="nurse-station-dashboard-poli-toggle" id="nurseDashPoliTogglePenyakitDalam">▼</span>',
                    '        </button>',
                    '        <div class="nurse-station-dashboard-poli-expand" id="nurseDashPoliExpandPenyakitDalam">',
                    '        </div>',
                    '      </div>',
                    '      <div class="nurse-station-dashboard-poli-card is-expanded-pediatrik is-disabled" id="nurseDashPoliCardAnak" data-poli-id="anak">',
                    '        <button type="button" class="nurse-station-dashboard-poli-card-header" data-action="toggle-poli" data-poli-id="anak">',
                    '          <span class="nurse-station-dashboard-poli-icon">🧸</span>',
                    '          <span class="nurse-station-dashboard-poli-title-wrap">',
                    '            <span class="nurse-station-dashboard-poli-title">Poliklinik Anak</span>',
                    '            <span class="nurse-station-dashboard-poli-subtitle">Pediatrik — Bayi, Balita & Anak < 18 Tahun</span>',
                    '          </span>',
                    '          <span class="nurse-station-dashboard-poli-badge-soon">Segera Hadir</span>',
                    '        </button>',
                    '        <div class="nurse-station-dashboard-poli-expand" id="nurseDashPoliExpandAnak">',
                    '          <div class="nurse-station-dashboard-soon-card">',
                    '            <span class="nurse-station-dashboard-soon-icon">🚧</span>',
                    '            <span class="nurse-station-dashboard-soon-text">Formulir asesmen Poli Anak (Pediatrik) sedang disiapkan tim SIM-AMI dan akan segera aktif pada tahap berikutnya.</span>',
                    '          </div>',
                    '        </div>',
                    '      </div>',
                    '    </div>',
                    '    <div id="nurseDashFilterBar" class="nurse-station-dashboard-filter-bar hidden">',
                    '      <div class="nurse-station-dashboard-filter-info">',
                    '        <span class="nurse-station-dashboard-filter-label">Filter Aktif</span>',
                    '        <span class="nurse-station-dashboard-filter-pill" id="nurseDashFilterPoliPill">Poli: Penyakit Dalam</span>',
                    '        <span class="nurse-station-dashboard-filter-divider">•</span>',
                    '        <span class="nurse-station-dashboard-filter-pill is-formulir" id="nurseDashFilterFormulirPill">Formulir: -</span>',
                    '      </div>',
                    '      <div class="nurse-station-dashboard-filter-actions">',
                    '        <button type="button" class="nurse-station-dashboard-filter-btn-reset" id="nurseDashFilterResetBtn">✖ Reset Filter</button>',
                    '      </div>',
                    '    </div>',
                    '    <div class="nurse-station-dashboard-toolbar">',
                    '      <div>',
                    '        <div class="nurse-station-dashboard-panel-title">Worklist Nurse Station</div>',
                    '        <div id="nurseDashMeta" class="nurse-station-dashboard-panel-meta">Memuat data...</div>',
                    '      </div>',
                    '      <div class="nurse-station-dashboard-actions">',
                    '        <button id="nurseDashOpenRekapBtn" type="button" class="nurse-station-dashboard-btn nurse-station-dashboard-btn-secondary">Daftar Pasien Hari Ini</button>',
                    '        <button id="nurseDashRefreshBtn" type="button" class="nurse-station-dashboard-btn nurse-station-dashboard-btn-primary">Refresh</button>',
                    '      </div>',
                    '    </div>',
                    '    <div class="nurse-station-dashboard-tabs">',
                    '      <button id="nurseDashTabPending" type="button" class="nurse-station-dashboard-tab is-active">Menunggu</button>',
                    '      <button id="nurseDashTabDone" type="button" class="nurse-station-dashboard-tab">Selesai</button>',
                    '    </div>',
                    '    <div id="nurseDashMessage" class="nurse-station-dashboard-message hidden"></div>',
                    '    <div id="nurseDashList" class="nurse-station-dashboard-list"></div>',
                    '  </section>',
                    '</div>'
                ].join('');

                els = {
                    staffName: containerEl.querySelector('#nurseDashStaffName'),
                    roleLabel: containerEl.querySelector('#nurseDashRoleLabel'),
                    loketLabel: containerEl.querySelector('#nurseDashLoketLabel'),
                    email: containerEl.querySelector('#nurseDashEmail'),
                    totalCount: containerEl.querySelector('#nurseDashTotalCount'),
                    priorityCount: containerEl.querySelector('#nurseDashPriorityCount'),
                    poliCount: containerEl.querySelector('#nurseDashPoliCount'),
                    meta: containerEl.querySelector('#nurseDashMeta'),
                    tabPending: containerEl.querySelector('#nurseDashTabPending'),
                    tabDone: containerEl.querySelector('#nurseDashTabDone'),
                    message: containerEl.querySelector('#nurseDashMessage'),
                    list: containerEl.querySelector('#nurseDashList'),
                    openRekapBtn: containerEl.querySelector('#nurseDashOpenRekapBtn'),
                    refreshBtn: containerEl.querySelector('#nurseDashRefreshBtn'),
                    poliCardPenyakitDalam: containerEl.querySelector('#nurseDashPoliCardPenyakitDalam'),
                    poliCardAnak: containerEl.querySelector('#nurseDashPoliCardAnak'),
                    poliExpandPenyakitDalam: containerEl.querySelector('#nurseDashPoliExpandPenyakitDalam'),
                    poliExpandAnak: containerEl.querySelector('#nurseDashPoliExpandAnak'),
                    poliTogglePenyakitDalam: containerEl.querySelector('#nurseDashPoliTogglePenyakitDalam'),
                    filterBar: containerEl.querySelector('#nurseDashFilterBar'),
                    filterPoliPill: containerEl.querySelector('#nurseDashFilterPoliPill'),
                    filterFormulirPill: containerEl.querySelector('#nurseDashFilterFormulirPill'),
                    filterResetBtn: containerEl.querySelector('#nurseDashFilterResetBtn')
                };

                els.openRekapBtn?.addEventListener('click', async () => {
                    await Promise.resolve(config?.openRekapToday?.());
                });
                els.refreshBtn?.addEventListener('click', async () => {
                    await loadRows();
                });
                els.filterResetBtn?.addEventListener('click', () => {
                    state.activePoliCard = null;
                    state.selectedSubmenuSchemaId = null;
                    state.selectedSubmenuTitle = null;
                    state.selectedPoliKeyword = null;
                    state.selectedPoliId = null;
                    refreshPoliMenuVisual();
                    renderFilterBar();
                    renderList();
                });
                // Delegated click untuk toggle kartu poli & submenu item
                containerEl.addEventListener('click', async (event) => {
                    const toggleBtn = event.target.closest('[data-action="toggle-poli"]');
                    if (toggleBtn && !toggleBtn.closest('.is-disabled')) {
                        const poliId = String(toggleBtn.getAttribute('data-poli-id') || '').trim();
                        if (poliId) {
                            togglePoliCard(poliId);
                        }
                        return;
                    }
                    const resetBtn = event.target.closest('[data-action="reset-filter"]');
                    if (resetBtn) {
                        state.activePoliCard = null;
                        state.selectedSubmenuSchemaId = null;
                        state.selectedSubmenuTitle = null;
                        state.selectedPoliKeyword = null;
                        state.selectedPoliId = null;
                        refreshPoliMenuVisual();
                        renderFilterBar();
                        renderList();
                        return;
                    }
                    const submenuBtn = event.target.closest('[data-poli-menu-item="1"]');
                    if (submenuBtn) {
                        const itemType = String(submenuBtn.getAttribute('data-item-type') || '').trim();
                        if (itemType === 'assessment') {
                            const schemaId = String(submenuBtn.getAttribute('data-schema-id') || '').trim();
                            const poliId = String(submenuBtn.getAttribute('data-poli-id') || '').trim();
                            const poliKeyword = String(submenuBtn.getAttribute('data-poli-keyword') || '').trim();
                            const label = String(submenuBtn.getAttribute('data-label') || '').trim();
                            if (schemaId) {
                                state.activePoliCard = poliId || state.activePoliCard;
                                state.selectedSubmenuSchemaId = schemaId;
                                state.selectedSubmenuTitle = label;
                                state.selectedPoliId = poliId;
                                state.selectedPoliKeyword = poliKeyword;
                                refreshPoliMenuVisual();
                                renderFilterBar();
                                const activeCalledRow = getOpenCalledRow();
                                if (activeCalledRow && matchRowPoliKeyword(activeCalledRow, poliKeyword || (poliId === 'anak' ? 'anak' : (poliId === 'penyakit_dalam' ? 'penyakit dalam' : '')))) {
                                    const queueNo = getEffectiveQueueNo(activeCalledRow, activeCalledRow.nsData) || '-';
                                    const nama = String(activeCalledRow?.nama_pasien || 'Pasien').trim();
                                    const confirmNow = window.confirm(
                                        'Ada pasien yang SEDANG DIPANGGIL di Nurse Station:' +
                                        '\n  • Nomor Antrian: ' + queueNo +
                                        '\n  • Nama: ' + nama +
                                        '\n  • Formulir: ' + (label || schemaId) +
                                        '\n\nLangsung buka formulir untuk pasien ini sekarang?' +
                                        '\n\n[OK] = Buka formulir asesmen' +
                                        '\n[Cancel] = Tampilkan worklist terfilter poli & formulir'
                                    );
                                    if (confirmNow === true) {
                                        const schema = getSchemaById(schemaId);
                                        const schemaFinal = schema || { id: schemaId };
                                        const patientPayload = {
                                            id: activeCalledRow.id,
                                            nama_pasien: activeCalledRow.nama_pasien,
                                            tanggal_lahir: activeCalledRow.tanggal_lahir,
                                            jenis_kelamin: activeCalledRow.jenis_kelamin,
                                            no_rm: activeCalledRow.no_rm,
                                            no_registrasi: activeCalledRow.no_registrasi,
                                            unit: activeCalledRow.unit,
                                            no_antrian: activeCalledRow.no_antrian,
                                            poli_tujuan: activeCalledRow.poli_tujuan,
                                            umur: activeCalledRow.umur,
                                            alamat: activeCalledRow.alamat,
                                            no_telepon: activeCalledRow.no_telepon,
                                            schemaId: schemaId
                                        };
                                        if (typeof config?.handleAssessmentButtonClick === 'function') {
                                            await Promise.resolve(config.handleAssessmentButtonClick(submenuBtn, patientPayload, schemaId));
                                        } else {
                                            await Promise.resolve(config?.openAssessmentShared?.(patientPayload, schemaFinal));
                                        }
                                        renderList();
                                        if (els.list) { els.list.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
                                        return;
                                    }
                                }
                                renderList();
                                if (els.list) { els.list.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
                                return;
                            }
                        }
                        if (itemType === 'action_placeholder' || itemType === 'coming_soon') {
                            alert('Fitur ini sedang dalam persiapan & akan segera aktif. \n\nFitur selanjutnya: Pengajuan Laboratorium • Pengajuan Radiologi • Asesmen Poli Anak');
                            return;
                        }
                    }
                });
                els.tabPending?.addEventListener('click', () => {
                    state.activeTab = 'pending';
                    refreshTabVisual();
                    renderList();
                    renderSummary();
                });
                els.tabDone?.addEventListener('click', () => {
                    state.activeTab = 'done';
                    refreshTabVisual();
                    renderList();
                    renderSummary();
                });
                els.list?.addEventListener('click', async (event) => {
                    const assessmentBtn = event.target.closest('.assessment-shared-btn');
                    if (assessmentBtn) {
                        const rowId = String(assessmentBtn.getAttribute('data-row-id') || '').trim();
                        let schemaId = String(assessmentBtn.getAttribute('data-assessment-schema') || assessmentBtn.getAttribute('data-schema-id') || '').trim();
                        let patientPayload = null;
                        const patientRaw = assessmentBtn.getAttribute('data-patient');
                        if (patientRaw) {
                            try { patientPayload = JSON.parse(patientRaw); } catch (_e) { patientPayload = null; }
                        }
                        if (!schemaId && patientPayload?.schemaId) {
                            schemaId = String(patientPayload.schemaId || '').trim();
                        }
                        let target = state.rows.find((item) => String(item.id || '') === rowId) || null;
                        if (!target && patientPayload) {
                            target = patientPayload;
                        }
                        if (target && schemaId) {
                            if (typeof config?.handleAssessmentButtonClick === 'function') {
                                await Promise.resolve(config.handleAssessmentButtonClick(assessmentBtn, target, schemaId));
                            } else {
                                await Promise.resolve(config?.openAssessmentShared?.(target, schemaId));
                            }
                        }
                        return;
                    }
                    const callBtn = event.target.closest('[data-action="call"]');
                    if (callBtn) {
                        const rowId = String(callBtn.getAttribute('data-row-id') || '');
                        const target = state.rows.find((item) => String(item.id || '') === rowId);
                        if (target) {
                            await markAsCalled(target);
                        }
                        return;
                    }
                    const doneBtn = event.target.closest('[data-action="done"]');
                    if (doneBtn) {
                        const rowId = String(doneBtn.getAttribute('data-row-id') || '');
                        const target = state.rows.find((item) => String(item.id || '') === rowId);
                        if (target) {
                            await markAsDone(target);
                        }
                        return;
                    }
                    const historyBtn = event.target.closest('[data-action="history"]');
                    if (historyBtn) {
                        const rowId = String(historyBtn.getAttribute('data-row-id') || '');
                        const target = state.rows.find((item) => String(item.id || '') === rowId);
                        if (target) {
                            await Promise.resolve(config?.openHistory?.(target));
                        }
                    }
                });

                mounted = true;
            }

            function getPoliMenuConfig() {
                const registry = (window.SIMAMI_POLI_MENU && typeof window.SIMAMI_POLI_MENU === 'object') ? window.SIMAMI_POLI_MENU : null;
                const fallbackPenyakitDalam = {
                    id: 'penyakit_dalam',
                    title: 'Poliklinik Penyakit Dalam',
                    tone: 'dewasa',
                    categories: [
                        {
                            id: 'asesmen_medis',
                            title: '📑 Asesmen Medis',
                            hint: 'Formulir standar poli dewasa',
                            items: [
                                { type: 'assessment', schemaId: 'rawat_jalan_pd', icon: '📋' },
                                { type: 'assessment', schemaId: 'asesmen_awal_medis_pd', icon: '🩺' },
                                { type: 'assessment', schemaId: 'cppti_pd', icon: '📝' }
                            ]
                        },
                        {
                            id: 'permintaan_penunjang',
                            title: '🧪 Permintaan Penunjang',
                            hint: 'Akan segera hadir',
                            items: [
                                { type: 'action_placeholder', id: 'lab', label: 'Pengajuan Laboratorium', icon: '🧪', status: 'soon' },
                                { type: 'action_placeholder', id: 'radio', label: 'Pengajuan Radiologi', icon: '🩻', status: 'soon' }
                            ]
                        }
                    ]
                };
                return {
                    penyakit_dalam: (registry && registry.PENYAKIT_DALAM) ? registry.PENYAKIT_DALAM : fallbackPenyakitDalam,
                    anak: (registry && registry.ANAK) ? registry.ANAK : { id: 'anak', title: 'Poliklinik Anak', tone: 'pediatrik', active: false, comingSoon: true, categories: [] }
                };
            }

            function getSchemaById(schemaId) {
                if (!schemaId) return null;
                if (window.SIMAMI_ASSESSMENT_SCHEMAS && typeof window.SIMAMI_ASSESSMENT_SCHEMAS.getById === 'function') {
                    const s = window.SIMAMI_ASSESSMENT_SCHEMAS.getById(schemaId);
                    if (s) return s;
                }
                if (window.SIMAMI_ASSESSMENT_SCHEMAS && Array.isArray(window.SIMAMI_ASSESSMENT_SCHEMAS.listAll)) {
                    return window.SIMAMI_ASSESSMENT_SCHEMAS.listAll().find(function (s) { return String(s && s.id) === String(schemaId); }) || null;
                }
                return null;
            }

            function togglePoliCard(poliId) {
                if (!poliId) return;
                if (poliId === 'anak') {
                    // Poli anak placeholder disabled (boleh expand tapi isinya teks soon)
                    if (state.activePoliCard === 'anak') {
                        state.activePoliCard = null;
                    } else {
                        state.activePoliCard = 'anak';
                    }
                    refreshPoliMenuVisual();
                    return;
                }
                if (state.activePoliCard === poliId) {
                    state.activePoliCard = null;
                } else {
                    state.activePoliCard = poliId;
                }
                refreshPoliMenuVisual();
            }

            function refreshPoliMenuVisual() {
                const cardPd = els.poliCardPenyakitDalam;
                const cardAnak = els.poliCardAnak;
                const expandPd = els.poliExpandPenyakitDalam;
                const expandAnak = els.poliExpandAnak;
                const togglePd = els.poliTogglePenyakitDalam;

                const activePd = state.activePoliCard === 'penyakit_dalam';
                const activeAnak = state.activePoliCard === 'anak';

                if (cardPd) {
                    cardPd.classList.toggle('is-expanded', activePd);
                    cardPd.classList.toggle('is-collapsed', !activePd && state.activePoliCard !== null);
                }
                if (cardAnak) {
                    cardAnak.classList.toggle('is-expanded', activeAnak);
                    cardAnak.classList.toggle('is-collapsed', !activeAnak && state.activePoliCard !== null);
                }
                if (expandPd) {
                    if (activePd) {
                        expandPd.style.display = 'block';
                        if (window.getComputedStyle(expandPd).maxHeight === '0px' || !expandPd.style.maxHeight) {
                            requestAnimationFrame(function () {
                                expandPd.style.maxHeight = expandPd.scrollHeight + 'px';
                                expandPd.style.opacity = '1';
                            });
                        }
                    } else {
                        expandPd.style.maxHeight = '0px';
                        expandPd.style.opacity = '0';
                        setTimeout(function () { if (!state.activePoliCard) { expandPd.style.display = 'none'; } }, 120);
                    }
                }
                if (expandAnak) {
                    expandAnak.style.display = activeAnak ? 'block' : 'none';
                }
                if (togglePd) {
                    togglePd.textContent = activePd ? '▲' : '▼';
                }
            }

            function renderPoliExpandMenus() {
                const menuCfg = getPoliMenuConfig();
                const expandPd = els.poliExpandPenyakitDalam;
                if (expandPd) {
                    const cfg = menuCfg.penyakit_dalam;
                    const html = renderCategoriesHtml(cfg, 'penyakit_dalam');
                    expandPd.innerHTML = html;
                }
                refreshPoliMenuVisual();
            }

            function renderCategoriesHtml(poliCfg, poliId) {
                const categories = Array.isArray(poliCfg.categories) ? poliCfg.categories : [];
                const poliKeyword = poliId === 'penyakit_dalam' ? 'penyakit dalam' : (poliId === 'anak' ? 'anak' : '');
                return categories.map(function (cat) {
                    const itemsHtml = (Array.isArray(cat.items) ? cat.items : []).map(function (item) {
                        return renderMenuItemHtml(item, poliId, poliKeyword);
                    }).join('');
                    return [
                        '<div class="nurse-station-dashboard-poli-cat">',
                        `  <div class="nurse-station-dashboard-poli-cat-head"><span class="nurse-station-dashboard-poli-cat-title">${escapeHtml(String(cat.title || ''))}</span>${cat.hint ? `<span class="nurse-station-dashboard-poli-cat-hint">${escapeHtml(String(cat.hint))}</span>` : ''}</div>`,
                        `  <div class="nurse-station-dashboard-poli-cat-items">${itemsHtml || '<div class="nurse-station-dashboard-poli-emptycat">Tidak ada item tersedia</div>'}</div>`,
                        '</div>'
                    ].join('');
                }).join('');
            }

            function renderMenuItemHtml(item, poliId, poliKeyword) {
                if (!item) return '';
                const itemType = String(item.type || '').trim();
                if (itemType === 'coming_soon' || (item.status && /soon|preview/i.test(String(item.status)))) {
                    const label = String(item.label || 'Fitur Segera Hadir').trim();
                    const icon = String(item.icon || '⏳').trim();
                    return [
                        `<button type="button" class="nurse-station-dashboard-poli-item is-soon" data-poli-menu-item="1" data-item-type="coming_soon" data-poli-id="${escapeHtml(poliId)}" disabled>`,
                        `  <span class="nurse-station-dashboard-poli-item-icon">${icon}</span>`,
                        `  <span class="nurse-station-dashboard-poli-item-body">`,
                        `    <span class="nurse-station-dashboard-poli-item-label">${escapeHtml(label)}</span>`,
                        `    <span class="nurse-station-dashboard-poli-item-desc badge-soon">Segera hadir • Tahap berikutnya</span>`,
                        `  </span>`,
                        `  <span class="nurse-station-dashboard-poli-item-arrow">🔒</span>`,
                        `</button>`
                    ].join('');
                }
                if (itemType === 'action_placeholder') {
                    const label = String(item.label || 'Fitur Persiapan').trim();
                    const icon = String(item.icon || '🧪').trim();
                    return [
                        `<button type="button" class="nurse-station-dashboard-poli-item is-placeholder" data-poli-menu-item="1" data-item-type="action_placeholder" data-poli-id="${escapeHtml(poliId)}">`,
                        `  <span class="nurse-station-dashboard-poli-item-icon">${icon}</span>`,
                        `  <span class="nurse-station-dashboard-poli-item-body">`,
                        `    <span class="nurse-station-dashboard-poli-item-label">${escapeHtml(label)}</span>`,
                        `    <span class="nurse-station-dashboard-poli-item-desc badge-soon">Dalam persiapan • Pengajuan cetak permintaan via SIM-AMI</span>`,
                        `  </span>`,
                        `  <span class="nurse-station-dashboard-poli-item-arrow badge-soon">COMING SOON</span>`,
                        `</button>`
                    ].join('');
                }
                if (itemType === 'assessment') {
                    const schemaId = String(item.schemaId || '').trim();
                    const schema = getSchemaById(schemaId);
                    const icon = String(item.icon || (schema && schema.id === 'cppti_pd' ? '📝' : (schema && /medis/i.test(schema.label || '') ? '🩺' : '📋'))).trim();
                    const label = schema ? (schema.menuLabel || schema.label || schema.title || schema.id) : schemaId;
                    const shortLabel = schema && schema.menuShortLabel ? schema.menuShortLabel : '';
                    const desc = schema ? (schema.subtitle || 'Formulir asesmen untuk pasien poli ' + poliKeyword) : 'Klik untuk mulai isi formulir pada pasien worklist di bawah';
                    const keywordPoli = schema && schema.targetPoliKeyword ? schema.targetPoliKeyword : poliKeyword;
                    const isSelected = String(state.selectedSubmenuSchemaId) === schemaId;
                    return [
                        `<button type="button" class="nurse-station-dashboard-poli-item is-assessment ${isSelected ? 'is-selected' : ''}" data-poli-menu-item="1" data-item-type="assessment" data-schema-id="${escapeHtml(schemaId)}" data-poli-id="${escapeHtml(poliId)}" data-poli-keyword="${escapeHtml(keywordPoli)}" data-label="${escapeHtml(label)}">`,
                        `  <span class="nurse-station-dashboard-poli-item-icon">${icon}</span>`,
                        `  <span class="nurse-station-dashboard-poli-item-body">`,
                        `    <span class="nurse-station-dashboard-poli-item-label">${escapeHtml(label)}${shortLabel ? ` <span class="nurse-station-dashboard-poli-item-short">(${escapeHtml(shortLabel)})</span>` : ''}</span>`,
                        `    <span class="nurse-station-dashboard-poli-item-desc">${escapeHtml(desc)}</span>`,
                        `  </span>`,
                        `  <span class="nurse-station-dashboard-poli-item-arrow">${isSelected ? '✔️ Terpilih' : '▶ Pilih'}</span>`,
                        `</button>`
                    ].join('');
                }
                return '';
            }

            function renderFilterBar() {
                if (!els.filterBar) return;
                const active = !!(state.selectedSubmenuSchemaId || state.selectedPoliId);
                els.filterBar.classList.toggle('hidden', !active);
                if (!active) return;
                const poliPill = els.filterPoliPill;
                const formPill = els.filterFormulirPill;
                const poliName = ({
                    penyakit_dalam: 'Poli: Penyakit Dalam',
                    anak: 'Poli: Anak / Pediatrik'
                })[String(state.selectedPoliId || '')] || 'Filter';
                const formulirName = state.selectedSubmenuTitle
                    ? state.selectedSubmenuTitle
                    : (state.selectedSubmenuSchemaId ? (getSchemaById(state.selectedSubmenuSchemaId) || {}).label || 'Formulir' : '-');
                if (poliPill) poliPill.textContent = poliName;
                if (formPill) formPill.textContent = 'Formulir: ' + (formulirName || '-');
            }

            function matchRowPoliKeyword(row, kw) {
                if (!row || !String(kw || '').trim()) return true;
                const keyword = String(kw).toLowerCase().trim();
                const checks = [];
                checks.push(String(row?.poli_tujuan || '').toLowerCase());
                checks.push(String(row?.poli || '').toLowerCase());
                checks.push(String(row?.poli_nama || '').toLowerCase());
                checks.push(String(row?.poli_tujuan_nama || '').toLowerCase());
                checks.push(formatPoliLabel(row?.poli_tujuan || row?.poli || row?.poli_tujuan_id || row?.poli_id || '').toLowerCase());
                return checks.some(function (text) { return text && text.includes(keyword); });
            }

            function hasAnyPoliInfoInRows(rows) {
                const any = (Array.isArray(rows) ? rows : []).some(function (r) {
                    const poliTextRaw = String(r?.poli_tujuan || r?.poli || r?.poli_nama || r?.poli_tujuan_nama || '').trim();
                    if (poliTextRaw) return true;
                    const poliLabelFormatted = String(formatPoliLabel(r?.poli_tujuan || r?.poli_id || r?.poli_tujuan_id || '') || '').trim();
                    return poliLabelFormatted && poliLabelFormatted !== '-' && poliLabelFormatted !== 'Belum dipilih';
                });
                return any;
            }

            function getFilteredRows(applyTabFilter) {
                const rows = Array.isArray(state.rows) ? state.rows : [];
                let out = rows;
                const poliKeyword = String(state.selectedPoliKeyword || '').trim();
                const poliId = String(state.selectedPoliId || '').trim();
                let activeKeyword = '';
                if (poliKeyword) {
                    activeKeyword = poliKeyword.toLowerCase().trim();
                } else if (poliId) {
                    activeKeyword = ({ penyakit_dalam: 'penyakit dalam', anak: 'anak' })[poliId] || '';
                }
                if (activeKeyword) {
                    const punyaInfoPoli = hasAnyPoliInfoInRows(rows);
                    if (punyaInfoPoli) {
                        out = out.filter(function (r) { return matchRowPoliKeyword(r, activeKeyword); });
                    }
                }
                if (applyTabFilter !== false) {
                    out = state.activeTab === 'done'
                        ? out.filter(function (r) { return r && r.nsData && r.nsData.status === 'selesai'; })
                        : out.filter(function (r) { return !(r && r.nsData && r.nsData.status === 'selesai'); });
                }
                return out;
            }

            function renderMessage() {
                if (!els.message) return;
                const text = String(state.message || '').trim();
                els.message.textContent = text;
                els.message.classList.toggle('hidden', !text);
                els.message.classList.toggle('is-success', state.messageTone === 'success');
                els.message.classList.toggle('is-error', state.messageTone === 'error');
            }

            function renderSummary() {
                const rowsAll = Array.isArray(state.rows) ? state.rows : [];
                const rowsVisible = getFilteredRows(false);
                const poliSet = new Set();
                let priorityCount = 0;
                let pendingCount = 0;
                let doneCount = 0;

                rowsVisible.forEach((row) => {
                    if (isPriorityQueue(row?.no_antrian)) {
                        priorityCount += 1;
                    }
                    if (row.nsData?.status === 'selesai') {
                        doneCount += 1;
                    } else {
                        pendingCount += 1;
                    }
                    const poli = String(row?.poli_tujuan || '').trim();
                    if (poli) poliSet.add(poli);
                });

                if (els.totalCount) els.totalCount.textContent = String(rowsAll.length);
                if (els.priorityCount) els.priorityCount.textContent = String(priorityCount);
                if (els.poliCount) els.poliCount.textContent = String(poliSet.size);
                if (els.meta) {
                    const filterInfo = state.selectedPoliKeyword || state.selectedPoliId
                        ? ` • Filter Poli: ${state.selectedSubmenuTitle ? '✔ ' + state.selectedSubmenuTitle : state.selectedPoliId}`
                        : '';
                    els.meta.textContent = state.loading
                        ? 'Memuat data pasien poliklinik hari ini...'
                        : `Menunggu ${pendingCount} • Selesai ${doneCount} • Total ${rowsVisible.length}${filterInfo}`;
                }
            }

            function renderList() {
                if (!els.list) return;
                renderPoliExpandMenus();
                const activeCalledRow = getOpenCalledRow();
                const tabRows = getFilteredRows(true);

                if (!tabRows.length) {
                    const filterActive = state.selectedPoliId || state.selectedPoliKeyword;
                    if (filterActive) {
                        const poliLabel = state.selectedPoliId === 'anak' ? 'Anak / Pediatrik' : 'Penyakit Dalam';
                        const formulirLabel = state.selectedSubmenuTitle || (state.selectedSubmenuSchemaId ? (getSchemaById(state.selectedSubmenuSchemaId) || {}).label || '' : '');
                        const allInPoliNoTab = (function () {
                            const oldPoliId = state.selectedPoliId, oldKw = state.selectedPoliKeyword, oldSchema = state.selectedSubmenuSchemaId, oldTitle = state.selectedSubmenuTitle;
                            state.selectedSubmenuSchemaId = null;
                            state.selectedSubmenuTitle = null;
                            const res = getFilteredRows(false);
                            state.selectedPoliId = oldPoliId;
                            state.selectedPoliKeyword = oldKw;
                            state.selectedSubmenuSchemaId = oldSchema;
                            state.selectedSubmenuTitle = oldTitle;
                            return res;
                        })();
                        const totalPoliAll = allInPoliNoTab.length;
                        const poliPending = allInPoliNoTab.filter(function (r) { return !(r && r.nsData && r.nsData.status === 'selesai'); }).length;
                        const poliDone = totalPoliAll - poliPending;
                        els.list.innerHTML = `
    <div class="nurse-station-dashboard-empty is-filtered" style="text-align:left;padding:18px 20px;">
    <div style="font-size:14px;font-weight:700;margin-bottom:6px;">🔎 Filter Aktif — Tidak ada pasien yang cocok.</div>
    <div style="font-size:13px;color:#334155;line-height:1.6;margin-bottom:8px;">
        Poli Tujuan : <b>${escapeHtml(poliLabel)}</b>${formulirLabel ? ` • Formulir : <b>${escapeHtml(formulirLabel)}</b>` : ''}
        <br>
        Total pasien di poli ini hari ini: <b>${totalPoliAll}</b> orang — Menunggu: <b>${poliPending}</b> • Selesai: <b>${poliDone}</b>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;">
        <button type="button" class="nurse-station-dashboard-filter-btn-reset" data-action="reset-filter" style="border-radius:10px;padding:8px 12px;border:1px solid #cbd5e1;background:#fff;font-weight:600;cursor:pointer;">✖ Hapus Filter — Tampilkan Semua Pasien</button>
        <button type="button" data-action="toggle-poli" data-poli-id="${escapeHtml(state.activePoliCard || state.selectedPoliId || '')}" style="border-radius:10px;padding:8px 12px;border:1px solid #dbeafe;background:#eff6ff;color:#1d4ed8;font-weight:600;cursor:pointer;">📋 Pilih Formulir Lain di Menu Poli</button>
    </div>
    <div style="font-size:12px;color:#64748b;margin-top:10px;line-height:1.55;">
        💡 <b>Alur yang benar menurut alur RSUD:</b><br>
        1. Lihat <b>Worklist</b> di bawah (klik tombol <i>Hapus Filter</i>)<br>
        2. Klik tombol <b>PANGGIL</b> pada kartu pasien yang akan diperiksa<br>
        3. Pada kartu pasien yang sama, klik tombol berwarna <b>📋 Asesmen Rawat Jalan</b> / <b>🩺 Awal Medis</b> / <b>📝 CPPT</b> untuk mulai isi data.
    </div>
    </div>`;
                    } else {
                        els.list.innerHTML = state.activeTab === 'done'
                            ? '<div class="nurse-station-dashboard-empty">Belum ada pasien yang selesai asesmen Nurse Station hari ini.</div>'
                            : '<div class="nurse-station-dashboard-empty">Tidak ada pasien menunggu Nurse Station hari ini.</div>';
                    }
                    return;
                }

                els.list.innerHTML = tabRows.map((row) => {
                    const noAntrian = getRegistrationQueueNo(row) || '-';
                    const nsQueueNo = getEffectiveQueueNo(row);
                    const nsLabel = nsQueueNo || '-';
                    const badgeClass = isPriorityQueue(nsLabel)
                        ? 'nurse-station-dashboard-badge is-priority'
                        : 'nurse-station-dashboard-badge is-regular';

                    const status = row?.nsData?.status || 'menunggu';
                    const statusLabel = status === 'selesai'
                        ? 'Selesai'
                        : (status === 'dipanggil' ? 'Dipanggil' : 'Menunggu');
                    const statusClass = status === 'selesai'
                        ? 'nurse-station-dashboard-status is-done'
                        : (status === 'dipanggil' ? 'nurse-station-dashboard-status is-called' : 'nurse-station-dashboard-status is-pending');

                    const canCall = !!nsQueueNo && status !== 'selesai' && (!activeCalledRow || String(activeCalledRow.id || '') === String(row?.id || ''));
                    const canDone = !!nsQueueNo && status === 'dipanggil';
                    const canHistory = !!String(row?.no_rm || '').trim();

                    const calledMeta = row?.nsData?.called_at
                        ? `Dipanggil ${escapeHtml(formatDateTime(row.nsData.called_at))}`
                        : '';
                    const doneMeta = row?.nsData?.completed_at
                        ? `Selesai ${escapeHtml(formatDateTime(row.nsData.completed_at))}`
                        : '';
                    const queueSourceMeta = nsQueueNo
                        ? `Nomor dari pendaftaran: ${escapeHtml(nsQueueNo)}`
                        : 'Nomor Nurse Station belum tersedia dari pendaftaran.';
                    const metaLine = [queueSourceMeta, calledMeta, doneMeta].filter(Boolean).join(' • ');

                    let assessmentButtonsHtml = '';
                    if (String(state.selectedSubmenuSchemaId || '').trim()) {
                        const selSchema = getSchemaById(state.selectedSubmenuSchemaId);
                        const selLabel = state.selectedSubmenuTitle
                            || (selSchema && (selSchema.menuShortLabel || selSchema.menuLabel || selSchema.label))
                            || 'Formulir';
                        const toneClass = selSchema && selSchema.id === 'cppti_pd'
                            ? 'is-amber'
                            : (selSchema && /medis/i.test(selSchema.label || '') ? 'is-sky' : 'is-rose');
                        const dataset = JSON.stringify({
                            id: row.id,
                            nama_pasien: row.nama_pasien,
                            tanggal_lahir: row.tanggal_lahir,
                            jenis_kelamin: row.jenis_kelamin,
                            no_rm: row.no_rm,
                            no_registrasi: row.no_registrasi,
                            unit: row.unit,
                            no_antrian: row.no_antrian,
                            poli_tujuan: row.poli_tujuan,
                            umur: row.umur,
                            alamat: row.alamat,
                            no_telepon: row.no_telepon,
                            schemaId: state.selectedSubmenuSchemaId
                        });
                        assessmentButtonsHtml = `<button type="button" class="nurse-station-dashboard-formulir-pinned-btn ${toneClass} assessment-shared-btn" data-schema-id="${escapeHtml(state.selectedSubmenuSchemaId)}" data-patient='${escapeHtml(dataset)}' title="Klik untuk membuka formulir ${escapeHtml(selLabel)} untuk pasien ini">
                            <span class="nurse-station-dashboard-formulir-pinned-icon">📝</span>
                            <span class="nurse-station-dashboard-formulir-pinned-body">
                            <span class="nurse-station-dashboard-formulir-pinned-label">Buka ${escapeHtml(selLabel)}</span>
                            <span class="nurse-station-dashboard-formulir-pinned-desc">Isi formulir asesmen terpilih untuk pasien ini</span>
                            </span>
                            <span class="nurse-station-dashboard-formulir-pinned-arrow">▶ Mulai Isi</span>
                        </button>`;
                    } else {
                        let fromConfig = '';
                        if (typeof config?.renderAssessmentButtons === 'function') {
                            fromConfig = String(config.renderAssessmentButtons(row) || '').trim();
                        }
                        if (fromConfig) {
                            assessmentButtonsHtml = fromConfig;
                        } else if (matchRowPoliKeyword(row, 'penyakit dalam')) {
                            const basePatient = {
                                id: row.id, nama_pasien: row.nama_pasien, tanggal_lahir: row.tanggal_lahir,
                                jenis_kelamin: row.jenis_kelamin, no_rm: row.no_rm, no_registrasi: row.no_registrasi,
                                unit: row.unit, no_antrian: row.no_antrian, poli_tujuan: row.poli_tujuan,
                                umur: row.umur, alamat: row.alamat, no_telepon: row.no_telepon
                            };
                            const defaultList = [
                                { schemaId: 'rawat_jalan_pd', label: 'Asesmen Rawat Jalan', icon: '📋', tone: 'is-rose' },
                                { schemaId: 'asesmen_awal_medis_pd', label: 'Asesmen Awal Medis', icon: '🩺', tone: 'is-sky' },
                                { schemaId: 'cppti_pd', label: 'CPPT', short: 'CPPT', icon: '📝', tone: 'is-amber' }
                            ];
                            const listHtml = defaultList.map(function (item, _idx) {
                                const schema = getSchemaById(item.schemaId);
                                const labelFinal = (schema && schema.menuLabel) || item.label;
                                const shortFinal = (schema && schema.menuShortLabel) || item.short || '';
                                const dataset = JSON.stringify({ ...basePatient, schemaId: item.schemaId });
                                return `<button type="button" class="nurse-station-dashboard-formulir-pinned-btn ${item.tone} assessment-shared-btn" data-schema-id="${escapeHtml(item.schemaId)}" data-patient='${escapeHtml(dataset)}' title="Mulai ${escapeHtml(labelFinal)} untuk pasien ini">
                                    <span class="nurse-station-dashboard-formulir-pinned-icon">${escapeHtml(item.icon)}</span>
                                    <span class="nurse-station-dashboard-formulir-pinned-body">
                                    <span class="nurse-station-dashboard-formulir-pinned-label">${escapeHtml(labelFinal)}${shortFinal ? ` <small style="opacity:.75">(${escapeHtml(shortFinal)})</small>` : ''}</span>
                                    <span class="nurse-station-dashboard-formulir-pinned-desc">Klik untuk mulai isi formulir</span>
                                    </span>
                                    <span class="nurse-station-dashboard-formulir-pinned-arrow">▶ Buka</span>
                                </button>`;
                            }).join('');
                            assessmentButtonsHtml = `<div class="nurse-station-dashboard-default-assessments-row" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:10px;">${listHtml}</div>`;
                        }
                    }

                    return [
                        '<div class="nurse-station-dashboard-item">',
                        `  <div class="${badgeClass}">${escapeHtml(nsLabel)}</div>`,
                        '  <div class="nurse-station-dashboard-item-body">',
                        '    <div class="nurse-station-dashboard-item-head">',
                        `      <div class="nurse-station-dashboard-item-title">${escapeHtml(row?.nama_pasien || 'Pasien tanpa nama')}</div>`,
                        `      <div class="${statusClass}">${escapeHtml(statusLabel)}</div>`,
                        '    </div>',
                        `    <div class="nurse-station-dashboard-item-meta">${escapeHtml(formatPoliLabel(row?.poli_tujuan || ''))} • Antrian Poli ${escapeHtml(noAntrian)}</div>`,
                        `    <div class="nurse-station-dashboard-item-submeta">Terdaftar ${escapeHtml(formatTime(row?.created_at || ''))}${metaLine ? ' • ' + metaLine : ''}</div>`,
                        assessmentButtonsHtml ? `    <div class="nurse-station-dashboard-item-assessment-row">${assessmentButtonsHtml}</div>` : '',
                        '    <div class="nurse-station-dashboard-item-actions">',
                        canCall ? `      <button type="button" class="nurse-station-dashboard-action-btn is-call" data-action="call" data-row-id="${escapeHtml(String(row?.id || ''))}">Panggil</button>` : '',
                        canDone ? `      <button type="button" class="nurse-station-dashboard-action-btn is-done" data-action="done" data-row-id="${escapeHtml(String(row?.id || ''))}">Selesai</button>` : '',
                        canHistory ? `      <button type="button" class="nurse-station-dashboard-action-btn is-secondary" data-action="history" data-row-id="${escapeHtml(String(row?.id || ''))}">Riwayat</button>` : '',
                        '    </div>',
                        '  </div>',
                        '</div>'
                    ].filter(Boolean).join('');
                }).join('');
            }

            async function persistNsData(row, payload, extraUpdate = null) {
                const rowId = String(row?.id || '').trim();
                if (!rowId) return false;
                const hasColumn = await detectNsColumn();
                if (hasColumn) {
                    const baseUpdate = { nurse_station_data: payload };
                    const mergedUpdate = extraUpdate && typeof extraUpdate === 'object'
                        ? { ...baseUpdate, ...extraUpdate }
                        : baseUpdate;

                    let result = await supabaseClient
                        .from('pasien')
                        .update(mergedUpdate)
                        .eq('id', rowId);

                    if (result?.error && /poli_service_data/i.test(result.error.message || '') && Object.prototype.hasOwnProperty.call(mergedUpdate, 'poli_service_data')) {
                        state.poliServiceColumnAvailable = false;
                        result = await supabaseClient
                            .from('pasien')
                            .update(baseUpdate)
                            .eq('id', rowId);
                    }

                    if (result?.error) throw result.error;
                    return true;
                }
                writeLocalNsData(row, payload);
                return false;
            }

            async function markAsCalled(row) {
                if (!row) return;
                const nsData = mergeNsData(row);
                const activeCalledRow = getOpenCalledRow(row?.id || '');
                if (activeCalledRow) {
                    const activeQueueNo = getEffectiveQueueNo(activeCalledRow, activeCalledRow.nsData) || '-';
                    const activeName = String(activeCalledRow?.nama_pasien || 'Pasien sebelumnya').trim();
                    setMessage(`Selesaikan pasien yang sedang dipanggil dulu (${activeQueueNo} - ${activeName}) sebelum memanggil pasien berikutnya.`, 'error');
                    render();
                    return;
                }
                const queueNo = getEffectiveQueueNo(row, nsData);
                if (!queueNo) {
                    setMessage('Nomor Nurse Station belum tersedia dari pendaftaran awal.', 'error');
                    render();
                    return;
                }
                const payload = {
                    ...nsData,
                    queue_no: queueNo,
                    status: 'dipanggil',
                    called_at: new Date().toISOString(),
                    called_by_name: getOperatorName(),
                    called_by_email: getOperatorEmail()
                };
                state.loading = true;
                setMessage('Menyimpan status panggilan...', 'info');
                render();
                try {
                    await persistNsData(row, payload);
                    row.nsData = payload;
                    setMessage(`Pasien dipanggil (${payload.queue_no}).`, 'success');
                } catch (err) {
                    setMessage('Gagal menyimpan status panggilan: ' + (err?.message || String(err)), 'error');
                } finally {
                    state.loading = false;
                    render();
                }
            }

            async function markAsDone(row) {
                if (!row) return;
                const nsData = mergeNsData(row);
                const queueNo = getEffectiveQueueNo(row, nsData);
                if (!queueNo) {
                    setMessage('Nomor Nurse Station belum tersedia dari pendaftaran awal.', 'error');
                    render();
                    return;
                }
                if (nsData?.status !== 'dipanggil') {
                    setMessage('Pasien harus dipanggil terlebih dahulu sebelum ditandai selesai.', 'error');
                    render();
                    return;
                }
                const payload = {
                    ...nsData,
                    queue_no: queueNo,
                    status: 'selesai',
                    completed_at: new Date().toISOString(),
                    completed_by_name: getOperatorName(),
                    completed_by_email: getOperatorEmail()
                };

                const canUsePoliService = await detectPoliServiceColumn();
                const poliServicePayload = canUsePoliService
                    ? {
                        status: 'menunggu',
                        ready_at: new Date().toISOString(),
                        ready_by_name: getOperatorName(),
                        ready_by_email: getOperatorEmail()
                    }
                    : null;

                state.loading = true;
                setMessage('Menyimpan status selesai...', 'info');
                render();
                try {
                    await persistNsData(row, payload, poliServicePayload ? { poli_service_data: poliServicePayload } : null);
                    row.nsData = payload;
                    setMessage('Status Nurse Station disimpan: selesai.', 'success');
                    renderList();
                } catch (err) {
                    setMessage('Gagal menyimpan status selesai: ' + (err?.message || String(err)), 'error');
                } finally {
                    state.loading = false;
                    render();
                }
            }

            async function loadRows() {
                ensureMounted();
                if (!supabaseClient) {
                    state.rows = [];
                    state.loading = false;
                    render();
                    return;
                }

                state.loading = true;
                setMessage('Memuat data...', 'info');
                renderSummary();
                renderMessage();

                try {
                    await detectNsColumn();
                    await detectBatalColumn();
                    const { startIso, endIso } = getDayBounds();
                    const selectFields = [
                        'id',
                        'no_rm',
                        'nama_pasien',
                        'no_antrian',
                        'poli_tujuan',
                        'created_at',
                        'unit',
                        'nurse_station_data'
                    ];
                    if (state.batalColumnAvailable) {
                        selectFields.push('batal_berobat_data');
                    }
                    const { data, error } = await supabaseClient
                        .from('pasien')
                        .select(selectFields.join(','))
                        .eq('unit', 'POLIKLINIK')
                        .gte('created_at', startIso)
                        .lt('created_at', endIso)
                        .order('created_at', { ascending: false });

                    if (error) {
                        throw error;
                    }

                    const rows = Array.isArray(data) ? data : [];
                    const normalized = rows
                        .filter((row) => (state.batalColumnAvailable ? !isCancelledRow(row) : true))
                        .map((row) => ({
                            ...row,
                            nsData: mergeNsData(row)
                        }));
                    state.rows = sortRows(normalized);
                    setMessage('', 'info');
                } catch (_err) {
                    state.rows = [];
                    setMessage('Gagal memuat data Nurse Station. Coba Refresh.', 'error');
                } finally {
                    state.loading = false;
                    render();
                }
            }

            function refreshTabVisual() {
                if (!els || !els.tabPending || !els.tabDone) return;
                els.tabPending.classList.toggle('is-active', state.activeTab === 'pending');
                els.tabDone.classList.toggle('is-active', state.activeTab === 'done');
            }

            function render() {
                ensureMounted();
                if (els.staffName) els.staffName.textContent = getStaffName();
                if (els.roleLabel) els.roleLabel.textContent = getRoleLabel();
                if (els.loketLabel) els.loketLabel.textContent = getLoketLabel();
                if (els.email) els.email.textContent = getEmail();
                if (els.refreshBtn) {
                    els.refreshBtn.disabled = state.loading;
                    els.refreshBtn.textContent = state.loading ? 'Memuat...' : 'Refresh';
                }
                refreshTabVisual();
                renderSummary();
                renderMessage();
                renderList();
            }

            return {
                render: () => {
                    ensureMounted();
                    render();
                    if (!state.rows.length && !state.loading) {
                        loadRows();
                    }
                },
                refresh: async () => {
                    await loadRows();
                }
            };
        }

        window.createNurseStationDashboardModule = createNurseStationDashboardModule;
    })();
