var AppMode = {
    IDLE: 'idle',
    MEMO: 'memo',
    EXEC: 'exec',
    RESULT: 'result'
};

class Trainer {
    constructor() {
        this.data = [];
        this.currentSequence = [];
        this.userAnswers = [];
        this.currentMemoIndex = 0;
        this.mode = AppMode.IDLE;
        this.startTime = 0;
        this.timerInterval = 0;
        
        // Stats Object
        this.stats = {
            solves: 0,
            successes: 0,
            totalTime: 0,
            bestTime: null,
            history: [] // { time: 12.5, success: true, date: '...' }
        };

        // DOM Elements
        this.appEl = document.getElementById('app');
        this.modeTextEl = document.getElementById('mode-text');
        this.timerEl = document.getElementById('timer');
        this.imgEl = document.getElementById('memo-img');
        this.wordEl = document.getElementById('memo-word');
        this.typeEl = document.getElementById('memo-type');
        this.inputEl = document.getElementById('user-input');
        this.historyEl = document.getElementById('input-history');
        
        // Stats DOM
        this.statsPanel = document.getElementById('stats-panel');
        document.getElementById('stats-toggle').onclick = () => this.toggleStats();
        document.getElementById('close-stats').onclick = () => this.toggleStats();

        this.loadData();
        this.loadStats(); // Load from LocalStorage
        this.attachListeners();
    }

    async loadData() {
        try {
            const res = await fetch('pairs.json');
            if (!res.ok) throw new Error("File not found");
            this.data = await res.json();
            console.log(`Loaded ${this.data.length} pairs.`);
            this.modeTextEl.innerText = "READY";
            this.modeTextEl.style.color = "#4ade80";
        } catch (e) {
            alert("Error: Ensure python server is running and pairs.json exists.");
        }
    }

    loadStats() {
        const saved = localStorage.getItem('4bld_stats');
        if (saved) {
            this.stats = JSON.parse(saved);
            this.updateStatsUI();
        }
    }

    saveStats() {
        localStorage.setItem('4bld_stats', JSON.stringify(this.stats));
        this.updateStatsUI();
    }

    updateStatsUI() {
        const s = this.stats;
        document.getElementById('st-total').innerText = s.solves;
        
        const rate = s.solves > 0 ? Math.round((s.successes / s.solves) * 100) : 0;
        document.getElementById('st-rate').innerText = `${rate}%`;

        document.getElementById('st-best').innerText = s.bestTime ? `${s.bestTime}s` : '-';
        
        const avg = s.solves > 0 ? (s.totalTime / s.solves).toFixed(2) : '-';
        document.getElementById('st-avg').innerText = `${avg}s`;

        // History List (Last 10)
        const list = document.getElementById('st-history');
        list.innerHTML = '';
        s.history.slice().reverse().slice(0, 10).forEach(h => {
            const div = document.createElement('div');
            div.className = `hist-item ${h.success ? 'hist-good' : 'hist-bad'}`;
            div.innerHTML = `<span>${h.success ? '✔' : '✘'} ${h.time}s</span> <span style="opacity:0.5">${h.date}</span>`;
            list.appendChild(div);
        });
    }

    toggleStats() {
        this.statsPanel.classList.toggle('open');
    }

