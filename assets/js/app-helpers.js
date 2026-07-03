function getPetugasPoliAccountLabel() {
    const poli = getPetugasPoliDefaultPoli();
    if (poli === 'DOKTER_UMUM') return 'POLIKLINIK UMUM';
    if (poli === 'SPESIALIS_ANAK') return 'POLIKLINIK ANAK';
    if (poli === 'SPESIALIS_PENYAKIT_DALAM') return 'POLIKLINIK PENYAKIT DALAM';
    return 'POLIKLINIK';
}

function formatAdminRoleLabel(role) {
    const value = String(role || '').trim().toLowerCase();
    if (value === 'supervisor') return 'Supervisor';
    if (value === 'admin_rme') return 'Admin RME';
    if (value === 'admin_pendaftaran') return 'Petugas Pendaftaran';
    if (value === 'admin_igd') return 'Petugas UGD';
    if (value === 'bidan') return 'Bidan';
    if (value === 'perawat') return 'Perawat';
    if (value === 'dokter') return 'Dokter';
    if (value === 'admin_farmasi' || value === 'petugas_farmasi' || value === 'petugas farmasi') return 'Petugas Farmasi';
    if (value === 'petugas_poli' || value === 'petugas poli') return getPetugasPoliAccountLabel();
    return value ? value.replace(/_/g, ' ') : 'Belum Diatur';
}

