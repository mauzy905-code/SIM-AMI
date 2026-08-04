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
            messageTone: 'info'
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
            return /^B-/i.test(value) ? `P-${value.slice(2)}` : value;
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
                '      <p class="nurse-station-dashboard-desc">Landing awal untuk memantau pasien poliklinik hari ini dan membuka daftar pasien yang akan masuk ke alur Nurse Station.</p>',
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
                refreshBtn: containerEl.querySelector('#nurseDashRefreshBtn')
            };

            els.openRekapBtn?.addEventListener('click', async () => {
                await Promise.resolve(config?.openRekapToday?.());
            });
            els.refreshBtn?.addEventListener('click', async () => {
                await loadRows();
            });
            els.tabPending?.addEventListener('click', () => {
                state.activeTab = 'pending';
                renderList();
            });
            els.tabDone?.addEventListener('click', () => {
                state.activeTab = 'done';
                renderList();
            });
            els.list?.addEventListener('click', async (event) => {
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

        function renderMessage() {
            if (!els.message) return;
            const text = String(state.message || '').trim();
            els.message.textContent = text;
            els.message.classList.toggle('hidden', !text);
            els.message.classList.toggle('is-success', state.messageTone === 'success');
            els.message.classList.toggle('is-error', state.messageTone === 'error');
        }

        function renderSummary() {
            const rows = Array.isArray(state.rows) ? state.rows : [];
            const poliSet = new Set();
            let priorityCount = 0;
            let pendingCount = 0;
            let doneCount = 0;

            rows.forEach((row) => {
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

            if (els.totalCount) els.totalCount.textContent = String(rows.length);
            if (els.priorityCount) els.priorityCount.textContent = String(priorityCount);
            if (els.poliCount) els.poliCount.textContent = String(poliSet.size);
            if (els.meta) {
                els.meta.textContent = state.loading
                    ? 'Memuat data pasien poliklinik hari ini...'
                    : `Menunggu ${pendingCount} • Selesai ${doneCount} • Total ${rows.length}`;
            }
        }

        function renderList() {
            if (!els.list) return;
            const rows = Array.isArray(state.rows) ? state.rows : [];
            const activeCalledRow = getOpenCalledRow();
            const tabRows = state.activeTab === 'done'
                ? rows.filter((row) => row.nsData?.status === 'selesai')
                : rows.filter((row) => row.nsData?.status !== 'selesai');

            if (!tabRows.length) {
                els.list.innerHTML = state.activeTab === 'done'
                    ? '<div class="nurse-station-dashboard-empty">Belum ada pasien yang selesai asesmen Nurse Station hari ini.</div>'
                    : '<div class="nurse-station-dashboard-empty">Tidak ada pasien menunggu Nurse Station hari ini.</div>';
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
            if (els.tabPending) {
                els.tabPending.classList.toggle('is-active', state.activeTab === 'pending');
            }
            if (els.tabDone) {
                els.tabDone.classList.toggle('is-active', state.activeTab === 'done');
            }
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
