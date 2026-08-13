/**
 * SIM-AMI Queue Sound System
 * Sistem suara antrian untuk SIM-AMI
 */

class QueueSoundSystem {
    constructor() {
        this.basePath = 'assets/sound';
        this.soundEnabled = false;
        this.isPlaying = false;
        this.soundQueue = [];
        this.currentIndex = 0;
        this.currentAudio = null;
        this.audioCache = new Map();
        this.audioBufferCache = new Map();
        this.audioContext = null;
        this.audioUnlocked = false;
        this.transitionGapMs = 15;
        this.soundFiles = {
            opening: 'nada.mp3',
            nurseOpening: 'nada2.mp3',
            attention: 'Perhatian.mp3',
            queueNumber: 'Nomor Antrian.mp3',
            noAntrean: 'No Antrean.mp3',
            farmasi: 'Farmasi.mp3',
            umum: 'Umum.mp3',
            prioritas: 'Prioritas.mp3',
            menujuLoket: 'Menuju Loket.mp3',
            menujuMejaPemeriksaan: 'Menuju Meja Pemeriksaan.mp3',
            ribu: 'ribu.mp3'
        };
    }

    /**
     * Inisialisasi sistem suara
     */
    init() {
        this.loadSoundEnabled();
        console.log('🎵 QueueSoundSystem initialized');
    }

    /**
     * Toggle suara on/off
     */
    toggleSound(enabled) {
        this.soundEnabled = enabled;
        try {
            localStorage.setItem('queueSoundEnabled', enabled ? '1' : '0');
        } catch (e) {}
        console.log('🔊 Sound:', enabled ? 'ON' : 'OFF');
    }

    /**
     * Load setting suara dari localStorage
     */
    loadSoundEnabled() {
        try {
            const saved = localStorage.getItem('queueSoundEnabled');
            this.soundEnabled = saved === '1';
        } catch (e) {
            this.soundEnabled = false;
        }
    }

    /**
     * Cek apakah file suara ada
     */
    async fileExists(path) {
        // Kita anggap ada (untuk kecepatan, tapi bisa diimprove dengan fetch
        return true;
    }

    normalizeCandidates(filePath) {
        return (Array.isArray(filePath) ? filePath : [filePath])
            .map((item) => String(item || '').trim())
            .filter(Boolean);
    }

    preloadAudio(path) {
        const src = String(path || '').trim();
        if (!src) return null;
        if (this.audioCache.has(src)) return this.audioCache.get(src);

        const audio = new Audio(src);
        audio.preload = 'auto';
        try {
            audio.load();
        } catch (e) {}
        this.audioCache.set(src, audio);
        return audio;
    }

    preloadCandidates(filePath) {
        const candidates = this.normalizeCandidates(filePath);
        for (let i = 0; i < candidates.length; i++) {
            this.preloadAudio(candidates[i]);
            this.preloadAudioBuffer(candidates[i]).catch(() => {});
        }
    }

    async ensureAudioContext() {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return null;
        if (!this.audioContext) {
            this.audioContext = new AudioCtx();
        }
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
        return this.audioContext;
    }

    async unlockAudio() {
        try {
            const ctx = await this.ensureAudioContext();
            if (!ctx) return false;
            const buffer = ctx.createBuffer(1, 1, 22050);
            const source = ctx.createBufferSource();
            const gain = ctx.createGain();
            gain.gain.value = 0.0001;
            source.buffer = buffer;
            source.connect(gain);
            gain.connect(ctx.destination);
            source.start(0);
            source.stop(ctx.currentTime + 0.01);
            this.audioUnlocked = true;
            return true;
        } catch (err) {
            return false;
        }
    }