function normalizeStaffName(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function formatLoketLabel(loket) {
    const value = String(loket || '').trim().toUpperCase();
    if (value === 'A' || value === 'LOKET_A') return 'Loket A';
    if (value === 'B' || value === 'LOKET_B') return 'Loket B';
    if (value === 'C' || value === 'LOKET_C') return 'Loket C';
    if (value === 'LOKET_1') return 'Loket A';
    if (value === 'LOKET_2') return 'Loket B';
    if (value === 'LOKET_3') return 'Loket C';
    if (value === 'SUPERVISOR') return 'Supervisor';
    return value ? value.replace(/_/g, ' ') : '-';
}

function normalizeLoketCode(value) {
    const raw = String(value || '').trim().toUpperCase();
    if (!raw) return '';
    if (raw === 'SUPERVISOR') return 'SUPERVISOR';
    if (raw === 'A' || raw === 'LOKET_A' || raw === 'LOKETA' || raw === 'LOKET-A') return 'A';
    if (raw === 'B' || raw === 'LOKET_B' || raw === 'LOKETB' || raw === 'LOKET-B') return 'B';
    if (raw === 'C' || raw === 'LOKET_C' || raw === 'LOKETC' || raw === 'LOKET-C') return 'C';
    if (raw === 'LOKET_1' || raw === 'LOKET1') return 'A';
    if (raw === 'LOKET_2' || raw === 'LOKET2') return 'B';
    if (raw === 'LOKET_3' || raw === 'LOKET3') return 'C';
    const match = raw.match(/\b([ABC])\b/);
    return match ? match[1] : raw;
}

function getLoketAliases(loketCode) {
    const code = normalizeLoketCode(loketCode);
    if (!code || code === 'SUPERVISOR') return [];
    if (code === 'A') return ['A', 'LOKET_1', 'LOKET_A'];
    if (code === 'B') return ['B', 'LOKET_2', 'LOKET_B'];
    if (code === 'C') return ['C', 'LOKET_3', 'LOKET_C'];
    return [code];
}

function isUgdValue(value) {
    const normalized = String(value || '').trim().toUpperCase();
    return normalized === 'UGD' || normalized === 'IGD';
}

function queueControlPrefix(unit) {
    if (unit === 'POLIKLINIK') return 'Poliklinik';
    if (unit === 'FARMASI') return 'Farmasi';
    return String(unit || '');
}

function isPrioritasNoAntrian(noAntrian) {
    return /^B-/i.test(String(noAntrian || '').trim());
}

function isPoliklinikRegulerNoAntrian(noAntrian) {
    return /^A-/i.test(String(noAntrian || '').trim());
}

function r_unitLabel(unit) {
    if (!unit) return '-';
    if (unit === 'FARMASI') return 'Farmasi';
    if (unit === 'POLIKLINIK') return 'Poliklinik';
    if (isUgdValue(unit)) return 'UGD';
    return unit;
}

function r_jenisPasienLabel(jenisPasien) {
    if (!jenisPasien) return '-';
    if (jenisPasien === 'BELUM_DITENTUKAN') return '-';
    if (jenisPasien === 'BPJS') return 'BPJS';
    if (jenisPasien === 'UMUM') return 'Umum';
    return jenisPasien;
}

function r_poliLabel(poli) {
    if (!poli) return '';
    if (poli === 'FARMASI') return '';
    if (isUgdValue(poli)) return 'UGD';
    if (poli === 'SPESIALIS_ANAK') return 'Poli Anak';
    if (poli === 'SPESIALIS_PENYAKIT_DALAM') return 'Poli Penyakit Dalam';
    if (poli === 'DOKTER_UMUM') return 'Poli Umum';
    return poli;
}

window.createDraftTriaseHelpers = function createDraftTriaseHelpers(deps) {
    function setDraftTableAvailable(value) {
        deps.setTriaseUgdDraftsTableAvailable(!!value);
    }

    function getDraftTableAvailable() {
        return !!deps.getTriaseUgdDraftsTableAvailable();
    }

    function getPendingLinkDraft() {
        return deps.getPendingDraftTriaseLink();
    }

    function setPendingLinkDraft(value) {
        deps.setPendingDraftTriaseLink(value || null);
    }

    function getPatientsCache() {
        const items = deps.getDraftTriasePatientsCache();
        return Array.isArray(items) ? items : [];
    }

    function setPatientsCache(items) {
        deps.setDraftTriasePatientsCache(Array.isArray(items) ? items : []);
    }

    async function detectTriaseUgdDraftsTable() {
        try {
            const { error } = await deps.supabaseClient
                .from('triase_ugd_drafts')
                .select('id')
                .limit(1);
            if (error && /(does not exist|relation .* does not exist|schema cache|not found)/i.test(error.message || '')) {
                setDraftTableAvailable(false);
            } else {
                setDraftTableAvailable(true);
            }
        } catch (err) {
            setDraftTableAvailable(false);
        }
    }

    function dt_showDraftMessage(message, tone) {
        const el = deps.elements.draftTriaseMessage;
        if (!el) return;
        el.textContent = message;
        el.classList.remove('hidden', 'border-red-200', 'bg-red-50', 'text-red-700', 'border-emerald-200', 'bg-emerald-50', 'text-emerald-700', 'border-blue-200', 'bg-blue-50', 'text-blue-700');
        if (tone === 'success') {
            el.classList.add('border-emerald-200', 'bg-emerald-50', 'text-emerald-700');
        } else if (tone === 'error') {
            el.classList.add('border-red-200', 'bg-red-50', 'text-red-700');
        } else {
            el.classList.add('border-blue-200', 'bg-blue-50', 'text-blue-700');
        }
        el.classList.remove('hidden');
    }

    function dt_clearDraftMessage() {
        const el = deps.elements.draftTriaseMessage;
        if (!el) return;
        el.classList.add('hidden');
        el.textContent = '';
    }

    function dt_buildDraftIdentityFromInputs() {
        const nama = String(deps.elements.draftTriaseNamaInput?.value || '').trim();
        const jk = String(deps.elements.draftTriaseJkInput?.value || '').trim();
        const umurRaw = String(deps.elements.draftTriaseUmurInput?.value || '').trim();
        const umur = umurRaw === '' ? null : Number(umurRaw);
        const tanggalLahir = String(deps.elements.draftTriaseTglLahirInput?.value || '').trim();
        const keluhanUtama = String(deps.elements.draftTriaseKuInput?.value || '').trim();
        return {
            nama_pasien: nama,
            jenis_kelamin: jk,
            umur: Number.isFinite(umur) ? Math.max(0, Math.min(150, Math.floor(umur))) : null,
            tanggal_lahir: tanggalLahir || null,
            keluhan_utama: keluhanUtama
        };
    }

    function dt_syncDraftMetaBadge(total) {
        const el = deps.elements.draftTriaseMeta;
        if (!el) return;
        if (!deps.canAccessDraftTriaseView()) {
            el.textContent = '-';
            return;
        }
        el.textContent = `Total Draft: ${Number(total) || 0}`;
    }

    function dt_renderDraftTriaseList(items) {
        const container = deps.elements.draftTriaseList;
        if (!container) return;
        const safeItems = Array.isArray(items) ? items : [];
        if (safeItems.length === 0) {
            container.innerHTML = '<div class="px-5 py-6 text-slate-500 font-semibold">Belum ada draft.</div>';
            return;
        }
        container.innerHTML = safeItems.map((d) => {
            const createdAt = deps.r_formatDateTimeLocal(d.created_at);
            const nama = d.nama_pasien || '-';
            const jk = d.jenis_kelamin || '-';
            const umur = (d.umur ?? d.umur === 0) ? String(d.umur) : '-';
            const ku = d.keluhan_utama || '-';
            const staff = d.created_by_name || d.created_by_email || '';
            const staffLabel = staff ? `<div class="text-[12px] font-semibold text-slate-500 mt-1">Petugas: ${deps.escapeHtml(staff)}</div>` : '';
            return `<div class="px-5 py-4">
                <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div class="min-w-0">
                        <div class="text-[11px] font-extrabold uppercase tracking-[0.22em] text-rose-700">${deps.escapeHtml(createdAt)}</div>
                        <div class="mt-1 text-lg font-black tracking-tight text-slate-900 truncate">${deps.escapeHtml(nama)}</div>
                        <div class="mt-1 text-sm font-semibold text-slate-600">JK: ${deps.escapeHtml(jk)} · Umur: ${deps.escapeHtml(umur)} · KU: ${deps.escapeHtml(ku)}</div>
                        ${staffLabel}
                    </div>
                    <div class="flex flex-wrap gap-2 shrink-0">
                        <button type="button" class="dt-open-btn rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-sm font-bold text-rose-800 shadow-sm transition hover:bg-rose-100" data-id="${deps.escapeHtml(String(d.id || ''))}">Lanjutkan</button>
                        <button type="button" class="dt-link-btn rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-sm font-bold text-emerald-800 shadow-sm transition hover:bg-emerald-100" data-id="${deps.escapeHtml(String(d.id || ''))}">Tautkan</button>
                        <button type="button" class="dt-delete-btn rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50" data-id="${deps.escapeHtml(String(d.id || ''))}">Hapus</button>
                    </div>
                </div>
            </div>`;
        }).join('');
    }

    function dt_getLocalDraftStore() {
        const key = 'triase-ugd-drafts-local';
        try {
            const raw = window.localStorage.getItem(key);
            const parsed = raw ? JSON.parse(raw) : [];
            return { key, items: Array.isArray(parsed) ? parsed : [] };
        } catch (err) {
            return { key, items: [] };
        }
    }

    function dt_setLocalDraftStore(items) {
        const { key } = dt_getLocalDraftStore();
        try {
            window.localStorage.setItem(key, JSON.stringify(Array.isArray(items) ? items : []));
        } catch (err) {}
    }

    async function dt_reloadDraftTriaseList() {
        if (!deps.canAccessDraftTriaseView()) return;
        dt_clearDraftMessage();
        dt_syncDraftMetaBadge(0);
        const container = deps.elements.draftTriaseList;
        if (!container) return;
        container.innerHTML = '<div class="px-5 py-6 text-slate-500 font-semibold">Memuat draft...</div>';

        if (!getDraftTableAvailable()) {
            const local = dt_getLocalDraftStore().items;
            dt_showDraftMessage('Tabel draft Supabase belum tersedia. Saat ini memakai draft lokal (hanya perangkat ini).', 'info');
            dt_syncDraftMetaBadge(local.length);
            dt_renderDraftTriaseList(local);
            return;
        }

        try {
            const res = await deps.withTimeout(
                deps.supabaseClient
                    .from('triase_ugd_drafts')
                    .select('id, created_at, nama_pasien, jenis_kelamin, umur, tanggal_lahir, keluhan_utama, triase_payload, created_by_name, created_by_email')
                    .order('created_at', { ascending: false })
                    .limit(200),
                15000,
                'Muat draft triase'
            );
            if (res?.error) throw new Error(res.error.message);
            const data = Array.isArray(res?.data) ? res.data : [];
            const normalized = data.map((row) => ({ ...row, payload: row.triase_payload }));
            dt_syncDraftMetaBadge(normalized.length);
            dt_renderDraftTriaseList(normalized);
        } catch (err) {
            const local = dt_getLocalDraftStore().items;
            dt_showDraftMessage('Gagal memuat draft dari Supabase: ' + (err?.message || String(err)) + '. Memakai draft lokal (hanya perangkat ini).', 'error');
            dt_syncDraftMetaBadge(local.length);
            dt_renderDraftTriaseList(local);
        }
    }

    function dt_resetDraftIdentityInputs() {
        if (deps.elements.draftTriaseNamaInput) deps.elements.draftTriaseNamaInput.value = '';
        if (deps.elements.draftTriaseJkInput) deps.elements.draftTriaseJkInput.value = '';
        if (deps.elements.draftTriaseUmurInput) deps.elements.draftTriaseUmurInput.value = '';
        if (deps.elements.draftTriaseTglLahirInput) deps.elements.draftTriaseTglLahirInput.value = '';
        if (deps.elements.draftTriaseKuInput) deps.elements.draftTriaseKuInput.value = '';
        dt_clearDraftMessage();
    }

    function dt_openTriaseDraftModal(meta, draftRow) {
        deps.setTriaseUgdMode('draft');
        deps.setCurrentTriaseUgdDraftId(String(draftRow?.id || '').trim());
        deps.setCurrentTriaseUgdDraftMeta(meta || null);

        const saveBtn = document.getElementById('saveTriaseUgdBtn');
        const printBtn = document.getElementById('printTriaseUgdBtn');
        if (saveBtn) saveBtn.textContent = 'Simpan Draft';
        if (printBtn) printBtn.classList.add('hidden');

        deps.fillTriaseUgdHeader({
            nama_pasien: meta?.nama_pasien || '',
            jenis_kelamin: meta?.jenis_kelamin || '',
            tanggal_lahir: meta?.tanggal_lahir || '',
            umur: (meta?.umur ?? meta?.umur === 0) ? meta.umur : '',
            no_rm: '',
            no_registrasi: ''
        });
        deps.resetTriaseUgdForm();
        deps.clearTriaseUgdMessage();
        document.getElementById('triageUgdModal').classList.remove('hidden');

        const ku1 = document.getElementById('t_keluhan_utama');
        if (ku1 && meta?.keluhan_utama) ku1.value = String(meta.keluhan_utama);
        if (draftRow?.payload) {
            deps.applyTriaseDraftPayload(draftRow.payload);
            deps.showTriaseUgdMessage('Draft triase berhasil dimuat.', 'success');
        }
    }

    async function dt_saveTriaseDraftFromModal() {
        if (!deps.canAccessDraftTriaseView()) return;
        const saveBtn = document.getElementById('saveTriaseUgdBtn');
        const originalLabel = saveBtn?.textContent || 'Simpan Draft';
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Menyimpan...';
        }
        try {
            const payload = deps.buildTriaseDraftPayload();
            const ku1 = String(document.getElementById('t_keluhan_utama')?.value || '').trim();
            const currentMeta = deps.getCurrentTriaseUgdDraftMeta();
            const meta = {
                ...(currentMeta || {}),
                keluhan_utama: ku1 || String(currentMeta?.keluhan_utama || '').trim()
            };

            if (!meta.nama_pasien) {
                throw new Error('Nama pasien draft belum diisi.');
            }

            const sessionRes = await deps.supabaseClient.auth.getSession();
            const userId = sessionRes?.data?.session?.user?.id || null;
            const email = String(sessionRes?.data?.session?.user?.email || '').trim();
            const staffName = String(deps.getCurrentStaffName() || '').trim();

            const rowPayload = {
                nama_pasien: meta.nama_pasien,
                jenis_kelamin: meta.jenis_kelamin || null,
                umur: (meta.umur ?? meta.umur === 0) ? meta.umur : null,
                tanggal_lahir: meta.tanggal_lahir || null,
                keluhan_utama: meta.keluhan_utama || null,
                triase_payload: payload,
                created_by: userId,
                created_by_email: email || null,
                created_by_name: staffName || null
            };

            if (getDraftTableAvailable()) {
                const currentDraftId = deps.getCurrentTriaseUgdDraftId();
                if (currentDraftId) {
                    const updateRes = await deps.withTimeout(
                        deps.supabaseClient
                            .from('triase_ugd_drafts')
                            .update(rowPayload)
                            .eq('id', currentDraftId),
                        15000,
                        'Update draft triase'
                    );
                    if (updateRes?.error) throw new Error(updateRes.error.message);
                    deps.showTriaseUgdMessage('Draft triase berhasil diperbarui.', 'success');
                } else {
                    const insertRes = await deps.withTimeout(
                        deps.supabaseClient
                            .from('triase_ugd_drafts')
                            .insert(rowPayload)
                            .select('id')
                            .maybeSingle(),
                        15000,
                        'Simpan draft triase'
                    );
                    if (insertRes?.error) throw new Error(insertRes.error.message);
                    deps.setCurrentTriaseUgdDraftId(String(insertRes?.data?.id || '').trim());
                    deps.showTriaseUgdMessage('Draft triase berhasil disimpan.', 'success');
                }
            } else {
                const local = dt_getLocalDraftStore().items;
                const nowIso = new Date().toISOString();
                const currentDraftId = deps.getCurrentTriaseUgdDraftId();
                if (currentDraftId) {
                    const next = local.map((it) => it.id === currentDraftId ? { ...it, ...meta, payload, created_at: it.created_at || nowIso } : it);
                    dt_setLocalDraftStore(next);
                } else {
                    const nextId = 'local-' + String(Date.now());
                    deps.setCurrentTriaseUgdDraftId(nextId);
                    const next = [{ id: nextId, created_at: nowIso, ...meta, payload }, ...local];
                    dt_setLocalDraftStore(next);
                }
                deps.showTriaseUgdMessage('Draft triase disimpan lokal (hanya perangkat ini).', 'info');
            }

            deps.setCurrentTriaseUgdDraftMeta(meta);
            await dt_reloadDraftTriaseList();
        } catch (err) {
            deps.showTriaseUgdMessage('Gagal menyimpan draft: ' + (err?.message || String(err)), 'error');
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.textContent = originalLabel;
            }
        }
    }

    async function dt_deleteDraftById(id) {
        const draftId = String(id || '').trim();
        if (!draftId) return;
        if (getDraftTableAvailable() && !draftId.startsWith('local-')) {
            const res = await deps.withTimeout(
                deps.supabaseClient
                    .from('triase_ugd_drafts')
                    .delete()
                    .eq('id', draftId),
                15000,
                'Hapus draft triase'
            );
            if (res?.error) throw new Error(res.error.message);
            return;
        }
        const local = dt_getLocalDraftStore().items;
        dt_setLocalDraftStore(local.filter((it) => String(it.id || '') !== draftId));
    }

    function dt_closeLinkDraftTriaseModal() {
        const modal = deps.elements.linkDraftTriaseModal;
        if (!modal) return;
        modal.classList.add('hidden');
        setPendingLinkDraft(null);
        setPatientsCache([]);
        if (deps.elements.linkDraftTriaseSearchInput) deps.elements.linkDraftTriaseSearchInput.value = '';
        if (deps.elements.linkDraftTriaseList) deps.elements.linkDraftTriaseList.innerHTML = '';
        if (deps.elements.linkDraftTriaseMeta) deps.elements.linkDraftTriaseMeta.textContent = '-';
        if (deps.elements.linkDraftTriaseMessage) {
            deps.elements.linkDraftTriaseMessage.classList.add('hidden');
            deps.elements.linkDraftTriaseMessage.textContent = '';
        }
    }

    function dt_showLinkDraftMessage(message, tone) {
        const el = deps.elements.linkDraftTriaseMessage;
        if (!el) return;
        el.textContent = message;
        el.classList.remove('hidden', 'border-red-200', 'bg-red-50', 'text-red-700', 'border-emerald-200', 'bg-emerald-50', 'text-emerald-700', 'border-blue-200', 'bg-blue-50', 'text-blue-700');
        if (tone === 'success') {
            el.classList.add('border-emerald-200', 'bg-emerald-50', 'text-emerald-700');
        } else if (tone === 'error') {
            el.classList.add('border-red-200', 'bg-red-50', 'text-red-700');
        } else {
            el.classList.add('border-blue-200', 'bg-blue-50', 'text-blue-700');
        }
        el.classList.remove('hidden');
    }

    function dt_renderLinkPatients() {
        const container = deps.elements.linkDraftTriaseList;
        if (!container) return;
        const q = String(deps.elements.linkDraftTriaseSearchInput?.value || '').trim().toLowerCase();
        const items = getPatientsCache();
        const filtered = q
            ? items.filter((p) => {
                const hay = [
                    p.nama_pasien,
                    p.no_rm,
                    p.no_registrasi,
                    p.no_antrian
                ].map((v) => String(v || '').toLowerCase()).join(' ');
                return hay.includes(q);
            })
            : items;
        if (filtered.length === 0) {
            container.innerHTML = '<div class="px-4 py-5 text-slate-500 font-semibold">Tidak ada pasien cocok.</div>';
            return;
        }
        container.innerHTML = filtered.map((p) => {
            const waktu = deps.r_formatDateTimeLocal(p.created_at);
            const nama = p.nama_pasien || '-';
            const noRm = p.no_rm || '-';
            const reg = p.no_registrasi || '-';
            const noAntrian = p.no_antrian ?? '-';
            return `<div class="px-4 py-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div class="min-w-0">
                    <div class="text-[11px] font-extrabold uppercase tracking-[0.22em] text-slate-500">${deps.escapeHtml(waktu)}</div>
                    <div class="mt-1 text-base font-black text-slate-900 truncate">${deps.escapeHtml(nama)}</div>
                    <div class="mt-1 text-sm font-semibold text-slate-600">No RM: ${deps.escapeHtml(noRm)} · No REG: ${deps.escapeHtml(reg)} · No Antrian: ${deps.escapeHtml(String(noAntrian))}</div>
                </div>
                <button type="button" class="dt-pick-patient-btn rounded-xl bg-emerald-600 px-3.5 py-2 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700" data-id="${deps.escapeHtml(String(p.id || ''))}">Pilih</button>
            </div>`;
        }).join('');
    }

    async function dt_loadTodayUgdPatients() {
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const today = `${yyyy}-${mm}-${dd}`;
        const fromISO = deps.r_toISOStart(today);
        const toISO = deps.r_toISOEnd(today);
        let query = deps.supabaseClient
            .from('pasien')
            .select('id, created_at, unit, nama_pasien, no_rm, no_registrasi, no_antrian')
            .eq('unit', 'UGD')
            .order('created_at', { ascending: false })
            .limit(80);
        if (fromISO) query = query.gte('created_at', fromISO);
        if (toISO) query = query.lte('created_at', toISO);
        const res = await deps.withTimeout(query, 15000, 'Muat pasien UGD hari ini');
        if (res?.error) throw new Error(res.error.message);
        return Array.isArray(res?.data) ? res.data : [];
    }

    async function dt_openLinkDraftTriaseModal(draftRow) {
        setPendingLinkDraft(draftRow);
        const modal = deps.elements.linkDraftTriaseModal;
        if (!modal) return;
        if (deps.elements.linkDraftTriaseMeta) {
            const nama = String(draftRow?.nama_pasien || '').trim();
            deps.elements.linkDraftTriaseMeta.textContent = nama ? `Draft: ${nama}` : 'Draft dipilih';
        }
        modal.classList.remove('hidden');
        if (deps.elements.linkDraftTriaseList) {
            deps.elements.linkDraftTriaseList.innerHTML = '<div class="px-4 py-5 text-slate-500 font-semibold">Memuat pasien...</div>';
        }
        try {
            setPatientsCache(await dt_loadTodayUgdPatients());
            dt_renderLinkPatients();
        } catch (err) {
            setPatientsCache([]);
            if (deps.elements.linkDraftTriaseList) {
                deps.elements.linkDraftTriaseList.innerHTML = '<div class="px-4 py-5 text-slate-500 font-semibold">Gagal memuat pasien.</div>';
            }
            dt_showLinkDraftMessage('Gagal memuat pasien: ' + (err?.message || String(err)), 'error');
        }
    }

    async function dt_attachDraftToPatient(draftRow, patientId) {
        if (!draftRow) return;
        if (!deps.getTriaseDraftColumnAvailable()) {
            dt_showLinkDraftMessage('Kolom `triase_ugd_data` belum ada di tabel pasien.', 'error');
            return;
        }
        const pid = String(patientId || '').trim();
        if (!pid) return;
        const payload = draftRow.payload || draftRow.triase_payload || draftRow.triase_payload === '' ? (draftRow.payload || draftRow.triase_payload) : null;
        if (!payload) {
            dt_showLinkDraftMessage('Payload draft kosong.', 'error');
            return;
        }
        try {
            let updatePayload = { triase_ugd_data: payload };
            let updateRes = await deps.withTimeout(
                deps.supabaseClient
                    .from('pasien')
                    .update(updatePayload)
                    .eq('id', pid),
                15000,
                'Tautkan triase'
            );
            if (updateRes?.error) {
                updatePayload = { triase_ugd_data: JSON.stringify(payload) };
                updateRes = await deps.withTimeout(
                    deps.supabaseClient
                        .from('pasien')
                        .update(updatePayload)
                        .eq('id', pid),
                    15000,
                    'Tautkan triase fallback'
                );
            }
            if (updateRes?.error) throw new Error(updateRes.error.message);

            await dt_deleteDraftById(draftRow.id);
            dt_showLinkDraftMessage('Draft berhasil ditautkan ke pasien dan dihapus otomatis.', 'success');
            await dt_reloadDraftTriaseList();
            window.setTimeout(() => dt_closeLinkDraftTriaseModal(), 500);
        } catch (err) {
            dt_showLinkDraftMessage('Gagal menautkan draft: ' + (err?.message || String(err)), 'error');
        }
    }

    function bindDraftTriaseEvents() {
        if (deps.elements.draftTriaseRefreshBtn) {
            deps.elements.draftTriaseRefreshBtn.addEventListener('click', async () => {
                await deps.withPageLoading('Memuat Draft Triase...', async () => {
                    await dt_reloadDraftTriaseList();
                });
            });
        }

        if (deps.elements.draftTriaseClearBtn) {
            deps.elements.draftTriaseClearBtn.addEventListener('click', () => {
                dt_resetDraftIdentityInputs();
            });
        }

        if (deps.elements.draftTriaseOpenBtn) {
            deps.elements.draftTriaseOpenBtn.addEventListener('click', () => {
                dt_clearDraftMessage();
                const meta = dt_buildDraftIdentityFromInputs();
                if (!meta.nama_pasien) {
                    dt_showDraftMessage('Nama pasien wajib diisi untuk membuat draft.', 'error');
                    return;
                }
                if (!meta.jenis_kelamin) {
                    dt_showDraftMessage('Jenis kelamin wajib diisi untuk membuat draft.', 'error');
                    return;
                }
                dt_openTriaseDraftModal(meta, null);
            });
        }

        if (deps.elements.draftTriaseList) {
            deps.elements.draftTriaseList.addEventListener('click', async (e) => {
                const openBtn = e.target.closest('.dt-open-btn');
                const linkBtn = e.target.closest('.dt-link-btn');
                const deleteBtn = e.target.closest('.dt-delete-btn');
                const id = String(openBtn?.dataset?.id || linkBtn?.dataset?.id || deleteBtn?.dataset?.id || '').trim();
                if (!id) return;

                if (openBtn) {
                    if (getDraftTableAvailable() && !id.startsWith('local-')) {
                        try {
                            const res = await deps.withTimeout(
                                deps.supabaseClient
                                    .from('triase_ugd_drafts')
                                    .select('id, created_at, nama_pasien, jenis_kelamin, umur, tanggal_lahir, keluhan_utama, triase_payload, created_by_name, created_by_email')
                                    .eq('id', id)
                                    .maybeSingle(),
                                15000,
                                'Muat draft'
                            );
                            if (res?.error) throw new Error(res.error.message);
                            const row = res?.data || null;
                            if (!row) throw new Error('Draft tidak ditemukan.');
                            dt_openTriaseDraftModal({
                                nama_pasien: row.nama_pasien,
                                jenis_kelamin: row.jenis_kelamin,
                                umur: row.umur,
                                tanggal_lahir: row.tanggal_lahir,
                                keluhan_utama: row.keluhan_utama
                            }, { ...row, payload: row.triase_payload });
                        } catch (err) {
                            dt_showDraftMessage('Gagal membuka draft: ' + (err?.message || String(err)), 'error');
                        }
                        return;
                    }
                    const local = dt_getLocalDraftStore().items;
                    const row = local.find((it) => String(it.id || '') === id) || null;
                    if (!row) {
                        dt_showDraftMessage('Draft lokal tidak ditemukan.', 'error');
                        return;
                    }
                    dt_openTriaseDraftModal(row, row);
                    return;
                }

                if (linkBtn) {
                    let row = null;
                    if (getDraftTableAvailable() && !id.startsWith('local-')) {
                        try {
                            const res = await deps.withTimeout(
                                deps.supabaseClient
                                    .from('triase_ugd_drafts')
                                    .select('id, nama_pasien, triase_payload')
                                    .eq('id', id)
                                    .maybeSingle(),
                                15000,
                                'Muat draft untuk tautkan'
                            );
                            if (res?.error) throw new Error(res.error.message);
                            row = res?.data ? { ...res.data, payload: res.data.triase_payload } : null;
                        } catch (err) {
                            dt_showDraftMessage('Gagal memuat draft untuk ditautkan: ' + (err?.message || String(err)), 'error');
                            return;
                        }
                    } else {
                        const local = dt_getLocalDraftStore().items;
                        row = local.find((it) => String(it.id || '') === id) || null;
                    }
                    if (!row) {
                        dt_showDraftMessage('Draft tidak ditemukan.', 'error');
                        return;
                    }
                    await dt_openLinkDraftTriaseModal(row);
                    return;
                }

                if (deleteBtn) {
                    try {
                        await dt_deleteDraftById(id);
                        await dt_reloadDraftTriaseList();
                        dt_showDraftMessage('Draft berhasil dihapus.', 'success');
                    } catch (err) {
                        dt_showDraftMessage('Gagal menghapus draft: ' + (err?.message || String(err)), 'error');
                    }
                }
            });
        }

        if (deps.elements.closeLinkDraftTriaseModal) {
            deps.elements.closeLinkDraftTriaseModal.addEventListener('click', () => dt_closeLinkDraftTriaseModal());
        }

        if (deps.elements.linkDraftTriaseModal) {
            deps.elements.linkDraftTriaseModal.addEventListener('click', function(e) {
                if (e.target === this || e.target.classList.contains('bg-slate-900')) {
                    dt_closeLinkDraftTriaseModal();
                }
            });
        }

        if (deps.elements.linkDraftTriaseRefreshBtn) {
            deps.elements.linkDraftTriaseRefreshBtn.addEventListener('click', async () => {
                if (!getPendingLinkDraft()) return;
                try {
                    setPatientsCache(await dt_loadTodayUgdPatients());
                    dt_renderLinkPatients();
                } catch (err) {
                    dt_showLinkDraftMessage('Gagal refresh pasien: ' + (err?.message || String(err)), 'error');
                }
            });
        }

        if (deps.elements.linkDraftTriaseSearchInput) {
            deps.elements.linkDraftTriaseSearchInput.addEventListener('input', () => dt_renderLinkPatients());
        }

        if (deps.elements.linkDraftTriaseList) {
            deps.elements.linkDraftTriaseList.addEventListener('click', async (e) => {
                const btn = e.target.closest('.dt-pick-patient-btn');
                if (!btn) return;
                const pid = String(btn.dataset.id || '').trim();
                const pendingDraft = getPendingLinkDraft();
                if (!pid || !pendingDraft) return;
                await dt_attachDraftToPatient(pendingDraft, pid);
            });
        }
    }

    return {
        detectTriaseUgdDraftsTable,
        dt_showDraftMessage,
        dt_clearDraftMessage,
        dt_buildDraftIdentityFromInputs,
        dt_syncDraftMetaBadge,
        dt_renderDraftTriaseList,
        dt_getLocalDraftStore,
        dt_setLocalDraftStore,
        dt_reloadDraftTriaseList,
        dt_resetDraftIdentityInputs,
        dt_openTriaseDraftModal,
        dt_saveTriaseDraftFromModal,
        dt_deleteDraftById,
        dt_closeLinkDraftTriaseModal,
        dt_showLinkDraftMessage,
        dt_renderLinkPatients,
        dt_loadTodayUgdPatients,
        dt_openLinkDraftTriaseModal,
        dt_attachDraftToPatient,
        bindDraftTriaseEvents,
        getPendingLinkDraft
    };
};
