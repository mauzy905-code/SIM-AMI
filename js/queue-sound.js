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
        this.transitionGapMs = 15;
        this.soundFiles = {
            opening: 'nada.mp3',
            attention: 'Perhatian.mp3',
            queueNumber: 'Nomor Antrian.mp3',
            umum: 'Umum.mp3',
            prioritas: 'Prioritas.mp3',
            menujuLoket: 'Menuju Loket.mp3',
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
        // #region debug-point A:queue-toggle
        fetch("http://127.0.0.1:7777/event",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sessionId:"display-audio-missing",runId:"pre-fix",hypothesisId:"A",location:"queue-sound.js:toggleSound",msg:"[DEBUG] queue sound toggled",data:{enabled:!!enabled,basePath:String(this.basePath||"")},ts:Date.now()})}).catch(()=>{});
        // #endregion
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
        }
    }

    /**
     * Memainkan satu file suara
     */
    playSound(filePath) {
        return new Promise((resolve) => {
            if (!this.soundEnabled) {
                // #region debug-point E:play-sound-disabled
                fetch("http://127.0.0.1:7777/event",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sessionId:"display-audio-missing",runId:"pre-fix",hypothesisId:"E",location:"queue-sound.js:playSound:disabled",msg:"[DEBUG] playSound skipped because disabled",data:{candidateCount:Array.isArray(filePath)?filePath.length:1},ts:Date.now()})}).catch(()=>{});
                // #endregion
                resolve();
                return;
            }

            const candidates = this.normalizeCandidates(filePath);

            if (candidates.length === 0) {
                resolve();
                return;
            }

            const tryPlay = (index) => {
                if (index >= candidates.length) {
                    console.warn('⚠️ Tidak dapat memainkan kandidat suara:', candidates);
                    resolve();
                    return;
                }

                const currentPath = candidates[index];
                const cachedAudio = this.preloadAudio(currentPath);
                const audio = cachedAudio ? cachedAudio.cloneNode() : new Audio(currentPath);
                audio.preload = 'auto';
                let settled = false;

                const finish = () => {
                    if (settled) return;
                    settled = true;
                    resolve();
                };

                const next = () => {
                    if (settled) return;
                    settled = true;
                    // #region debug-point E:play-sound-next
                    fetch("http://127.0.0.1:7777/event",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sessionId:"display-audio-missing",runId:"pre-fix",hypothesisId:"E",location:"queue-sound.js:playSound:next",msg:"[DEBUG] playSound candidate failed, moving next",data:{path:String(currentPath||""),candidateIndex:Number(index||0)},ts:Date.now()})}).catch(()=>{});
                    // #endregion
                    tryPlay(index + 1);
                };

                audio.onended = finish;
                audio.onerror = next;

                const playPromise = audio.play();
                if (playPromise && typeof playPromise.then === 'function') {
                    playPromise.then(() => {
                        // #region debug-point E:play-sound-started
                        fetch("http://127.0.0.1:7777/event",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sessionId:"display-audio-missing",runId:"pre-fix",hypothesisId:"E",location:"queue-sound.js:playSound:started",msg:"[DEBUG] playSound started",data:{path:String(currentPath||""),candidateIndex:Number(index||0)},ts:Date.now()})}).catch(()=>{});
                        // #endregion
                    }).catch((err) => {
                        // #region debug-point E:play-sound-catch
                        fetch("http://127.0.0.1:7777/event",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sessionId:"display-audio-missing",runId:"pre-fix",hypothesisId:"E",location:"queue-sound.js:playSound:catch",msg:"[DEBUG] playSound rejected",data:{path:String(currentPath||""),candidateIndex:Number(index||0),message:String(err?.message||err||"")},ts:Date.now()})}).catch(()=>{});
                        // #endregion
                        next();
                    });
                }

                this.currentAudio = audio;
            };

            tryPlay(0);
        });
    }

    /**
     * Memainkan antrian suara secara berurutan
     */
    async playSequence(soundFiles) {
        if (!this.soundEnabled || soundFiles.length === 0) return;
        // #region debug-point F:play-sequence
        fetch("http://127.0.0.1:7777/event",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sessionId:"display-audio-missing",runId:"pre-fix",hypothesisId:"F",location:"queue-sound.js:playSequence",msg:"[DEBUG] playSequence start",data:{length:Number(soundFiles.length||0),preview:Array.isArray(soundFiles)?soundFiles.slice(0,5):[]},ts:Date.now()})}).catch(()=>{});
        // #endregion
        this.soundQueue = soundFiles;
        this.isPlaying = true;
        this.currentIndex = 0;

        for (let i = 0; i < soundFiles.length; i++) {
            this.preloadCandidates(soundFiles[i]);
        }

        for (let i = 0; i < soundFiles.length; i++) {
            if (!this.soundEnabled) break;
            await this.playSound(soundFiles[i]);
            if (this.transitionGapMs > 0 && i < soundFiles.length - 1) {
                await this.sleep(this.transitionGapMs);
            }
        }

        this.isPlaying = false;
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

    getQueueNumberValue(noAntrian) {
        const digits = String(noAntrian || '').replace(/\D/g, '');
        if (!digits) return null;
        const value = parseInt(digits, 10);
        return Number.isFinite(value) ? value : null;
    }

    getLoketLetters(loketTujuan) {
        const raw = String(loketTujuan || '').trim().toUpperCase();
        if (!raw) return [];
        if (raw === 'LOKET_1') return ['A'];
        if (raw === 'LOKET_2') return ['B'];
        const match = raw.match(/[A-Z]+$/);
        return match ? match[0].split('') : [];
    }

    buildNumberTokens(value) {
        const num = Number(value);
        if (!Number.isFinite(num) || num <= 0) return [];
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
        const { noAntrian, jenisPasien, loketTujuan } = queueData;
        const sequence = [];

        // 1. Nada pembuka
        sequence.push(this.getOpeningSound(this.soundFiles.opening));
        sequence.push(this.getWordSound(this.soundFiles.attention));
        sequence.push(this.getWordSound(this.soundFiles.queueNumber));

        // 2. Huruf awal nomor antrian (A/B/dst)
        const prefixLetters = this.getQueuePrefixLetters(noAntrian);
        for (let i = 0; i < prefixLetters.length; i++) {
            const letterPath = this.getLetterSound(prefixLetters[i]);
            if (letterPath.length) sequence.push(letterPath);
        }

        // 3. Angka antrian mengikuti sampel file suara:
        // 21 => 20 + 1, 115 => 100 + 15, 234 => 200 + 30 + 4.
        const queueNumberValue = this.getQueueNumberValue(noAntrian);
        const numberTokens = this.buildNumberTokens(queueNumberValue);
        for (let i = 0; i < numberTokens.length; i++) {
            const numberPath = this.getNumberSound(numberTokens[i]);
            if (numberPath.length) sequence.push(numberPath);
        }

        // 4. Hanya antrean prioritas yang dibacakan.
        if (jenisPasien) {
            const jenisLower = jenisPasien.toLowerCase();
            if (jenisLower.includes('prioritas') || jenisLower === 'prioritas') {
                sequence.push(this.getWordSound(this.soundFiles.prioritas));
            }
        }

        // 5. Menuju loket
        if (loketTujuan) {
            sequence.push(this.getWordSound(this.soundFiles.menujuLoket));
            const loketLetters = this.getLoketLetters(loketTujuan);
            for (let i = 0; i < loketLetters.length; i++) {
                const letterPath = this.getLetterSound(loketLetters[i]);
                if (letterPath.length) sequence.push(letterPath);
            }
        }

        // #region debug-point G:build-sequence
        fetch("http://127.0.0.1:7777/event",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sessionId:"display-audio-missing",runId:"pre-fix",hypothesisId:"G",location:"queue-sound.js:buildQueueSequence",msg:"[DEBUG] queue sequence built",data:{noAntrian:String(noAntrian||""),jenisPasien:String(jenisPasien||""),loketTujuan:String(loketTujuan||""),steps:Number(sequence.length||0),numberTokens:this.buildNumberTokens(this.getQueueNumberValue(noAntrian))},ts:Date.now()})}).catch(()=>{});
        // #endregion

        return sequence;
    }

    /**
     * Memanggil antrian farmasi
     */
    async announceFarmasi(queueData) {
        console.log('📢 Memanggil antrian Farmasi:', queueData.noAntrian);
        const sequence = this.buildQueueSequence({
            ...queueData,
            unit: 'FARMASI'
        });
        await this.playSequence(sequence);
    }

    /**
     * Memanggil antrian poliklinik
     */
    async announcePoliklinik(queueData) {
        console.log('📢 Memanggil antrian Poliklinik:', queueData.noAntrian);
        const sequence = this.buildQueueSequence({
            ...queueData,
            unit: 'POLIKLINIK'
        });
        await this.playSequence(sequence);
    }

    /**
     * Menghentikan suara
     */
    stop() {
        if (this.currentAudio && !this.currentAudio.paused) {
            this.currentAudio.pause();
        }
        this.isPlaying = false;
        this.soundQueue = [];
    }
}

// Inisialisasi global
window.queueSound = new QueueSoundSystem();
const queueSound = window.queueSound;
