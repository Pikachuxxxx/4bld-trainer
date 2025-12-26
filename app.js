const AppMode = {IDLE: 'idle', MEMO: 'memo', EXEC: 'exec', RESULT: 'result', STATS: 'stats', STUDY: 'study'};

class Trainer
{
    constructor()
    {
        this.data             = [];
        this.currentSequence  = [];
        this.userAnswers      = [];
        this.currentMemoIndex = 0;
        this.mode             = AppMode.IDLE;

        // Timing
        this.startTime     = 0;
        this.memoTime      = 0;
        this.timerInterval = 0;

        // Stats
        this.stats = JSON.parse(localStorage.getItem('4bld_stats') || '[]');

        // UI Cache
        this.ui = {
            app: document.getElementById('app'),
            modeText: document.getElementById('mode-text'),
            timer: document.getElementById('timer'),
            input: document.getElementById('user-input'),

            memoImg: document.getElementById('memo-img'),
            memoWord: document.getElementById('memo-word'),
            memoType: document.getElementById('memo-type'),
            progress: document.getElementById('memo-progress'),

            studyImg: document.getElementById('study-img'),
            studyPair: document.getElementById('study-pair'),
            studyWord: document.getElementById('study-word'),
            studyFilter: document.getElementById('study-filter')
        };

        this.init();
    }

    async init()
    {
        try {
            const res                  = await fetch('pairs.json');
            this.data                  = await res.json();
            this.ui.modeText.innerText = "READY";
            this.populateStudyFilter();
        } catch (e) {
            alert("Error loading data");
        }
        this.attachListeners();
    }

    populateStudyFilter()
    {
        const sel = this.ui.studyFilter;
        if (sel.options.length > 1) return;
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split('').forEach(c = > {
            const opt     = document.createElement('option');
            opt.value     = c;
            opt.innerText = `Letter $
            {
                c
            }
            `;
            sel.appendChild(opt);
        });
    }

    attachListeners()
    {
        this.ui.app.addEventListener('click', (e) = > {
            // Ignore if clicking a button, input, or link
            const tag = e.target.tagName;
            if (tag === 'BUTTON' || tag === 'INPUT' || tag === 'SELECT' || tag === 'LABEL') return;

            // If in Execution mode, tapping background should focus input (bring up keyboard)
            if (this.mode === AppMode.EXEC) {
                this.ui.input.focus();
                return;
            }

            // Otherwise, treat click as Spacebar
            this.handleSpace(); });

        // --- BUTTONS ---

        // NEW FINISH BUTTON LOGIC
        document.getElementById('btn-finish-run').onclick = () =>
        {
            // Save pending text if any
            if (this.ui.input.value.trim().length > 0) {
                this.submitPair();
            }
            this.finishRun();
        };

        document.getElementById('btn-stats').onclick = ()  = > this.showStats();
        document.getElementById('btn-close-stats').onclick = () = > this.setMode(AppMode.IDLE);
        document.getElementById('btn-reset-stats').onclick = () =>
        {
            localStorage.removeItem('4bld_stats');
            location.reload();
        };

        document.getElementById('btn-study').onclick = () = > this.startStudy();
        document.getElementById('btn-exit-study').onclick = () = > this.setMode(AppMode.IDLE);
        document.getElementById('btn-prev').onclick = () = > this.navStudy(-1);
        document.getElementById('btn-next').onclick = () = > this.navStudy(1);

        this.ui.studyFilter.onchange = () = > this.filterStudy();

        // --- KEYBOARD ---
        document.addEventListener('keydown', (e) = > {
            if (e.code === 'Space') {
                e.preventDefault();
                this.handleSpace();
            }
            if (e.code === 'Enter') {
                e.preventDefault();
                this.handleEnter();
            }
            if (this.mode === AppMode.STUDY) {
                if(e.code === 'ArrowLeft') this.navStudy(-1);
                if(e.code === 'ArrowRight') this.navStudy(1);
            } });

        this.ui.input.addEventListener('input', () = > {
            if(this.ui.input.value.length === 2) setTimeout(() => this.submitPair(), 100); });
    }

    handleSpace()
    {
        switch (this.mode) {
            case AppMode.IDLE: this.startMemo(); break;
            case AppMode.MEMO: this.nextMemo(); break;
            // Space does NOTHING in EXEC now (Button only)
            case AppMode.RESULT: this.setMode(AppMode.IDLE); break;
            case AppMode.STUDY: this.navStudy(1); break;
            case AppMode.STATS: this.setMode(AppMode.IDLE); break;
        }
    }

