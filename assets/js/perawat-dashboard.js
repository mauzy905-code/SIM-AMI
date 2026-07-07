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
                '    <div class="perawat-dashboard-tile is-note is-asses">',
                '      <div class="perawat-dashboard-icon is-asses" aria-hidden="true">',
                '        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">',
                '          <path d="M12 21s-7-4.35-7-11a4 4 0 0 1 7-2.65A4 4 0 0 1 19 10c0 6.65-7 11-7 11z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
                '          <path d="M12 8v5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
                '          <path d="M9.5 10.5h5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
                '        </svg>',
                '      </div>',
                '      <div class="perawat-dashboard-tile-content">',
                '        <div class="perawat-dashboard-tile-title">Asesmen UGD</div>',
                '        <div class="perawat-dashboard-tile-desc">Asesmen UGD dibuka dari rekap pasien UGD, lalu klik tombol Asesmen pada pasien.</div>',
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
                menuDraftBtn: containerEl.querySelector('#perawatDashMenuDraftTriase')
            };

            els.menuRekapBtn?.addEventListener('click', async () => {
                await Promise.resolve(config?.openRekap?.());
            });

            els.menuDraftBtn?.addEventListener('click', async () => {
                await Promise.resolve(config?.openDraftTriase?.());
            });

            mounted = true;
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
