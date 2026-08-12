(function () {
    'use strict';

    // ============================================================
    // REGISTRY SKEMA ASESMEN TERDEPAN (SIMAMI_ASSESSMENT_SCHEMAS)
    // ------------------------------------------------------------
    // Scaffold KOSONG untuk 3 formulir sesuai OPSI B - Standar RS.
    // MAPPING FIELD AKAN DILENGKAPI SETELAH PDF FORMULIR INTERNAL RS
    // DITERIMA USER (taruh di folder: documents/).
    // ============================================================

    window.SIMAMI_ASSESSMENT_SCHEMAS = window.SIMAMI_ASSESSMENT_SCHEMAS || {};

    // ------------------------------------------------------------
    // 1. SKEMA TRIASE UGD (Internal RS, 5 kategori)
    // ------------------------------------------------------------
    window.SIMAMI_ASSESSMENT_SCHEMAS.TRIASE_UGD = {
        id: 'triase_ugd',
        label: 'Triase UGD Internal',
        table: 'triase_ugd',
        jsonbColumn: 'triase_data',
        title: 'TRIASE AWAL PASIEN UGD (FORMULIR INTERNAL RS)',
        subtitle: 'Triase 5 Kategori (Resusitasi - Nonurgent) + Airway, Breathing, Circulation, Disability, Exposure',
        requireRole: 'canAccessTriaseUgd',
        allowRoles: ['isPerawatRole', 'isPendaftaranRole', 'isDoctorRole', 'isIgdRole', 'isTriaseRole', 'isNurseStationRole', 'isSupervisorRole'],
        printOrientation: 'portrait',
        fixedMeta: {
            tanggalColumn: 'tanggal_triase',
            namaColumn: 'perawat_triase_nama',
            emailColumn: 'perawat_triase_email',
            skorColumn: 'skor_ews',
            finalizeColumn: 'is_finalized',
            finalizedAtColumn: 'finalized_at',
            finalizedByColumn: 'finalized_by'
        },
        vitalSigns: [
            { key: 'airway', label: 'Airway', priority: 1 },
            { key: 'breathing', label: 'Breathing', priority: 2 },
            { key: 'circulation', label: 'Circulation', priority: 3 },
            { key: 'disability', label: 'Disability (GCS)', priority: 4 },
            { key: 'exposure', label: 'Exposure', priority: 5 }
        ],
        ewsEnabled: true,
        finalizeEnabled: true,
        sections: [
            {
                key: 'survey_primer',
                title: '1. SURVEY PRIMER (ABCDE)',
                hint: 'Isi bagian ini pertama (Prioritas 1) untuk pasien baru UGD',
                fields: [
                    { key: 'airway', type: 'textarea', label: 'A. Airway (Jalan Nafas)', placeholder: 'Contoh: Bebas / Ada sumbatan / Guedel airway', rows: 2, required: true },
                    { key: 'breathing', type: 'textarea', label: 'B. Breathing (Pernafasan)', placeholder: 'Contoh: Spontan, RR 24 x/mnt, Simetris, ronchi -/-, wheezing -/-', rows: 2, required: true },
                    { key: 'circulation', type: 'textarea', label: 'C. Circulation (Sirkulasi)', placeholder: 'TD, nadi, CRT, akral hangat/dingin, perdarahan', rows: 2, required: true },
                    { key: 'disability', type: 'textarea', label: 'D. Disability (Kesadaran / GCS)', placeholder: 'GCS E... V... M... = Total... / Pupil isokor / anisokor', rows: 2, required: true },
                    { key: 'exposure', type: 'textarea', label: 'E. Exposure (Pemeriksaan Sekunder)', rows: 2 }
                ]
            },
            {
                key: 'anamnesis',
                title: '2. ANAMNESIS & KELUHAN UTAMA',
                fields: [
                    { key: 'keluhan_utama', type: 'textarea', label: 'Keluhan Utama', rows: 2, required: true },
                    { key: 'rps', type: 'textarea', label: 'Riwayat Penyakit Sekarang (RPS)', rows: 3 },
                    { key: 'rpd', type: 'textarea', label: 'Riwayat Penyakit Dahulu (RPD)', rows: 2 },
                    { key: 'alergi', type: 'radio-group', label: 'Riwayat Alergi', options: ['Tidak Ada', 'Obat', 'Makanan', 'Lainnya'], otherField: true }
                ]
            },
            {
                key: 'vital_sign',
                title: '3. VITAL SIGN (PENGUKURAN)',
                fields: [
                    { key: 'td_sistolik', type: 'number', label: 'TD Sistolik', min: 40, max: 260, suffix: 'mmHg', vitalSign: true },
                    { key: 'td_diastolik', type: 'number', label: 'TD Diastolik', min: 20, max: 160, suffix: 'mmHg', vitalSign: true },
                    { key: 'nadi', type: 'number', label: 'Nadi', min: 20, max: 240, suffix: 'x/menit', vitalSign: true },
                    { key: 'suhu', type: 'number', label: 'Suhu', min: 32, max: 43, step: 0.1, suffix: '°C', vitalSign: true },
                    { key: 'rr', type: 'number', label: 'RR (Pernafasan)', min: 4, max: 80, suffix: 'x/menit', vitalSign: true },
                    { key: 'spo2', type: 'number', label: 'SpO2', min: 0, max: 100, suffix: '%', vitalSign: true },
                    { key: 'gcs_total', type: 'number', label: 'GCS Total (E+V+M)', min: 3, max: 15 }
                ]
            },
            {
                key: 'keputusan',
                title: '4. KEPUTUSAN TRIASE & RENCANA',
                fields: [
                    { key: 'kategori_triase', type: 'radio-group', label: 'Kategori Triase', options: [
                        { label: '1 - RESUSITASI (MERAH)', value: 1 },
                        { label: '2 - EMERGENSI (ORANYE)', value: 2 },
                        { label: '3 - URGEN (KUNING)', value: 3 },
                        { label: '4 - KURANG URGEN (HIJAU)', value: 4 },
                        { label: '5 - NON URGEN (BIRU)', value: 5 }
                    ], required: true, mapToFixed: 'kategori_triase', mapLabelTo: 'kategori_triase_label' },
                    { key: 'rencana_tindakan', type: 'textarea', label: 'Rencana Tindakan', rows: 2 },
                    { key: 'rujuk_ke', type: 'text', label: 'Dirujuk ke / Ruang Tujuan (opsional)' }
                ]
            }
        ]
    };

    // ------------------------------------------------------------
    // 2. SKEMA ASESMEN RAWAT JALAN DEWASA (OPSI B STANDAR RS)
    // ------------------------------------------------------------
    window.SIMAMI_ASSESSMENT_SCHEMAS.RAWAT_JALAN_DEWASA = {
        id: 'rawat_jalan_dewasa',
        label: 'Asesmen Rawat Jalan Dewasa',
        table: 'asesmen_rawat_jalan_dewasa',
        jsonbColumn: 'asesmen_data',
        title: 'ASESMEN AWAL KEPERAWATAN RAWAT JALAN (DEWASA > 18 TAHUN)',
        subtitle: 'Sesuai Formulir Internal RSUD AJI MUHAMMAD IDRIS',
        requireRole: 'canAccessAssessmentRawatJalan',
        allowRoles: ['isPerawatRole', 'isPendaftaranRole', 'isDoctorRole', 'isNurseStationRole', 'isSupervisorRole'],
        printOrientation: 'portrait',
        fixedMeta: {
            tanggalColumn: 'tanggal_asesmen',
            namaColumn: 'perawat_nama',
            emailColumn: 'perawat_email',
            skorColumn: 'skor_ews',
            finalizeColumn: 'is_finalized',
            finalizedAtColumn: 'finalized_at',
            finalizedByColumn: 'finalized_by',
            keluhanUtamaColumn: 'keluhan_utama'
        },
        vitalSigns: [
            { key: 'td_sistolik', label: 'TD (mmHg)' },
            { key: 'nadi', label: 'Nadi' },
            { key: 'suhu', label: 'Suhu' },
            { key: 'respirasi', label: 'RR' },
            { key: 'spo2', label: 'SpO2' }
        ],
        ewsEnabled: true,
        finalizeEnabled: true,
        sections: [
            {
                key: 'anamnesis',
                title: '1. ANAMNESIS',
                fields: [
                    { key: 'keluhan_utama', type: 'textarea', label: 'Keluhan Utama', rows: 2, required: true, copyToFixed: 'keluhan_utama' },
                    { key: 'rps', type: 'textarea', label: 'Riwayat Penyakit Sekarang (RPS)', rows: 3 },
                    { key: 'rpd', type: 'textarea', label: 'Riwayat Penyakit Dahulu (RPD)', rows: 2 },
                    { key: 'alergi', type: 'radio-group', label: 'Riwayat Alergi', options: ['Tidak Ada', 'Obat', 'Makanan', 'Lainnya'], otherField: true },
                    { key: 'riwayat_operasi', type: 'radio-group', label: 'Riwayat Operasi', options: ['Tidak Pernah', 'Pernah'], otherField: true }
                ]
            },
            {
                key: 'pemeriksaan_fisik',
                title: '2. PEMERIKSAAN FISIK & VITAL SIGN',
                fields: [
                    { key: 'kesadaran', type: 'radio-group', label: 'Tingkat Kesadaran', options: ['Compos Mentis', 'Apatis', 'Somnolen', 'Sopor', 'Koma'], required: true },
                    { key: 'gcs_eye', type: 'number', label: 'GCS - Mata (E)', min: 1, max: 4 },
                    { key: 'gcs_verbal', type: 'number', label: 'GCS - Verbal (V)', min: 1, max: 5 },
                    { key: 'gcs_motorik', type: 'number', label: 'GCS - Motorik (M)', min: 1, max: 6 },
                    { key: 'td_sistolik', type: 'number', label: 'TD Sistolik', min: 40, max: 260, suffix: 'mmHg', vitalSign: true, copyToFixed: 'td_sistolik' },
                    { key: 'td_diastolik', type: 'number', label: 'TD Diastolik', min: 20, max: 160, suffix: 'mmHg', vitalSign: true, copyToFixed: 'td_diastolik' },
                    { key: 'nadi', type: 'number', label: 'Nadi', min: 20, max: 240, suffix: 'x/menit', vitalSign: true, copyToFixed: 'nadi' },
                    { key: 'suhu', type: 'number', label: 'Suhu Badan', min: 32, max: 43, step: 0.1, suffix: '°C', vitalSign: true, copyToFixed: 'suhu' },
                    { key: 'respirasi', type: 'number', label: 'Pernafasan (RR)', min: 4, max: 80, suffix: 'x/menit', vitalSign: true, copyToFixed: 'respirasi' },
                    { key: 'spo2', type: 'number', label: 'SpO2', min: 0, max: 100, suffix: '%', vitalSign: true, copyToFixed: 'spo2' },
                    { key: 'bb', type: 'number', label: 'Berat Badan', min: 5, max: 250, step: 0.1, suffix: 'kg' },
                    { key: 'tb', type: 'number', label: 'Tinggi Badan', min: 50, max: 230, step: 0.1, suffix: 'cm' }
                ]
            },
            {
                key: 'rencana',
                title: '3. RENCANA KEPERAWATAN, EDUKASI, KONTROL',
                fields: [
                    { key: 'diagnosa_keperawatan_1', type: 'text', label: 'Diagnosa Keperawatan 1' },
                    { key: 'diagnosa_keperawatan_2', type: 'text', label: 'Diagnosa Keperawatan 2' },
                    { key: 'intervensi', type: 'textarea', label: 'Intervensi & Implementasi', rows: 3 },
                    { key: 'edukasi', type: 'checkbox-group', label: 'Edukasi Yang Diberikan', options: ['Minum Obat', 'Pola Makan', 'Aktivitas Fisik', 'Istirahat', 'Kontrol Kembali', 'Tanda Bahaya', 'Lainnya'], otherField: true },
                    { key: 'rencana_kontrol', type: 'date', label: 'Jadwal Kontrol Kembali' },
                    { key: 'catatan_tambahan', type: 'textarea', label: 'Catatan Lainnya / Catatan Dokter', rows: 2 }
                ]
            }
        ]
    };

    // ------------------------------------------------------------
    // 3. SKEMA ASESMEN AWAL PEDIATRIK (ANAK / BAYI < 18 TAHUN)
    //    Termasuk SKALA NYERI WONG-BAKER 0-5 + PEWS SCORE
    // ------------------------------------------------------------
    window.SIMAMI_ASSESSMENT_SCHEMAS.PEDIATRIK_AWAL = {
        id: 'pediatrik_awal',
        label: 'Asesmen Awal Pediatrik',
        table: 'asesmen_pediatrik_awal',
        jsonbColumn: 'asesmen_data',
        title: 'ASESMEN AWAL KEPERAWATAN PEDIATRIK (ANAK & BAYI)',
        subtitle: 'Sesuai Formulir Internal RS. Incl Skala Nyeri Wong-Baker & PEWS Score.',
        requireRole: 'canAccessAssessmentPediatrik',
        allowRoles: ['isPerawatRole', 'isPendaftaranRole', 'isDoctorRole', 'isPediatrikRole', 'isNurseStationRole', 'isSupervisorRole'],
        printOrientation: 'portrait',
        fixedMeta: {
            tanggalColumn: 'tanggal_asesmen',
            namaColumn: 'perawat_nama',
            emailColumn: 'perawat_email',
            skorColumn: 'skor_pews',
            skorLabel: 'Skor PEWS (Pediatric Early Warning Score)',
            finalizeColumn: 'is_finalized',
            finalizedAtColumn: 'finalized_at',
            finalizedByColumn: 'finalized_by'
        },
        vitalSigns: [
            { key: 'suhu', label: 'Suhu' },
            { key: 'nadi', label: 'Nadi' },
            { key: 'rr', label: 'RR' },
            { key: 'spo2', label: 'SpO2' },
            { key: 'bb', label: 'BB (kg)' },
            { key: 'tb', label: 'TB/PB (cm)' }
        ],
        ewsEnabled: true,
        ewsType: 'pews',
        finalizeEnabled: true,
        sections: [
            {
                key: 'anamnesis_orangtua',
                title: '1. ANAMNESIS (KELUARGA / ORANG TUA)',
                fields: [
                    { key: 'keluhan_utama', type: 'textarea', label: 'Keluhan Utama (menurut orang tua)', rows: 2, required: true },
                    { key: 'rps', type: 'textarea', label: 'Riwayat Penyakit Sekarang', rows: 3 },
                    { key: 'riwayat_kehamilan', type: 'textarea', label: 'Riwayat Kehamilan & Persalinan Ibu', rows: 2, placeholder: 'Anak ke-, cukup bulan / prematur (minggu), persalinan normal / SC, BB lahir, PB lahir, APGAR, dll' },
                    { key: 'riwayat_mp_asi', type: 'radio-group', label: 'Pola Makan Bayi', options: ['ASI Eksklusif', 'ASI + Formula', 'Formula Saja', 'MP-ASI (sudah)', 'Belum MP-ASI'], otherField: true }
                ]
            },
            {
                key: 'riwayat_kesehatan',
                title: '2. RIWAYAT KESEHATAN DAN TUMBUH KEMBANG',
                fields: [
                    { key: 'imunisasi_tt', type: 'radio-group', label: 'Status Imunisasi Dasar', options: ['Lengkap sesuai umur', 'Tidak Lengkap', 'Belum sama sekali'], otherField: true },
                    { key: 'tumbuh_kembang', type: 'radio-group', label: 'Tumbuh Kembang sesuai umur', options: ['Sesuai', 'Terlambat (perlu dicatat)', 'Belum bisa dinilai'], otherField: true },
                    { key: 'alergi', type: 'radio-group', label: 'Riwayat Alergi (obat/makanan/lingkungan)', options: ['Tidak Ada', 'Ada'], otherField: true },
                    { key: 'riwayat_penyakit_dahulu', type: 'textarea', label: 'Riwayat Penyakit Dahulu / Riwayat Operasi', rows: 2 }
                ]
            },
            {
                key: 'pemeriksaan_fisik',
                title: '3. PEMERIKSAAN FISIK & VITAL SIGN',
                fields: [
                    { key: 'kesadaran', type: 'radio-group', label: 'Tingkat Kesadaran', options: ['Compos Mentis', 'Mengantuk', 'Rewel Gelisah', 'Letargis', 'Koma / Menurun'] },
                    { key: 'suhu', type: 'number', label: 'Suhu Badan', min: 32, max: 43, step: 0.1, suffix: '°C', vitalSign: true, copyToFixed: 'suhu' },
                    { key: 'nadi', type: 'number', label: 'Nadi', min: 30, max: 240, suffix: 'x/menit', vitalSign: true, copyToFixed: 'nadi' },
                    { key: 'rr', type: 'number', label: 'Pernafasan (RR)', min: 8, max: 100, suffix: 'x/menit', vitalSign: true, copyToFixed: 'respirasi' },
                    { key: 'spo2', type: 'number', label: 'SpO2', min: 0, max: 100, suffix: '%', vitalSign: true, copyToFixed: 'spo2' },
                    { key: 'bb', type: 'number', label: 'Berat Badan', min: 0.5, max: 150, step: 0.01, suffix: 'kg', vitalSign: true, copyToFixed: 'berat_badan_kg' },
                    { key: 'tb', type: 'number', label: 'Panjang Badan / Tinggi Badan', min: 20, max: 180, step: 0.1, suffix: 'cm', vitalSign: true, copyToFixed: 'panjang_badan_cm' },
                    { key: 'nyeri_wong_baker', type: 'wong-baker-0-5', label: 'Skala Nyeri (Wong-Baker Faces 0 - 5)', min: 0, max: 5, copyToFixed: 'skala_nyeri_wong_baker' }
                ]
            },
            {
                key: 'keputusan_edukasi',
                title: '4. KEPUTUSAN, RENCANA KEPERAWATAN & EDUKASI ORANG TUA',
                fields: [
                    { key: 'diagnosa_keperawatan_1', type: 'text', label: 'Diagnosa Keperawatan 1' },
                    { key: 'diagnosa_keperawatan_2', type: 'text', label: 'Diagnosa Keperawatan 2' },
                    { key: 'intervensi', type: 'textarea', label: 'Intervensi & Tindakan', rows: 3 },
                    { key: 'edukasi_ortu', type: 'checkbox-group', label: 'Edukasi Diberikan Kepada Orang Tua', options: ['Cara Memberi Obat', 'Pola Makan Anak', 'ASI / Cara Menyusui', 'Tanda Bahaya Demam', 'Tanda Bahaya Sesak', 'Kapan Kembali Kontrol', 'Imunisasi Selanjutnya', 'Lainnya'], otherField: true },
                    { key: 'rencana_kontrol', type: 'date', label: 'Jadwal Kontrol Kembali' },
                    { key: 'catatan_tambahan', type: 'textarea', label: 'Catatan Lainnya', rows: 2 }
                ]
            }
        ]
    };

    // =====================================================================
    // 4. SKEMA KHUSUS POLIKLINIK PENYAKIT DALAM — FASE 1 (PRIORITAS)
    // ---------------------------------------------------------------------
    // 4.1 Asesmen Rawat Jalan (Poli Penyakit Dalam)
    // =====================================================================
    window.SIMAMI_ASSESSMENT_SCHEMAS.RAWAT_JALAN_PD = {
        id: 'rawat_jalan_pd',
        label: 'Asesmen Rawat Jalan',
        menuLabel: 'Asesmen Rawat Jalan',
        menuPoliId: 'penyakit_dalam',
        menuCategory: 'asesmen_medis',
        menuOrder: 1,
        targetPoliKeyword: 'penyakit dalam',
        table: 'asesmen_rawat_jalan_dewasa',
        jsonbColumn: 'asesmen_data',
        title: 'ASSESMENT RAWAT JALAN',
        subtitle: 'POLIKLINIK PENYAKIT DALAM — RUMAH SAKIT UMUM DAERAH AJI MUHAMMAD IDRIS',
        printTitle: 'ASSESMENT RAWAT JALAN',
        printSubtitle: 'PERAWAT / BIDAN — POLIKLINIK PENYAKIT DALAM',
        requireRole: 'canAccessAssessmentRawatJalan',
        allowRoles: ['isPerawatRole', 'isPendaftaranRole', 'isDoctorRole', 'isNurseStationRole', 'isSupervisorRole'],
        printOrientation: 'portrait',
        printPaperSize: 'F4',
        printPageWidthMm: 220,
        printPageHeightMm: 330,
        ewsEnabled: true,
        finalizeEnabled: true,
        useGcHeaderStyle: true,
        fixedMeta: {
            tanggalColumn: 'tanggal_asesmen',
            namaColumn: 'perawat_nama',
            emailColumn: 'perawat_email',
            skorColumn: 'skor_ews',
            finalizeColumn: 'is_finalized',
            finalizedAtColumn: 'finalized_at',
            finalizedByColumn: 'finalized_by',
            keluhanUtamaColumn: 'keluhan_utama',
            dokterNamaColumn: 'dokter_nama',
            dokterNipColumn: 'dokter_nip'
        },
        vitalSigns: [
            { key: 'td_sistolik', label: 'TD Sistolik' },
            { key: 'td_diastolik', label: 'TD Diastolik' },
            { key: 'nadi', label: 'Nadi' },
            { key: 'respirasi', label: 'RR' },
            { key: 'suhu', label: 'Suhu' },
            { key: 'spo2', label: 'SpO2' }
        ],
        sections: [
            {
                key: 'hal1_perawat_identitas',
                title: 'ASSESMENT RAWAT JALAN — PERAWAT / BIDAN',
                roleLabel: 'Halaman Perawat',
                roleTone: 'nurse',
                editableByRole: ['isPerawatRole', 'isNurseStationRole', 'isSupervisorRole', 'isDoctorRole'],
                page: 1,
                fields: [
                    { key: 'tanggal_asesmen', type: 'date', label: 'Tanggal', required: true, copyToFixed: 'tanggal_asesmen' },
                    { key: 'jam_asesmen', type: 'time', label: 'Jam', required: true },
                    { key: 'keluhan', type: 'textarea', label: 'Keluhan', rows: 3, required: true, copyToFixed: 'keluhan_utama' },
                    { key: 'riwayat_alergi', type: 'radio-group', label: 'Alergi', options: ['Tidak', 'Ya'], otherField: true, otherLabel: 'Alergi Ya, sebutkan (obat / makanan / lainnya)' },
                    { key: 'skrining_nyeri', type: 'radio-group', label: 'Skrinning Nyeri', options: ['Tidak ada Nyeri', 'Ada Nyeri'], required: true },
                    { key: 'skala_nyeri', type: 'number', label: 'Skala Nyeri (0 - 10)', min: 0, max: 10, hint: 'Diisi jika Ada Nyeri' },
                    { key: 'lokasi_nyeri', type: 'text', label: 'Lokasi Nyeri' },
                    { key: 'skrining_jatuh_pengkajian', type: 'textarea', label: 'Skrining Risiko Jatuh (Get Up and Go Test) — Pengkajian', rows: 2, hint: 'a) Cara berjalan (tidak seimbang / limbung / pakai alat bantu dll), b) Menopang saat duduk' },
                    { key: 'skrining_jatuh_hasil', type: 'radio-group', label: 'Skrining Risiko Jatuh — Hasil', options: ['Tidak berisiko (tidak ditemukan a & b)', 'Berisiko sedang (ditemukan salah satu a / b)', 'Berisiko tinggi (ditemukan a & b)'], required: true },
                    { key: 'skrining_jatuh_intervensi', type: 'checkbox-group', label: 'Skrining Risiko Jatuh — Tindakan / Intervensi', options: ['Tidak ada tindakan', 'Edukasi', 'Pasang pita kuning (risiko tinggi)', 'Lainnya'], otherField: true }
                ]
            },
            {
                key: 'hal1_perawat_tandavital',
                title: 'Tanda Vital & Pemeriksaan Tambahan',
                roleLabel: 'Halaman Perawat',
                roleTone: 'nurse',
                editableByRole: ['isPerawatRole', 'isNurseStationRole', 'isSupervisorRole', 'isDoctorRole'],
                page: 1,
                fields: [
                    { key: 'td_sistolik', type: 'number', label: 'TD Sistolik', min: 40, max: 260, suffix: 'mmHg', vitalSign: true, required: true },
                    { key: 'td_diastolik', type: 'number', label: 'TD Diastolik', min: 20, max: 160, suffix: 'mmHg', vitalSign: true },
                    { key: 'nadi', type: 'number', label: 'Nadi', min: 20, max: 240, suffix: '/ menit', vitalSign: true, required: true },
                    { key: 'respirasi', type: 'number', label: 'RR (Pernafasan)', min: 4, max: 80, suffix: '/ menit', vitalSign: true },
                    { key: 'suhu', type: 'number', label: 'Suhu', min: 32, max: 43, step: 0.1, suffix: '° C', vitalSign: true, required: true },
                    { key: 'tinggi_badan', type: 'number', label: 'TB (Tinggi Badan)', min: 50, max: 230, suffix: 'cm' },
                    { key: 'berat_badan', type: 'number', label: 'BB (Berat Badan)', min: 5, max: 250, step: 0.1, suffix: 'Kg' },
                    { key: 'spo2', type: 'number', label: 'SpO2 (Oksigenasi)', min: 0, max: 100, suffix: '%', vitalSign: true },
                    { key: 'imt', type: 'text', label: 'IMT (Otomatis — BB / TB²)', placeholder: 'Otomatis dihitung ketika BB & TB terisi', computed: true },
                    { key: 'kehamilan_g', type: 'number', label: 'Pemeriksaan Kehamilan — G (Gravida)', min: 0, max: 15, hint: 'Diisi jika pasien wanita usia subur' },
                    { key: 'kehamilan_p', type: 'number', label: 'P (Para)', min: 0, max: 15 },
                    { key: 'kehamilan_a', type: 'number', label: 'A (Abortus)', min: 0, max: 15 },
                    { key: 'hpht', type: 'date', label: 'HPHT (Hari Pertama Haid Terakhir)' },
                    { key: 'lila', type: 'number', label: 'Lila (Lingkar Lengan Atas)', min: 10, max: 50, step: 0.1, suffix: 'cm' }
                ]
            },
            {
                key: 'hal1_perawat_fungsional_edukasi',
                title: 'Nutrisi, Status Fungsional, Psikososial & Kebutuhan Edukasi',
                roleLabel: 'Halaman Perawat',
                roleTone: 'nurse',
                editableByRole: ['isPerawatRole', 'isNurseStationRole', 'isSupervisorRole', 'isDoctorRole'],
                page: 1,
                fields: [
                    { key: 'nutrisi', type: 'checkbox-group', label: 'Nutrisi', options: ['Tidak Ada Keluhan', 'Mual', 'Muntah', 'Kehilangan Nafsu Makan'], otherField: true, otherLabel: 'Kehilangan nafsu makan (berapa hari)' },
                    { key: 'status_fungsional', type: 'radio-group', label: 'Status fungsional', options: ['Mandiri', 'Perlu bantuan', 'Ketergantungan total'], otherField: true, otherLabel: 'Keterangan (alat bantu / ketergantungan sejak kapan)' },
                    { key: 'psiko_hubungan_keluarga', type: 'radio-group', label: 'Hubungan pasien dengan anggota keluarga', options: ['Baik', 'Tidak baik'], required: true },
                    { key: 'psiko_status_psikologis', type: 'checkbox-group', label: 'Status Psikologis', options: ['Tenang', 'Cemas', 'Takut', 'Marah', 'Sedih', 'Kecenderungan bunuh diri', 'Lainnya'], otherField: true, otherLabel: 'Lainnya / Dilaporkan ke (untuk kecenderungan bunuh diri)' },
                    { key: 'psiko_koping', type: 'radio-group', label: 'Koping mekanisme', options: ['Baik', 'Menarik diri / isolasi sosial', 'Perilaku kekerasan', 'Sulit dinilai'], required: true },
                    { key: 'psiko_persepsi_sakit', type: 'radio-group', label: 'Persepsi terhadap sakit', options: ['Tidak ada keluhan', 'Merasa menjadi beban'], otherField: true },
                    { key: 'psiko_ibadah', type: 'radio-group', label: 'Menjalankan Ibadah', options: ['Tidak ada hambatan', 'Ada hambatan'], otherField: true },
                    { key: 'edukasi_hambatan_pembelajaran', type: 'checkbox-group', label: 'Terdapat hambatan dalam pembelajaran', options: ['Tidak', 'Pendengaran', 'Penglihatan', 'Kognitif', 'Fisik', 'Budaya', 'Agama', 'Emosi', 'Bahasa', 'Lainnya'], otherField: true, otherLabel: 'Sebutkan hambatan lain' },
                    { key: 'edukasi_butuh_penerjemah', type: 'radio-group', label: 'Butuh penerjemah', options: ['Tidak', 'Ya'], otherField: true, otherLabel: 'Jika Ya, sebutkan bahasa' },
                    { key: 'edukasi_topik_pembelajaran', type: 'checkbox-group', label: 'Kebutuhan pembelajaran pasien (topik pembelajaran)', options: ['Diagnosa dan manajemen penyakit', 'Obat-obatan', 'Diet & nutrisi', 'Tindakan Keperawatan', 'Rehabilitasi', 'Manajemen nyeri', 'Lain – lain'], otherField: true },
                    { key: 'masalah_keperawatan_penilaian', type: 'textarea', label: 'MASALAH KEPERAWATAN/KEBIDANAN — Penilaian / Pengkajian', rows: 3, hint: 'Identifikasi masalah keperawatan: nyeri akut, risiko jatuh, kurang pengetahuan, intoleransi aktivitas, gangguan nutrisi, dll' },
                    { key: 'masalah_keperawatan_rencana', type: 'textarea', label: 'RENCANA ASUHAN KEPERAWATAN', rows: 3, hint: 'Tujuan + intervensi + evaluasi per masalah' }
                ]
            },
            {
                key: 'hal2_dokter',
                title: 'DOKTER — PEMERIKSAAN MEDIS DAN RENCANA ASUHAN',
                roleLabel: 'Halaman Dokter',
                roleTone: 'doctor',
                editableByRole: ['isDoctorRole', 'isSupervisorRole'],
                page: 2,
                pageBreakBefore: true,
                fields: [
                    { key: 'keluhan_utama', type: 'textarea', label: 'Keluhan Utama', rows: 3, required: true, copyToFixed: 'keluhan_utama' },
                    { key: 'riwayat_penyakit', type: 'textarea', label: 'Riwayat Penyakit', rows: 4, hint: 'RPS, RPD, Riwayat penyakit keluarga, riwayat sosial' },
                    { key: 'riwayat_penggunaan_obat', type: 'radio-group', label: 'Riwayat Penggunaan Obat', options: ['Tidak Ada', 'Ada'], otherField: true, otherLabel: 'Jika Ada, Tuliskan (nama • dosis • frekuensi)' },
                    { key: 'hasil_penunjang_yang_ada', type: 'textarea', label: 'Hasil pemeriksaan penunjang yang telah ada', rows: 4, hint: 'Lab, EKG, Rontgen, USG, CT-scan, dll yang sudah dibawa pasien / ada di rekam medis' },
                    { key: 'pemeriksaan_fisik_kondisi_umum', type: 'checkbox-group', label: 'Pemeriksaan Fisik — Status General — Kondisi Umum', options: ['Baik', 'Tampak Sakit', 'Sesak', 'Pucat', 'Lemah', 'Kejang', 'Lainnya'], otherField: true, required: true },
                    { key: 'pemeriksaan_fisik_sistem_tubuh', type: 'textarea', label: 'Pemeriksaan Fisik Sistem Tubuh — Kepala-Leher / Thorax (Cor+Pulmo) / Abdomen / Ekstremitas', rows: 4, hint: 'Kepala & Leher (anemis/ikterik/JVP/tiroid/kelenjar getah bening) ; Thorax Cor (B1B2/murmur/gallop) ; Thorax Pulmo (suara dasar/ronchi/wheezing) ; Abdomen (BU/nyeri tekan/Hepar/Lien) ; Ekstremitas (edema/akral/CRT/varikositas)' },
                    { key: 'status_lokalis', type: 'body-map', label: 'Status Lokalis (Tandai lokasi yang tidak normal)', noteLabel: 'Temuan yang signifikan di status lokalis:', noteRows: 6, notePlaceholder: 'Jelaskan temuan di titik yang ditandai pada gambar tubuh: morfologi lesi, ukuran, warna, nyeri tekan, oedema, dll.' },
                    { key: 'diagnosa_kerja_banding', type: 'textarea', label: 'Diagnosis Kerja / Diagnosis Banding', rows: 3, required: true, hint: 'Sertakan ICD-10 bila memungkinkan' },
                    { key: 'instruksi_awal_dokter', type: 'textarea', label: 'Instruksi Awal Dokter', rows: 6, required: true, hint: 'Isi terstruktur: 1) Terapi medikamentosa (Nama Obat • Dosis • Frekuensi • Jalur • Lama pemberian), 2) Tindakan medis, 3) Edukasi khusus pasien & keluarga' },
                    { key: 'rencana_asuhan', type: 'checkbox-group', label: 'Rencana Asuhan', options: ['Kontrol', 'Rawat Inap', 'Rujuk', 'Konsultasi'], otherField: true, otherLabel: 'Keterangan (tgl kontrol / tujuan rujukan / tujuan konsultasi)' },
                    { key: 'dpjp_nama', type: 'text', label: 'Nama DPJP (Dokter Penanggung Jawab Pelayanan)', required: true },
                    { key: 'dpjp_sip', type: 'text', label: 'SIP / NIP Dokter' }
                ]
            }
        ],
        signature: {
            perawat: {
                label: 'Perawat Nurse Station / Perawat Poli',
                stampField: 'perawat_nama_stamp',
                nipField: 'perawat_nip'
            },
            dokter: {
                label: 'Dokter DPJP Poliklinik Penyakit Dalam',
                stampField: 'dpjp_nama',
                nipField: 'dpjp_sip'
            },
            footerLokasi: 'Muara Badak',
            timezone: 'WITA'
        }
    };

    // =====================================================================
    // 4.2 Asesmen Awal Medis — Poli Penyakit Dalam
    // =====================================================================
    window.SIMAMI_ASSESSMENT_SCHEMAS.ASESMEN_AWAL_MEDIS_PD = {
        id: 'asesmen_awal_medis_pd',
        label: 'Asesmen Awal Medis',
        menuLabel: 'Asesmen Awal Medis',
        menuPoliId: 'penyakit_dalam',
        menuCategory: 'asesmen_medis',
        menuOrder: 2,
        targetPoliKeyword: 'penyakit dalam',
        table: 'asesmen_rawat_jalan_dewasa',
        jsonbColumn: 'asesmen_data',
        title: 'ASESMEN AWAL MEDIS — POLIKLINIK PENYAKIT DALAM',
        subtitle: 'Formulir Pemeriksaan Dokter / Assisten Medis (Bagan Anamnesis Lengkap)',
        requireRole: 'canAccessAssessmentRawatJalan',
        allowRoles: ['isPerawatRole', 'isPendaftaranRole', 'isDoctorRole', 'isNurseStationRole', 'isSupervisorRole'],
        printOrientation: 'portrait',
        ewsEnabled: true,
        finalizeEnabled: true,
        fixedMeta: {
            tanggalColumn: 'tanggal_asesmen',
            namaColumn: 'perawat_nama',
            emailColumn: 'perawat_email',
            skorColumn: 'skor_ews',
            finalizeColumn: 'is_finalized',
            finalizedAtColumn: 'finalized_at',
            finalizedByColumn: 'finalized_by',
            keluhanUtamaColumn: 'keluhan_utama'
        },
        vitalSigns: [
            { key: 'td_sistolik', label: 'TD (mmHg)' },
            { key: 'nadi', label: 'Nadi' },
            { key: 'suhu', label: 'Suhu' },
            { key: 'respirasi', label: 'RR' },
            { key: 'spo2', label: 'SpO2' }
        ],
        sections: [
            {
                key: 'anamnesis_sistem',
                title: '1. ANAMNESIS SISTEMATIS',
                fields: [
                    { key: 'keluhan_utama', type: 'textarea', label: 'Keluhan Utama (Chief Complaint)', rows: 2, required: true, copyToFixed: 'keluhan_utama' },
                    { key: 'hpi', type: 'textarea', label: 'History of Present Illness (Riwayat Penyakit Sekarang — detail onset, durasi, lokasi, frekuensi, pemicu, faktor peringan)', rows: 4 },
                    { key: 'pms', type: 'textarea', label: 'Past Medical History (Riwayat Penyakit Dahulu)', rows: 3 },
                    { key: 'medication', type: 'textarea', label: 'Obat-obat yang sedang dikonsumsi sekarang (Nama • Dosis • Frekuensi)', rows: 2 },
                    { key: 'alergi_obat', type: 'text', label: 'Alergi Obat / Food Allergy' },
                    { key: 'family_history', type: 'textarea', label: 'Family History (Riwayat Keluarga: HT / DM / Jantung / Ginjal / Kanker)', rows: 2 },
                    { key: 'social_history', type: 'textarea', label: 'Social History (Merokok • Alkohol • Aktifitas fisik • Diet)', rows: 2 }
                ]
            },
            {
                key: 'review_sistem',
                title: '2. REVIEW SISTEM (ROS)',
                fields: [
                    { key: 'sistem_kardiovaskular', type: 'textarea', label: 'Kardiovaskular (Nyeri dada • Palpitasi • Edema • Orthopnea • PND)', rows: 2 },
                    { key: 'sistem_pernapasan', type: 'textarea', label: 'Pernapasan (Sesak • Batuk • Dahak • Hemoptisis • Riwayat Asma / TB / PPOK)', rows: 2 },
                    { key: 'sistem_gastrointestinal', type: 'textarea', label: 'Gastrointestinal (Mual • Muntah • Diare • Konstipasi • Nyeri Abdomen • IMT / BB turun)', rows: 2 },
                    { key: 'sistem_genitourinaria', type: 'textarea', label: 'Genitourinaria (BAK • BAK nyeri • Hematuria • Frekuensi • Nokturia • Retensi / Inkontinensia)', rows: 2 },
                    { key: 'sistem_neuro_muskulo', type: 'textarea', label: 'Neurologis & Muskuloskeletal (Pusing • Sakit kepala • Lemah anggota gerak • Nyeri sendi)', rows: 2 },
                    { key: 'sistem_lain', type: 'textarea', label: 'Kulit • Endokrin (Polyuria / Polydipsia / Polyphagia) • Hematologi', rows: 2 }
                ]
            },
            {
                key: 'pemeriksaan_fisik_lengkap',
                title: '3. PEMERIKSAAN FISIK LENGKAP',
                fields: [
                    { key: 'status_generalis', type: 'textarea', label: 'Status Generalis (Kesan umum • Kesadaran • TTV)', rows: 2, required: true },
                    { key: 'td_sistolik', type: 'number', label: 'TD Sistolik', min: 40, max: 260, suffix: 'mmHg', vitalSign: true, required: true },
                    { key: 'td_diastolik', type: 'number', label: 'TD Diastolik', min: 20, max: 160, suffix: 'mmHg', vitalSign: true },
                    { key: 'nadi', type: 'number', label: 'Nadi', min: 20, max: 240, suffix: 'x/menit', vitalSign: true, required: true },
                    { key: 'suhu', type: 'number', label: 'Suhu Badan', min: 32, max: 43, step: 0.1, suffix: '°C', vitalSign: true, required: true },
                    { key: 'respirasi', type: 'number', label: 'RR', min: 4, max: 80, suffix: 'x/menit', vitalSign: true },
                    { key: 'spo2', type: 'number', label: 'SpO2', min: 0, max: 100, suffix: '%', vitalSign: true },
                    { key: 'kepala_leher', type: 'textarea', label: 'Kepala & Leher (Anemis • Ikterik • JVP • Kelenjar tiroid • Limphadenopathy)', rows: 2 },
                    { key: 'thorax_pulmo', type: 'textarea', label: 'Thorax - Pulmo (Inspeksi • Palpasi • Perkusi • Auskultasi — Rhonchi • Wheezing • Suara dasar)', rows: 3 },
                    { key: 'thorax_cor', type: 'textarea', label: 'Thorax - Cor (Ictus cordis • B1 B2 reguler • Murmur • Gallop)', rows: 2 },
                    { key: 'abdomen', type: 'textarea', label: 'Abdomen (Datar • Cembung • Lecet • BU • Nyeri tekan • Hepar / lien)', rows: 2 },
                    { key: 'ekstremitas', type: 'textarea', label: 'Ekstremitas (Edema • Akral • CRT • Varicositas • Tonus otot • Kekuatan motorik)', rows: 2 }
                ]
            },
            {
                key: 'diagnosa_dan_terapi',
                title: '4. DIAGNOSA KERJA & TERAPI',
                fields: [
                    { key: 'diagnosa_kerja_utama', type: 'text', label: 'Diagnosa Kerja Utama', required: true },
                    { key: 'diagnosa_banding', type: 'text', label: 'Diagnosa Banding' },
                    { key: 'penunjang_diperlukan', type: 'checkbox-group', label: 'Pemeriksaan Penunjang yang Diperlukan', options: ['Laboratorium Rutin', 'Lab Khusus (Fungsi Jantung/Ginjal/Hati)', 'EKG', 'Rontgen Thorax', 'USG Abdomen', 'CT-Scan', 'MRI', 'Lainnya'], otherField: true },
                    { key: 'terapi_medikamentosa', type: 'textarea', label: 'Terapi Medikamentosa (Nama • Dosis • Frekuensi • Lama • Jalur pemberian)', rows: 3 },
                    { key: 'tindakan_non_farmakologi', type: 'textarea', label: 'Tindakan Non-Farmakologi & Edukasi', rows: 2 },
                    { key: 'jadwal_kontrol', type: 'date', label: 'Jadwal Kontrol Kembali' },
                    { key: 'rujukan_internal_eksternal', type: 'text', label: 'Rujukan (Subspesialis / RS Lain — opsional)' }
                ]
            }
        ]
    };

    // =====================================================================
    // 4.3 CPPT (Catatan Pengembangan Pasien Terintegrasi) — Poli Penyakit Dalam
    // =====================================================================
    window.SIMAMI_ASSESSMENT_SCHEMAS.CPPT_PD = {
        id: 'cppti_pd',
        label: 'CPPT (Catatan Pengembangan Pasien Terintegrasi)',
        menuLabel: 'Catatan Pengembangan Pasien Terintegrasi',
        menuShortLabel: 'CPPT',
        menuPoliId: 'penyakit_dalam',
        menuCategory: 'asesmen_medis',
        menuOrder: 3,
        targetPoliKeyword: 'penyakit dalam',
        table: 'asesmen_rawat_jalan_dewasa',
        jsonbColumn: 'asesmen_data',
        title: 'CPPT — CATATAN PENGEMBANGAN PASIEN TERINTEGRASI POLIKLINIK PENYAKIT DALAM',
        subtitle: 'Format SOAP (Subyektif • Obyektif • Asesmen • Plan) untuk pasien kontrol / follow up',
        requireRole: 'canAccessAssessmentRawatJalan',
        allowRoles: ['isPerawatRole', 'isPendaftaranRole', 'isDoctorRole', 'isNurseStationRole', 'isSupervisorRole'],
        printOrientation: 'portrait',
        ewsEnabled: true,
        finalizeEnabled: true,
        fixedMeta: {
            tanggalColumn: 'tanggal_asesmen',
            namaColumn: 'perawat_nama',
            emailColumn: 'perawat_email',
            skorColumn: 'skor_ews',
            finalizeColumn: 'is_finalized',
            finalizedAtColumn: 'finalized_at',
            finalizedByColumn: 'finalized_by',
            keluhanUtamaColumn: 'keluhan_utama'
        },
        vitalSigns: [
            { key: 'td_sistolik', label: 'TD (mmHg)' },
            { key: 'nadi', label: 'Nadi' },
            { key: 'suhu', label: 'Suhu' },
            { key: 'respirasi', label: 'RR' },
            { key: 'spo2', label: 'SpO2' }
        ],
        sections: [
            {
                key: 'soap_subyektif',
                title: '1. SUBYEKTIF (S) — Keluhan Pasien / Informasi Anamnestik',
                fields: [
                    { key: 'keluhan_utama', type: 'textarea', label: 'S — Keluhan Utama saat ini (sesuai pasien)', rows: 2, required: true, copyToFixed: 'keluhan_utama' },
                    { key: 'riwayat_perjalanan_penyakit', type: 'textarea', label: 'Riwayat Perjalanan Penyakit sejak kunjungan terakhir (Perubahan keluhan • Respon terapi • Komplikasi)', rows: 4, required: true },
                    { key: 'ketaatan_obat', type: 'radio-group', label: 'Ketaatan Konsumsi Obat', options: ['Selalu tepat waktu (Baik)', 'Sering lupa', 'Tidak meminum sama sekali', 'Sudah dihentikan atas saran dokter'], otherField: true },
                    { key: 'keluhan_tambahan', type: 'checkbox-group', label: 'Keluhan Tambahan yang Perlu Ditanggapi', options: ['Nyeri kepala', 'Nyeri dada / jantung', 'Sesak nafas', 'Mual / muntah', 'Demam', 'Batuk / pilek', 'Kaki bengkak / edema', 'Tidak nafsu makan', 'BB turun drastis', 'Pusing / melayang', 'Gangguan BAK / BAB', 'Gangguan tidur', 'Keluhan psikologis / cemas', 'Lainnya'], otherField: true }
                ]
            },
            {
                key: 'soap_obyektif',
                title: '2. OBYEKTIF (O) — Temuan Pemeriksaan',
                fields: [
                    { key: 'td_sistolik', type: 'number', label: 'TD Sistolik', min: 40, max: 260, suffix: 'mmHg', vitalSign: true, required: true },
                    { key: 'td_diastolik', type: 'number', label: 'TD Diastolik', min: 20, max: 160, suffix: 'mmHg', vitalSign: true },
                    { key: 'nadi', type: 'number', label: 'Nadi', min: 20, max: 240, suffix: 'x/menit', vitalSign: true, required: true },
                    { key: 'suhu', type: 'number', label: 'Suhu', min: 32, max: 43, step: 0.1, suffix: '°C', vitalSign: true },
                    { key: 'respirasi', type: 'number', label: 'RR', min: 4, max: 80, suffix: 'x/menit', vitalSign: true },
                    { key: 'spo2', type: 'number', label: 'SpO2', min: 0, max: 100, suffix: '%', vitalSign: true },
                    { key: 'berat_badan', type: 'number', label: 'Berat Badan', min: 5, max: 250, step: 0.1, suffix: 'kg' },
                    { key: 'temuan_fisik', type: 'textarea', label: 'Temuan Fisik Lain (Kepala / Jantung / Paru / Abdomen / Ekstremitas)', rows: 3 },
                    { key: 'hasil_penunjang_terakhir', type: 'textarea', label: 'Hasil Pemeriksaan Penunjang Terakhir (Lab • EKG • Rontgen • USG dll)', rows: 3 }
                ]
            },
            {
                key: 'soap_asesmen_plan',
                title: '3. ASESMEN (A) & PLANNING (P) — Penilaian & Rencana Tindakan',
                fields: [
                    { key: 'asesmen_progresifitas', type: 'textarea', label: 'A — Asesmen (Progres penyakit dibanding kunjungan sebelumnya • Prognosis)', rows: 3, required: true },
                    { key: 'evaluasi_diagnosa', type: 'textarea', label: 'Evaluasi Diagnosa Kerja sebelumnya (Diagnosis masih sama • Sudah teratasi • Bertambah)', rows: 2 },
                    { key: 'plan_terapi', type: 'textarea', label: 'P — Rencana Terapi Lanjutan', rows: 4, required: true, hint: 'Isi: (a) Terapi dilanjut / tambah / kurangi / hentikan, (b) Dosis, frekuensi, jalur, (c) Tindakan medis, (d) Rujukan bila perlu' },
                    { key: 'plan_penunjang', type: 'checkbox-group', label: 'Pemeriksaan Penunjang Lanjutan', options: ['Lab Rutin Kontrol (Hb • Lekosit • LED • LED • KGD • Urinalisa)', 'Lab Fungsi Hati / Ginjal / Jantung', 'Lab Lipid • H. Urat', 'EKG', 'Röntgen Thorax', 'USG Abdomen', 'Tidak perlu'], otherField: true },
                    { key: 'edukasi_pasien', type: 'checkbox-group', label: 'Edukasi & Konseling Diberikan', options: ['Penggunaan obat sesuai aturan pakai', 'Efek samping obat yang perlu diwaspadai', 'Diet & Nutrisi (Garam rendah, gula, kolesterol, rendah serat)', 'Aktifitas fisik & latihan fisik ringan', 'Penghentian Merokok / Alkohol', 'Cara identifikasi tanda bahaya / komplikasi', 'Kapan harus kembali ke UGD / poli darurat', 'Manajemen stress'], otherField: true },
                    { key: 'jadwal_kontrol', type: 'date', label: 'Jadwal Kontrol Kembali', required: true }
                ]
            }
        ]
    };

    // =====================================================================
    // KONFIGURASI MENU POLI NURSE STATION (Extensible untuk LAB / RADIO nanti)
    // =====================================================================
    window.SIMAMI_POLI_MENU = window.SIMAMI_POLI_MENU || {};
    window.SIMAMI_POLI_MENU.PENYAKIT_DALAM = {
        id: 'penyakit_dalam',
        title: 'Poliklinik Penyakit Dalam',
        subtitle: 'Poli Umum — Dewasa > 18 Tahun',
        tone: 'dewasa',
        active: true,
        categories: [
            {
                id: 'asesmen_medis',
                title: '📑 Asesmen Medis',
                hint: 'Formulir asesmen & catatan medis pasien poli Penyakit Dalam',
                items: [
                    { type: 'assessment', schemaId: 'rawat_jalan_pd', icon: '📋' },
                    { type: 'assessment', schemaId: 'asesmen_awal_medis_pd', icon: '🩺' },
                    { type: 'assessment', schemaId: 'cppti_pd', icon: '📝' }
                ]
            },
            {
                id: 'permintaan_penunjang',
                title: '🧪 Permintaan Penunjang',
                hint: 'Pengajuan pemeriksaan Lab & Radiologi (coming soon)',
                items: [
                    { type: 'action_placeholder', id: 'permintaan_lab', label: 'Pengajuan Laboratorium', icon: '🧪', status: 'soon' },
                    { type: 'action_placeholder', id: 'permintaan_radiologi', label: 'Pengajuan Radiologi', icon: '🩻', status: 'soon' }
                ]
            }
        ]
    };
    window.SIMAMI_POLI_MENU.ANAK = {
        id: 'anak',
        title: 'Poliklinik Anak',
        subtitle: 'Pediatrik — Bayi, Balita & Anak < 18 Tahun',
        tone: 'pediatrik',
        active: false,
        comingSoon: true,
        categories: [
            {
                id: 'asesmen_medis',
                title: '📑 Asesmen Medis Pediatrik',
                hint: 'Tahap berikutnya, segera hadir',
                items: [
                    { type: 'coming_soon' }
                ]
            }
        ]
    };

    // Utility cepat (opsional) - ambil daftar skema (utk rendering tombol dinamis)
    window.SIMAMI_ASSESSMENT_SCHEMAS.listAll = function () {
        return [
            window.SIMAMI_ASSESSMENT_SCHEMAS.TRIASE_UGD,
            window.SIMAMI_ASSESSMENT_SCHEMAS.RAWAT_JALAN_DEWASA,
            window.SIMAMI_ASSESSMENT_SCHEMAS.PEDIATRIK_AWAL,
            window.SIMAMI_ASSESSMENT_SCHEMAS.RAWAT_JALAN_PD,
            window.SIMAMI_ASSESSMENT_SCHEMAS.ASESMEN_AWAL_MEDIS_PD,
            window.SIMAMI_ASSESSMENT_SCHEMAS.CPPT_PD
        ].filter(Boolean);
    };

    // Cari schema by id
    window.SIMAMI_ASSESSMENT_SCHEMAS.getById = function (schemaId) {
        schemaId = String(schemaId || '').trim();
        if (!schemaId) return null;
        // coba akses langsung key (cepat)
        const keyUpper = schemaId.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
        const direct = window.SIMAMI_ASSESSMENT_SCHEMAS[keyUpper];
        if (direct && direct.id) return direct;
        const list = window.SIMAMI_ASSESSMENT_SCHEMAS.listAll();
        for (const s of list) {
            if (String(s && s.id || '') === schemaId) return s;
        }
        return null;
    };
})();