    async preloadAudioBuffer(path) {
        const src = String(path || '').trim();
        if (!src) return null;
        if (this.audioBufferCache.has(src)) {
            return this.audioBufferCache.get(src);
        }

        const bufferPromise = (async () => {
            const ctx = await this.ensureAudioContext();
            if (!ctx) throw new Error('AudioContext tidak tersedia.');
            const response = await fetch(src, { cache: 'force-cache' });
            if (!response.ok) {
                throw new Error(`Gagal memuat audio: ${response.status}`);
            }
            const arrayBuffer = await response.arrayBuffer();
            const cloned = arrayBuffer.slice(0);
            return await new Promise((resolve, reject) => {
                ctx.decodeAudioData(cloned, resolve, reject);
            });
        })();

        this.audioBufferCache.set(src, bufferPromise);
        return bufferPromise;
    }

    playAudioBuffer(buffer) {
        return new Promise(async (resolve, reject) => {
            try {
                const ctx = await this.ensureAudioContext();
                if (!ctx || !buffer) {
                    resolve(false);
                    return;
                }
                const source = ctx.createBufferSource();
                const gain = ctx.createGain();
                gain.gain.value = 1;
                source.buffer = buffer;
                source.connect(gain);
                gain.connect(ctx.destination);
                source.onended = () => resolve(true);
                source.start(0);
                this.currentAudio = {
                    paused: false,
                    pause: () => {
                        try {
                            source.stop(0);
                        } catch (e) {}
                    }
                };
            } catch (err) {
                reject(err);
            }
        });
    }

    playHtmlAudio(path) {
        return new Promise((resolve, reject) => {
            const cachedAudio = this.preloadAudio(path);
            const audio = cachedAudio ? cachedAudio.cloneNode() : new Audio(path);
            audio.preload = 'auto';
            let finished = false;
            const done = (result) => {
                if (finished) return;
                finished = true;
                resolve(result);
            };
            audio.onended = () => done(true);
            audio.onerror = () => reject(new Error('HTMLAudio gagal memutar file.'));
            const playPromise = audio.play();
            if (playPromise && typeof playPromise.then === 'function') {
                playPromise.catch((err) => reject(err));
            }
            this.currentAudio = audio;
        });
    }

    /**
     * Memainkan satu file suara
     * @returns {Promise<boolean>} true jika berhasil dimainkan
     */
    async playSound(filePath) {
        if (!this.soundEnabled) {
            return false;
        }

        const candidates = this.normalizeCandidates(filePath);
        if (candidates.length === 0) return false;

        for (let index = 0; index < candidates.length; index++) {
            const currentPath = candidates[index];
            try {
                const buffer = await this.preloadAudioBuffer(currentPath);
                await this.playAudioBuffer(buffer);
                return true;
            } catch (webAudioErr) {
                try {
                    await this.playHtmlAudio(currentPath);
                    return true;
                } catch (htmlAudioErr) {
                }
            }
        }

        console.warn('⚠️ Tidak dapat memainkan kandidat suara:', candidates);
        return false;
    }

    /**
     * Memainkan antrian suara secara berurutan
     * @returns {Promise<boolean>} true jika SEMUA suara berhasil dimainkan
     */
    async playSequence(soundFiles) {
        if (!this.soundEnabled || soundFiles.length === 0) return false;
        let anyFail = false;
        try {
            await this.ensureAudioContext();
        } catch (e) {}
        this.soundQueue = soundFiles;
        this.isPlaying = true;
        this.currentIndex = 0;

        for (let i = 0; i < soundFiles.length; i++) {
            this.preloadCandidates(soundFiles[i]);
        }

        for (let i = 0; i < soundFiles.length; i++) {
            if (!this.soundEnabled) break;
            const ok = await this.playSound(soundFiles[i]);
            if (!ok) anyFail = true;
            if (this.transitionGapMs > 0 && i < soundFiles.length - 1) {
                await this.sleep(this.transitionGapMs);
            }
        }

        this.isPlaying = false;
        return !anyFail;
    }