    handleEnter()
    {
        if (this.mode == = AppMode.MEMO) this.startExec();
        else if (this.mode == = AppMode.EXEC) {
            // Enter works as "Submit or Finish"
            if (this.ui.input.value.trim().length > 0) this.submitPair();
            else
                this.finishRun();
        }
    }

    // --- GAME LOGIC ---
    startMemo()
    {
        if (!this.data.length) return;
        this.generateSequence();
        this.currentMemoIndex = 0;
        this.startTime        = Date.now();
        this.startTimer();
        this.setMode(AppMode.MEMO);
        this.renderMemo();
    }

    generateSequence()
    {
        // Get Checkbox States
        const useCenters = document.getElementById('chk-centers').checked;
        const useEdges   = document.getElementById('chk-edges').checked;
        const useCorners = document.getElementById('chk-corners').checked;
        const useParity  = document.getElementById('chk-parity').checked;

        // Get Number Values
        let centerCount = parseInt(document.getElementById('num-centers').value) || 2;
        let edgeCount   = parseInt(document.getElementById('num-edges').value) || 10;
        let cornerCount = parseInt(document.getElementById('num-corners').value) || 6;

        let seq   = [];
        const rnd = () = > this.data[Math.floor(Math.random() * this.data.length)];

        // Push useCenters
        if (useCenters) {
            for (let i = 0; i < centerCount; i++) seq.push(rnd());
        }

        // Push Edges
        if (useEdges) {
            for (let i = 0; i < edgeCount; i++) seq.push(rnd());
        }

        // Push Corners
        if (useCorners) {
            for (let i = 0; i < cornerCount; i++) seq.push(rnd());
        }

        // Handle Parity
        // If parity is ON, ensure total length is ODD.
        // If parity is OFF, ensure total length is EVEN.
        const isOdd = seq.length % 2 != = 0;
        if ((useParity && !isOdd) || (!useParity && isOdd)) {
            seq.push(rnd());
        }

        this.currentSequence = seq;
    }
    renderMemo()
    {
        if (this.currentMemoIndex >= this.currentSequence.length) {
            this.startExec();
            return;
        }
        const item                 = this.currentSequence[this.currentMemoIndex];
        this.ui.memoImg.src        = item.image;
        this.ui.memoWord.innerText = item.word;
        this.ui.memoType.innerText = `${this.currentMemoIndex + 1} / $
        {
            this.currentSequence.length
        }
        `;
        this.ui.progress.style.width = `${((this.currentMemoIndex + 1) / this.currentSequence.length) * 100} %`;
    }

    nextMemo()
    {
        this.currentMemoIndex++;
        this.renderMemo();
    }

    startExec()
    {
        // CAPTURE SPLIT TIME
        this.memoTime = (Date.now() - this.startTime) / 1000;

        this.setMode(AppMode.EXEC);
        this.userAnswers                                   = [];
        document.getElementById('input-history').innerHTML = '';
        this.ui.input.value                                = '';

        // FORCE FOCUS FOR MOBILE KEYBOARD
        setTimeout(() = > {
            this.ui.input.focus();
            this.ui.input.click();    // Sometimes needed for iOS
        },
            50);
        // NOTE: Timer continues running!
    }

    submitPair()
    {
        const val = this.ui.input.value.toUpperCase().trim();
        if (!val) return;
        this.userAnswers.push(val);
        const chip     = document.createElement('div');
        chip.className = 'chip';
        chip.innerText = val;
        document.getElementById('input-history').appendChild(chip);
        this.ui.input.value = '';
        this.ui.input.focus();
    }

