(function() {
    function createUgdAssessmentModule(deps) {
        if (!deps || !deps.supabaseClient) {
            throw new Error('Supabase client wajib tersedia untuk modul asesmen UGD.');
        }

        const supabaseClient = deps.supabaseClient;
        const withTimeout = typeof deps.withTimeout === 'function'
            ? deps.withTimeout
            : async function(promise) { return await promise; };
        const withPageLoading = typeof deps.withPageLoading === 'function'
            ? deps.withPageLoading
            : async function(_label, task) { return await task(); };
        const escapeHtml = deps.escapeHtml || function(value) { return String(value ?? ''); };
        const formatBirthDate = deps.formatGeneralConsentDate || function(value) { return String(value || ''); };
        const getCurrentOperatorName = deps.getCurrentOperatorName || function() { return ''; };
        const getCurrentOperatorEmail = deps.getCurrentOperatorEmail || function() { return ''; };
        const canAccessAssessment = deps.canAccessAssessment || function() { return false; };
        const isDoctorRole = deps.isDoctorRole || function() { return false; };
        const isPerawatRole = deps.isPerawatRole || function() { return false; };

        const state = {
            currentPatient: null,
            currentAssessment: null,
            saveTimer: null,
            lastWriteAt: 0,
            subscription: null,
            broadcastChannel: null
        };

        const dom = {};

        injectModalHtml();
        wireDom();
        wireEvents();

        try {
            state.broadcastChannel = new window.BroadcastChannel('assessment-ugd-local-sync');
            state.broadcastChannel.addEventListener('message', function(event) {
                const payload = event?.data || {};
                if (!dom.modal.classList.contains('is-open')) return;
                if (String(payload.patientId || '') !== String(state.currentPatient?.id || '')) return;
                if (Date.now() - state.lastWriteAt < 1000) return;
                refreshCurrentPatient(false);
            });
        } catch (_err) {
            state.broadcastChannel = null;
        }

        return {
            renderRekapButton: renderRekapButton,
            openAssessmentFromPayload: openAssessmentFromPayload,
            handleRekapButtonClick: handleRekapButtonClick,
            refreshCurrentPatient: refreshCurrentPatient
        };

        function injectModalHtml() {
            if (document.getElementById('assessmentUgdModal')) return;

            const wrapper = document.createElement('div');
            wrapper.innerHTML = [
                '<div id="assessmentUgdModal" class="assessment-ugd-modal" aria-hidden="true">',
                '  <div class="assessment-ugd-overlay"></div>',
                '  <div class="assessment-ugd-dialog">',
                '    <div class="assessment-ugd-panel">',
                '      <div class="assessment-ugd-shell">',
                '        <div class="assessment-ugd-toolbar">',
                '          <div class="assessment-ugd-toolbar-main">',
                '            <div class="assessment-ugd-kicker">Asesmen UGD</div>',
                '            <div class="assessment-ugd-title">Asesmen Awal Pasien Gawat Darurat</div>',
                '            <div id="assessmentUgdSubtitle" class="assessment-ugd-subtitle">Memuat data pasien...</div>',
                '          </div>',
                '          <div class="assessment-ugd-toolbar-actions">',
                '            <div id="assessmentUgdStatus" class="assessment-ugd-status">Siap</div>',
                '            <button id="assessmentUgdRefreshBtn" type="button" class="assessment-ugd-btn assessment-ugd-btn-secondary">Refresh</button>',
                '            <button id="assessmentUgdPrintBtn" type="button" class="assessment-ugd-btn assessment-ugd-btn-secondary">Cetak</button>',
                '            <button id="assessmentUgdCloseBtn" type="button" class="assessment-ugd-btn assessment-ugd-btn-primary">Tutup</button>',
                '          </div>',
                '        </div>',
                '        <div class="assessment-ugd-body">',
                '          <div class="assessment-ugd-help">',
                '            <div class="assessment-ugd-help-card">',
                '              <div class="assessment-ugd-help-title">Role Aktif</div>',
                '              <div id="assessmentUgdRoleText" class="assessment-ugd-help-text">-</div>',
                '            </div>',
                '            <div class="assessment-ugd-help-card">',
                '              <div class="assessment-ugd-help-title">Sinkronisasi</div>',
                '              <div id="assessmentUgdRealtimeText" class="assessment-ugd-help-text">Perubahan akan disimpan ke data pasien UGD dan disinkronkan dari tabel pasien.</div>',
                '            </div>',
                '          </div>',
                '          <div id="assessmentUgdForm" class="assessment-ugd-document">',
                '            <section class="assessment-ugd-sheet">',
                '              <div class="gc-header-box">',
                '                <div class="gc-header-left">',
                '                  <div class="gc-logo-wrap">',
                '                    <img src="assets/image/logo-rsud.png" alt="Logo RSUD" class="gc-logo">',
                '                  </div>',
                '                  <div class="gc-header-center">',
                '                    <div class="gc-header-line">PEMERINTAH KABUPATEN KUTAI KARTANEGARA</div>',
                '                    <div class="gc-header-line gc-header-strong">DINAS KESEHATAN</div>',
                '                    <div class="gc-header-line gc-header-strong">UNIT ORGANISASI BERSIFAT KHUSUS</div>',
                '                    <div class="gc-header-title">RUMAH SAKIT UMUM DAERAH AJI MUHAMMAD IDRIS</div>',
                '                    <div class="gc-header-address">Jalan Pramuka Muara Badak-Mangkujoyo, RT 02 Sambutan Jembatan, Desa Tanjung Limau</div>',
                '                    <div class="gc-header-address">Kec. Muara Badak, Kode Pos 75382, Pos-el: rsudajimuhammadidris@gmail.com</div>',
                '                  </div>',
                '                </div>',
                '                <div class="gc-patient-col">',
                '                  <div class="gc-patient-box">',
                '                    <table class="gc-patient-meta">',
                '                      <tr><td>Nomor RM</td><td>:</td><td id="assessment_no_rm"></td></tr>',
                '                      <tr><td>Nama</td><td>:</td><td id="assessment_nama_pasien"></td></tr>',
                '                      <tr><td>Jenis Kelamin</td><td>:</td><td id="assessment_jk"></td></tr>',
                '                      <tr><td>Tanggal Lahir</td><td>:</td><td id="assessment_tanggal_lahir"></td></tr>',
                '                    </table>',
                '                  </div>',
                '                </div>',
                '              </div>',
                '              <div class="assessment-ugd-title-box">ASESMEN AWAL PASIEN GAWAT DARURAT</div>',
                '              <div class="assessment-ugd-section-box">',
                '                <div class="assessment-ugd-section-head">DOKTER</div>',
                '                <div class="assessment-ugd-section-body">',
                '                  <div id="assessmentDoctorReadonlyNote" class="assessment-ugd-readonly-note hidden">Bagian ini hanya dapat diubah oleh dokter. Akun Anda tetap dapat melihat perubahan secara realtime.</div>',
                '                  <div class="assessment-ugd-role-pill is-doctor">Halaman Dokter</div>',
                '                  <div class="assessment-ugd-datetime">',
                '                    <div class="assessment-ugd-inline-row"><span>Tanggal :</span><input id="assessment_tanggal" type="text" class="assessment-ugd-line-input assessment-ugd-line-input-date" placeholder="dd-mm-yyyy"></div>',
                '                    <div class="assessment-ugd-inline-row"><span>Jam</span><input id="assessment_jam" type="text" class="assessment-ugd-line-input assessment-ugd-line-input-time" placeholder="manual"><span>Wita</span></div>',
                '                  </div>',
                '                  <div class="assessment-ugd-field-block">',
                '                    <label class="assessment-ugd-field-label">Survey Primer</label>',
                '                  </div>',
                '                  <div class="assessment-ugd-grid-2">',
                '                    <div class="assessment-ugd-field-block"><label class="assessment-ugd-field-label">A (Airway)</label><textarea id="assessment_airway" class="assessment-ugd-textarea"></textarea></div>',
                '                    <div class="assessment-ugd-field-block"><label class="assessment-ugd-field-label">B (Breathing)</label><textarea id="assessment_breathing" class="assessment-ugd-textarea"></textarea></div>',
                '                    <div class="assessment-ugd-field-block"><label class="assessment-ugd-field-label">C (Circulation)</label><textarea id="assessment_circulation" class="assessment-ugd-textarea"></textarea></div>',
                '                    <div class="assessment-ugd-field-block"><label class="assessment-ugd-field-label">D (Disability)</label><textarea id="assessment_disability" class="assessment-ugd-textarea"></textarea></div>',
                '                  </div>',
                '                  <div class="assessment-ugd-field-block"><label class="assessment-ugd-field-label">GCS</label><input id="assessment_gcs" type="text" class="assessment-ugd-line-input" placeholder="contoh: E4 V5 M6"></div>',
                '                  <div class="assessment-ugd-field-block">',
                '                    <label class="assessment-ugd-field-label">Survey sekunder</label>',
                '                    <div class="assessment-ugd-checkline">',
                '                      <label class="assessment-ugd-checkitem"><input id="assessment_riwayat_anamnesis" type="checkbox"> Anamnesis</label>',
                '                      <label class="assessment-ugd-checkitem"><input id="assessment_riwayat_alloanamnesis" type="checkbox"> Alloanamnesis</label>',
                '                      <span>dengan nama</span><input id="assessment_riwayat_nama" type="text" class="assessment-ugd-line-input" placeholder="nama pemberi informasi">',
                '                      <span>hubungan</span><input id="assessment_riwayat_hubungan" type="text" class="assessment-ugd-line-input" placeholder="hubungan dengan pasien">',
                '                    </div>',
                '                  </div>',
                '                  <div class="assessment-ugd-field-block"><label class="assessment-ugd-field-label">Keluhan Utama</label><textarea id="assessment_keluhan_utama" class="assessment-ugd-textarea is-tall"></textarea></div>',
                '                  <div class="assessment-ugd-field-block"><label class="assessment-ugd-field-label">Perjalanan Penyakit</label><textarea id="assessment_perjalanan_penyakit" class="assessment-ugd-textarea is-tall"></textarea></div>',
                '                  <div class="assessment-ugd-field-block">',
                '                    <label class="assessment-ugd-field-label">Riwayat Penggunaan Obat</label>',
                '                    <div class="assessment-ugd-checkline">',
                '                      <label class="assessment-ugd-checkitem"><input id="assessment_obat_tidak" type="checkbox"> Tidak Ada</label>',
                '                      <label class="assessment-ugd-checkitem"><input id="assessment_obat_ada" type="checkbox"> Ada</label>',
                '                      <span>Tuliskan :</span><input id="assessment_obat_keterangan" type="text" class="assessment-ugd-line-input" placeholder="nama obat / catatan">',
                '                    </div>',
                '                  </div>',
                '                  <div class="assessment-ugd-field-block"><label class="assessment-ugd-field-label">Riwayat Penyakit Dahulu</label><textarea id="assessment_penyakit_dahulu" class="assessment-ugd-textarea is-tall"></textarea></div>',
                '                  <div class="assessment-ugd-field-block">',
                '                    <label class="assessment-ugd-field-label is-underlined">Status General</label>',
                '                    <div class="assessment-ugd-checkline">',
                '                      <span>Kondisi Umum :</span>',
                '                      <label class="assessment-ugd-checkitem"><input id="assessment_status_baik" type="checkbox"> Baik</label>',
                '                      <label class="assessment-ugd-checkitem"><input id="assessment_status_tampak_sakit" type="checkbox"> Tampak Sakit</label>',
                '                      <label class="assessment-ugd-checkitem"><input id="assessment_status_sesak" type="checkbox"> Sesak</label>',
                '                      <label class="assessment-ugd-checkitem"><input id="assessment_status_pucat" type="checkbox"> Pucat</label>',
                '                      <label class="assessment-ugd-checkitem"><input id="assessment_status_lemah" type="checkbox"> Lemah</label>',
                '                      <label class="assessment-ugd-checkitem"><input id="assessment_status_kejang" type="checkbox"> Kejang</label>',
                '                      <span>Lainnya :</span><input id="assessment_status_lainnya" type="text" class="assessment-ugd-line-input" placeholder="isi bila ada">',
                '                    </div>',
                '                  </div>',
                '                </div>',
                '              </div>',
                '            </section>',
                '            <section class="assessment-ugd-sheet">',
                '              <div class="assessment-ugd-section-box">',
                '                <div class="assessment-ugd-section-head">STATUS LOKALIS (Tandai lokasi yang tidak normal)</div>',
                '                <div class="assessment-ugd-section-body assessment-ugd-lokalis">',
                '                  <div class="assessment-ugd-lokalis-grid">',
                '                    <div class="assessment-ugd-body-card">Tampak Depan</div>',
                '                    <div class="assessment-ugd-body-card">Tampak Belakang</div>',
                '                    <div class="assessment-ugd-body-card">Tampak Samping Kiri</div>',
                '                    <div class="assessment-ugd-body-card">Tampak Samping Kanan</div>',
                '                  </div>',
                '                  <div class="assessment-ugd-body-note">',
                '                    <textarea id="assessment_status_lokalis" class="assessment-ugd-textarea is-tall" placeholder="Catatan status lokalis / lokasi yang tidak normal"></textarea>',
                '                  </div>',
                '                </div>',
                '              </div>',
                '              <div class="assessment-ugd-section-box">',
                '                <div class="assessment-ugd-section-head">DOKTER DAN PERAWAT</div>',
                '                <div class="assessment-ugd-section-body">',
                '                  <div id="assessmentDiagnosisReadonlyNote" class="assessment-ugd-readonly-note hidden">Diagnosis kerja / banding hanya dapat diubah oleh dokter.</div>',
                '                  <div class="assessment-ugd-field-block">',
                '                    <label class="assessment-ugd-field-label assessment-ugd-field-label">Diagnosis kerja / Diagnosis Banding</label>',
                '                    <textarea id="assessment_diagnosis" class="assessment-ugd-textarea assessment-ugd-diagnosis"></textarea>',
                '                  </div>',
                '                  <table class="assessment-ugd-log-table">',
                '                    <thead>',
                '                      <tr>',
                '                        <th colspan="2">Instruksi Dokter</th>',
                '                        <th colspan="2">Tindakan Keperawatan</th>',
                '                      </tr>',
                '                      <tr>',
                '                        <th>Jam</th><th>Instruksi</th><th>Jam</th><th>Tindakan</th>',
                '                      </tr>',
                '                    </thead>',
                '                    <tbody id="assessmentLogRows"></tbody>',
                '                  </table>',
                '                  <div id="assessmentDoctorEntryBlock">',
                '                    <div class="assessment-ugd-role-pill is-doctor">Tambah Instruksi Dokter</div>',
                '                    <div id="assessmentDoctorEntryReadonly" class="assessment-ugd-readonly-note hidden">Kolom ini hanya bisa ditambah oleh dokter.</div>',
                '                    <div class="assessment-ugd-entry-form">',
                '                      <input id="assessmentDoctorEntryTime" type="text" class="assessment-ugd-line-input" placeholder="Jam">',
                '                      <textarea id="assessmentDoctorEntryText" class="assessment-ugd-textarea" placeholder="Tulis instruksi dokter"></textarea>',
                '                      <button id="assessmentDoctorAddBtn" type="button" class="assessment-ugd-btn assessment-ugd-btn-primary assessment-ugd-entry-btn">Tambah</button>',
                '                    </div>',
                '                  </div>',
                '                  <div id="assessmentNurseEntryBlock" style="margin-top: 14px;">',
                '                    <div class="assessment-ugd-role-pill is-nurse">Tambah Tindakan Keperawatan</div>',
                '                    <div id="assessmentNurseEntryReadonly" class="assessment-ugd-readonly-note hidden">Kolom ini hanya bisa ditambah oleh perawat.</div>',
                '                    <div class="assessment-ugd-entry-form">',
                '                      <input id="assessmentNurseEntryTime" type="text" class="assessment-ugd-line-input" placeholder="Jam">',
                '                      <textarea id="assessmentNurseEntryText" class="assessment-ugd-textarea" placeholder="Tulis tindakan keperawatan"></textarea>',
                '                      <button id="assessmentNurseAddBtn" type="button" class="assessment-ugd-btn assessment-ugd-btn-primary assessment-ugd-entry-btn">Tambah</button>',
                '                    </div>',
                '                  </div>',
                '                </div>',
                '              </div>',
                '              <div class="assessment-ugd-signatures">',
                '                <div class="assessment-ugd-sign-col">',
                '                  <div class="assessment-ugd-sign-head">Rencana asuhan</div>',
                '                  <div class="assessment-ugd-sign-body">',
                '                    <div id="assessmentDoctorPlanReadonly" class="assessment-ugd-readonly-note hidden">Checklist ini hanya dapat diubah oleh dokter.</div>',
                '                    <div class="assessment-ugd-checkline">',
                '                      <label class="assessment-ugd-checkitem"><input id="assessment_rencana_pulang" type="checkbox"> Pulang</label>',
                '                      <label class="assessment-ugd-checkitem"><input id="assessment_rencana_rawat_inap" type="checkbox"> Rawat inap</label>',
                '                      <label class="assessment-ugd-checkitem"><input id="assessment_rencana_permintaan_sendiri" type="checkbox"> Pulang atas permintaan sendiri</label>',
                '                      <label class="assessment-ugd-checkitem"><input id="assessment_rencana_rujuk" type="checkbox"> Rujuk</label>',
                '                    </div>',
                '                    <div style="margin-top: 12px;">Muara Badak, Tgl <input id="assessment_doctor_sign_date" type="text" class="assessment-ugd-line-input" placeholder="manual"> Jam <input id="assessment_doctor_sign_time" type="text" class="assessment-ugd-line-input" placeholder="manual"> Wita</div>',
                '                    <div style="margin-top: 4px;">Tanda Tangan dokter Jaga</div>',
                '                    <div class="assessment-ugd-sign-space"></div>',
                '                    <div>Nama : <input id="assessment_doctor_sign_name" type="text" class="assessment-ugd-line-input" placeholder="Nama dokter"></div>',
                '                  </div>',
                '                </div>',
                '                <div class="assessment-ugd-sign-col">',
                '                  <div class="assessment-ugd-sign-head">Keputusan pelayanan pasien</div>',
                '                  <div class="assessment-ugd-sign-body">',
                '                    <div id="assessmentNurseDecisionReadonly" class="assessment-ugd-readonly-note hidden">Checklist dan tanda tangan ini hanya dapat diubah oleh perawat.</div>',
                '                    <div class="assessment-ugd-checkline">',
                '                      <label class="assessment-ugd-checkitem"><input id="assessment_keputusan_preventif" type="checkbox"> Preventif</label>',
                '                      <label class="assessment-ugd-checkitem"><input id="assessment_keputusan_kuratif" type="checkbox"> Kuratif</label>',
                '                      <label class="assessment-ugd-checkitem"><input id="assessment_keputusan_paliatif" type="checkbox"> Paliatif</label>',
                '                      <label class="assessment-ugd-checkitem"><input id="assessment_keputusan_rehabilitatif" type="checkbox"> Rehabilitatif</label>',
                '                    </div>',
                '                    <div style="margin-top: 12px;">Muara Badak, Tgl <input id="assessment_nurse_sign_date" type="text" class="assessment-ugd-line-input" placeholder="manual"> Jam <input id="assessment_nurse_sign_time" type="text" class="assessment-ugd-line-input" placeholder="manual"> Wita</div>',
                '                    <div style="margin-top: 4px;">Tanda Tangan Perawat</div>',
                '                    <div class="assessment-ugd-sign-space"></div>',
                '                    <div>Nama : <input id="assessment_nurse_sign_name" type="text" class="assessment-ugd-line-input" placeholder="Nama perawat"></div>',
                '                  </div>',
                '                </div>',
                '              </div>',
                '            </section>',
                '          </div>',
                '        </div>',
                '      </div>',
                '    </div>',
                '  </div>',
                '</div>'
            ].join('');
            document.body.appendChild(wrapper.firstElementChild);
        }

        function wireDom() {
            dom.modal = document.getElementById('assessmentUgdModal');
            dom.subtitle = document.getElementById('assessmentUgdSubtitle');
            dom.status = document.getElementById('assessmentUgdStatus');
            dom.roleText = document.getElementById('assessmentUgdRoleText');
            dom.realtimeText = document.getElementById('assessmentUgdRealtimeText');
            dom.closeBtn = document.getElementById('assessmentUgdCloseBtn');
            dom.refreshBtn = document.getElementById('assessmentUgdRefreshBtn');
            dom.printBtn = document.getElementById('assessmentUgdPrintBtn');
            dom.logRows = document.getElementById('assessmentLogRows');
            dom.noRm = document.getElementById('assessment_no_rm');
            dom.nama = document.getElementById('assessment_nama_pasien');
            dom.jk = document.getElementById('assessment_jk');
            dom.tanggalLahir = document.getElementById('assessment_tanggal_lahir');

            dom.doctorReadonlyNote = document.getElementById('assessmentDoctorReadonlyNote');
            dom.diagnosisReadonlyNote = document.getElementById('assessmentDiagnosisReadonlyNote');
            dom.doctorEntryReadonly = document.getElementById('assessmentDoctorEntryReadonly');
            dom.nurseEntryReadonly = document.getElementById('assessmentNurseEntryReadonly');
            dom.doctorPlanReadonly = document.getElementById('assessmentDoctorPlanReadonly');
            dom.nurseDecisionReadonly = document.getElementById('assessmentNurseDecisionReadonly');

            dom.doctorAddBtn = document.getElementById('assessmentDoctorAddBtn');
            dom.nurseAddBtn = document.getElementById('assessmentNurseAddBtn');
            dom.doctorEntryTime = document.getElementById('assessmentDoctorEntryTime');
            dom.doctorEntryText = document.getElementById('assessmentDoctorEntryText');
            dom.nurseEntryTime = document.getElementById('assessmentNurseEntryTime');
            dom.nurseEntryText = document.getElementById('assessmentNurseEntryText');

            dom.inputs = {
                tanggal: document.getElementById('assessment_tanggal'),
                jam: document.getElementById('assessment_jam'),
                airway: document.getElementById('assessment_airway'),
                breathing: document.getElementById('assessment_breathing'),
                circulation: document.getElementById('assessment_circulation'),
                disability: document.getElementById('assessment_disability'),
                gcs: document.getElementById('assessment_gcs'),
                riwayatAnamnesis: document.getElementById('assessment_riwayat_anamnesis'),
                riwayatAlloanamnesis: document.getElementById('assessment_riwayat_alloanamnesis'),
                riwayatNama: document.getElementById('assessment_riwayat_nama'),
                riwayatHubungan: document.getElementById('assessment_riwayat_hubungan'),
                keluhanUtama: document.getElementById('assessment_keluhan_utama'),
                perjalananPenyakit: document.getElementById('assessment_perjalanan_penyakit'),
                obatTidak: document.getElementById('assessment_obat_tidak'),
                obatAda: document.getElementById('assessment_obat_ada'),
                obatKeterangan: document.getElementById('assessment_obat_keterangan'),
                penyakitDahulu: document.getElementById('assessment_penyakit_dahulu'),
                statusBaik: document.getElementById('assessment_status_baik'),
                statusTampakSakit: document.getElementById('assessment_status_tampak_sakit'),
                statusSesak: document.getElementById('assessment_status_sesak'),
                statusPucat: document.getElementById('assessment_status_pucat'),
                statusLemah: document.getElementById('assessment_status_lemah'),
                statusKejang: document.getElementById('assessment_status_kejang'),
                statusLainnya: document.getElementById('assessment_status_lainnya'),
                statusLokalis: document.getElementById('assessment_status_lokalis'),
                diagnosis: document.getElementById('assessment_diagnosis'),
                rencanaPulang: document.getElementById('assessment_rencana_pulang'),
                rencanaRawatInap: document.getElementById('assessment_rencana_rawat_inap'),
                rencanaPermintaanSendiri: document.getElementById('assessment_rencana_permintaan_sendiri'),
                rencanaRujuk: document.getElementById('assessment_rencana_rujuk'),
                keputusanPreventif: document.getElementById('assessment_keputusan_preventif'),
                keputusanKuratif: document.getElementById('assessment_keputusan_kuratif'),
                keputusanPaliatif: document.getElementById('assessment_keputusan_paliatif'),
                keputusanRehabilitatif: document.getElementById('assessment_keputusan_rehabilitatif'),
                doctorSignDate: document.getElementById('assessment_doctor_sign_date'),
                doctorSignTime: document.getElementById('assessment_doctor_sign_time'),
                doctorSignName: document.getElementById('assessment_doctor_sign_name'),
                nurseSignDate: document.getElementById('assessment_nurse_sign_date'),
                nurseSignTime: document.getElementById('assessment_nurse_sign_time'),
                nurseSignName: document.getElementById('assessment_nurse_sign_name')
            };
        }

        function wireEvents() {
            dom.closeBtn.addEventListener('click', closeModal);
            dom.refreshBtn.addEventListener('click', function() {
                if (!state.currentPatient) return;
                refreshCurrentPatient(true);
            });
            dom.printBtn.addEventListener('click', function() {
                document.body.classList.add('assessment-ugd-print');
                window.print();
                window.setTimeout(function() {
                    document.body.classList.remove('assessment-ugd-print');
                }, 150);
            });
            dom.modal.addEventListener('click', function(event) {
                if (event.target === dom.modal || event.target === dom.modal.querySelector('.assessment-ugd-overlay')) {
                    closeModal();
                }
            });

            Object.keys(dom.inputs).forEach(function(key) {
                const input = dom.inputs[key];
                if (!input) return;
                input.addEventListener('input', onDoctorFieldInput);
                input.addEventListener('change', onDoctorFieldInput);
            });

            dom.doctorAddBtn.addEventListener('click', function() {
                addEntry('doctor');
            });
            dom.nurseAddBtn.addEventListener('click', function() {
                addEntry('nurse');
            });

            window.addEventListener('afterprint', function() {
                document.body.classList.remove('assessment-ugd-print');
            });
        }

        function renderRekapButton(patient) {
            const patientData = buildPatientSnapshot(patient);
            return '<button type="button" class="assessment-ugd-btn-trigger assessment-ugd-trigger" data-assessment-patient="' +
                escapeHtml(JSON.stringify(patientData)) +
                '">Asesmen UGD</button>';
        }

        function handleRekapButtonClick(buttonEl) {
            if (!buttonEl) return;
            try {
                const payload = JSON.parse(buttonEl.dataset.assessmentPatient || '{}');
                openAssessmentFromPayload(payload);
            } catch (err) {
                setStatus('Gagal membaca data pasien untuk asesmen UGD.', 'error');
                console.error(err);
            }
        }

        async function openAssessmentFromPayload(patientData) {
            if (!canAccessAssessment()) return;
            const patientId = String(patientData?.id || '').trim();
            if (!patientId) {
                setStatus('Data pasien UGD belum memiliki ID kunjungan.', 'error');
                return;
            }

            state.currentPatient = buildPatientSnapshot(patientData);
            dom.modal.classList.add('is-open');
            document.body.style.overflow = 'hidden';
            setStatus('Memuat asesmen UGD...', 'info');

            await withPageLoading('Memuat asesmen UGD...', async function() {
                await refreshCurrentPatient(false);
            });
        }

        async function refreshCurrentPatient(showLoadingStatus) {
            if (!state.currentPatient?.id) return;
            if (showLoadingStatus) {
                setStatus('Menyegarkan data asesmen...', 'info');
            }

            try {
                const patientRow = await fetchPatientRow(state.currentPatient.id);
                state.currentPatient = buildPatientSnapshot(patientRow);
                state.currentAssessment = readAssessment(patientRow);
                renderPatientHeader();
                renderAssessment();
                subscribeToPatientRow(state.currentPatient.id);
                setStatus('Data asesmen sinkron.', 'success');
            } catch (err) {
                setStatus('Gagal memuat asesmen: ' + (err?.message || String(err)), 'error');
            }
        }

        async function fetchPatientRow(patientId) {
            const result = await withTimeout(
                supabaseClient
                    .from('pasien')
                    .select('id,no_rm,no_registrasi,nama_pasien,jenis_kelamin,tanggal_lahir,umur,unit,no_antrian,triase_ugd_data')
                    .eq('id', patientId)
                    .limit(1)
                    .maybeSingle(),
                15000,
                'Muat asesmen UGD'
            );

            if (result?.error) throw new Error(result.error.message);
            if (!result?.data) throw new Error('Pasien tidak ditemukan.');
            return result.data;
        }

        function buildPatientSnapshot(patient) {
            return {
                id: String(patient?.id || '').trim(),
                no_rm: String(patient?.no_rm || '').trim(),
                no_registrasi: String(patient?.no_registrasi || '').trim(),
                nama_pasien: String(patient?.nama_pasien || '').trim(),
                jenis_kelamin: String(patient?.jenis_kelamin || '').trim(),
                tanggal_lahir: patient?.tanggal_lahir || '',
                umur: patient?.umur ?? '',
                unit: String(patient?.unit || '').trim(),
                no_antrian: patient?.no_antrian ?? '',
                triase_ugd_data: patient?.triase_ugd_data ?? null
            };
        }

        function safeParseJson(value) {
            if (!value) return {};
            if (typeof value === 'object') return value;
            try {
                const parsed = JSON.parse(value);
                return parsed && typeof parsed === 'object' ? parsed : {};
            } catch (_err) {
                return {};
            }
        }

        function readAssessment(patientRow) {
            const root = safeParseJson(patientRow?.triase_ugd_data);
            const base = root.assessment_ugd && typeof root.assessment_ugd === 'object' ? root.assessment_ugd : {};
            const doctor = base.doctor && typeof base.doctor === 'object' ? base.doctor : {};
            const nurse = base.nurse && typeof base.nurse === 'object' ? base.nurse : {};
            return {
                doctor: {
                    tanggal: String(doctor.tanggal || ''),
                    jam: String(doctor.jam || ''),
                    airway: String(doctor.airway || ''),
                    breathing: String(doctor.breathing || ''),
                    circulation: String(doctor.circulation || ''),
                    disability: String(doctor.disability || ''),
                    gcs: String(doctor.gcs || ''),
                    riwayat_anamnesis: Boolean(doctor.riwayat_anamnesis),
                    riwayat_alloanamnesis: Boolean(doctor.riwayat_alloanamnesis),
                    riwayat_nama: String(doctor.riwayat_nama || ''),
                    riwayat_hubungan: String(doctor.riwayat_hubungan || ''),
                    keluhan_utama: String(doctor.keluhan_utama || ''),
                    perjalanan_penyakit: String(doctor.perjalanan_penyakit || ''),
                    obat_tidak: Boolean(doctor.obat_tidak),
                    obat_ada: Boolean(doctor.obat_ada),
                    obat_keterangan: String(doctor.obat_keterangan || ''),
                    penyakit_dahulu: String(doctor.penyakit_dahulu || ''),
                    status_baik: Boolean(doctor.status_baik),
                    status_tampak_sakit: Boolean(doctor.status_tampak_sakit),
                    status_sesak: Boolean(doctor.status_sesak),
                    status_pucat: Boolean(doctor.status_pucat),
                    status_lemah: Boolean(doctor.status_lemah),
                    status_kejang: Boolean(doctor.status_kejang),
                    status_lainnya: String(doctor.status_lainnya || ''),
                    status_lokalis: String(doctor.status_lokalis || ''),
                    diagnosis: String(doctor.diagnosis || ''),
                    rencana_pulang: Boolean(doctor.rencana_pulang),
                    rencana_rawat_inap: Boolean(doctor.rencana_rawat_inap),
                    rencana_permintaan_sendiri: Boolean(doctor.rencana_permintaan_sendiri),
                    rencana_rujuk: Boolean(doctor.rencana_rujuk),
                    sign_date: String(doctor.sign_date || ''),
                    sign_time: String(doctor.sign_time || ''),
                    sign_name: String(doctor.sign_name || '')
                },
                nurse: {
                    keputusan_preventif: Boolean(nurse.keputusan_preventif),
                    keputusan_kuratif: Boolean(nurse.keputusan_kuratif),
                    keputusan_paliatif: Boolean(nurse.keputusan_paliatif),
                    keputusan_rehabilitatif: Boolean(nurse.keputusan_rehabilitatif),
                    sign_date: String(nurse.sign_date || ''),
                    sign_time: String(nurse.sign_time || ''),
                    sign_name: String(nurse.sign_name || '')
                },
                doctorInstructions: Array.isArray(base.doctor_instructions) ? base.doctor_instructions : [],
                nurseActions: Array.isArray(base.nurse_actions) ? base.nurse_actions : [],
                updated_at: String(base.updated_at || ''),
                updated_by_role: String(base.updated_by_role || ''),
                updated_by_name: String(base.updated_by_name || '')
            };
        }

        function renderPatientHeader() {
            const patient = state.currentPatient || {};
            dom.noRm.textContent = patient.no_rm || '-';
            dom.nama.textContent = patient.nama_pasien || '-';
            dom.jk.textContent = patient.jenis_kelamin || '-';
            dom.tanggalLahir.textContent = formatBirthDate(patient.tanggal_lahir || '') || '-';
            dom.subtitle.textContent = 'Pasien ' + (patient.nama_pasien || '-') + ' - No REG ' + (patient.no_registrasi || '-');
            dom.roleText.textContent = isDoctorRole()
                ? 'Dokter dapat mengisi halaman 1, diagnosis, instruksi dokter, dan tanda tangan dokter.'
                : 'Perawat dapat melihat halaman dokter dan menambah tindakan keperawatan serta tanda tangan perawat.';
            dom.realtimeText.textContent = 'Data disimpan ke kolom triase UGD pada kunjungan pasien yang sama. Perubahan baru akan dimuat ulang saat ada update pada data pasien.';
        }

        function renderAssessment() {
            const data = state.currentAssessment || readAssessment(state.currentPatient);
            const isDoctor = isDoctorRole();
            const isPerawat = isPerawatRole();

            setInputValue(dom.inputs.tanggal, data.doctor.tanggal);
            setInputValue(dom.inputs.jam, data.doctor.jam);
            setInputValue(dom.inputs.airway, data.doctor.airway);
            setInputValue(dom.inputs.breathing, data.doctor.breathing);
            setInputValue(dom.inputs.circulation, data.doctor.circulation);
            setInputValue(dom.inputs.disability, data.doctor.disability);
            setInputValue(dom.inputs.gcs, data.doctor.gcs);
            setChecked(dom.inputs.riwayatAnamnesis, data.doctor.riwayat_anamnesis);
            setChecked(dom.inputs.riwayatAlloanamnesis, data.doctor.riwayat_alloanamnesis);
            setInputValue(dom.inputs.riwayatNama, data.doctor.riwayat_nama);
            setInputValue(dom.inputs.riwayatHubungan, data.doctor.riwayat_hubungan);
            setInputValue(dom.inputs.keluhanUtama, data.doctor.keluhan_utama);
            setInputValue(dom.inputs.perjalananPenyakit, data.doctor.perjalanan_penyakit);
            setChecked(dom.inputs.obatTidak, data.doctor.obat_tidak);
            setChecked(dom.inputs.obatAda, data.doctor.obat_ada);
            setInputValue(dom.inputs.obatKeterangan, data.doctor.obat_keterangan);
            setInputValue(dom.inputs.penyakitDahulu, data.doctor.penyakit_dahulu);
            setChecked(dom.inputs.statusBaik, data.doctor.status_baik);
            setChecked(dom.inputs.statusTampakSakit, data.doctor.status_tampak_sakit);
            setChecked(dom.inputs.statusSesak, data.doctor.status_sesak);
            setChecked(dom.inputs.statusPucat, data.doctor.status_pucat);
            setChecked(dom.inputs.statusLemah, data.doctor.status_lemah);
            setChecked(dom.inputs.statusKejang, data.doctor.status_kejang);
            setInputValue(dom.inputs.statusLainnya, data.doctor.status_lainnya);
            setInputValue(dom.inputs.statusLokalis, data.doctor.status_lokalis);
            setInputValue(dom.inputs.diagnosis, data.doctor.diagnosis);
            setChecked(dom.inputs.rencanaPulang, data.doctor.rencana_pulang);
            setChecked(dom.inputs.rencanaRawatInap, data.doctor.rencana_rawat_inap);
            setChecked(dom.inputs.rencanaPermintaanSendiri, data.doctor.rencana_permintaan_sendiri);
            setChecked(dom.inputs.rencanaRujuk, data.doctor.rencana_rujuk);
            setInputValue(dom.inputs.doctorSignDate, data.doctor.sign_date);
            setInputValue(dom.inputs.doctorSignTime, data.doctor.sign_time);
            setInputValue(dom.inputs.doctorSignName, data.doctor.sign_name);

            setChecked(dom.inputs.keputusanPreventif, data.nurse.keputusan_preventif);
            setChecked(dom.inputs.keputusanKuratif, data.nurse.keputusan_kuratif);
            setChecked(dom.inputs.keputusanPaliatif, data.nurse.keputusan_paliatif);
            setChecked(dom.inputs.keputusanRehabilitatif, data.nurse.keputusan_rehabilitatif);
            setInputValue(dom.inputs.nurseSignDate, data.nurse.sign_date);
            setInputValue(dom.inputs.nurseSignTime, data.nurse.sign_time);
            setInputValue(dom.inputs.nurseSignName, data.nurse.sign_name);

            const doctorEditableIds = new Set([
                'tanggal', 'jam', 'airway', 'breathing', 'circulation', 'disability', 'gcs',
                'riwayatAnamnesis', 'riwayatAlloanamnesis', 'riwayatNama', 'riwayatHubungan',
                'keluhanUtama', 'perjalananPenyakit', 'obatTidak', 'obatAda', 'obatKeterangan',
                'penyakitDahulu', 'statusBaik', 'statusTampakSakit', 'statusSesak', 'statusPucat',
                'statusLemah', 'statusKejang', 'statusLainnya', 'statusLokalis', 'diagnosis',
                'rencanaPulang', 'rencanaRawatInap', 'rencanaPermintaanSendiri', 'rencanaRujuk',
                'doctorSignDate', 'doctorSignTime', 'doctorSignName'
            ]);
            const nurseEditableIds = new Set([
                'keputusanPreventif', 'keputusanKuratif', 'keputusanPaliatif',
                'keputusanRehabilitatif', 'nurseSignDate', 'nurseSignTime', 'nurseSignName'
            ]);

            Object.keys(dom.inputs).forEach(function(key) {
                const input = dom.inputs[key];
                if (!input) return;
                const canEdit = (doctorEditableIds.has(key) && isDoctor) || (nurseEditableIds.has(key) && isPerawat);
                input.disabled = !canEdit;
            });

            toggleHidden(dom.doctorReadonlyNote, isDoctor);
            toggleHidden(dom.diagnosisReadonlyNote, isDoctor);
            toggleHidden(dom.doctorEntryReadonly, isDoctor);
            toggleHidden(dom.nurseEntryReadonly, isPerawat);
            toggleHidden(dom.doctorPlanReadonly, isDoctor);
            toggleHidden(dom.nurseDecisionReadonly, isPerawat);

            dom.doctorAddBtn.disabled = !isDoctor;
            dom.nurseAddBtn.disabled = !isPerawat;
            dom.doctorEntryTime.disabled = !isDoctor;
            dom.doctorEntryText.disabled = !isDoctor;
            dom.nurseEntryTime.disabled = !isPerawat;
            dom.nurseEntryText.disabled = !isPerawat;

            renderCombinedRows(data.doctorInstructions, data.nurseActions);
        }

        function renderCombinedRows(doctorInstructions, nurseActions) {
            const maxLength = Math.max(doctorInstructions.length, nurseActions.length, 1);
            const rows = [];

            for (let index = 0; index < maxLength; index += 1) {
                const doctorEntry = doctorInstructions[index];
                const nurseEntry = nurseActions[index];
                rows.push(
                    '<tr>' +
                    '<td>' + escapeHtml(doctorEntry?.jam_manual || '') + '</td>' +
                    '<td><div class="assessment-ugd-log-text">' + escapeHtml(doctorEntry?.text || '') + '</div>' +
                    (doctorEntry ? '<span class="assessment-ugd-log-meta">' + escapeHtml(formatLogMeta(doctorEntry)) + '</span>' : '') +
                    '</td>' +
                    '<td>' + escapeHtml(nurseEntry?.jam_manual || '') + '</td>' +
                    '<td><div class="assessment-ugd-log-text">' + escapeHtml(nurseEntry?.text || '') + '</div>' +
                    (nurseEntry ? '<span class="assessment-ugd-log-meta">' + escapeHtml(formatLogMeta(nurseEntry)) + '</span>' : '') +
                    '</td>' +
                    '</tr>'
                );
            }

            dom.logRows.innerHTML = rows.join('');
        }

        function formatLogMeta(entry) {
            const actor = String(entry?.created_by_name || entry?.created_by_email || '').trim();
            const stamp = String(entry?.created_at || '').trim();
            if (actor && stamp) return actor + ' - ' + formatDateTime(stamp);
            if (actor) return actor;
            if (stamp) return formatDateTime(stamp);
            return '';
        }

        function formatDateTime(value) {
            if (!value) return '';
            const date = new Date(value);
            if (Number.isNaN(date.getTime())) return String(value);
            const dd = String(date.getDate()).padStart(2, '0');
            const mm = String(date.getMonth() + 1).padStart(2, '0');
            const yyyy = date.getFullYear();
            const hh = String(date.getHours()).padStart(2, '0');
            const min = String(date.getMinutes()).padStart(2, '0');
            return dd + '-' + mm + '-' + yyyy + ' ' + hh + ':' + min;
        }

        function setInputValue(el, value) {
            if (!el) return;
            const safeValue = value == null ? '' : String(value);
            if (el.value !== safeValue) {
                el.value = safeValue;
            }
        }

        function setChecked(el, value) {
            if (!el) return;
            el.checked = Boolean(value);
        }

        function toggleHidden(el, editable) {
            if (!el) return;
            el.classList.toggle('hidden', editable);
        }

        function setStatus(message, tone) {
            dom.status.textContent = message || 'Siap';
            dom.status.classList.remove('is-error', 'is-success');
            if (tone === 'error') {
                dom.status.classList.add('is-error');
            } else if (tone === 'success') {
                dom.status.classList.add('is-success');
            }
        }

        function collectDoctorFields() {
            return {
                tanggal: dom.inputs.tanggal.value.trim(),
                jam: dom.inputs.jam.value.trim(),
                airway: dom.inputs.airway.value.trim(),
                breathing: dom.inputs.breathing.value.trim(),
                circulation: dom.inputs.circulation.value.trim(),
                disability: dom.inputs.disability.value.trim(),
                gcs: dom.inputs.gcs.value.trim(),
                riwayat_anamnesis: dom.inputs.riwayatAnamnesis.checked,
                riwayat_alloanamnesis: dom.inputs.riwayatAlloanamnesis.checked,
                riwayat_nama: dom.inputs.riwayatNama.value.trim(),
                riwayat_hubungan: dom.inputs.riwayatHubungan.value.trim(),
                keluhan_utama: dom.inputs.keluhanUtama.value.trim(),
                perjalanan_penyakit: dom.inputs.perjalananPenyakit.value.trim(),
                obat_tidak: dom.inputs.obatTidak.checked,
                obat_ada: dom.inputs.obatAda.checked,
                obat_keterangan: dom.inputs.obatKeterangan.value.trim(),
                penyakit_dahulu: dom.inputs.penyakitDahulu.value.trim(),
                status_baik: dom.inputs.statusBaik.checked,
                status_tampak_sakit: dom.inputs.statusTampakSakit.checked,
                status_sesak: dom.inputs.statusSesak.checked,
                status_pucat: dom.inputs.statusPucat.checked,
                status_lemah: dom.inputs.statusLemah.checked,
                status_kejang: dom.inputs.statusKejang.checked,
                status_lainnya: dom.inputs.statusLainnya.value.trim(),
                status_lokalis: dom.inputs.statusLokalis.value.trim(),
                diagnosis: dom.inputs.diagnosis.value.trim(),
                rencana_pulang: dom.inputs.rencanaPulang.checked,
                rencana_rawat_inap: dom.inputs.rencanaRawatInap.checked,
                rencana_permintaan_sendiri: dom.inputs.rencanaPermintaanSendiri.checked,
                rencana_rujuk: dom.inputs.rencanaRujuk.checked,
                sign_date: dom.inputs.doctorSignDate.value.trim(),
                sign_time: dom.inputs.doctorSignTime.value.trim(),
                sign_name: dom.inputs.doctorSignName.value.trim()
            };
        }

        function collectNurseFields() {
            return {
                keputusan_preventif: dom.inputs.keputusanPreventif.checked,
                keputusan_kuratif: dom.inputs.keputusanKuratif.checked,
                keputusan_paliatif: dom.inputs.keputusanPaliatif.checked,
                keputusan_rehabilitatif: dom.inputs.keputusanRehabilitatif.checked,
                sign_date: dom.inputs.nurseSignDate.value.trim(),
                sign_time: dom.inputs.nurseSignTime.value.trim(),
                sign_name: dom.inputs.nurseSignName.value.trim()
            };
        }

        function onDoctorFieldInput() {
            if (!state.currentPatient?.id) return;
            if (isDoctorRole()) {
                if (state.saveTimer) window.clearTimeout(state.saveTimer);
                state.saveTimer = window.setTimeout(function() {
                    persistDoctorPage();
                }, 650);
                return;
            }

            if (isPerawatRole()) {
                if (state.saveTimer) window.clearTimeout(state.saveTimer);
                state.saveTimer = window.setTimeout(function() {
                    persistNurseMeta();
                }, 650);
            }
        }

        async function persistDoctorPage() {
            if (!state.currentPatient?.id || !isDoctorRole()) return;
            const doctorPayload = collectDoctorFields();
            try {
                await persistAssessment(function(root) {
                    root.doctor = doctorPayload;
                    return root;
                }, 'Menyimpan asesmen dokter...');
                state.currentAssessment.doctor = doctorPayload;
                setStatus('Perubahan dokter tersimpan.', 'success');
            } catch (err) {
                setStatus('Gagal menyimpan asesmen dokter: ' + (err?.message || String(err)), 'error');
            }
        }

        async function persistNurseMeta() {
            if (!state.currentPatient?.id || !isPerawatRole()) return;
            const nursePayload = collectNurseFields();
            try {
                await persistAssessment(function(root) {
                    root.nurse = nursePayload;
                    return root;
                }, 'Menyimpan data perawat...');
                state.currentAssessment.nurse = nursePayload;
                setStatus('Perubahan perawat tersimpan.', 'success');
            } catch (err) {
                setStatus('Gagal menyimpan data perawat: ' + (err?.message || String(err)), 'error');
            }
        }

        async function addEntry(type) {
            if (!state.currentPatient?.id) return;
            const isDoctor = type === 'doctor';
            if (isDoctor && !isDoctorRole()) return;
            if (!isDoctor && !isPerawatRole()) return;

            const timeInput = isDoctor ? dom.doctorEntryTime : dom.nurseEntryTime;
            const textInput = isDoctor ? dom.doctorEntryText : dom.nurseEntryText;
            const jamManual = String(timeInput.value || '').trim();
            const text = String(textInput.value || '').trim();

            if (!jamManual || !text) {
                setStatus('Jam dan isi catatan wajib diisi sebelum ditambahkan.', 'error');
                return;
            }

            const entry = {
                id: 'entry-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
                jam_manual: jamManual,
                text: text,
                created_at: new Date().toISOString(),
                created_by_name: String(getCurrentOperatorName() || '').trim(),
                created_by_email: String(getCurrentOperatorEmail() || '').trim(),
                created_by_role: isDoctor ? 'dokter' : 'perawat'
            };

            try {
                await persistAssessment(function(root) {
                    if (isDoctor) {
                        const nextDoctor = Array.isArray(root.doctor_instructions) ? root.doctor_instructions.slice() : [];
                        nextDoctor.push(entry);
                        root.doctor_instructions = nextDoctor;
                    } else {
                        const nextNurse = Array.isArray(root.nurse_actions) ? root.nurse_actions.slice() : [];
                        nextNurse.push(entry);
                        root.nurse_actions = nextNurse;
                    }
                    return root;
                }, 'Menyimpan catatan baru...');

                if (isDoctor) {
                    state.currentAssessment.doctorInstructions = state.currentAssessment.doctorInstructions.concat([entry]);
                    dom.doctorEntryTime.value = '';
                    dom.doctorEntryText.value = '';
                } else {
                    state.currentAssessment.nurseActions = state.currentAssessment.nurseActions.concat([entry]);
                    dom.nurseEntryTime.value = '';
                    dom.nurseEntryText.value = '';
                }

                renderCombinedRows(state.currentAssessment.doctorInstructions, state.currentAssessment.nurseActions);
                setStatus('Catatan baru berhasil ditambahkan.', 'success');
            } catch (err) {
                setStatus('Gagal menambah catatan: ' + (err?.message || String(err)), 'error');
            }
        }

        async function persistAssessment(mutator, loadingLabel) {
            const patientId = state.currentPatient?.id;
            if (!patientId) throw new Error('Pasien asesmen belum dipilih.');

            state.lastWriteAt = Date.now();
            setStatus(loadingLabel || 'Menyimpan...', 'info');

            const latestPatient = await fetchPatientRow(patientId);
            const latestRoot = safeParseJson(latestPatient.triase_ugd_data);
            const latestAssessment = readAssessment(latestPatient);
            const nextAssessment = {
                doctor: latestAssessment.doctor,
                nurse: latestAssessment.nurse,
                doctor_instructions: latestAssessment.doctorInstructions.slice(),
                nurse_actions: latestAssessment.nurseActions.slice(),
                updated_at: new Date().toISOString(),
                updated_by_role: isDoctorRole() ? 'dokter' : (isPerawatRole() ? 'perawat' : ''),
                updated_by_name: String(getCurrentOperatorName() || '').trim()
            };

            const mutated = mutator(nextAssessment) || nextAssessment;
            latestRoot.assessment_ugd = mutated;

            let updateResult = await withTimeout(
                supabaseClient
                    .from('pasien')
                    .update({ triase_ugd_data: latestRoot })
                    .eq('id', patientId),
                15000,
                'Simpan asesmen UGD'
            );

            if (updateResult?.error) {
                updateResult = await withTimeout(
                    supabaseClient
                        .from('pasien')
                        .update({ triase_ugd_data: JSON.stringify(latestRoot) })
                        .eq('id', patientId),
                    15000,
                    'Simpan asesmen UGD fallback'
                );
            }

            if (updateResult?.error) {
                throw new Error(updateResult.error.message);
            }

            state.currentAssessment = {
                doctor: mutated.doctor || latestAssessment.doctor,
                nurse: mutated.nurse || latestAssessment.nurse,
                doctorInstructions: Array.isArray(mutated.doctor_instructions) ? mutated.doctor_instructions : latestAssessment.doctorInstructions,
                nurseActions: Array.isArray(mutated.nurse_actions) ? mutated.nurse_actions : latestAssessment.nurseActions,
                updated_at: mutated.updated_at || '',
                updated_by_role: mutated.updated_by_role || '',
                updated_by_name: mutated.updated_by_name || ''
            };

            if (state.broadcastChannel) {
                state.broadcastChannel.postMessage({ patientId: patientId });
            }
        }

        function subscribeToPatientRow(patientId) {
            unsubscribe();
            const channelName = 'assessment-ugd-patient-' + String(patientId);
            state.subscription = supabaseClient
                .channel(channelName)
                .on('postgres_changes', {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'pasien',
                    filter: 'id=eq.' + String(patientId)
                }, function() {
                    if (!dom.modal.classList.contains('is-open')) return;
                    if (Date.now() - state.lastWriteAt < 1000) return;
                    refreshCurrentPatient(false);
                })
                .subscribe();
        }

        function unsubscribe() {
            if (!state.subscription) return;
            try {
                supabaseClient.removeChannel(state.subscription);
            } catch (_err) {
                /* noop */
            }
            state.subscription = null;
        }

        function closeModal() {
            dom.modal.classList.remove('is-open');
            document.body.style.overflow = '';
            if (state.saveTimer) {
                window.clearTimeout(state.saveTimer);
                state.saveTimer = null;
            }
            unsubscribe();
        }
    }

    window.createUgdAssessmentModule = createUgdAssessmentModule;
})();