    /**
     * Helper untuk delay
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    buildPath() {
        const segments = Array.prototype.slice.call(arguments)
            .map((segment) => String(segment || '').trim())
            .filter(Boolean);
        return segments.join('/');
    }

    getCandidatePaths(folder, fileNames) {
        const names = Array.isArray(fileNames) ? fileNames : [fileNames];
        const seen = {};
        const result = [];

        for (let i = 0; i < names.length; i++) {
            const name = String(names[i] || '').trim();
            if (!name) continue;

            const withFolder = folder ? this.buildPath(this.basePath, folder, name) : this.buildPath(this.basePath, name);
            const rootOnly = this.buildPath(this.basePath, name);

            if (!seen[withFolder]) {
                seen[withFolder] = true;
                result.push(withFolder);
            }

            if (!folder) continue;

            if (!seen[rootOnly]) {
                seen[rootOnly] = true;
                result.push(rootOnly);
            }
        }

        return result;
    }

    getWordSound(fileName) {
        const raw = String(fileName || '').trim();
        if (!raw) return [];
        const lower = raw.toLowerCase();
        return this.getCandidatePaths('01-words', [raw, lower]);
    }

    getOpeningSound(fileName) {
        const raw = String(fileName || '').trim();
        if (!raw) return [];
        return this.getCandidatePaths('00-opening', [raw, raw.toLowerCase()]);
    }

    getNurseOpeningSound() {
        const candidates = [
            this.soundFiles.nurseOpening,
            'Opening Nurse Station.mp3',
            this.soundFiles.opening
        ].map((item) => String(item || '').trim()).filter(Boolean);
        return this.getCandidatePaths('00-opening', candidates);
    }

    getLetterSound(letter) {
        const token = String(letter || '').trim();
        if (!token) return [];
        return this.getCandidatePaths('02-letters', [`${token.toUpperCase()}.mp3`, `${token.toLowerCase()}.mp3`]);
    }

    getNumberSound(token) {
        const value = String(token || '').trim();
        if (!value) return [];
        return this.getCandidatePaths('03-numbers', [`${value}.mp3`]);
    }

    getQueuePrefixLetters(noAntrian) {
        const raw = String(noAntrian || '').trim().toUpperCase();
        const match = raw.match(/^[A-Z]+/);
        return match ? match[0].split('') : [];
    }

    getQueueNumberDigits(noAntrian) {
        const raw = String(noAntrian || '').trim();
        if (!raw) return [];
        const normalized = raw.split(/[-_\s]/).slice(1).join('') || raw.replace(/^\D+/, '');
        const digits = normalized.replace(/\D/g, '').split('').filter(Boolean);
        return digits;
    }

    getQueueNumberString(noAntrian) {
        const raw = String(noAntrian || '').trim();
        if (!raw) return '';
        const afterSplit = raw.split(/[-_\s]/).slice(1).join('');
        const normalized = (afterSplit || raw.replace(/^\D+/, '')).trim();
        if (!normalized) return '';
        const m = normalized.match(/\d+/);
        return m ? m[0] : '';
    }

    getQueueNumberTokens(noAntrian) {
        const digitString = this.getQueueNumberString(noAntrian);
        if (!digitString) return [];
        const tokens = [];
        if (/^0+$/.test(digitString)) {
            for (let i = 0; i < digitString.length; i++) tokens.push('0');
            return tokens;
        }
        let firstNonZeroIdx = 0;
        for (let i = 0; i < digitString.length; i++) {
            if (digitString.charAt(i) !== '0') { firstNonZeroIdx = i; break; }
            tokens.push('0');
        }
        const remainder = digitString.substring(firstNonZeroIdx);
        if (!remainder) return tokens;
        const remainderNum = parseInt(remainder, 10);
        if (!Number.isFinite(remainderNum)) return tokens;
        if (remainder.length === 1) {
            tokens.push(String(remainderNum));
            return tokens;
        }
        if (remainder.length <= 4) {
            const naturalTokens = this.buildNumberTokens(remainderNum);
            for (let i = 0; i < naturalTokens.length; i++) tokens.push(naturalTokens[i]);
            return tokens;
        }
        const rawDigits = remainder.split('');
        for (let i = 0; i < rawDigits.length; i++) tokens.push(rawDigits[i]);
        return tokens;
    }

    getQueueNumberValue(noAntrian) {
        const digits = String(noAntrian || '').replace(/\D/g, '');
        if (!digits) return null;
        const value = parseInt(digits, 10);
        return Number.isFinite(value) ? value : null;
    }

    getLoketTokens(loketTujuan, unit) {
        if (window.queueLoketUtils && typeof window.queueLoketUtils.getAudioTokens === 'function') {
            const tokens = window.queueLoketUtils.getAudioTokens(loketTujuan, { unit: unit || '' });
            if (Array.isArray(tokens) && tokens.length > 0) {
                return tokens;
            }
        }

        const raw = String(loketTujuan || '').trim().toUpperCase();
        if (!raw) return [];
        const match = raw.match(/[A-Z]+$/);
        return match ? match[0].split('') : [];
    }

    buildDigitByDigitTokens(digitsArray) {
        if (!Array.isArray(digitsArray) || digitsArray.length === 0) return [];
        return digitsArray.map((d) => String(d));
    }

    buildNumberTokens(value) {
        const num = Number(value);
        if (!Number.isFinite(num) || num < 0) return [];
        if (num === 0) return ['0'];
        if (num <= 19) return [String(num)];
        if (num < 100) {
            const tens = Math.floor(num / 10) * 10;
            const ones = num % 10;
            return ones ? [String(tens), String(ones)] : [String(tens)];
        }
        if (num < 1000) {
            const hundreds = Math.floor(num / 100) * 100;
            const remainder = num % 100;
            return remainder ? [String(hundreds)].concat(this.buildNumberTokens(remainder)) : [String(hundreds)];
        }
        if (num < 10000) {
            const thousands = Math.floor(num / 1000);
            const remainder = num % 1000;
            const tokens = this.buildNumberTokens(thousands).concat(['ribu']);
            return remainder ? tokens.concat(this.buildNumberTokens(remainder)) : tokens;
        }
        return String(num).split('');
    }

    /**
     * Bangun urutan suara untuk antrian
     * @param {Object} queueData - Data antrian
     * @returns {string[]} Daftar path file suara
     */
    buildQueueSequence(queueData) {
        const { noAntrian, jenisPasien, loketTujuan, unit } = queueData;
        const sequence = [];

        sequence.push(this.getOpeningSound(this.soundFiles.opening));
        sequence.push(this.getWordSound(this.soundFiles.attention));
        sequence.push(this.getWordSound(this.soundFiles.queueNumber));

        const prefixLetters = this.getQueuePrefixLetters(noAntrian);
        for (let i = 0; i < prefixLetters.length; i++) {
            const letterPath = this.getLetterSound(prefixLetters[i]);
            if (letterPath.length) sequence.push(letterPath);
        }

        const numberTokens = this.getQueueNumberTokens(noAntrian);
        for (let i = 0; i < numberTokens.length; i++) {
            const tok = String(numberTokens[i] || '').trim();
            if (!tok) continue;
            const numberPath = /^ribu$/i.test(tok)
                ? this.getWordSound(this.soundFiles.ribu)
                : this.getNumberSound(tok);
            if (numberPath && numberPath.length) sequence.push(numberPath);
        }

        if (String(unit || '').trim().toUpperCase() === 'FARMASI') {
            sequence.push(this.getWordSound(this.soundFiles.farmasi));
        }

        if (jenisPasien) {
            const jenisLower = jenisPasien.toLowerCase();
            if (jenisLower.includes('prioritas') || jenisLower === 'prioritas') {
                sequence.push(this.getWordSound(this.soundFiles.prioritas));
            }
        }

        if (loketTujuan) {
            sequence.push(this.getWordSound(this.soundFiles.menujuLoket));
            const loketTokens = this.getLoketTokens(loketTujuan, unit);
            for (let i = 0; i < loketTokens.length; i++) {
                const token = String(loketTokens[i] || '').trim();
                if (!token) continue;
                const soundPath = /^\d+$/.test(token)
                    ? this.getNumberSound(token)
                    : this.getLetterSound(token);
                if (soundPath.length) sequence.push(soundPath);
            }
        }

        return sequence;
    }