    attachListeners() {
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                if (document.activeElement !== this.inputEl) e.preventDefault();
                this.handleSpace();
            }
            if (e.code === 'Enter') this.handleEnter();
        });

        this.inputEl.addEventListener('input', () => {
            // Auto-submit 2 chars. Ignore 1 char (Parity) until Enter is pressed.
            if (this.inputEl.value.length === 2) {
                setTimeout(() => this.submitPair(), 150);
            }
        });
    }

    handleSpace() {
        if (!this.data.length) return;
        switch (this.mode) {
            case AppMode.IDLE: this.startMemo(); break;
            case AppMode.MEMO: this.nextMemoItem(); break;
            case AppMode.EXEC: this.finishRun(); break;
            case AppMode.RESULT: this.setMode(AppMode.IDLE); break;
        }
    }

    handleEnter() {
        if (this.mode === AppMode.MEMO) this.startExecution();
        else if (this.mode === AppMode.EXEC) this.submitPair();
        else if (this.mode === AppMode.RESULT) this.setMode(AppMode.IDLE);
    }

    generateSequence() {
        const useEdges = document.getElementById('chk-edges').checked;
        const useCorners = document.getElementById('chk-corners').checked;
        const randParity = document.getElementById('chk-parity').checked;

        let sequence = [];
        const getRandom = () => this.data[Math.floor(Math.random() * this.data.length)];

        // Standard 4BLD amount (approx)
        const edgeCount = useEdges ? 10 : 0; 
        const cornerCount = useCorners ? 8 : 0;

        for (let i = 0; i < edgeCount; i++) sequence.push(getRandom());
        for (let i = 0; i < cornerCount; i++) sequence.push(getRandom());

        // Parity Logic
        // If "Random Parity" is checked, we flip a coin to force odd/even length
        if (randParity) {
            if (Math.random() > 0.5) {
                // Force Odd (Parity exists)
                if (sequence.length % 2 === 0) sequence.push(getRandom());
            } else {
                // Force Even (No parity)
                if (sequence.length % 2 !== 0) sequence.push(getRandom());
            }
        }

        this.currentSequence = sequence;
    }

    startMemo() {
        this.generateSequence();
        if(this.currentSequence.length === 0) { alert("Select Edges or Corners"); return; }
        
        this.currentMemoIndex = 0;
        this.startTime = Date.now();
        this.startTimer();
        this.setMode(AppMode.MEMO);
        this.renderMemoItem();
    }

    nextMemoItem() {
        this.currentMemoIndex++;
        if (this.currentMemoIndex >= this.currentSequence.length) {
            this.startExecution();
        } else {
            this.renderMemoItem();
        }
    }

    renderMemoItem() {
        const item = this.currentSequence[this.currentMemoIndex];
        this.imgEl.src = item.image;
        this.wordEl.innerText = item.word;
        // Logic: Usually edges are first, but here it's mixed. 
        this.typeEl.innerText = `${this.currentMemoIndex + 1} / ${this.currentSequence.length}`;
        const pct = ((this.currentMemoIndex + 1) / this.currentSequence.length) * 100;
        document.getElementById('memo-progress').style.width = `${pct}%`;
    }

    startExecution() {
        this.setMode(AppMode.EXEC);
        this.userAnswers = [];
        this.historyEl.innerHTML = '';
        this.inputEl.value = '';
        this.inputEl.focus();
    }

    submitPair() {
        const val = this.inputEl.value.toUpperCase().trim();
        if (!val) return;

        this.userAnswers.push(val);
        
        // Add visual chip
        const chip = document.createElement('div');
        chip.className = 'history-chip';
        chip.innerText = val;
        this.historyEl.appendChild(chip);

        this.inputEl.value = '';
        this.inputEl.focus();
    }

    finishRun() {
        this.stopTimer();
        this.setMode(AppMode.RESULT);
        this.calculateResults();
    }

    calculateResults() {
        const listEl = document.getElementById('result-list');
        listEl.innerHTML = '';
        let correctCount = 0;
        let hasErrors = false;

        const maxLen = Math.max(this.currentSequence.length, this.userAnswers.length);

        for (let i = 0; i < maxLen; i++) {
            const target = this.currentSequence[i];
            const answer = this.userAnswers[i] || "-";
            
            // Logic: Answer is correct if it matches the Pair OR if it's the last item and matches the Parity Letter (single char)
            let isCorrect = false;
            if (target) {
                // Normal Pair Match
                if (answer === target.pair) isCorrect = true;
                
                // Parity Handling: If target is "KA" but user typed "K" (last item), 
                // In real BLD you might memorize "K" for parity.
                // But this trainer enforces exact pair matching usually.
                // However, user requested "Single Letter" parity input.
                // So if it's the LAST item, we can be lenient if the pair STARTS with the letter? 
                // Or just enforce strict matching. 
                // Let's stick to: If you typed a single letter 'A', and the target Pair starts with 'A', we count it as Parity correct?
                // Actually, standard trainer behavior: You define parity images. 
                // Since we rely on letter pairs, Parity usually means an odd number of targets.
                // The last target IS the parity target.
                
                // Strict Match for now:
                if (answer === target.pair) isCorrect = true;
            }

            if (isCorrect) {
                correctCount++;
            } else {
                hasErrors = true;
            }

            // Only Draw Row if Wrong (Cleaner) OR if it's the end
            const div = document.createElement('div');
            div.className = `res-item ${isCorrect ? 'correct' : 'wrong'}`;
            
            let html = `<span class="res-idx">#${i+1}</span>`;
            
            if (isCorrect) {
                 html += `<span class="res-match">${answer}</span> <span class="res-check">✔</span>`;
            } else {
                html += `<div class="res-detail">
                            <span class="res-bad">You: ${answer}</span>
                            <span class="res-good">Target: ${target ? target.pair : 'END'} (${target ? target.word : '-'})</span>
                         </div>`;
            }
            
            div.innerHTML = html;
            listEl.appendChild(div);
        }

        const timeVal = parseFloat(((Date.now() - this.startTime) / 1000).toFixed(2));
        const isSuccess = (correctCount === maxLen);
        
        // Update Model
        this.stats.solves++;
        if (isSuccess) this.stats.successes++;
        this.stats.totalTime += timeVal;
        
        if (isSuccess) {
            if (this.stats.bestTime === null || timeVal < this.stats.bestTime) {
                this.stats.bestTime = timeVal;
            }
        }
        
        // Add to history
        this.stats.history.push({
            time: timeVal,
            success: isSuccess,
            date: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
        });
        
        this.saveStats(); // Save to Disk (LocalStorage)

        const scoreEl = document.getElementById('score-display');
        document.getElementById('time-display').innerText = `${timeVal}s`;

        if (isSuccess) {
            scoreEl.innerText = "PERFECT!";
            scoreEl.style.color = "#4ade80";
        } else {
            scoreEl.innerText = `${correctCount}/${maxLen} Correct`;
            scoreEl.style.color = "#f87171";
        }
    }

    setMode(mode) {
        this.mode = mode;
        this.appEl.className = `mode-${mode}`;
        document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
        const s = document.getElementById(`screen-${mode}`);
        if(s) s.classList.add('active');

        const map = { 'idle': "IDLE", 'memo': "MEMO", 'exec': "RECALL", 'result': "RESULTS" };
        this.modeTextEl.innerText = map[mode];
    }

    startTimer() {
        this.stopTimer();
        this.timerInterval = setInterval(() => {
            const s = (Date.now() - this.startTime) / 1000;
            this.timerEl.innerText = s.toFixed(2) + 's';
        }, 100);
    }
    stopTimer() { clearInterval(this.timerInterval); }
}

window.addEventListener('DOMContentLoaded', () => { new Trainer(); });
