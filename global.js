const ZoomManager = {
    zoomLevel: 1,
    minZoom: 0.5,
    maxZoom: 2.0,
    step: 0.1,

    init: function () {
        const savedZoom = localStorage.getItem('siteZoomLevel');
        if (savedZoom) {
            this.zoomLevel = parseFloat(savedZoom);
        }
        this.applyZoom();
        console.log('ZoomManager initialized. Level:', this.zoomLevel);
    },

    zoomIn: function () {
        if (this.zoomLevel < this.maxZoom) {
            this.zoomLevel = parseFloat((this.zoomLevel + this.step).toFixed(1));
            this.saveZoom();
            this.applyZoom();
        }
    },

    zoomOut: function () {
        if (this.zoomLevel > this.minZoom) {
            this.zoomLevel = parseFloat((this.zoomLevel - this.step).toFixed(1));
            this.saveZoom();
            this.applyZoom();
        }
    },

    saveZoom: function () {
        localStorage.setItem('siteZoomLevel', this.zoomLevel);
    },

    applyZoom: function () {
        document.body.style.zoom = this.zoomLevel;
    }
};


const TimeManager = {
    remainingSeconds: 0,
    timerInterval: null,
    saveInterval: null,
    syncInterval: null,
    DAILY_LIMIT: 300, // 5 minutes
    AD_REWARD: 1200, // 20 minutes
    AD_DURATION: 30, // 30 seconds

    // Supabase
    sb: null,
    user: null,
    pendingSync: false,
    SUPABASE_URL: 'https://rydsgfbhbhenquxqvdct.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5ZHNnZmJoYmhlbnF1eHF2ZGN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUwOTgyMDAsImV4cCI6MjA4MDY3NDIwMH0.nN6MvxbJvUaxEmL-xCk-9DcRKGqWDHUw09xFid9qgQU',

    init: async function () {
        // Init Supabase if available
        try {
            if (window.supabase && window.supabase.createClient) {
                // Check if already initialized globally (e.g. by auth.js)
                if (typeof supabase !== 'undefined') {
                    this.sb = supabase;
                } else {
                    this.sb = window.supabase.createClient(this.SUPABASE_URL, this.SUPABASE_ANON_KEY);
                }
            }
        } catch (e) {
            console.warn("Supabase init failed, falling back to local:", e);
        }

        // Check Auth & Initial Load
        if (this.sb) {
            try {
                const { data: { user } } = await this.sb.auth.getUser();
                this.user = user;
                if (user) {
                    console.log("Logged in as:", user.email);
                    await this.fetchRemoteTime();
                } else {
                    this.checkDailyResetLocal();
                }
            } catch (err) {
                console.warn("Supabase auth check failed:", err);
                this.checkDailyResetLocal();
            }
        } else {
            this.checkDailyResetLocal();
        }

        this.createUI();
        this.startTimer();

        // Save locally every 5s
        this.saveInterval = setInterval(() => this.saveTimeLocal(), 5000);

        // Sync to Server every 30s if logged in
        if (this.user) {
            this.syncInterval = setInterval(() => this.syncTimeRemote(), 30000);
        }

        // Handle tab visibility
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.saveTimeLocal();
                if (this.user) this.syncTimeRemote();
            }
        });

        // Handle unload
        window.addEventListener('beforeunload', () => {
            this.saveTimeLocal();
        });
    },



    finishAd: function () {
        const newTime = this.remainingSeconds + this.AD_REWARD;
        this.updateTime(newTime);
        this.updateUIDisplay();

        document.getElementById('tm-ad-modal').style.display = 'none';
        document.getElementById('tm-block-modal').style.display = 'none';

        // No alert as requested
    },

    // --- Local Logic ---
    checkDailyResetLocal: function () {
        const lastReset = localStorage.getItem('tm_last_reset_date');
        const today = new Date().toDateString();
        const savedTime = localStorage.getItem('tm_remaining_seconds');

        if (lastReset !== today) {
            this.remainingSeconds = this.DAILY_LIMIT;
            localStorage.setItem('tm_last_reset_date', today);
            this.saveTimeLocal();
        } else {
            this.remainingSeconds = savedTime ? parseInt(savedTime) : this.DAILY_LIMIT;
        }
    },

    saveTimeLocal: function () {
        localStorage.setItem('tm_remaining_seconds', this.remainingSeconds);
        this.pendingSync = true;
    },

    // --- Remote Logic ---
    fetchRemoteTime: async function () {
        if (!this.user || !this.sb) return;

        const { data, error } = await this.sb
            .from('users_profile')
            .select('remaining_seconds, last_reset_date')
            .eq('id', this.user.id)
            .single();

        if (data) {
            const today = new Date().toDateString();

            // Check Server Reset Date
            if (data.last_reset_date !== today) {
                // New Day on Server -> Reset to limit (or keep if default is null?)
                // If it's a new day, we reset.
                console.log("New day detected from server. Resetting.");
                this.remainingSeconds = this.DAILY_LIMIT;
                // We should update server immediately to mark today as visited
                this.syncTimeRemote(true);
            } else {
                // Same day, use server time
                // Handle case where server says null (new user) -> use default
                this.remainingSeconds = data.remaining_seconds != null ? data.remaining_seconds : this.DAILY_LIMIT;
            }
            // Update local storage to match server (trust server)
            localStorage.setItem('tm_remaining_seconds', this.remainingSeconds);
            localStorage.setItem('tm_last_reset_date', today);
        } else {
            // Profile might not exist yet, rely on local for now
            this.checkDailyResetLocal();
        }
    },

    syncTimeRemote: async function (force = false) {
        if (!this.user || !this.sb) return;
        if (!this.pendingSync && !force) return;

        const today = new Date().toDateString();

        const { error } = await this.sb
            .from('users_profile')
            .update({
                remaining_seconds: this.remainingSeconds,
                last_reset_date: today
            })
            .eq('id', this.user.id);

        if (!error) {
            this.pendingSync = false;
            // console.log("Time synced to server.");
        } else {
            console.error("Error syncing time:", error);
        }
    },

    updateTime: function (newSeconds) {
        this.remainingSeconds = newSeconds;
        this.saveTimeLocal();
        if (this.user) this.syncTimeRemote();
    },

    startTimer: function () {
        if (this.timerInterval) clearInterval(this.timerInterval);

        this.timerInterval = setInterval(() => {
            if (this.remainingSeconds > 0) {
                this.remainingSeconds--;
                this.updateUIDisplay();
                this.pendingSync = true; // Mark dirty

                if (this.remainingSeconds <= 0) {
                    this.handleTimeUp();
                }
            } else {
                this.handleTimeUp();
            }
        }, 1000);

        this.updateUIDisplay();
    },

    saveTime: function () {
        // Legacy wrapper if called externally
        this.saveTimeLocal();
    },

    formatTime: function (seconds) {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    },

    createUI: function () {
        // Remove old container if exists
        const old = document.getElementById('tm-timer-container');
        if (old) old.remove();

        // Inject CSS
        const style = document.createElement('style');
        style.textContent = `
            .tm-inline-timer {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-right: 15px;
                font-family: 'Fredoka', sans-serif;
                font-weight: bold;
                
                /* Ring/Pill Container */
                background: rgba(255, 255, 255, 0.9);
                border: 3px solid #4ECDC4;
                border-radius: 30px;
                padding: 5px 12px;
                box-shadow: 0 4px 0 rgba(78, 205, 196, 0.2);
                color: #2D3436;
            }
            
            .tm-fixed-timer {
                position: fixed;
                top: 20px;
                right: 20px;
                background: rgba(0, 0, 0, 0.8);
                color: #fff;
                padding: 8px 15px;
                border-radius: 30px;
                font-family: 'Fredoka', sans-serif;
                font-weight: bold;
                z-index: 9999;
                display: flex;
                align-items: center;
                gap: 10px;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                border: 3px solid #4ECDC4;
            }

            #tm-timer-text {
                font-size: 1.1rem;
                min-width: 45px;
                text-align: center;
                font-variant-numeric: tabular-nums;
                margin-right: 5px;
            }

            .tm-add-btn {
                background: #FF6B6B;
                border: none;
                color: white;
                border-radius: 50%;
                width: 26px;
                height: 26px;
                cursor: pointer;
                font-size: 1.1rem;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s;
                font-family: 'Fredoka', sans-serif;
                font-weight: bold;
                padding: 0;
                line-height: 1;
                box-shadow: 0 2px 0 #d64545;
            }
            .tm-add-btn:hover {
                transform: scale(1.1) translateY(-1px);
                box-shadow: 0 3px 0 #d64545;
            }
            .tm-add-btn:active {
                transform: scale(0.95) translateY(1px);
                box-shadow: 0 1px 0 #d64545;
            }
            
            /* Fixed timer overrides */
            .tm-fixed-timer .tm-add-btn {
                border: 2px solid white;
            }

            /* Modal Overlay */
            .tm-modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.95);
                z-index: 10000;
                display: none;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                color: white;
                font-family: 'Fredoka', sans-serif;
            }
            .tm-modal-content {
                background: #2D3436;
                padding: 40px;
                border-radius: 20px;
                text-align: center;
                max-width: 400px;
                border: 4px solid #FF6B6B;
                animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            }
            .tm-btn-primary {
                background: #4ECDC4;
                color: white;
                border: none;
                padding: 15px 30px;
                font-size: 1.2rem;
                border-radius: 50px;
                cursor: pointer;
                margin-top: 20px;
                font-weight: bold;
                box-shadow: 0 4px 0 #3aa39b;
                transition: all 0.2s;
            }
            .tm-btn-primary:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 0 #3aa39b;
            }
            .tm-btn-primary:active {
                transform: translateY(2px);
                box-shadow: 0 2px 0 #3aa39b;
            }
            
            /* Ad Progress */
            #tm-ad-progress-bar {
                width: 100%;
                height: 10px;
                background: #444;
                border-radius: 5px;
                margin-top: 20px;
                overflow: hidden;
            }
            #tm-ad-progress-fill {
                height: 100%;
                background: #FF6B6B;
                width: 0%;
                transition: width 1s linear;
            }
        `;
        document.head.appendChild(style);

        // Timer Widget
        const timerContainer = document.createElement('div');
        timerContainer.id = 'tm-timer-container';

        // Clock Icon SVG
        const clockIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 5px;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`;

        timerContainer.innerHTML = `
            ${clockIcon}
            <span id="tm-timer-text">--:--</span>
            <button class="tm-add-btn" id="tm-add-btn" title="Watch Ad for +20 mins">+</button>
        `;

        // Try to find header actions container
        const zoomBtn = document.querySelector('.btn-zoom');
        if (zoomBtn && zoomBtn.parentElement) {
            timerContainer.className = 'tm-inline-timer';
            // Insert before the first zoom button
            zoomBtn.parentElement.insertBefore(timerContainer, zoomBtn);
        } else {
            timerContainer.className = 'tm-fixed-timer';
            document.body.appendChild(timerContainer);
        }

        document.getElementById('tm-add-btn').onclick = () => this.playAd();

        // Time's Up Modal
        const blockModal = document.createElement('div');
        blockModal.id = 'tm-block-modal';
        blockModal.className = 'tm-modal-overlay';
        blockModal.innerHTML = `
            <div class="tm-modal-content">
                <h1 style="font-size: 3rem; margin-bottom: 10px;">⏰</h1>
                <h2>Time's Up!</h2>
                <p style="color: #bbb; margin: 15px 0;">Your daily playtime has ended.</p>
                <p style="font-size: 1.1rem;">Watch a short ad to get <strong>20 more minutes</strong>!</p>
                <button class="tm-btn-primary" onclick="TimeManager.playAd()">📺 Watch Ad (+20m)</button>
            </div>
        `;
        document.body.appendChild(blockModal);

        // Ad Playing Modal
        const adModal = document.createElement('div');
        adModal.id = 'tm-ad-modal';
        adModal.className = 'tm-modal-overlay';
        adModal.innerHTML = `
             <div class="tm-modal-content" style="border-color: #4ECDC4;">
                <h2>Ad Playing...</h2>
                <p>Please wait <span id="tm-ad-timer">30</span>s to get your reward.</p>
                <div id="tm-ad-progress-bar">
                    <div id="tm-ad-progress-fill"></div>
                </div>
            </div>
        `;
        document.body.appendChild(adModal);
    },

    updateUIDisplay: function () {
        const el = document.getElementById('tm-timer-text');
        if (el) {
            el.textContent = this.formatTime(this.remainingSeconds);
            // If inline, use inherit/css color. If fixed, use white/red.
            const container = document.getElementById('tm-timer-container');
            const isFixed = container && container.classList.contains('tm-fixed-timer');

            if (this.remainingSeconds < 60) {
                el.style.color = '#FF6B6B';
            } else {
                el.style.color = isFixed ? 'white' : ''; // Reset to CSS default
            }
        }
    },

    handleTimeUp: function () {
        this.remainingSeconds = 0;
        this.saveTime();
        this.updateUIDisplay();
        document.getElementById('tm-block-modal').style.display = 'flex';
    },

    playAd: function () {
        const adModal = document.getElementById('tm-ad-modal');
        const blockModal = document.getElementById('tm-block-modal');
        const timerSpan = document.getElementById('tm-ad-timer');
        const progressFill = document.getElementById('tm-ad-progress-fill');

        blockModal.style.display = 'none'; // Hide block modal if open
        adModal.style.display = 'flex';

        let timeLeft = this.AD_DURATION;
        timerSpan.textContent = timeLeft;
        progressFill.style.width = '0%';
        progressFill.style.transition = `width ${this.AD_DURATION}s linear`;

        // Force reflow
        progressFill.offsetHeight;
        progressFill.style.width = '100%';

        const interval = setInterval(() => {
            timeLeft--;
            timerSpan.textContent = timeLeft;

            if (timeLeft <= 0) {
                clearInterval(interval);
                this.finishAd();
            }
        }, 1000);
    },


};

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        ZoomManager.init();
        TimeManager.init();
    });
} else {
    ZoomManager.init();
    TimeManager.init();
}
