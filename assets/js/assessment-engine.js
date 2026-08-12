(function () {
    'use strict';

    // ============================================================
    // ASSESSMENT SHARED ENGINE (OPSI B - STANDAR RS)
    // ------------------------------------------------------------
    // 1 shared engine untuk SEMUA skema asesmen (Triase UGD,
    // Rawat Jalan Dewasa, Pediatrik, dll).
    //
    // CARA PAKAI (dari index.html / modul lain):
    //   const module = createAssessmentModule({
    //       supabaseClient, withTimeout, escapeHtml,
    //       getCurrentOperatorName, getCurrentOperatorEmail,
    //       isPerawatRole, isDoctorRole, ... role helpers
    //   });
    //
    //   module.openAssessment(patientPayload, schemaId);
    //   module.renderRekapButton(patient); // <- tombol di rekap row
    // ============================================================

    const MODAL_ID = 'assessmentSharedModal';
    const FORM_ID = 'assessmentSharedForm';
    const PRINT_MODE = 'shared-assessment';
    const BASE_CLASS_PREFIX = 'assessment-shared';

    function createAssessmentModule(deps) {
        if (!deps || !deps.supabaseClient) throw new Error('Supabase client wajib untuk assessment engine.');

        const supabaseClient = deps.supabaseClient;
        const withTimeout = typeof deps.withTimeout === 'function' ? deps.withTimeout : async function (p) { return await p; };
        const escapeHtml = deps.escapeHtml || function (v) { return String(v == null ? '' : v); };
        const formatDate = deps.formatGeneralConsentDate || function (v) { return String(v || ''); };
        const getCurrentOperatorName = deps.getCurrentOperatorName || function () { return ''; };
        const getCurrentOperatorEmail = deps.getCurrentOperatorEmail || function () { return ''; };
        const getCurrentAdminRole = typeof deps.getCurrentAdminRole === 'function' ? deps.getCurrentAdminRole : function () { return (window.currentAdminRole || ''); };

        // Role check (fallback: window globals jika ada)
        const roleFn = function (name) {
            if (typeof deps[name] === 'function') return deps[name];
            if (typeof window[name] === 'function') return window[name];
            return function () { return false; };
        };
        const isPerawatRole = roleFn('isPerawatRole');
        const isDoctorRole = roleFn('isDoctorRole');
        const isPendaftaranRole = roleFn('isPendaftaranRole');
        const isSupervisorRole = roleFn('isSupervisorRole');
        const isIgdRole = roleFn('isIgdRole');
        const isTriaseRole = roleFn('isTriaseRole');
        const isPediatrikRole = roleFn('isPediatrikRole');

        const state = {
            schema: null,
            schemaId: '',
            patient: null,
            record: null,
            recordId: null,
            formValues: {},
            saveTimer: null,
            lastWriteAt: 0,
            lastSaveText: '',
            realtimeChannel: null,
            broadcast: null,
            inFlight: false,
            fieldsById: {} // id field -> schema def
        };

        const dom = {};

        ensureModalInjected();
        wireDom();
        wireEvents();

        try {
            state.broadcast = new window.BroadcastChannel('simami-assessment-shared-local');
            state.broadcast.addEventListener('message', function (ev) {
                const p = ev.data || {};
                if (!dom.modal.classList.contains('is-open')) return;
                if (String(p.patientId || '') !== String(state.patient?.id || '')) return;
                if (String(p.schemaId || '') !== String(state.schemaId)) return;
                if (Date.now() - state.lastWriteAt < 1500) return;
                refreshCurrentRecord(true);
            });
        } catch (_e) {
            state.broadcast = null;
        }

        return {
            renderRekapButton: renderRekapButton,
            openAssessment: openAssessment,
            openAssessmentBySchemaId: openAssessmentBySchemaId,
            handleRekapButtonClick: handleRekapButtonClick
        };

        function getRegistry() {
            return window.SIMAMI_ASSESSMENT_SCHEMAS;
        }

        function getSchemaById(id) {
            return getRegistry()?.getById?.(id) || getRegistry()?.[id] || null;
        }

        function userCanAccess(schema) {
            if (!schema) return false;
            const allowRoles = Array.isArray(schema.allowRoles) ? schema.allowRoles : [];
            for (const r of allowRoles) {
                const fn = roleFn(r);
                if (typeof fn === 'function' && fn()) return true;
            }
            if (isSupervisorRole()) return true;
            return false;
        }

        function canEditSection(section) {
            if (!section) return true;
            const allow = Array.isArray(section.editableByRole) ? section.editableByRole : [];
            if (!allow.length) return true;
            for (const r of allow) {
                const fn = roleFn(r);
                if (typeof fn === 'function' && fn()) return true;
            }
            if (isSupervisorRole()) return true;
            return false;
        }

        function describeSectionRole(section) {
            if (!section || !Array.isArray(section.editableByRole) || !section.editableByRole.length) return '';
            const map = {
                isPerawatRole: 'Perawat',
                isNurseStationRole: 'Nurse Station',
                isDoctorRole: 'Dokter',
                isPendaftaranRole: 'Pendaftaran',
                isTriaseRole: 'Petugas Triase',
                isIgdRole: 'IGD',
                isPediatrikRole: 'Poli Anak',
                isSupervisorRole: 'Supervisor'
            };
            const out = [];
            section.editableByRole.forEach(function (r) { if (map[r]) out.push(map[r]); });
            return out.join(' / ');
        }

        function ratioNormalize(v) {
            const n = Number(v);
            if (typeof v !== 'number' || Number.isNaN(n)) return 0;
            return Math.max(0, Math.min(1, n));
        }

        function renderBodyMapField(field, schema, editable) {
            return renderBodyMapFieldInner(field, schema, editable);
        }

        function renderBodyMapFieldInner(field, schema, editable) {
            const id = 'f_' + state.schemaId + '_' + field.key;
            state.fieldsById[id] = field;

            const wrap = document.createElement('div');
            wrap.className = BASE_CLASS_PREFIX + '-body-map-wrap';
            wrap.dataset.bodyMapKey = field.key;
            wrap.id = id + '__wrap';

            if (editable) wrap.classList.add('is-clickable');

            const grid = document.createElement('div');
            grid.className = BASE_CLASS_PREFIX + '-body-map-grid';
            const views = [
                { id: 'front', title: 'Tampak Depan', image: 'assets/image/body-front.png' },
                { id: 'back', title: 'Tampak Belakang', image: 'assets/image/body-back.png' },
                { id: 'left', title: 'Tampak Samping Kiri', image: 'assets/image/body-left.png' },
                { id: 'right', title: 'Tampak Samping Kanan', image: 'assets/image/body-right.png' }
            ];
            const bodySvgs = {};
            views.forEach(function (v) {
                const card = document.createElement('div');
                card.className = BASE_CLASS_PREFIX + '-body-card';
                const title = document.createElement('div');
                title.className = BASE_CLASS_PREFIX + '-body-title';
                title.textContent = v.title;
                card.appendChild(title);
                const svgNS = 'http://www.w3.org/2000/svg';
                const svg = document.createElementNS(svgNS, 'svg');
                svg.setAttribute('viewBox', '0 0 120 180');
                svg.setAttribute('xmlns', svgNS);
                svg.classList.add(BASE_CLASS_PREFIX + '-body-figure');
                if (editable) svg.classList.add('is-clickable');
                svg.dataset.view = v.id;
                svg.dataset.bodyMapFieldKey = field.key;
                const img = document.createElementNS(svgNS, 'image');
                img.setAttributeNS('http://www.w3.org/1999/xlink', 'href', v.image);
                img.setAttribute('href', v.image);
                img.setAttribute('x', '0');
                img.setAttribute('y', '0');
                img.setAttribute('width', '120');
                img.setAttribute('height', '180');
                img.setAttribute('preserveAspectRatio', 'xMidYMid meet');
                svg.appendChild(img);
                card.appendChild(svg);
                grid.appendChild(card);
                bodySvgs[v.id] = svg;

                if (editable) {
                    svg.addEventListener('click', function (e) {
                        onBodyMapSvgClick(e, field.key, v.id, bodySvgs);
                    });
                }
            });
            wrap.appendChild(grid);

            const toolbar = document.createElement('div');
            toolbar.className = BASE_CLASS_PREFIX + '-body-map-toolbar';
            const leftBox = document.createElement('div');
            leftBox.className = BASE_CLASS_PREFIX + '-body-map-count';
            leftBox.innerHTML = '📍 Jumlah Tanda : <span data-count="' + field.key + '">0</span> lokasi. Klik gambar untuk menambah tanda lokasi nyeri / kelainan. ' +
                (editable ? '' : '<strong>Mode Lihat Saja</strong>');
            toolbar.appendChild(leftBox);
            if (editable) {
                const clearBtn = document.createElement('button');
                clearBtn.type = 'button';
                clearBtn.className = BASE_CLASS_PREFIX + '-btn ' + BASE_CLASS_PREFIX + '-btn-body-clear';
                clearBtn.dataset.clearFieldKey = field.key;
                clearBtn.textContent = '🔄 Hapus Semua Tanda';
                clearBtn.addEventListener('click', function () {
                    clearBodyMapMarkers(field.key, bodySvgs);
                });
                toolbar.appendChild(clearBtn);
            }
            wrap.appendChild(toolbar);

            const noteRow = document.createElement('div');
            noteRow.className = BASE_CLASS_PREFIX + '-body-map-note-row';
            const noteLabel = document.createElement('label');
            noteLabel.className = BASE_CLASS_PREFIX + '-field-label';
            noteLabel.textContent = field.noteLabel || 'Catatan Lokalis / Keterangan Lokasi Keluhan :';
            if (field.required) {
                const s = document.createElement('span');
                s.className = 'is-required';
                s.textContent = ' *';
                noteLabel.appendChild(s);
            }
            const noteControl = document.createElement('div');
            noteControl.className = BASE_CLASS_PREFIX + '-field-control';
            const noteTextarea = document.createElement('textarea');
            noteTextarea.className = BASE_CLASS_PREFIX + '-textarea';
            noteTextarea.id = id + '__note';
            noteTextarea.dataset.fieldKey = field.key + '__note';
            noteTextarea.rows = Number(field.noteRows || 3);
            noteTextarea.placeholder = field.notePlaceholder || 'Isikan penjelasan lokasi keluhan: misal "Nyeri tekan perut kanan bawah daerah appendiks, nyeri lepas (+), defense musculer (-). Lokasi tanda merah di gambar adalah titik paling nyeri."';
            if (field.required) noteTextarea.required = true;
            if (!editable) { noteTextarea.setAttribute('readonly', 'readonly'); noteTextarea.classList.add('is-readonly'); }
            noteControl.appendChild(noteTextarea);
            noteRow.appendChild(noteLabel);
            noteRow.appendChild(noteControl);
            wireFieldValue(noteTextarea, { key: field.key + '__note' }, 'value');
            wrap.appendChild(noteRow);

            state.bodyMapFields = state.bodyMapFields || {};
            state.bodyMapFields[field.key] = { svgs: bodySvgs };
            return wrap;
        }

        function onBodyMapSvgClick(event, fieldKey, viewId, svgs) {
            const svg = svgs && svgs[viewId] ? svgs[viewId] : null;
            if (!svg) return;
            const rect = svg.getBoundingClientRect();
            if (!rect.width || !rect.height) return;
            const xR = ratioNormalize((event.clientX - rect.left) / rect.width);
            const yR = ratioNormalize((event.clientY - rect.top) / rect.height);
            const entry = {
                id: 'bm-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
                view: String(viewId || ''),
                x: xR,
                y: yR,
                created_at: new Date().toISOString(),
                created_by_name: String(getCurrentOperatorName() || '').trim(),
                created_by_email: String(getCurrentOperatorEmail() || '').trim()
            };
            const values = state.formValues || {};
            const keyStore = fieldKey + '__markers';
            const arr = Array.isArray(values[keyStore]) ? values[keyStore].slice() : [];
            arr.push(entry);
            values[keyStore] = arr;
            state.formValues = values;
            refreshBodyMapVisual(fieldKey);
            onFieldChange();
            scheduleSave(250);
        }

        function clearBodyMapMarkers(fieldKey, svgs) {
            const values = state.formValues || {};
            values[fieldKey + '__markers'] = [];
            state.formValues = values;
            refreshBodyMapVisual(fieldKey);
            onFieldChange();
            scheduleSave(250);
        }

        function refreshBodyMapVisual(fieldKey) {
            const values = state.formValues || {};
            const markers = Array.isArray(values[fieldKey + '__markers']) ? values[fieldKey + '__markers'] : [];
            const fieldEntry = state.bodyMapFields && state.bodyMapFields[fieldKey] ? state.bodyMapFields[fieldKey] : null;
            const svgs = fieldEntry && fieldEntry.svgs ? fieldEntry.svgs : null;
            const countEl = document.querySelector('[data-count="' + fieldKey + '"]');
            if (countEl) countEl.textContent = String(markers.length);
            if (!svgs) return;
            Object.keys(svgs).forEach(function (viewId) {
                const svg = svgs[viewId];
                if (!svg) return;
                const circles = svg.querySelectorAll('circle.' + BASE_CLASS_PREFIX + '-body-marker');
                for (let i = 0; i < circles.length; i++) circles[i].remove();
                const vb = svg.viewBox && svg.viewBox.baseVal ? svg.viewBox.baseVal : null;
                const vbW = vb ? vb.width : 120;
                const vbH = vb ? vb.height : 180;
                const list = markers.filter(function (m) { return String(m?.view || '') === viewId; });
                list.forEach(function (m) {
                    const cx = ratioNormalize(Number(m?.x)) * vbW;
                    const cy = ratioNormalize(Number(m?.y)) * vbH;
                    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                    c.setAttribute('class', BASE_CLASS_PREFIX + '-body-marker');
                    c.setAttribute('cx', String(cx));
                    c.setAttribute('cy', String(cy));
                    c.setAttribute('r', '6.5');
                    svg.appendChild(c);
                });
            });
        }

        function renderGcStyleHeader(schema, patient) {
            const wrap = document.createElement('div');
            wrap.className = BASE_CLASS_PREFIX + '-gc-header';
            const p = patient || {};
            const dt = new Date();
            const yyyy = dt.getFullYear();
            const mm = String(dt.getMonth() + 1).padStart(2, '0');
            const dd = String(dt.getDate()).padStart(2, '0');
            const todayStr = dd + '/' + mm + '/' + yyyy;
            wrap.innerHTML = [
                '<div class="gc-header-box">',
                '  <div class="gc-header-left">',
                '    <div class="gc-logo-wrap"><img class="gc-logo" src="assets/image/logo-rsud.png" alt="Logo RSUD Aji Muhammad Idris"></div>',
                '    <div class="gc-header-center">',
                '      <span class="gc-header-line">RUMAH SAKIT UMUM DAERAH</span>',
                '      <span class="gc-header-strong gc-header-title">AJI MUHAMMAD IDRIS</span>',
                '      <span class="gc-header-line">Kabupaten Berau — Provinsi Kalimantan Timur</span>',
                '      <span class="gc-header-address">Jl. Aji Muhammad Idris No. 1, Telp. (0554) 21009 • Email : rsudajimuhammadidris@beraukab.go.id</span>',
                '    </div>',
                '  </div>',
                '  <div class="gc-patient-col">',
                '    <div class="gc-patient-box">',
                '      <table class="gc-patient-meta">',
                '        <tr><td>No. RM</td><td>:</td><td>' + escapeHtml(String(p.no_rm || '-')) + '</td></tr>',
                '        <tr><td>No. Reg</td><td>:</td><td>' + escapeHtml(String(p.no_registrasi || '-')) + '</td></tr>',
                '        <tr><td>Nama</td><td>:</td><td>' + escapeHtml(String(p.nama_pasien || '-')) + '</td></tr>',
                '        <tr><td id="gc_jk">JK / Umur</td><td>:</td><td>' + escapeHtml(String(p.jenis_kelamin || '-')) + ' / ' + (p.umur != null ? escapeHtml(String(p.umur) + ' thn') : '-') + '</td></tr>',
                '        <tr><td>Tgl</td><td>:</td><td>' + todayStr + '</td></tr>',
                '        <tr><td>Poli</td><td>:</td><td>' + escapeHtml(String(p.poli_tujuan || '-')) + '</td></tr>',
                '        <tr><td>No. Antr</td><td>:</td><td>' + escapeHtml(String(p.no_antrian || '-')) + '</td></tr>',
                '      </table>',
                '    </div>',
                '  </div>',
                '</div>'
            ].join('');
            return wrap.firstElementChild;
        }

        function renderRekapButton(patient) {
            const registry = getRegistry();
            if (!registry || !registry.listAll) return '';
            const patientUnit = String(patient.unit || '').toUpperCase();
            const pasienUmur = patient.umur;
            const poliTujuan = String(patient.poli_tujuan || '').toUpperCase();
            const isPediatrikRow = poliTujuan.includes('ANAK') || poliTujuan.includes('PEDIATRIK')
                || (typeof pasienUmur === 'number' && pasienUmur < 18) || /anak|pediatrik|bayi|balita/i.test(String(patient.poli_tujuan || ''));
            const isUgdRow = patientUnit === 'UGD';

            const available = registry.listAll().filter(function (s) {
                if (!userCanAccess(s)) return false;
                if (s.id === 'triase_ugd') return isUgdRow;
                if (s.id === 'pediatrik_awal') return isPediatrikRow;
                if (s.id === 'rawat_jalan_dewasa') return !isPediatrikRow; // dewasa default non-anak
                return true;
            });
            if (!available.length) return '';
            return available.map(function (s) {
                const tone = s.id === 'triase_ugd'
                    ? 'border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100'
                    : (s.id === 'pediatrik_awal'
                        ? 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800 hover:bg-fuchsia-100'
                        : 'border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100');
                const dataset = JSON.stringify({
                    id: patient.id,
                    nama_pasien: patient.nama_pasien,
                    tanggal_lahir: patient.tanggal_lahir,
                    jenis_kelamin: patient.jenis_kelamin,
                    no_rm: patient.no_rm,
                    no_registrasi: patient.no_registrasi,
                    unit: patient.unit,
                    no_antrian: patient.no_antrian,
                    poli_tujuan: patient.poli_tujuan,
                    umur: patient.umur,
                    alamat: patient.alamat,
                    no_telepon: patient.no_telepon,
                    schemaId: s.id
                });
                const btnLabel = (s.id === 'triase_ugd')
                    ? 'Triase UGD'
                    : (s.id === 'pediatrik_awal' ? 'Asesmen Pediatrik' : 'Asesmen R.Jalan');
                return `<button type="button" class="assessment-shared-btn inline-flex items-center justify-center rounded-lg border ${tone} px-3 py-1.5 text-[11px] font-extrabold transition whitespace-nowrap" data-schema-id="${escapeHtml(String(s.id))}" data-patient='${escapeHtml(dataset)}' title="${escapeHtml(String(s.title || ''))}">${escapeHtml(btnLabel)}</button>`;
            }).join('');
        }

        function handleRekapButtonClick(btnEl) {
            if (!btnEl) return;
            const schemaId = btnEl.getAttribute('data-schema-id');
            const payloadRaw = btnEl.getAttribute('data-patient');
            let payload = null;
            try { payload = JSON.parse(payloadRaw); } catch (_e) { return; }
            if (!payload || !schemaId) return;
            openAssessmentBySchemaId(payload, schemaId);
        }

        function openAssessmentBySchemaId(patientPayload, schemaId) {
            const schema = getSchemaById(schemaId);
            if (!schema) { alert('Skema asesmen tidak ditemukan: ' + String(schemaId)); return; }
            openAssessment(patientPayload, schema);
        }

        async function openAssessment(patientPayload, schemaOrId) {
            if (!patientPayload) return;
            const schema = typeof schemaOrId === 'string' ? getSchemaById(schemaOrId) : schemaOrId;
            if (!schema) { alert('Skema asesmen tidak ditemukan.'); return; }
            if (!userCanAccess(schema)) { alert('Akun Anda tidak diizinkan mengakses formulir ini.'); return; }

            state.schema = schema;
            state.schemaId = String(schema.id || '');
            state.patient = patientPayload;
            state.record = null;
            state.recordId = null;
            state.formValues = {};
            state.lastWriteAt = 0;

            if (state.realtimeChannel) {
                try { supabaseClient.removeChannel(state.realtimeChannel); } catch (_e) {}
                state.realtimeChannel = null;
            }

            applyHeaderMeta(schema, patientPayload);
            applyRoleText(schema);
            renderFormFromSchema(schema);
            openModal();
            setStatus('Memuat data asesmen dari server...', 'loading');
            try {
                await ensureRecordLoaded(schema, patientPayload);
                subscribeRealtime(schema, patientPayload);
                setStatus('Data siap. Perubahan akan disimpan otomatis.', 'ready');
                scheduleSave(0);
            } catch (err) {
                console.warn(err);
                setStatus('Gagal memuat data asesmen, harap Refresh. ' + (err?.message || String(err)), 'error');
            }
        }

        async function ensureRecordLoaded(schema, patient) {
            const pid = String(patient.id || '').trim();
            if (!pid) return;
            const table = schema.table;
            const query = supabaseClient
                .from(table)
                .select('*')
                .eq('pasien_id', pid)
                .order('id', { ascending: false })
                .limit(1);
            const { data, error } = await withTimeout(query, 15000, 'load-' + table);
            if (error) throw new Error(error.message);
            const row = (data && data.length) ? data[0] : null;
            if (row) {
                state.record = row;
                state.recordId = row.id;
                // Combine fixed meta + JSONB column ke formValues
                const combined = {};
                const jsonb = row[schema.jsonbColumn] || {};
                if (jsonb && typeof jsonb === 'object') Object.assign(combined, jsonb);
                // Mirror fixed vital signs ke formValues (jika ada di fixed column):
                const mirrorFixedKeys = ['td_sistolik', 'td_diastolik', 'nadi', 'suhu', 'respirasi', 'spo2', 'berat_badan_kg', 'panjang_badan_cm', 'skala_nyeri_wong_baker', 'kategori_triase'];
                for (const k of mirrorFixedKeys) if (row[k] != null) combined[k] = row[k];
                // category label fallback
                if (!combined.kategori_triase_label && row.kategori_triase_label) combined.kategori_triase_label = row.kategori_triase_label;
                state.formValues = combined;
                hydrateFormFromValues();
            } else {
                state.record = null;
                state.recordId = null;
                state.formValues = {};
                hydrateFormFromValues();
            }
            syncFixedBadges();
        }

        function subscribeRealtime(schema, patient) {
            const pid = String(patient.id || '').trim();
            if (!pid) return;
            const table = schema.table;
            try {
                state.realtimeChannel = supabaseClient
                    .channel('simami-shared-assessment-' + table + '-' + pid)
                    .on('postgres_changes', { event: '*', schema: 'public', table: table, filter: 'pasien_id=eq.' + pid }, function () {
                        if (Date.now() - state.lastWriteAt < 1500) return;
                        refreshCurrentRecord(true);
                    })
                    .subscribe();
            } catch (_e) {
                state.realtimeChannel = null;
            }
        }

        async function refreshCurrentRecord(fromRealtime) {
            if (!state.schema || !state.patient) return;
            try {
                await ensureRecordLoaded(state.schema, state.patient);
                if (fromRealtime) setStatus('Data diperbarui dari perangkat lain (realtime).', 'sync');
            } catch (err) {
                setStatus('Gagal refresh data. ' + (err?.message || String(err)), 'error');
            }
        }

        // ---- UI Rendering dari Schema ----
        function renderFormFromSchema(schema) {
            state.fieldsById = {};
            const form = dom.form;
            if (!form) return;
            form.innerHTML = '';

            if (schema.useGcHeaderStyle) {
                const kopEl = renderGcStyleHeader(schema, state.patient);
                if (kopEl) form.appendChild(kopEl);
                const titleBox = document.createElement('div');
                titleBox.className = BASE_CLASS_PREFIX + '-print-title-box';
                const printTitle = document.createElement('div');
                printTitle.className = BASE_CLASS_PREFIX + '-print-title';
                printTitle.textContent = schema.printTitle || schema.title || '';
                titleBox.appendChild(printTitle);
                if (schema.printSubtitle) {
                    const printSub = document.createElement('div');
                    printSub.className = BASE_CLASS_PREFIX + '-print-subtitle';
                    printSub.textContent = schema.printSubtitle;
                    titleBox.appendChild(printSub);
                }
                form.appendChild(titleBox);
            }

            const sections = Array.isArray(schema.sections) ? schema.sections : [];
            sections.forEach(function (section, idx) {
                const sec = document.createElement('section');
                sec.className = BASE_CLASS_PREFIX + '-section';
                sec.dataset.sectionKey = section.key || 'sec-' + idx;
                if (section.pageBreakBefore) sec.classList.add('is-page-break-before');
                const editable = canEditSection(section);
                if (!editable) sec.classList.add('is-locked');
                const tone = String(section.roleTone || '').toLowerCase();
                if (tone === 'nurse') sec.classList.add('is-nurse-section');
                else if (tone === 'doctor') sec.classList.add('is-doctor-section');

                const head = document.createElement('div');
                head.className = BASE_CLASS_PREFIX + '-section-head';
                const headTop = document.createElement('div');
                headTop.className = BASE_CLASS_PREFIX + '-section-head-top';
                const title = document.createElement('h3');
                title.className = BASE_CLASS_PREFIX + '-section-title';
                title.textContent = section.title || 'Bagian ' + (idx + 1);
                headTop.appendChild(title);
                if (section.roleLabel) {
                    const pill = document.createElement('span');
                    const toneCls = tone === 'doctor' ? 'is-doctor' : 'is-nurse';
                    pill.className = BASE_CLASS_PREFIX + '-role-pill ' + toneCls;
                    pill.textContent = section.roleLabel;
                    headTop.appendChild(pill);
                }
                head.appendChild(headTop);
                if (!editable) {
                    const note = document.createElement('div');
                    note.className = BASE_CLASS_PREFIX + '-readonly-note';
                    const who = describeSectionRole(section) || 'role yang berwenang';
                    note.textContent = '🔒 Bagian ini hanya dapat diisi oleh ' + who + '. Akun Anda hanya bisa melihat data dan perubahan realtime.';
                    head.appendChild(note);
                }
                if (section.hint) {
                    const hint = document.createElement('p');
                    hint.className = BASE_CLASS_PREFIX + '-section-hint';
                    hint.textContent = section.hint;
                    head.appendChild(hint);
                }
                sec.appendChild(head);

                const body = document.createElement('div');
                body.className = BASE_CLASS_PREFIX + '-section-body';
                if (!editable) body.classList.add('is-locked-body');
                const fields = Array.isArray(section.fields) ? section.fields : [];

                const vitals = fields.filter(function (f) { return f.vitalSign === true; });
                const nonVitals = fields.filter(function (f) { return f.vitalSign !== true; });

                if (vitals.length) {
                    const vt = renderVitalSignTable(vitals, schema);
                    if (vt) body.appendChild(vt);
                }

                nonVitals.forEach(function (field) {
                    if (field.computed) return;
                    if (field.type === 'body-map') {
                        const mapRow = renderBodyMapField(field, schema, editable);
                        if (mapRow) {
                            if (!editable) mapRow.classList.add('is-locked-field');
                            body.appendChild(mapRow);
                        }
                        return;
                    }
                    const row = renderFieldRow(field, schema);
                    if (row) {
                        if (!editable) row.classList.add('is-locked-field');
                        body.appendChild(row);
                    }
                });

                if (section.key === 'hal1_pemeriksaan_vitals') {
                    const imtRow = document.createElement('div');
                    imtRow.className = BASE_CLASS_PREFIX + '-field-row is-computed';
                    const imtLabel = document.createElement('label');
                    imtLabel.className = BASE_CLASS_PREFIX + '-field-label';
                    imtLabel.textContent = 'IMT (Indeks Massa Tubuh)';
                    imtRow.appendChild(imtLabel);
                    const imtCtrl = document.createElement('div');
                    imtCtrl.className = BASE_CLASS_PREFIX + '-field-control';
                    const imtInput = document.createElement('input');
                    imtInput.type = 'text';
                    imtInput.id = 'f_' + state.schemaId + '_imt_computed';
                    imtInput.dataset.fieldKey = 'imt';
                    imtInput.className = BASE_CLASS_PREFIX + '-line is-readonly';
                    imtInput.readOnly = true;
                    imtInput.placeholder = 'Otomatis dihitung ketika BB & TB terisi';
                    imtCtrl.appendChild(imtInput);
                    imtRow.appendChild(imtCtrl);
                    if (!editable) imtRow.classList.add('is-locked-field');
                    body.appendChild(imtRow);
                }

                if (!editable) {
                    const inputs = body.querySelectorAll('input, textarea, select, button');
                    for (let i = 0; i < inputs.length; i++) {
                        const inp = inputs[i];
                        if (inp.type === 'radio' || inp.type === 'checkbox') inp.disabled = true;
                        else { inp.setAttribute('readonly', 'readonly'); inp.classList.add('is-readonly'); }
                    }
                }

                sec.appendChild(body);
                form.appendChild(sec);
            });

            const signatureEl = renderSignatureSection(schema);
            if (signatureEl) form.appendChild(signatureEl);

            hydrateFormFromValues();
            refreshComputedFields();
        }

        function renderVitalSignTable(vitals, schema) {
            const wrap = document.createElement('div');
            wrap.className = BASE_CLASS_PREFIX + '-vital-table-wrap';
            const label = document.createElement('div');
            label.className = BASE_CLASS_PREFIX + '-vital-label';
            label.textContent = 'PENGUKURAN VITAL SIGN';
            wrap.appendChild(label);
            const table = document.createElement('table');
            table.className = BASE_CLASS_PREFIX + '-vital-table';
            const thead = document.createElement('thead');
            const headRow = document.createElement('tr');
            vitals.forEach(function (f) {
                const th = document.createElement('th');
                th.textContent = f.label || f.key;
                const suf = f.suffix ? (' (' + f.suffix + ')') : '';
                th.innerHTML = escapeHtml(f.label || f.key) + (suf ? '<span class="muted"> ' + escapeHtml(suf) + '</span>' : '');
                headRow.appendChild(th);
            });
            thead.appendChild(headRow);
            table.appendChild(thead);
            const tbody = document.createElement('tbody');
            const row = document.createElement('tr');
            vitals.forEach(function (f) {
                const td = document.createElement('td');
                const input = buildInputElement(f, schema);
                input.classList.add(BASE_CLASS_PREFIX + '-vital-input');
                td.appendChild(input);
                row.appendChild(td);
            });
            tbody.appendChild(row);
            table.appendChild(tbody);
            wrap.appendChild(table);
            return wrap;
        }

        function renderFieldRow(field, schema) {
            const row = document.createElement('div');
            row.className = BASE_CLASS_PREFIX + '-field-row';
            if (field.type === 'wong-baker-0-5') row.classList.add('is-wong-baker');
            const labelEl = document.createElement('label');
            labelEl.className = BASE_CLASS_PREFIX + '-field-label';
            labelEl.textContent = field.label || field.key;
            if (field.required) {
                const star = document.createElement('span');
                star.className = 'is-required';
                star.textContent = ' *';
                labelEl.appendChild(star);
            }
            row.appendChild(labelEl);
            const ctrl = document.createElement('div');
            ctrl.className = BASE_CLASS_PREFIX + '-field-control';
            const input = buildInputElement(field, schema);
            if (input) ctrl.appendChild(input);
            row.appendChild(ctrl);
            return row;
        }

        function buildInputElement(field, schema) {
            const id = 'f_' + state.schemaId + '_' + field.key;
            state.fieldsById[id] = field;
            const t = field.type || 'text';

            if (t === 'textarea') {
                const ta = document.createElement('textarea');
                ta.id = id;
                ta.dataset.fieldKey = field.key;
                ta.rows = Number(field.rows || 2);
                ta.placeholder = field.placeholder || '';
                ta.className = BASE_CLASS_PREFIX + '-textarea';
                if (field.required) ta.required = true;
                wireFieldValue(ta, field, 'value');
                return ta;
            }
            if (t === 'radio-group') {
                const wrap = document.createElement('div');
                wrap.className = BASE_CLASS_PREFIX + '-options';
                const opts = (Array.isArray(field.options) ? field.options : []).map(function (opt) {
                    if (opt && typeof opt === 'object') return { value: String(opt.value), label: String(opt.label) };
                    return { value: String(opt), label: String(opt) };
                });
                opts.forEach(function (opt) {
                    const lbl = document.createElement('label');
                    lbl.className = BASE_CLASS_PREFIX + '-option';
                    const radio = document.createElement('input');
                    radio.type = 'radio';
                    radio.name = 'grp_' + state.schemaId + '_' + field.key;
                    radio.dataset.fieldKey = field.key;
                    radio.value = opt.value;
                    radio.className = BASE_CLASS_PREFIX + '-radio';
                    const span = document.createElement('span');
                    span.textContent = opt.label;
                    lbl.appendChild(radio);
                    lbl.appendChild(span);
                    wrap.appendChild(lbl);
                    wireFieldValue(radio, field, 'checked');
                });
                if (field.otherField) {
                    const otherLabel = document.createElement('label');
                    otherLabel.className = BASE_CLASS_PREFIX + '-other';
                    otherLabel.textContent = 'Lainnya: ';
                    const otherInput = document.createElement('input');
                    otherInput.type = 'text';
                    otherInput.className = BASE_CLASS_PREFIX + '-line';
                    otherInput.id = id + '__other';
                    otherInput.dataset.fieldKey = field.key + '__other';
                    otherInput.placeholder = 'Keterangan lainnya';
                    wireFieldValue(otherInput, { key: field.key + '__other' }, 'value');
                    otherLabel.appendChild(otherInput);
                    wrap.appendChild(otherLabel);
                }
                return wrap;
            }
            if (t === 'checkbox-group') {
                const wrap = document.createElement('div');
                wrap.className = BASE_CLASS_PREFIX + '-options is-checkbox';
                const opts = (Array.isArray(field.options) ? field.options : []).map(String);
                opts.forEach(function (opt) {
                    const lbl = document.createElement('label');
                    lbl.className = BASE_CLASS_PREFIX + '-option';
                    const cb = document.createElement('input');
                    cb.type = 'checkbox';
                    cb.dataset.fieldKey = field.key + '[]';
                    cb.dataset.optionValue = opt;
                    cb.value = opt;
                    cb.className = BASE_CLASS_PREFIX + '-checkbox';
                    const span = document.createElement('span');
                    span.textContent = opt;
                    lbl.appendChild(cb);
                    lbl.appendChild(span);
                    wrap.appendChild(lbl);
                    wireCheckboxField(cb, field);
                });
                if (field.otherField) {
                    const otherLabel = document.createElement('label');
                    otherLabel.className = BASE_CLASS_PREFIX + '-other';
                    otherLabel.textContent = 'Lainnya: ';
                    const otherInput = document.createElement('input');
                    otherInput.type = 'text';
                    otherInput.className = BASE_CLASS_PREFIX + '-line';
                    otherInput.id = id + '__other';
                    otherInput.dataset.fieldKey = field.key + '__other';
                    otherInput.placeholder = 'Keterangan lainnya';
                    wireFieldValue(otherInput, { key: field.key + '__other' }, 'value');
                    otherLabel.appendChild(otherInput);
                    wrap.appendChild(otherLabel);
                }
                return wrap;
            }
            if (t === 'wong-baker-0-5') {
                const wrap = document.createElement('div');
                wrap.className = BASE_CLASS_PREFIX + '-wong-baker';
                const faces = [
                    { value: 0, label: '0 - Tidak Nyeri', face: '😊' },
                    { value: 1, label: '1 - Nyeri Ringan', face: '🙂' },
                    { value: 2, label: '2 - Nyeri Sedikit', face: '😐' },
                    { value: 3, label: '3 - Nyeri Sedang', face: '😟' },
                    { value: 4, label: '4 - Nyeri Hebat', face: '😢' },
                    { value: 5, label: '5 - Nyeri Paling Hebat', face: '😭' }
                ];
                faces.forEach(function (f) {
                    const lbl = document.createElement('label');
                    lbl.className = BASE_CLASS_PREFIX + '-wb-item';
                    const radio = document.createElement('input');
                    radio.type = 'radio';
                    radio.name = 'wb_' + state.schemaId + '_' + field.key;
                    radio.dataset.fieldKey = field.key;
                    radio.value = String(f.value);
                    const face = document.createElement('div');
                    face.className = BASE_CLASS_PREFIX + '-wb-face';
                    face.textContent = f.face;
                    const vlabel = document.createElement('div');
                    vlabel.className = BASE_CLASS_PREFIX + '-wb-label';
                    vlabel.textContent = f.label;
                    lbl.appendChild(radio);
                    lbl.appendChild(face);
                    lbl.appendChild(vlabel);
                    wrap.appendChild(lbl);
                    wireFieldValue(radio, field, 'checked');
                });
                return wrap;
            }
            if (t === 'body-map') {
                return renderBodyMapFieldInner(field, schema, true);
            }
            if (t === 'date') {
                const input = document.createElement('input');
                input.type = 'date';
                input.id = id;
                input.dataset.fieldKey = field.key;
                input.className = BASE_CLASS_PREFIX + '-line';
                if (field.required) input.required = true;
                wireFieldValue(input, field, 'value');
                return input;
            }
            if (t === 'number') {
                const input = document.createElement('input');
                input.type = 'number';
                input.id = id;
                input.dataset.fieldKey = field.key;
                if (typeof field.min === 'number') input.min = String(field.min);
                if (typeof field.max === 'number') input.max = String(field.max);
                if (typeof field.step === 'number') input.step = String(field.step);
                input.placeholder = (field.placeholder ? field.placeholder : (field.suffix ? 'isi dalam ' + field.suffix : ''));
                input.className = BASE_CLASS_PREFIX + '-line';
                if (field.required) input.required = true;
                wireFieldValue(input, field, 'value');
                if (field.suffix) {
                    const wrap = document.createElement('div');
                    wrap.className = BASE_CLASS_PREFIX + '-suffix-wrap';
                    wrap.appendChild(input);
                    const suf = document.createElement('span');
                    suf.className = BASE_CLASS_PREFIX + '-suffix';
                    suf.textContent = field.suffix;
                    wrap.appendChild(suf);
                    return wrap;
                }
                return input;
            }
            // default text
            const input = document.createElement('input');
            input.type = 'text';
            input.id = id;
            input.dataset.fieldKey = field.key;
            input.placeholder = field.placeholder || '';
            input.className = BASE_CLASS_PREFIX + '-line';
            if (field.required) input.required = true;
            wireFieldValue(input, field, 'value');
            return input;
        }

        function wireFieldValue(el, field, prop) {
            const key = field.key;
            el.addEventListener('input', function () { onFieldChange(); scheduleSave(600); }, { passive: true });
            el.addEventListener('change', function () { onFieldChange(); scheduleSave(250); }, { passive: true });
        }

        function wireCheckboxField(el, field) {
            el.addEventListener('change', function () { onFieldChange(); scheduleSave(250); }, { passive: true });
        }

        function onFieldChange() {
            collectFormValuesIntoState();
            refreshComputedFields();
            syncFixedBadges();
        }

        function refreshComputedFields() {
            const values = state.formValues || {};
            const schema = state.schema;
            if (!schema || schema.id !== 'rawat_jalan_pd') return;
            const bb = Number(values.berat_badan);
            const tbCm = Number(values.tinggi_badan);
            let imtText = '';
            if (!Number.isNaN(bb) && !Number.isNaN(tbCm) && tbCm > 0 && bb > 0) {
                const tbM = tbCm / 100.0;
                const imtVal = bb / (tbM * tbM);
                let ket = '';
                if (imtVal < 18.5) ket = ' (Kurus)';
                else if (imtVal < 25) ket = ' (Normal)';
                else if (imtVal < 30) ket = ' (Gemuk)';
                else ket = ' (Obesitas)';
                imtText = imtVal.toFixed(1) + ket;
            }
            const imtEl = document.getElementById('f_' + state.schemaId + '_imt_computed');
            if (imtEl) { imtEl.value = imtText; values.imt = imtText; }
        }

        function collectFormValuesIntoState() {
            const form = dom.form;
            if (!form) return;
            const values = {};
            // inputs with data-fieldKey
            const inputs = form.querySelectorAll('[data-field-key]');
            for (let i = 0; i < inputs.length; i++) {
                const el = inputs[i];
                const key = el.getAttribute('data-field-key') || '';
                if (!key) continue;
                if (el.type === 'radio') {
                    if (el.checked) values[key.replace(/\[\]$/, '')] = el.value;
                    continue;
                }
                if (el.type === 'checkbox') {
                    const arrKey = key.replace(/\[\]$/, '');
                    if (!Array.isArray(values[arrKey])) values[arrKey] = [];
                    if (el.checked) {
                        const opt = el.getAttribute('data-option-value') || el.value || '';
                        if (opt) values[arrKey].push(opt);
                    }
                    continue;
                }
                if (el.type === 'number') {
                    const raw = el.value;
                    if (raw === '' || raw == null) { values[key] = null; continue; }
                    values[key] = Number.isNaN(Number(raw)) ? raw : Number(raw);
                    continue;
                }
                values[key] = (el.value == null ? '' : String(el.value));
            }
            state.formValues = values;
            return values;
        }

        function hydrateFormFromValues() {
            const form = dom.form;
            if (!form) return;
            const values = state.formValues || {};
            const inputs = form.querySelectorAll('[data-field-key]');
            for (let i = 0; i < inputs.length; i++) {
                const el = inputs[i];
                const key = el.getAttribute('data-field-key') || '';
                if (!key) continue;
                if (el.type === 'radio') {
                    const arrKey = key.replace(/\[\]$/, '');
                    el.checked = String(values[arrKey] ?? '') === String(el.value ?? '');
                    continue;
                }
                if (el.type === 'checkbox') {
                    const arrKey = key.replace(/\[\]$/, '');
                    const arr = Array.isArray(values[arrKey]) ? values[arrKey] : [];
                    const opt = el.getAttribute('data-option-value') || el.value || '';
                    el.checked = arr.indexOf(opt) !== -1;
                    continue;
                }
                const raw = values[key];
                if (raw != null) el.value = String(raw); else el.value = '';
            }
            if (state.bodyMapFields) {
                Object.keys(state.bodyMapFields).forEach(function (fieldKey) {
                    refreshBodyMapVisual(fieldKey);
                });
            }
        }

        function syncFixedBadges() {
            const schema = state.schema;
            if (!schema) return;
            const v = state.formValues || {};
            const ews = calculateEwsScore(schema, v);
            if (dom.ewsBadge) {
                dom.ewsBadge.textContent = (schema?.fixedMeta?.skorLabel || 'Skor EWS') + ': ' + String(ews);
                if (ews >= 5) { dom.ewsBadge.className = BASE_CLASS_PREFIX + '-ews-badge is-high'; }
                else if (ews >= 3) { dom.ewsBadge.className = BASE_CLASS_PREFIX + '-ews-badge is-medium'; }
                else { dom.ewsBadge.className = BASE_CLASS_PREFIX + '-ews-badge is-low'; }
            }
            if (schema.id === 'triase_ugd' && v.kategori_triase) {
                const mapping = {
                    1: { cls: 'is-k1', label: 'KATEGORI 1 - RESUSITASI' },
                    2: { cls: 'is-k2', label: 'KATEGORI 2 - EMERGENSI' },
                    3: { cls: 'is-k3', label: 'KATEGORI 3 - URGEN' },
                    4: { cls: 'is-k4', label: 'KATEGORI 4 - KURANG URGEN' },
                    5: { cls: 'is-k5', label: 'KATEGORI 5 - NON URGEN' }
                };
                const info = mapping[Number(v.kategori_triase)] || null;
                if (dom.kategoriBadge && info) {
                    dom.kategoriBadge.className = BASE_CLASS_PREFIX + '-kategori-badge ' + info.cls;
                    dom.kategoriBadge.textContent = info.label;
                }
            }
        }

        function calculateEwsScore(schema, v) {
            // Skor EWS / PEWS standar ringkas; disesuaikan RS nanti
            const td_sistolik = Number(v.td_sistolik);
            const nadi = Number(v.nadi);
            const rr = Number(v.rr) || Number(v.respirasi);
            const suhu = Number(v.suhu);
            const spo2 = Number(v.spo2);
            let score = 0;
            if (!Number.isNaN(td_sistolik)) {
                if (td_sistolik <= 70) score += 3;
                else if (td_sistolik >= 200) score += 2;
                else if (td_sistolik < 90) score += 2;
                else if (td_sistolik > 180) score += 1;
            }
            if (!Number.isNaN(nadi)) {
                if (nadi <= 40) score += 3;
                else if (nadi >= 130) score += 3;
                else if (nadi < 60) score += 1;
                else if (nadi > 110) score += 1;
            }
            if (!Number.isNaN(rr)) {
                if (rr <= 8) score += 2;
                else if (rr >= 30) score += 3;
                else if (rr < 12) score += 1;
                else if (rr > 20) score += 1;
            }
            if (!Number.isNaN(suhu)) {
                if (suhu >= 38.5) score += 2;
                else if (suhu < 35) score += 2;
                else if (suhu >= 38) score += 1;
            }
            if (!Number.isNaN(spo2) && spo2 > 0) {
                if (spo2 < 92) score += 3;
                else if (spo2 < 95) score += 2;
                else if (spo2 < 96) score += 1;
            }
            return Math.min(20, score);
        }

        function renderSignatureSection(schema) {
            const wrap = document.createElement('section');
            wrap.className = BASE_CLASS_PREFIX + '-sign-section';
            const custom = schema.signature && typeof schema.signature === 'object' ? schema.signature : null;

            if (custom) {
                const lokasi = String(custom.footerLokasi || 'Muara Badak');
                const timezone = String(custom.timezone || 'WITA');
                const dt = new Date();
                const yyyy = dt.getFullYear();
                const mm = String(dt.getMonth() + 1).padStart(2, '0');
                const dd = String(dt.getDate()).padStart(2, '0');
                const hh = String(dt.getHours()).padStart(2, '0');
                const mi = String(dt.getMinutes()).padStart(2, '0');
                const todayStr = dd + '  /  ' + mm + '  /  ' + yyyy;
                const jamStr = hh + ' : ' + mi;
                const head = document.createElement('div');
                head.className = BASE_CLASS_PREFIX + '-sign-meta-row';
                const locationEl = document.createElement('div');
                locationEl.className = BASE_CLASS_PREFIX + '-sign-location';
                locationEl.textContent = lokasi + ',  Tgl  ..........................................    Jam  ................    ' + timezone;
                head.appendChild(locationEl);
                wrap.appendChild(head);

                const row = document.createElement('div');
                row.className = BASE_CLASS_PREFIX + '-sign-row is-two-col';

                const labelPerawat = custom.perawat?.label || 'Perawat Pemeriksa';
                const labelDokter = custom.dokter?.label || 'Dokter DPJP';
                const stampPerawatField = custom.perawat?.stampField || 'perawat_nama_stamp';
                const stampDokterField = custom.dokter?.stampField || 'dokter_nama_stamp';
                const nipPerawatField = custom.perawat?.nipField || 'perawat_nip';
                const nipDokterField = custom.dokter?.nipField || 'dokter_nip';

                const defaultPerawatNama = (isPerawatRole() || isNurseStationRole()) ? (getCurrentOperatorName() || '') : '';
                const defaultDokterNama = isDoctorRole() ? (getCurrentOperatorName() || '') : '';

                const colPerawat = document.createElement('div');
                colPerawat.className = BASE_CLASS_PREFIX + '-sign-col';
                colPerawat.innerHTML = [
                    '<div class="' + BASE_CLASS_PREFIX + '-sign-title">' + escapeHtml(labelPerawat) + '</div>',
                    '<div class="' + BASE_CLASS_PREFIX + '-sign-space is-short"></div>',
                    '<div class="' + BASE_CLASS_PREFIX + '-sign-name">Nama : <input type="text" class="' + BASE_CLASS_PREFIX + '-line" data-field-key="' + stampPerawatField + '" value="' + escapeHtml(defaultPerawatNama) + '" placeholder="Nama lengkap terang"></div>',
                    '<div class="' + BASE_CLASS_PREFIX + '-sign-nip">NIP   : <input type="text" class="' + BASE_CLASS_PREFIX + '-line" data-field-key="' + nipPerawatField + '" placeholder="NIP / NIK perawat"></div>'
                ].join('');
                row.appendChild(colPerawat);

                const colDokter = document.createElement('div');
                colDokter.className = BASE_CLASS_PREFIX + '-sign-col';
                colDokter.innerHTML = [
                    '<div class="' + BASE_CLASS_PREFIX + '-sign-title">' + escapeHtml(labelDokter) + '</div>',
                    '<div class="' + BASE_CLASS_PREFIX + '-sign-space is-short"></div>',
                    '<div class="' + BASE_CLASS_PREFIX + '-sign-name">Nama : <input type="text" class="' + BASE_CLASS_PREFIX + '-line" data-field-key="' + stampDokterField + '" value="' + escapeHtml(defaultDokterNama) + '" placeholder="dr. Nama lengkap"></div>',
                    '<div class="' + BASE_CLASS_PREFIX + '-sign-nip">SIP  : <input type="text" class="' + BASE_CLASS_PREFIX + '-line" data-field-key="' + nipDokterField + '" placeholder="No. SIP / NIP dokter"></div>'
                ].join('');
                row.appendChild(colDokter);

                wrap.appendChild(row);
                setTimeout(function () {
                    const locVal = document.querySelector('[data-field-key="' + stampPerawatField + '__loc"]');
                }, 0);
                return wrap;
            }

            const head = document.createElement('div');
            head.className = BASE_CLASS_PREFIX + '-sign-head';
            head.textContent = 'FINALISASI DAN TANDA TANGAN PERAWAT / DOKTER';
            wrap.appendChild(head);
            const row = document.createElement('div');
            row.className = BASE_CLASS_PREFIX + '-sign-row';
            const colPerawat = document.createElement('div');
            colPerawat.className = BASE_CLASS_PREFIX + '-sign-col';
            colPerawat.innerHTML = [
                '<div class="' + BASE_CLASS_PREFIX + '-sign-title">Perawat Pemeriksa</div>',
                '<div class="' + BASE_CLASS_PREFIX + '-sign-meta">Tanggal <input type="text" class="' + BASE_CLASS_PREFIX + '-line is-sign-date" id="sh_sign_tanggal_perawat" placeholder="dd/mm/yyyy"> Jam <input type="text" class="' + BASE_CLASS_PREFIX + '-line is-sign-date" id="sh_sign_jam_perawat" placeholder="HH:MM"> Wita</div>',
                '<div class="' + BASE_CLASS_PREFIX + '-sign-space"></div>',
                '<div class="' + BASE_CLASS_PREFIX + '-sign-name-row">Nama : <input type="text" class="' + BASE_CLASS_PREFIX + '-line" id="sh_sign_nama_perawat" placeholder="Nama perawat"></div>'
            ].join('');
            row.appendChild(colPerawat);
            const colDokter = document.createElement('div');
            colDokter.className = BASE_CLASS_PREFIX + '-sign-col';
            colDokter.innerHTML = [
                '<div class="' + BASE_CLASS_PREFIX + '-sign-title">Dokter (jika ada)</div>',
                '<div class="' + BASE_CLASS_PREFIX + '-sign-meta">Tanggal <input type="text" class="' + BASE_CLASS_PREFIX + '-line is-sign-date" id="sh_sign_tanggal_dokter" placeholder="dd/mm/yyyy"> Jam <input type="text" class="' + BASE_CLASS_PREFIX + '-line is-sign-date" id="sh_sign_jam_dokter" placeholder="HH:MM"> Wita</div>',
                '<div class="' + BASE_CLASS_PREFIX + '-sign-space"></div>',
                '<div class="' + BASE_CLASS_PREFIX + '-sign-name-row">Nama : <input type="text" class="' + BASE_CLASS_PREFIX + '-line" id="sh_sign_nama_dokter" placeholder="Nama dokter"></div>'
            ].join('');
            row.appendChild(colDokter);
            wrap.appendChild(row);

            const dt = new Date();
            const yyyy = dt.getFullYear();
            const mm = String(dt.getMonth() + 1).padStart(2, '0');
            const dd = String(dt.getDate()).padStart(2, '0');
            const hh = String(dt.getHours()).padStart(2, '0');
            const mi = String(dt.getMinutes()).padStart(2, '0');
            setTimeout(function () {
                const tp = document.getElementById('sh_sign_tanggal_perawat'); if (tp && !tp.value) tp.value = dd + '/' + mm + '/' + yyyy;
                const jp = document.getElementById('sh_sign_jam_perawat'); if (jp && !jp.value) jp.value = hh + ':' + mi;
                const np = document.getElementById('sh_sign_nama_perawat'); if (np && !np.value) np.value = getCurrentOperatorName() || '';
            }, 30);
            return wrap;
        }

        // ---- Header / Status / Modal ----
        function ensureModalInjected() {
            if (document.getElementById(MODAL_ID)) return;
            const wrap = document.createElement('div');
            wrap.innerHTML = [
                '<div id="' + MODAL_ID + '" class="' + BASE_CLASS_PREFIX + '-modal" aria-hidden="true">',
                '  <div class="' + BASE_CLASS_PREFIX + '-overlay"></div>',
                '  <div class="' + BASE_CLASS_PREFIX + '-dialog">',
                '    <div class="' + BASE_CLASS_PREFIX + '-panel">',
                '      <div class="' + BASE_CLASS_PREFIX + '-shell">',
                '        <div class="' + BASE_CLASS_PREFIX + '-toolbar">',
                '          <div class="' + BASE_CLASS_PREFIX + '-toolbar-main">',
                '            <div class="' + BASE_CLASS_PREFIX + '-kicker">Asesmen Terpadu</div>',
                '            <div id="' + BASE_CLASS_PREFIX + '_title" class="' + BASE_CLASS_PREFIX + '-title">Asesmen</div>',
                '            <div id="' + BASE_CLASS_PREFIX + '_subtitle" class="' + BASE_CLASS_PREFIX + '-subtitle">-</div>',
                '            <div class="' + BASE_CLASS_PREFIX + '-badges">',
                '              <div id="' + BASE_CLASS_PREFIX + '_role" class="' + BASE_CLASS_PREFIX + '-role-badge">Role: -</div>',
                '              <div id="' + BASE_CLASS_PREFIX + '_ews" class="' + BASE_CLASS_PREFIX + '-ews-badge is-low">Skor: 0</div>',
                '              <div id="' + BASE_CLASS_PREFIX + '_kategori" class="' + BASE_CLASS_PREFIX + '-kategori-badge hidden"></div>',
                '            </div>',
                '          </div>',
                '          <div class="' + BASE_CLASS_PREFIX + '-toolbar-actions">',
                '            <div id="' + BASE_CLASS_PREFIX + '_status" class="' + BASE_CLASS_PREFIX + '-status">Siap</div>',
                '            <button type="button" class="' + BASE_CLASS_PREFIX + '-btn ' + BASE_CLASS_PREFIX + '-btn-secondary" id="' + BASE_CLASS_PREFIX + '_refresh">Refresh</button>',
                '            <button type="button" class="' + BASE_CLASS_PREFIX + '-btn ' + BASE_CLASS_PREFIX + '-btn-print" id="' + BASE_CLASS_PREFIX + '_print">Cetak</button>',
                '            <button type="button" class="' + BASE_CLASS_PREFIX + '-btn ' + BASE_CLASS_PREFIX + '-btn-primary" id="' + BASE_CLASS_PREFIX + '_finalize" title="Kunci formulir (hanya bisa dibuka supervisor)">Finalisasi & Kunci</button>',
                '            <button type="button" class="' + BASE_CLASS_PREFIX + '-btn ' + BASE_CLASS_PREFIX + '-btn-primary" id="' + BASE_CLASS_PREFIX + '_close">Tutup</button>',
                '          </div>',
                '        </div>',
                '        <div class="' + BASE_CLASS_PREFIX + '-body">',
                '          <div id="' + FORM_ID + '" class="' + BASE_CLASS_PREFIX + '-document"></div>',
                '        </div>',
                '      </div>',
                '    </div>',
                '  </div>',
                '</div>'
            ].join('');
            document.body.appendChild(wrap.firstElementChild);
        }

        function wireDom() {
            dom.modal = document.getElementById(MODAL_ID);
            dom.overlay = dom.modal?.querySelector('.' + BASE_CLASS_PREFIX + '-overlay');
            dom.closeBtn = document.getElementById(BASE_CLASS_PREFIX + '_close');
            dom.printBtn = document.getElementById(BASE_CLASS_PREFIX + '_print');
            dom.refreshBtn = document.getElementById(BASE_CLASS_PREFIX + '_refresh');
            dom.finalizeBtn = document.getElementById(BASE_CLASS_PREFIX + '_finalize');
            dom.statusEl = document.getElementById(BASE_CLASS_PREFIX + '_status');
            dom.titleEl = document.getElementById(BASE_CLASS_PREFIX + '_title');
            dom.subtitleEl = document.getElementById(BASE_CLASS_PREFIX + '_subtitle');
            dom.roleBadge = document.getElementById(BASE_CLASS_PREFIX + '_role');
            dom.ewsBadge = document.getElementById(BASE_CLASS_PREFIX + '_ews');
            dom.kategoriBadge = document.getElementById(BASE_CLASS_PREFIX + '_kategori');
            dom.form = document.getElementById(FORM_ID);
        }

        function wireEvents() {
            dom.closeBtn.addEventListener('click', closeModal);
            dom.overlay.addEventListener('click', closeModal);
            dom.refreshBtn.addEventListener('click', function () {
                if (!state.schema || !state.patient) return;
                setStatus('Refreshing...', 'loading');
                refreshCurrentRecord(false).then(function () { setStatus('Data diperbarui.', 'ready'); });
            });
            dom.printBtn.addEventListener('click', triggerPrint);
            dom.finalizeBtn.addEventListener('click', finalizeCurrent);
            document.addEventListener('keydown', function (e) {
                if (e.key === 'Escape' && dom.modal.classList.contains('is-open')) { closeModal(); }
            });
        }

        function applyHeaderMeta(schema, patient) {
            if (dom.titleEl) dom.titleEl.textContent = schema.title || 'Asesmen';
            const lines = [
                'No RM: ' + String(patient.no_rm || '-'),
                'No Reg: ' + String(patient.no_registrasi || '-'),
                'Nama: ' + String(patient.nama_pasien || '-'),
                'JK: ' + String(patient.jenis_kelamin || '-'),
                'Umur: ' + (patient.umur != null ? String(patient.umur) : '-'),
                'Unit: ' + String(patient.unit || '-') + (patient.poli_tujuan ? (' / ' + String(patient.poli_tujuan)) : '')
            ];
            if (dom.subtitleEl) dom.subtitleEl.textContent = lines.join('  |  ');
            if (dom.kategoriBadge) {
                if (schema.id === 'triase_ugd') dom.kategoriBadge.classList.remove('hidden');
                else dom.kategoriBadge.classList.add('hidden');
            }
        }

        function applyRoleText(schema) {
            if (!dom.roleBadge) return;
            const roles = [];
            if (isDoctorRole()) roles.push('Dokter');
            if (isPerawatRole()) roles.push('Perawat');
            if (isPendaftaranRole()) roles.push('Pendaftaran');
            if (isIgdRole()) roles.push('IGD');
            if (isTriaseRole()) roles.push('Petugas Triase');
            if (isPediatrikRole()) roles.push('Poli Anak');
            if (isSupervisorRole()) roles.push('Supervisor');
            dom.roleBadge.textContent = 'Role: ' + (roles.length ? roles.join(', ') : (getCurrentAdminRole() || '-'));
        }

        function setStatus(text, tone) {
            if (!dom.statusEl) return;
            dom.statusEl.textContent = text || '';
            dom.statusEl.classList.remove('is-loading', 'is-ready', 'is-error', 'is-sync', 'is-saving', 'is-saved');
            tone = String(tone || 'ready');
            if (tone === 'loading') dom.statusEl.classList.add('is-loading');
            else if (tone === 'error') dom.statusEl.classList.add('is-error');
            else if (tone === 'sync') dom.statusEl.classList.add('is-sync');
            else if (tone === 'saving') dom.statusEl.classList.add('is-saving');
            else if (tone === 'saved') dom.statusEl.classList.add('is-saved');
            else dom.statusEl.classList.add('is-ready');
        }

        function openModal() {
            if (!dom.modal) return;
            dom.modal.classList.add('is-open');
            dom.modal.setAttribute('aria-hidden', 'false');
            document.body.style.overflow = 'hidden';
        }

        function closeModal() {
            if (!dom.modal) return;
            dom.modal.classList.remove('is-open');
            dom.modal.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';
            if (state.realtimeChannel) {
                try { supabaseClient.removeChannel(state.realtimeChannel); } catch (_e) {}
                state.realtimeChannel = null;
            }
        }

        // ---- SAVE Pipeline ----
        function scheduleSave(delay) {
            if (state.saveTimer) window.clearTimeout(state.saveTimer);
            const d = Math.max(0, Number(delay) || 0);
            state.saveTimer = window.setTimeout(function () {
                saveCurrent(false).catch(function (err) {
                    setStatus('Gagal menyimpan: ' + (err?.message || String(err)), 'error');
                });
            }, d);
        }

        function buildPayloadToUpsert(schema, patient, values, includeFixedMeta) {
            const now = new Date().toISOString();
            const operatorName = getCurrentOperatorName() || '';
            const operatorEmail = getCurrentOperatorEmail() || '';
            const payload = {};
            payload.pasien_id = patient.id;
            payload[schema.jsonbColumn] = Object.assign({}, values);
            // Meta nama/tanggal wajib
            const fm = schema.fixedMeta || {};
            if (fm.tanggalColumn) payload[fm.tanggalColumn] = now;
            if (fm.namaColumn) payload[fm.namaColumn] = operatorName;
            if (fm.emailColumn) payload[fm.emailColumn] = operatorEmail;

            // copyToFixed / mapToFixed di schema fields:
            const sections = Array.isArray(schema.sections) ? schema.sections : [];
            sections.forEach(function (sec) {
                const fields = Array.isArray(sec.fields) ? sec.fields : [];
                fields.forEach(function (field) {
                    const v = values[field.key];
                    if (field.copyToFixed) payload[field.copyToFixed] = v;
                    if (field.mapToFixed && v != null && typeof field.mapToFixed === 'string') {
                        payload[field.mapToFixed] = typeof v === 'number' ? v : String(v);
                    }
                    if (field.mapLabelTo && Array.isArray(field.options) && v != null) {
                        const found = field.options.find(function (opt) {
                            if (opt && typeof opt === 'object') return String(opt.value) === String(v);
                            return String(opt) === String(v);
                        });
                        if (found && typeof found === 'object') payload[field.mapLabelTo] = String(found.label);
                    }
                });
            });

            // Hitung skor EWS
            const ews = calculateEwsScore(schema, values);
            if (fm.skorColumn) payload[fm.skorColumn] = Math.min(20, ews);

            if (includeFixedMeta && includeFixedMeta.forceFinalize) {
                if (fm.finalizeColumn) payload[fm.finalizeColumn] = true;
                if (fm.finalizedAtColumn) payload[fm.finalizedAtColumn] = now;
            }
            return payload;
        }

        async function saveCurrent(forceFinalize) {
            if (!state.schema || !state.patient) return false;
            if (state.inFlight) return false;
            state.inFlight = true;
            try {
                collectFormValuesIntoState();
                const values = state.formValues || {};
                // Validate required fields for finalize only (bukan auto save)
                if (forceFinalize) {
                    const error = findFirstRequiredError(state.schema, values);
                    if (error) { alert('Belum bisa difinalisasi: ' + error); return false; }
                }
                const payload = buildPayloadToUpsert(state.schema, state.patient, values, { forceFinalize: !!forceFinalize });
                const table = state.schema.table;
                let result;
                if (state.recordId) {
                    const query = supabaseClient
                        .from(table)
                        .update(payload)
                        .eq('id', state.recordId)
                        .select('*')
                        .limit(1);
                    result = await withTimeout(query, 15000, 'update-' + table);
                } else {
                    const query = supabaseClient
                        .from(table)
                        .insert(payload)
                        .select('*')
                        .limit(1);
                    result = await withTimeout(query, 15000, 'insert-' + table);
                }
                const { data, error } = result || {};
                if (error) throw new Error(error.message);
                const row = (data && data.length) ? data[0] : null;
                if (row) {
                    state.record = row;
                    state.recordId = row.id;
                    state.lastWriteAt = Date.now();
                    if (forceFinalize) setStatus('Formulir telah difinalisasi dan dikunci. (Bisa dibuka oleh Supervisor)', 'saved');
                    else setStatus('Disimpan otomatis ' + formatTimeNow(), 'saved');
                    if (state.broadcast) {
                        try {
                            state.broadcast.postMessage({
                                patientId: state.patient.id,
                                schemaId: state.schemaId,
                                at: state.lastWriteAt
                            });
                        } catch (_e) {}
                    }
                    return true;
                }
                return false;
            } finally {
                state.inFlight = false;
            }
        }

        function findFirstRequiredError(schema, values) {
            const sections = Array.isArray(schema.sections) ? schema.sections : [];
            for (let i = 0; i < sections.length; i++) {
                const fields = Array.isArray(sections[i].fields) ? sections[i].fields : [];
                for (let j = 0; j < fields.length; j++) {
                    const f = fields[j];
                    if (!f.required) continue;
                    const v = values[f.key];
                    if (v == null || v === '' || (Array.isArray(v) && v.length === 0)) {
                        return 'wajib diisi — ' + (f.label || f.key);
                    }
                }
            }
            return null;
        }

        async function finalizeCurrent() {
            if (!state.schema || !state.patient) return;
            const nama = String(state.patient.nama_pasien || 'pasien');
            const canFinalize = isPerawatRole() || isDoctorRole() || isSupervisorRole() || isTriaseRole();
            if (!canFinalize) { alert('Hanya Perawat / Dokter / Supervisor yang bisa Finalisasi.'); return; }
            if (state.record?.[state.schema.fixedMeta?.finalizeColumn] && !isSupervisorRole()) {
                const unlock = confirm('Formulir sudah dikunci. Hanya Supervisor bisa membuka kunci. Lanjut sebagai Supervisor unlock?');
                if (!unlock) return;
                // supervisor unlock -> set finalized false
                try {
                    state.inFlight = true;
                    const table = state.schema.table;
                    const fm = state.schema.fixedMeta || {};
                    const patch = {};
                    if (fm.finalizeColumn) patch[fm.finalizeColumn] = false;
                    if (fm.finalizedAtColumn) patch[fm.finalizedAtColumn] = null;
                    const q = supabaseClient.from(table).update(patch).eq('id', state.recordId).select('*').limit(1);
                    const { data, error } = await withTimeout(q, 15000, 'unlock-' + table);
                    if (error) throw new Error(error.message);
                    if (data && data.length) { state.record = data[0]; setStatus('Kunci dibuka oleh Supervisor.', 'ready'); syncFixedBadges(); }
                } catch (err) {
                    alert('Gagal buka kunci: ' + (err?.message || String(err)));
                } finally { state.inFlight = false; }
                return;
            }
            const ok = confirm('Finalisasi & kunci formulir untuk pasien: ' + nama + ' ?\nSetelah dikunci, hanya Supervisor bisa membuka kembali.');
            if (!ok) return;
            try {
                const saved = await saveCurrent(true);
                if (saved && state.recordId) await ensureRecordLoaded(state.schema, state.patient);
            } catch (err) {
                alert('Gagal finalisasi: ' + (err?.message || String(err)));
            }
        }

        function formatTimeNow() {
            const d = new Date();
            const hh = String(d.getHours()).padStart(2, '0');
            const mm = String(d.getMinutes()).padStart(2, '0');
            const ss = String(d.getSeconds()).padStart(2, '0');
            return hh + ':' + mm + ':' + ss;
        }

        // ---- PRINT ----
        function triggerPrint() {
            if (!state.schema || !state.patient || !dom.modal) return;
            // Flush pending auto save terlebih dahulu
            if (state.saveTimer) { window.clearTimeout(state.saveTimer); state.saveTimer = null; }
            saveCurrent(false).finally(function () {
                const mode = PRINT_MODE;
                document.body.setAttribute('data-print-mode', mode);
                try {
                    if (window.preparePrintContainer && typeof window.preparePrintContainer === 'function') {
                        window.preparePrintContainer(mode, {
                            sourceEl: dom.form,
                            schema: state.schema,
                            patient: state.patient,
                            record: state.record
                        });
                    } else {
                        // Fallback: set style inline untuk dokumen
                        dom.form.classList.add('is-print-mode');
                    }
                } catch (_e) {}
                const wPrintReady = function () {
                    try { window.print(); } catch (_e) { /* ignore */ }
                    window.setTimeout(function () {
                        document.body.removeAttribute('data-print-mode');
                        dom.form.classList.remove('is-print-mode');
                    }, 1200);
                };
                window.setTimeout(wPrintReady, 180);
            });
        }
    }

    window.createAssessmentModule = createAssessmentModule;
})();
