(() => {
    function createPoliDashboardModule(config) {
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
            serviceColumnAvailable: null,
            message: '',
            messageTone: 'info'
        };
        const STORAGE_PREFIX = 'sim-ami:poli-dashboard:';

        function getOperatorName() {
            const value = String(config?.getCurrentOperatorName?.() || '').trim();
            return value || 'Petugas Poli';
        }

        function getOperatorEmail() {
            const value = String(config?.getCurrentAdminEmail?.() || '').trim();
            return value || '';
        }

        function getRoleLabel() {
            const value = String(config?.getRoleLabel?.() || '').trim();
            return value || 'Petugas Poli';
        }

        function getPoliCode() {
            return String(config?.getDefaultPoli?.() || '').trim();
        }

        function getPoliLabel() {
            return String(config?.getPoliLabel?.(getPoliCode()) || '').trim() || 'Poliklinik';
        }

        function escapeHtml(value) {
            return String(value ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        function ensureMounted() {
            if (mounted) return;
            containerEl.innerHTML = [
                '<div class="poli-dashboard">',
                '  <section class="poli-dashboard-hero">',
                '    <div class="poli-dashboard-hero-main">',
                '      <div class="poli-dashboard-kicker">Panel Poli</div>',
                '      <h2 class="poli-dashboard-title">Worklist Pasien Poliklinik</h2>',
                '      <p class="poli-dashboard-desc">Daftar pasien hari ini per poli, dengan penanda umum dan prioritas agar petugas bisa mendahulukan pasien yang perlu diprioritaskan.</p>',
                '      <div class="poli-dashboard-cards">',
                '        <div class="poli-dashboard-stat-card"><div class="poli-dashboard-stat-label">Petugas Aktif</div><div id="poliDashStaffName" class="poli-dashboard-stat-value">-</div></div>',
                '        <div class="poli-dashboard-stat-card"><div class="poli-dashboard-stat-label">Peran</div><div id="poliDashRoleLabel" class="poli-dashboard-stat-value">-</div></div>',
                '        <div class="poli-dashboard-stat-card"><div class="poli-dashboard-stat-label">Poli Aktif</div><div id="poliDashPoliLabel" class="poli-dashboard-stat-value">-</div></div>',
                '      </div>',
                '    </div>',
                '    <div class="poli-dashboard-hero-side">',
                '      <div class="poli-dashboard-side-card"><div class="poli-dashboard-stat-label">Email Akun</div><div id="poliDashEmail" class="poli-dashboard-side-value">-</div></div>',
                '      <div class="poli-dashboard-side-card"><div class="poli-dashboard-stat-label">Catatan</div><div class="poli-dashboard-side-note">Tahap awal ini fokus pada daftar pasien, prioritas, buka riwayat, dan status selesai. Alur Nurse Station akan disambungkan di tahap berikutnya.</div></div>',
                '    </div>',
                '  </section>',
                '  <section class="poli-dashboard-summary">',
                '    <div class="poli-dashboard-summary-card"><div class="poli-dashboard-summary-label">Belum Dilayani</div><div id="poliDashPendingCount" class="poli-dashboard-summary-value">0</div></div>',
                '    <div class="poli-dashboard-summary-card"><div class="poli-dashboard-summary-label">Sudah Dilayani</div><div id="poliDashDoneCount" class="poli-dashboard-summary-value">0</div></div>',
                '    <div class="poli-dashboard-summary-card"><div class="poli-dashboard-summary-label">Pasien Prioritas</div><div id="poliDashPriorityCount" class="poli-dashboard-summary-value">0</div></div>',
                '  </section>',
                '  <section class="poli-dashboard-panel">',
                '    <div class="poli-dashboard-toolbar">',
                '      <div class="poli-dashboard-tabs">',
                '        <button id="poliDashTabPending" type="button" class="poli-dashboard-tab is-active">Belum Dilayani</button>',
                '        <button id="poliDashTabDone" type="button" class="poli-dashboard-tab">Sudah Dilayani</button>',
                '      </div>',
                '      <div class="poli-dashboard-actions">',
                '        <button id="poliDashOpenRekapAll" type="button" class="poli-dashboard-btn poli-dashboard-btn-secondary">Lihat Rekap Semua</button>',
                '        <button id="poliDashRefreshBtn" type="button" class="poli-dashboard-btn poli-dashboard-btn-primary">Refresh</button>',
                '      </div>',
                '    </div>',
                '    <div id="poliDashMessage" class="poli-dashboard-message hidden"></div>',
                '    <div id="poliDashList" class="poli-dashboard-list"></div>',
                '  </section>',
                '</div>'
            ].join('');

            els = {
                staffName: containerEl.querySelector('#poliDashStaffName'),
                roleLabel: containerEl.querySelector('#poliDashRoleLabel'),
                poliLabel: containerEl.querySelector('#poliDashPoliLabel'),
                email: containerEl.querySelector('#poliDashEmail'),
                pendingCount: containerEl.querySelector('#poliDashPendingCount'),
                doneCount: containerEl.querySelector('#poliDashDoneCount'),
                priorityCount: containerEl.querySelector('#poliDashPriorityCount'),
                tabPending: containerEl.querySelector('#poliDashTabPending'),
                tabDone: containerEl.querySelector('#poliDashTabDone'),
                refreshBtn: containerEl.querySelector('#poliDashRefreshBtn'),
                openRekapAllBtn: containerEl.querySelector('#poliDashOpenRekapAll'),
                message: containerEl.querySelector('#poliDashMessage'),
                list: containerEl.querySelector('#poliDashList')
            };

            els.tabPending?.addEventListener('click', () => {
                state.activeTab = 'pending';
                renderList();
            });
            els.tabDone?.addEventListener('click', () => {
                state.activeTab = 'done';
                renderList();
            });
            els.refreshBtn?.addEventListener('click', async () => {
                await loadRows();
            });
            els.openRekapAllBtn?.addEventListener('click', async () => {
                await Promise.resolve(config?.openRekapAll?.());
            });
            els.list?.addEventListener('click', async (event) => {
                const openBtn = event.target.closest('[data-action="open"]');
                if (openBtn) {
                    const rowId = String(openBtn.getAttribute('data-row-id') || '');
                    const target = state.rows.find((item) => String(item.id || '') === rowId);
                    if (target) {
                        await Promise.resolve(config?.openHistory?.(target));
                    }
                    return;
                }
                const completeBtn = event.target.closest('[data-action="complete"]');
                if (completeBtn) {
                    const rowId = String(completeBtn.getAttribute('data-row-id') || '');
                    const target = state.rows.find((item) => String(item.id || '') === rowId);
                    if (target) {
                        await markAsCompleted(target);
                    }
                }
            });

            mounted = true;
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

        function formatTime(value) {
            const date = new Date(value);
            if (Number.isNaN(date.getTime())) return '-';
            return date.toLocaleTimeString('id-ID', {
                hour: '2-digit',
                minute: '2-digit'
            });
        }

        function isPriorityQueue(noAntrian) {
            return /^(P|B)-/i.test(String(noAntrian || '').trim());
        }

        function getQueueCategoryLabel(noAntrian) {
            return isPriorityQueue(noAntrian) ? 'Prioritas' : 'Umum';
        }

        function normalizeServiceData(raw) {
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
            const status = String(value.status || '').trim().toLowerCase() === 'selesai' ? 'selesai' : 'menunggu';
            return {
                status,
                completed_at: String(value.completed_at || '').trim(),
                completed_by_name: String(value.completed_by_name || '').trim(),
                completed_by_email: String(value.completed_by_email || '').trim()
            };
        }

        function getStorageKey(row) {
            const patientId = String(row?.id || '').trim();
            return patientId ? `${STORAGE_PREFIX}${patientId}` : '';
        }

        function readLocalServiceData(row) {
            const key = getStorageKey(row);
            if (!key) return null;
            try {
                return normalizeServiceData(window.localStorage.getItem(key));
            } catch (_err) {
                return null;
            }
        }

        function writeLocalServiceData(row, payload) {
            const key = getStorageKey(row);
            if (!key) return;
            try {
                window.localStorage.setItem(key, JSON.stringify(payload || {}));
            } catch (_err) {}
        }

        async function detectServiceColumn() {
            if (!supabaseClient) {
                state.serviceColumnAvailable = false;
                return false;
            }
            if (typeof state.serviceColumnAvailable === 'boolean') {
                return state.serviceColumnAvailable;
            }
            try {
                const { error } = await supabaseClient
                    .from('pasien')
                    .select('poli_service_data')
                    .limit(1);
                state.serviceColumnAvailable = !(error && /poli_service_data/i.test(error.message || ''));
            } catch (_err) {
                state.serviceColumnAvailable = false;
            }
            return state.serviceColumnAvailable;
        }

        function mergeServiceData(row) {
            const fromRow = normalizeServiceData(row?.poli_service_data || null);
            const fromLocal = readLocalServiceData(row);
            return fromRow || fromLocal || {
                status: 'menunggu',
                completed_at: '',
                completed_by_name: '',
                completed_by_email: ''
            };
        }

        function sortRows(list) {
            return list.slice().sort((left, right) => {
                const leftPriority = isPriorityQueue(left.no_antrian) ? 0 : 1;
                const rightPriority = isPriorityQueue(right.no_antrian) ? 0 : 1;
                if (leftPriority !== rightPriority) return leftPriority - rightPriority;

                const leftDone = left.serviceData?.status === 'selesai';
                const rightDone = right.serviceData?.status === 'selesai';
                if (leftDone !== rightDone) return leftDone ? 1 : -1;

                const leftTime = new Date(left.created_at || 0).getTime();
                const rightTime = new Date(right.created_at || 0).getTime();
                return leftTime - rightTime;
            });
        }

        function getFilteredRows() {
            const rows = Array.isArray(state.rows) ? state.rows : [];
            if (state.activeTab === 'done') {
                return rows.filter((row) => row.serviceData?.status === 'selesai');
            }
            return rows.filter((row) => row.serviceData?.status !== 'selesai');
        }

        function updateSummary() {
            const rows = Array.isArray(state.rows) ? state.rows : [];
            const pendingCount = rows.filter((row) => row.serviceData?.status !== 'selesai').length;
            const doneCount = rows.filter((row) => row.serviceData?.status === 'selesai').length;
            const priorityCount = rows.filter((row) => isPriorityQueue(row.no_antrian) && row.serviceData?.status !== 'selesai').length;
            if (els.pendingCount) els.pendingCount.textContent = String(pendingCount);
            if (els.doneCount) els.doneCount.textContent = String(doneCount);
            if (els.priorityCount) els.priorityCount.textContent = String(priorityCount);
        }

        function setMessage(message, tone = 'info') {
            state.message = String(message || '').trim();
            state.messageTone = tone;
            if (!els.message) return;
            els.message.textContent = state.message;
            els.message.className = 'poli-dashboard-message';
            if (!state.message) {
                els.message.classList.add('hidden');
                return;
            }
            els.message.classList.add(`is-${tone}`);
            els.message.classList.remove('hidden');
        }

        function renderList() {
            if (!mounted) return;
            if (els.staffName) els.staffName.textContent = getOperatorName();
            if (els.roleLabel) els.roleLabel.textContent = getRoleLabel();
            if (els.poliLabel) els.poliLabel.textContent = getPoliLabel();
            if (els.email) els.email.textContent = getOperatorEmail() || '-';
            if (els.tabPending) els.tabPending.classList.toggle('is-active', state.activeTab === 'pending');
            if (els.tabDone) els.tabDone.classList.toggle('is-active', state.activeTab === 'done');

            updateSummary();

            const rows = getFilteredRows();
            if (!rows.length) {
                const emptyText = state.activeTab === 'done'
                    ? 'Belum ada pasien yang ditandai selesai hari ini.'
                    : 'Belum ada pasien masuk ke poli ini hari ini.';
                els.list.innerHTML = `<div class="poli-dashboard-empty">${escapeHtml(emptyText)}</div>`;
                return;
            }

            els.list.innerHTML = rows.map((row) => {
                const queueCategory = getQueueCategoryLabel(row.no_antrian);
                const isPriority = isPriorityQueue(row.no_antrian);
                const serviceStatus = row.serviceData?.status === 'selesai' ? 'Sudah Dilayani' : 'Belum Dilayani';
                const doneMeta = row.serviceData?.status === 'selesai'
                    ? `<div class="poli-dashboard-item-done">Selesai ${escapeHtml(formatTime(row.serviceData.completed_at))}${row.serviceData.completed_by_name ? ` • ${escapeHtml(row.serviceData.completed_by_name)}` : ''}</div>`
                    : '';
                const openDisabled = row.no_rm ? '' : ' disabled';
                const openLabel = row.serviceData?.status === 'selesai' ? 'Buka Riwayat' : 'Buka / Layani';
                const completeButton = row.serviceData?.status === 'selesai'
                    ? ''
                    : `<button type="button" class="poli-dashboard-action-btn is-complete" data-action="complete" data-row-id="${escapeHtml(String(row.id || ''))}">Selesai</button>`;
                return [
                    '<article class="poli-dashboard-item">',
                    '  <div class="poli-dashboard-item-head">',
                    `    <div class="poli-dashboard-queue-badge ${isPriority ? 'is-priority' : 'is-regular'}">${escapeHtml(String(row.no_antrian || '-'))}</div>`,
                    '    <div class="poli-dashboard-item-main">',
                    `      <h3 class="poli-dashboard-item-title">${escapeHtml(String(row.nama_pasien || 'Pasien'))}</h3>`,
                    `      <div class="poli-dashboard-item-meta">RM ${escapeHtml(String(row.no_rm || '-'))} • Masuk ${escapeHtml(formatTime(row.created_at))}</div>`,
                    '    </div>',
                    '    <div class="poli-dashboard-item-statuses">',
                    `      <span class="poli-dashboard-chip ${isPriority ? 'is-priority' : 'is-regular'}">${escapeHtml(queueCategory)}</span>`,
                    `      <span class="poli-dashboard-chip is-service">${escapeHtml(serviceStatus)}</span>`,
                    '    </div>',
                    '  </div>',
                    `  ${doneMeta}`,
                    '  <div class="poli-dashboard-item-actions">',
                    `    <button type="button" class="poli-dashboard-action-btn is-open" data-action="open" data-row-id="${escapeHtml(String(row.id || ''))}"${openDisabled}>${escapeHtml(openLabel)}</button>`,
                    `    ${completeButton}`,
                    '  </div>',
                    '</article>'
                ].join('');
            }).join('');
        }

        async function loadRows() {
            ensureMounted();
            const poliCode = getPoliCode();
            if (!poliCode) {
                state.rows = [];
                setMessage('Akun ini belum memiliki mapping poli tujuan. Gunakan email akun poli yang sudah terhubung ke poli.', 'error');
                renderList();
                return;
            }
            if (!supabaseClient) {
                state.rows = [];
                setMessage('Supabase client tidak tersedia untuk memuat worklist poli.', 'error');
                renderList();
                return;
            }

            state.loading = true;
            if (els.refreshBtn) {
                els.refreshBtn.disabled = true;
                els.refreshBtn.textContent = 'Memuat...';
            }

            try {
                const canUseServiceColumn = await detectServiceColumn();
                const selectFields = [
                    'id',
                    'no_rm',
                    'nama_pasien',
                    'no_antrian',
                    'poli_tujuan',
                    'created_at',
                    'unit'
                ];
                if (canUseServiceColumn) {
                    selectFields.push('poli_service_data');
                }

                const bounds = getDayBounds();
                const { data, error } = await supabaseClient
                    .from('pasien')
                    .select(selectFields.join(','))
                    .eq('unit', 'POLIKLINIK')
                    .eq('poli_tujuan', poliCode)
                    .gte('created_at', bounds.startIso)
                    .lt('created_at', bounds.endIso)
                    .order('created_at', { ascending: true })
                    .limit(200);

                if (error) {
                    throw new Error(error.message);
                }

                state.rows = sortRows((Array.isArray(data) ? data : []).map((row) => ({
                    ...row,
                    serviceData: mergeServiceData(row)
                })));

                if (state.serviceColumnAvailable === false) {
                    setMessage('Status selesai poli saat ini masih memakai simpan lokal browser. Jika ingin permanen lintas perangkat, nanti kita tambahkan kolom database.', 'info');
                } else {
                    setMessage('');
                }
            } catch (err) {
                state.rows = [];
                setMessage(`Gagal memuat daftar pasien poli: ${err?.message || String(err)}`, 'error');
            } finally {
                state.loading = false;
                if (els.refreshBtn) {
                    els.refreshBtn.disabled = false;
                    els.refreshBtn.textContent = 'Refresh';
                }
                renderList();
            }
        }

        async function persistServiceState(row, payload) {
            writeLocalServiceData(row, payload);
            if (!state.serviceColumnAvailable) {
                return true;
            }
            const updatePayload = {
                poli_service_data: payload
            };
            if (config?.canWritePetugasPoli?.()) {
                updatePayload.petugas_poli = getOperatorName();
            }

            let result = await supabaseClient
                .from('pasien')
                .update(updatePayload)
                .eq('id', row.id);

            if (result?.error && /petugas_poli/i.test(result.error.message || '') && Object.prototype.hasOwnProperty.call(updatePayload, 'petugas_poli')) {
                delete updatePayload.petugas_poli;
                result = await supabaseClient
                    .from('pasien')
                    .update(updatePayload)
                    .eq('id', row.id);
            }

            if (result?.error) {
                if (/poli_service_data/i.test(result.error.message || '')) {
                    state.serviceColumnAvailable = false;
                    return true;
                }
                throw new Error(result.error.message);
            }
            return true;
        }

        async function markAsCompleted(row) {
            if (!row?.id) return;
            const payload = {
                status: 'selesai',
                completed_at: new Date().toISOString(),
                completed_by_name: getOperatorName(),
                completed_by_email: getOperatorEmail()
            };
            try {
                await persistServiceState(row, payload);
                const target = state.rows.find((item) => String(item.id || '') === String(row.id || ''));
                if (target) {
                    target.serviceData = normalizeServiceData(payload);
                }
                state.rows = sortRows(state.rows);
                setMessage(`Pasien ${String(row.nama_pasien || 'ini')} ditandai selesai.`, 'success');
                renderList();
            } catch (err) {
                setMessage(`Gagal menandai selesai: ${err?.message || String(err)}`, 'error');
            }
        }

        return {
            render: async function() {
                ensureMounted();
                renderList();
                await loadRows();
            },
            refresh: async function() {
                await loadRows();
            }
        };
    }

    window.createPoliDashboardModule = createPoliDashboardModule;
})();
