(() => {
    function createPoliDoctorSettingsModule(config) {
        const containerEl = config?.containerEl || null;
        if (!containerEl) {
            return {
                render: () => {},
                refresh: async () => {}
            };
        }

        const supabaseClient = config?.supabaseClient || null;
        const STORAGE_PREFIX = 'sim-ami:poli-doctor-settings:';
        const DEFAULT_STATUS = 'Tersedia';
        const STATUS_OPTIONS = ['Tersedia', 'Sedang Praktik', 'Istirahat', 'Tidak Ada Dokter'];
        const DEFAULT_DOCTORS_BY_POLI = {
            SPESIALIS_ANAK: [
                'dr. Dewi Jumantan Hamzah, M.Sc, Sp.A (DOKTER SPESIALIS ANAK)'
            ],
            SPESIALIS_PENYAKIT_DALAM: [
                'dr. Andi Renny Amita, Sp.PD (DOKTER SPESIALIS PENYAKIT DALAM)'
            ],
            DOKTER_UMUM: []
        };

        let mounted = false;
        let els = {};
        const state = {
            tableAvailable: null,
            loading: false,
            message: '',
            messageTone: 'info',
            settings: null
        };

        function getPoliCode() {
            return String(config?.getDefaultPoli?.() || '').trim();
        }

        function getPoliLabel() {
            return String(config?.getPoliLabel?.(getPoliCode()) || '').trim() || 'Poliklinik';
        }

        function getRoleLabel() {
            return String(config?.getRoleLabel?.() || '').trim() || 'Petugas Poli';
        }

        function getOperatorName() {
            return String(config?.getCurrentOperatorName?.() || '').trim() || 'Petugas Poli';
        }

        function getOperatorEmail() {
            return String(config?.getCurrentAdminEmail?.() || '').trim() || '';
        }

        function escapeHtml(value) {
            return String(value ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        function getDoctorOptions(poliCode, selectedDoctor = '') {
            const defaults = DEFAULT_DOCTORS_BY_POLI[String(poliCode || '').trim()] || [];
            const selected = String(selectedDoctor || '').trim();
            const items = [...defaults];
            if (selected && !items.includes(selected)) {
                items.unshift(selected);
            }
            return Array.from(new Set(items.filter(Boolean)));
        }

        function getStorageKey(poliCode) {
            const key = String(poliCode || '').trim();
            return key ? `${STORAGE_PREFIX}${key}` : '';
        }

        function normalizeSettings(raw, poliCode = getPoliCode()) {
            let value = raw;
            if (!value) value = {};
            if (typeof value === 'string') {
                try {
                    value = JSON.parse(value);
                } catch (_err) {
                    value = {};
                }
            }
            const normalizedPoli = String(value?.poli_tujuan || poliCode || '').trim();
            const namaDokter = String(value?.nama_dokter || '').trim();
            const statusDokter = STATUS_OPTIONS.includes(String(value?.status_dokter || '').trim())
                ? String(value.status_dokter).trim()
                : DEFAULT_STATUS;
            return {
                poli_tujuan: normalizedPoli,
                nama_dokter: namaDokter,
                status_dokter: statusDokter,
                updated_at: String(value?.updated_at || '').trim(),
                updated_by_name: String(value?.updated_by_name || '').trim(),
                updated_by_email: String(value?.updated_by_email || '').trim()
            };
        }

        function readLocalSettings(poliCode) {
            const key = getStorageKey(poliCode);
            if (!key) return null;
            try {
                return normalizeSettings(window.localStorage.getItem(key), poliCode);
            } catch (_err) {
                return null;
            }
        }

        function writeLocalSettings(settings) {
            const key = getStorageKey(settings?.poli_tujuan || '');
            if (!key) return;
            try {
                window.localStorage.setItem(key, JSON.stringify(settings || {}));
            } catch (_err) {}
        }

        function formatUpdatedAt(value) {
            const date = new Date(value);
            if (Number.isNaN(date.getTime())) return '-';
            return date.toLocaleString('id-ID', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }

        async function detectTable() {
            if (!supabaseClient) {
                state.tableAvailable = false;
                return false;
            }
            if (typeof state.tableAvailable === 'boolean') {
                return state.tableAvailable;
            }
            try {
                const { error } = await supabaseClient
                    .from('poli_doctor_status')
                    .select('poli_tujuan,nama_dokter,status_dokter')
                    .limit(1);
                state.tableAvailable = !error;
            } catch (_err) {
                state.tableAvailable = false;
            }
            return state.tableAvailable;
        }

        function setMessage(message, tone = 'info') {
            state.message = String(message || '').trim();
            state.messageTone = tone;
        }

        function ensureMounted() {
            if (mounted) return;

            containerEl.innerHTML = [
                '<div class="poli-doctor-settings">',
                '  <section class="poli-doctor-settings-hero">',
                '    <div class="poli-doctor-settings-kicker">Pengaturan Dokter Poli</div>',
                '    <h2 class="poli-doctor-settings-title">Atur Dokter Bertugas & Status Poli</h2>',
                '    <p class="poli-doctor-settings-desc">Halaman ini dipakai petugas poli untuk mengatur nama dokter yang tersedia dan status dokter yang akan ditampilkan pada display Nurse Station.</p>',
                '    <div class="poli-doctor-settings-hero-grid">',
                '      <div class="poli-doctor-settings-card"><div class="poli-doctor-settings-label">Peran</div><div id="poliDoctorRoleLabel" class="poli-doctor-settings-value">-</div></div>',
                '      <div class="poli-doctor-settings-card"><div class="poli-doctor-settings-label">Poli Aktif</div><div id="poliDoctorPoliLabel" class="poli-doctor-settings-value">-</div></div>',
                '      <div class="poli-doctor-settings-card"><div class="poli-doctor-settings-label">Petugas</div><div id="poliDoctorOperatorName" class="poli-doctor-settings-value">-</div></div>',
                '    </div>',
                '  </section>',
                '  <section class="poli-doctor-settings-panel">',
                '    <div class="poli-doctor-settings-toolbar">',
                '      <div>',
                '        <div class="poli-doctor-settings-panel-title">Info Dokter Poli Hari Ini</div>',
                '        <div id="poliDoctorMeta" class="poli-doctor-settings-panel-meta">Memuat data pengaturan...</div>',
                '      </div>',
                '      <div class="poli-doctor-settings-actions">',
                '        <button id="poliDoctorRefreshBtn" type="button" class="poli-doctor-settings-btn is-secondary">Refresh</button>',
                '        <button id="poliDoctorSaveBtn" type="button" class="poli-doctor-settings-btn is-primary">Simpan Pengaturan</button>',
                '      </div>',
                '    </div>',
                '    <div id="poliDoctorMessage" class="poli-doctor-settings-message hidden"></div>',
                '    <div class="poli-doctor-settings-form-grid">',
                '      <div class="poli-doctor-settings-field">',
                '        <label class="poli-doctor-settings-field-label" for="poliDoctorDoctorSelect">Dokter Bertugas</label>',
                '        <select id="poliDoctorDoctorSelect" class="poli-doctor-settings-input"></select>',
                '      </div>',
                '      <div class="poli-doctor-settings-field">',
                '        <label class="poli-doctor-settings-field-label" for="poliDoctorStatusSelect">Status Dokter</label>',
                '        <select id="poliDoctorStatusSelect" class="poli-doctor-settings-input">',
                ...STATUS_OPTIONS.map((status) => `        <option value="${escapeHtml(status)}">${escapeHtml(status)}</option>`),
                '        </select>',
                '      </div>',
                '    </div>',
                '    <div class="poli-doctor-settings-summary-grid">',
                '      <div class="poli-doctor-settings-summary-card"><div class="poli-doctor-settings-label">Dokter Tersimpan</div><div id="poliDoctorCurrentDoctor" class="poli-doctor-settings-summary-value">-</div></div>',
                '      <div class="poli-doctor-settings-summary-card"><div class="poli-doctor-settings-label">Status Tersimpan</div><div id="poliDoctorCurrentStatus" class="poli-doctor-settings-summary-value">-</div></div>',
                '      <div class="poli-doctor-settings-summary-card"><div class="poli-doctor-settings-label">Terakhir Diubah</div><div id="poliDoctorUpdatedAt" class="poli-doctor-settings-summary-value">-</div></div>',
                '    </div>',
                '  </section>',
                '</div>'
            ].join('');

            els = {
                roleLabel: containerEl.querySelector('#poliDoctorRoleLabel'),
                poliLabel: containerEl.querySelector('#poliDoctorPoliLabel'),
                operatorName: containerEl.querySelector('#poliDoctorOperatorName'),
                meta: containerEl.querySelector('#poliDoctorMeta'),
                refreshBtn: containerEl.querySelector('#poliDoctorRefreshBtn'),
                saveBtn: containerEl.querySelector('#poliDoctorSaveBtn'),
                message: containerEl.querySelector('#poliDoctorMessage'),
                doctorSelect: containerEl.querySelector('#poliDoctorDoctorSelect'),
                statusSelect: containerEl.querySelector('#poliDoctorStatusSelect'),
                currentDoctor: containerEl.querySelector('#poliDoctorCurrentDoctor'),
                currentStatus: containerEl.querySelector('#poliDoctorCurrentStatus'),
                updatedAt: containerEl.querySelector('#poliDoctorUpdatedAt')
            };

            els.refreshBtn?.addEventListener('click', async () => {
                await loadSettings();
            });
            els.saveBtn?.addEventListener('click', async () => {
                await saveSettings();
            });

            mounted = true;
        }

        function renderDoctorOptions(settings) {
            if (!els.doctorSelect) return;
            const poliCode = settings?.poli_tujuan || getPoliCode();
            const selectedDoctor = settings?.nama_dokter || '';
            const options = getDoctorOptions(poliCode, selectedDoctor);
            els.doctorSelect.innerHTML = [
                '<option value="">Pilih dokter</option>',
                ...options.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`)
            ].join('');
            els.doctorSelect.value = selectedDoctor;
        }

        function renderMessage() {
            if (!els.message) return;
            if (!state.message) {
                els.message.textContent = '';
                els.message.className = 'poli-doctor-settings-message hidden';
                return;
            }
            els.message.textContent = state.message;
            els.message.className = `poli-doctor-settings-message is-${state.messageTone}`;
        }

        function render() {
            ensureMounted();
            const settings = state.settings || normalizeSettings({}, getPoliCode());
            if (els.roleLabel) els.roleLabel.textContent = getRoleLabel();
            if (els.poliLabel) els.poliLabel.textContent = getPoliLabel();
            if (els.operatorName) els.operatorName.textContent = getOperatorName();
            if (els.meta) {
                els.meta.textContent = state.tableAvailable === false
                    ? 'Mode lokal aktif. Untuk dipakai lintas akun dan display, lanjutkan dengan tabel Supabase poli_doctor_status.'
                    : 'Pengaturan ini dipakai sebagai sumber data info dokter untuk display Nurse Station.';
            }
            if (els.refreshBtn) {
                els.refreshBtn.disabled = state.loading;
                els.refreshBtn.textContent = state.loading ? 'Memuat...' : 'Refresh';
            }
            if (els.saveBtn) {
                els.saveBtn.disabled = state.loading;
                els.saveBtn.textContent = state.loading ? 'Menyimpan...' : 'Simpan Pengaturan';
            }
            renderDoctorOptions(settings);
            if (els.statusSelect) {
                els.statusSelect.value = settings.status_dokter || DEFAULT_STATUS;
            }
            if (els.currentDoctor) {
                els.currentDoctor.textContent = settings.nama_dokter || '-';
            }
            if (els.currentStatus) {
                els.currentStatus.textContent = settings.status_dokter || DEFAULT_STATUS;
            }
            if (els.updatedAt) {
                els.updatedAt.textContent = settings.updated_at ? formatUpdatedAt(settings.updated_at) : '-';
            }
            renderMessage();
        }

        async function loadSettings() {
            ensureMounted();
            const poliCode = getPoliCode();
            if (!poliCode) {
                state.settings = normalizeSettings({}, '');
                setMessage('Akun ini belum memiliki mapping poli tujuan.', 'error');
                render();
                return;
            }

            state.loading = true;
            render();

            try {
                const tableAvailable = await detectTable();
                const localSettings = readLocalSettings(poliCode);
                if (!tableAvailable) {
                    state.settings = localSettings || normalizeSettings({}, poliCode);
                    if (!state.message) {
                        setMessage('Pengaturan dokter sementara disimpan lokal di browser ini.', 'info');
                    }
                    return;
                }

                const { data, error } = await supabaseClient
                    .from('poli_doctor_status')
                    .select('poli_tujuan,nama_dokter,status_dokter,updated_at,updated_by_name,updated_by_email')
                    .eq('poli_tujuan', poliCode)
                    .maybeSingle();

                if (error) throw error;

                state.settings = normalizeSettings(data || localSettings || {}, poliCode);
                setMessage('', 'info');
            } catch (_err) {
                state.settings = readLocalSettings(poliCode) || normalizeSettings({}, poliCode);
                setMessage('Gagal memuat pengaturan dari database. Mode lokal tetap dipakai.', 'error');
            } finally {
                state.loading = false;
                render();
            }
        }

        async function saveSettings() {
            ensureMounted();
            const poliCode = getPoliCode();
            if (!poliCode) {
                setMessage('Akun ini belum terhubung ke poli tujuan.', 'error');
                render();
                return;
            }

            const payload = normalizeSettings({
                poli_tujuan: poliCode,
                nama_dokter: els.doctorSelect?.value || '',
                status_dokter: els.statusSelect?.value || DEFAULT_STATUS,
                updated_at: new Date().toISOString(),
                updated_by_name: getOperatorName(),
                updated_by_email: getOperatorEmail()
            }, poliCode);

            state.loading = true;
            state.settings = payload;
            writeLocalSettings(payload);
            render();

            try {
                const tableAvailable = await detectTable();
                if (!tableAvailable) {
                    setMessage('Pengaturan disimpan lokal. Jalankan SQL tabel poli_doctor_status agar bisa dibaca display lintas akun.', 'success');
                    return;
                }

                const { error } = await supabaseClient
                    .from('poli_doctor_status')
                    .upsert(payload, { onConflict: 'poli_tujuan' });

                if (error) throw error;

                setMessage('Pengaturan dokter poli berhasil disimpan.', 'success');
            } catch (_err) {
                setMessage('Pengaturan disimpan lokal. Database belum siap untuk sinkron lintas akun.', 'info');
            } finally {
                state.loading = false;
                render();
            }
        }

        return {
            render: async () => {
                ensureMounted();
                render();
                await loadSettings();
            },
            refresh: async () => {
                await loadSettings();
            }
        };
    }

    window.createPoliDoctorSettingsModule = createPoliDoctorSettingsModule;
})();