    buildNurseStationSequence(queueData) {
        const { noAntrian } = queueData;
        const sequence = [];

        sequence.push(this.getNurseOpeningSound());
        sequence.push(this.getWordSound(this.soundFiles.queueNumber));

        const normalizedQueueNo = String(noAntrian || '').trim().toUpperCase();
        const isPrioritas = /^(P|B)-/.test(normalizedQueueNo);
        sequence.push(this.getWordSound(isPrioritas ? this.soundFiles.prioritas : this.soundFiles.umum));

        const prefixLetters = this.getQueuePrefixLetters(noAntrian);
        for (let i = 0; i < prefixLetters.length; i++) {
            const letterPath = this.getLetterSound(prefixLetters[i]);
            if (letterPath.length) sequence.push(letterPath);
        }

        const numberTokens = this.getQueueNumberTokens(noAntrian);
        for (let i = 0; i < numberTokens.length; i++) {
            const tok = String(numberTokens[i] || '').trim();
            if (!tok) continue;
            const numberPath = /^ribu$/i.test(tok)
                ? this.getWordSound(this.soundFiles.ribu)
                : this.getNumberSound(tok);
            if (numberPath && numberPath.length) sequence.push(numberPath);
        }

        sequence.push(this.getWordSound(this.soundFiles.menujuMejaPemeriksaan));

        return sequence;
    }