    finishRun()
    {
        this.stopTimer();
        const totalTime = (Date.now() - this.startTime) / 1000;
        const execTime  = totalTime - this.memoTime;

        let correct    = 0;
        const total    = this.currentSequence.length;
        const list     = document.getElementById('result-list');
        list.innerHTML = '';

        const max = Math.max(total, this.userAnswers.length);
        for (let i = 0; i < max; i++) {
            const target = this.currentSequence[i];
            const ans    = this.userAnswers[i] || '-';
            const isOk = target&& target.pair == = ans;
            if (isOk) correct++;

            const div     = document.createElement('div');
            div.className = `res - row                          ${isOk ? 'res-correct' : 'res-wrong'}`;
            div.innerHTML = `<span> #${i + 1} < / span > <span> ${ans} < / span > <span style = "opacity:0.6"> ${target ? target.pair : 'End'} < / span >`;
            list.appendChild(div);
        }

        this.saveStats(totalTime, this.memoTime, execTime, correct, total);

        document.getElementById('score-display').innerText = `${correct} / ${total} Correct`;
        document.getElementById('time-total').innerText    = totalTime.toFixed(2) + 's';
        document.getElementById('time-memo').innerText     = this.memoTime.toFixed(2) + 's';
        document.getElementById('time-exec').innerText     = execTime.toFixed(2) + 's';

        this.setMode(AppMode.RESULT);
    }

    saveStats(totalTime, memoTime, execTime, score, total)
    {
        this.stats.unshift({
            date: new Date().toISOString(),
            time: totalTime,
            memo: memoTime,
            exec: execTime,
            score: score,
            total: total,
            success: score == = total
        });
        localStorage.setItem('4bld_stats', JSON.stringify(this.stats));
    }

    showStats()
    {
        this.setMode(AppMode.STATS);
        const total = this.stats.length;
        const wins  = this.stats.filter(s = > s.success);

        document.getElementById('st-total').innerText = total;
        document.getElementById('st-rate').innerText  = total ? Math.round((wins.length / total) * 100) + '%' : '0%';

        const times = wins.map(s = > s.time);
        const best  = times.length ? Math.min(... times) : 0;
        const avg   = times.length ? (times.reduce((a, b) = > a + b, 0) / times.length) : 0;

        document.getElementById('st-best').innerText = best ? best.toFixed(2) + 's' : '-';
        document.getElementById('st-avg').innerText  = avg ? avg.toFixed(2) + 's' : '-';

        document.getElementById('stats-body').innerHTML = this.stats.slice(0, 50).map(s = > ` <tr>
                                                                                          <td style = "color:${s.success ? '#4ade80' : '#ef4444'}">
                                                                                               ${s.success ? '✔' : '✖'} < / td >
                                                                                          <td> ${s.memo.toFixed(1)} s</ td>
                                                                                          <td>
                                                                                              ${s.exec.toFixed(1)} s</ td>
                                                                                          <td>
                                                                                              ${s.time.toFixed(2)} s</ td>
                                                                                          </ tr>`)
                                                              .join('');
    }

    startStudy()
    {
        if (!this.data.length) return;
        this.setMode(AppMode.STUDY);
        this.populateStudyFilter();
        this.filterStudy();
    }

    filterStudy()
    {
        const char      = this.ui.studyFilter.value;
        this.studyList  = (char == = 'ALL') ? this.data : this.data.filter(d = > d.pair.startsWith(char));
        this.studyIndex = 0;
        this.renderStudy();
    }

    navStudy(dir)
    {
        if (!this.studyList.length) return;
        this.studyIndex += dir;
        if (this.studyIndex < 0) this.studyIndex = this.studyList.length - 1;
        if (this.studyIndex >= this.studyList.length) this.studyIndex = 0;
        this.renderStudy();
    }

    renderStudy()
    {
        if (!this.studyList.length) return;
        const item                  = this.studyList[this.studyIndex];
        this.ui.studyPair.innerText = item.pair;
        this.ui.studyImg.src        = item.image;
        this.ui.studyWord.innerText = item.word;
    }

    setMode(mode)
    {
        this.mode             = mode;
        this.ui.app.className = `mode - $
        {
            mode
        }
        `;
        document.querySelectorAll('.screen').forEach(s = > s.classList.remove('active'));
        const active = document.getElementById(`screen - $ { mode }`);
        if (active) active.classList.add('active');
        const map                  = {idle: "IDLE", memo: "MEMO", exec: "RECALL", result: "DONE", stats: "STATS", study: "STUDY"};
        this.ui.modeText.innerText = map[mode];
    }

    startTimer()
    {
        clearInterval(this.timerInterval);
        this.timerInterval = setInterval(() = > {
            this.ui.timer.innerText = ((Date.now() - this.startTime) / 1000).toFixed(2) + 's';
        },
            100);
    }
    stopTimer() { clearInterval(this.timerInterval); }
}

window.addEventListener('DOMContentLoaded', () = > new Trainer());