    async playActivationPreview() {
        const previewSequence = [
            this.getOpeningSound(this.soundFiles.opening),
            this.getWordSound(this.soundFiles.attention)
        ].filter((item) => Array.isArray(item) ? item.length > 0 : !!item);
        return this.playSequence(previewSequence);
    }

    /**
     * Memanggil antrian farmasi
     * @returns {Promise<boolean>} true jika semua suara berhasil dimainkan
     */
    async announceFarmasi(queueData) {
        console.log('📢 Memanggil antrian Farmasi:', queueData.noAntrian);
        const sequence = this.buildQueueSequence({
            ...queueData,
            unit: 'FARMASI'
        });
        return this.playSequence(sequence);
    }

    /**
     * Memanggil antrian poliklinik
     * @returns {Promise<boolean>} true jika semua suara berhasil dimainkan
     */
    async announcePoliklinik(queueData) {
        console.log('📢 Memanggil antrian Poliklinik:', queueData.noAntrian);
        const sequence = this.buildQueueSequence({
            ...queueData,
            unit: 'POLIKLINIK'
        });
        return this.playSequence(sequence);
    }

    /**
     * Memanggil antrian Nurse Station
     * @returns {Promise<boolean>} true jika semua suara berhasil dimainkan
     */
    async announceNurseStation(queueData) {
        console.log('📢 Memanggil antrian Nurse Station:', queueData.noAntrian);
        const sequence = this.buildNurseStationSequence({
            ...queueData,
            unit: 'NURSE_STATION'
        });
        return this.playSequence(sequence);
    }

    /**
     * Menghentikan suara
     */
    stop() {
        if (this.currentAudio && typeof this.currentAudio.pause === 'function' && !this.currentAudio.paused) {
            this.currentAudio.pause();
        }
        this.isPlaying = false;
        this.soundQueue = [];
    }
}

// Inisialisasi global
window.queueSound = new QueueSoundSystem();
const queueSound = window.queueSound;
if (window.queueSound && typeof window.queueSound.init === 'function') {
    window.queueSound.init();
}
