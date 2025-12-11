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
        this.createUI();
        this.applyZoom();
        console.log('ZoomManager initialized. Level:', this.zoomLevel);
    },

    createUI: function () {
        // If buttons already exist (like in index.html), don't do anything
        if (document.querySelector('.btn-zoom')) return;

        // 1. Inject CSS
        const style = document.createElement('style');
        style.textContent = `
            .tm-zoom-controls {
                position: fixed;
                top: 20px;
                right: 20px;
                display: flex;
                align-items: center;
                gap: 10px;
                z-index: 9998; /* Just below modals */
            }
            .btn-zoom {
                background: rgba(255, 255, 255, 0.9);
                color: #2D3436;
                border: 3px solid #4ECDC4;
                border-radius: 50%;
                width: 40px;
                height: 40px;
                cursor: pointer;
                font-size: 1.2rem;
                display: flex;
                justify-content: center;
                align-items: center;
                transition: all 0.2s;
                font-family: 'Fredoka', sans-serif;
                font-weight: bold;
                box-shadow: 0 4px 0 rgba(78, 205, 196, 0.2);
                padding: 0;
            }
            .btn-zoom:hover {
                background: #4ECDC4;
                color: white;
                border-color: #4ECDC4;
                transform: scale(1.1) translateY(-2px);
                box-shadow: 0 6px 0 rgba(78, 205, 196, 0.2);
            }
            .btn-zoom:active {
                transform: scale(0.95) translateY(2px);
                box-shadow: 0 2px 0 rgba(78, 205, 196, 0.2);
            }
            .btn-zoom svg {
                width: 20px;
                height: 20px;
                stroke-width: 2.5;
            }
        `;
        document.head.appendChild(style);

        // 2. Create Container
        const container = document.createElement('div');
        container.className = 'tm-zoom-controls';

        // 3. Create Buttons
        container.innerHTML = `
            <button class="btn-zoom" onclick="ZoomManager.zoomOut()" aria-label="Zoom Out">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
            </button>
            <button class="btn-zoom" onclick="ZoomManager.zoomIn()" aria-label="Zoom In">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
            </button>
        `;

        document.body.appendChild(container);

        // Note: TimeManager will run later, find these buttons, and append the timer to this container automatically.
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


const GoldManager = {
    coins: 0,
    dailyEarned: 0,
    DAILY_CAP: 15,
    COINS_PER_MINUTE: 5, // Passive income rate
    pendingSync: false,

    // UI Elements
    coinTextEl: null,

    init: async function () {
        // UI is handled by TimeManager invoking setupUI
    },

    // Called by TimeManager after it sets up the HUD
    setupUI: function (container) {
        // Coin Icon (Yellow Circle with C or similar, or SVG)
        const coinIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="#FFD700" stroke="#B8860B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left: 10px; margin-right: 4px; filter: drop-shadow(0 1px 1px rgba(0,0,0,0.3));"><circle cx="12" cy="12" r="9"></circle><path d="M12 16v-8M10 10l4 4M14 10l-4 4" stroke-opacity="0.0" stroke-width="0"></path><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#B8860B" font-size="12" font-weight="bold" stroke="none" style="font-family: sans-serif;">$</text></svg>`;

        const wrapper = document.createElement('div');
        wrapper.style.display = 'flex';
        wrapper.style.alignItems = 'center';
        wrapper.innerHTML = `<span id="tm-gold-wrapper">${coinIcon}<span id="tm-gold-text">0</span></span>`;

        // Add divider if needed
        const divider = document.createElement('div');
        divider.style.width = '1px';
        divider.style.height = '16px';
        divider.style.background = '#ccc';
        divider.style.margin = '0 8px';

        container.appendChild(divider);
        container.appendChild(wrapper);

        this.coinTextEl = document.getElementById('tm-gold-text');

        // Small delay to ensure DOM is ready if created dynamically
        setTimeout(() => this.updateUIDisplay(), 0);
    },

    loadFromProfile: function (profileData) {
        // Robust Sync: Check if we have unsynced local changes
        const pendingSync = localStorage.getItem('gm_pending_sync') === 'true';

        if (pendingSync) {
            console.log("Gold Manager: Found unsynced local changes. Prioritizing local data.");
            const saved = localStorage.getItem('gm_gold_coins');
            const savedDaily = localStorage.getItem('gm_daily_earned');
            this.coins = saved ? parseInt(saved) : 0;
            this.dailyEarned = savedDaily ? parseInt(savedDaily) : 0;
            this.pendingSync = true; // Force sync next cycle
        } else if (profileData) {
            this.coins = profileData.gold_coins != null ? parseInt(profileData.gold_coins) : 0;
            this.dailyEarned = profileData.daily_coins_earned != null ? parseInt(profileData.daily_coins_earned) : 0;
        } else {
            // Try local storage
            const saved = localStorage.getItem('gm_gold_coins');
            const savedDaily = localStorage.getItem('gm_daily_earned');
            this.coins = saved ? parseInt(saved) : 0;
            this.dailyEarned = savedDaily ? parseInt(savedDaily) : 0;
        }
        this.updateUIDisplay();
        this.saveTxLocal(); // Ensure consistency
    },

    markSynced: function () {
        this.pendingSync = false;
        localStorage.removeItem('gm_pending_sync');
    },

    resetDaily: function () {
        this.dailyEarned = 0;
        this.saveTxLocal();
        this.pendingSync = true;
        console.log("Gold Manager: Daily limit reset.");
    },

    addCoins: function (amount) {
        if (!localStorage.getItem('is_logged_in')) {
            console.log("Not logged in. Cannot earn gold.");
            return;
        }

        if (this.dailyEarned >= this.DAILY_CAP) {
            console.log("Daily gold cap reached.");
            return;
        }

        const allowed = this.DAILY_CAP - this.dailyEarned;
        const actualAdd = Math.min(amount, allowed);

        if (actualAdd > 0) {
            this.coins += actualAdd;
            this.dailyEarned += actualAdd;
            this.saveTxLocal();
            this.pendingSync = true;
            this.updateUIDisplay();
            console.log("Added " + actualAdd + " coins. Total: " + this.coins);

            // Animation
            if (this.coinTextEl) {
                this.coinTextEl.style.transition = 'none'; // Reset
                this.coinTextEl.style.color = '#FFD700';
                this.coinTextEl.style.transform = 'scale(1.5)';

                // Force Reflow
                void this.coinTextEl.offsetWidth;

                this.coinTextEl.style.transition = 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
                this.coinTextEl.style.transform = 'scale(1)';

                setTimeout(() => {
                    this.coinTextEl.style.color = ''; // Reset to inherited
                }, 300);
            }
        }
    },

    saveTxLocal: function () {
        localStorage.setItem('gm_gold_coins', this.coins);
        localStorage.setItem('gm_daily_earned', this.dailyEarned);
        // Mark as needing sync
        localStorage.setItem('gm_pending_sync', 'true');
    },

    updateUIDisplay: function () {
        if (!this.coinTextEl) this.coinTextEl = document.getElementById('tm-gold-text');
        const wrapper = document.getElementById('tm-gold-wrapper');

        if (localStorage.getItem('is_logged_in') === 'true') {
            if (this.coinTextEl) {
                this.coinTextEl.textContent = this.coins.toLocaleString();
            }
            if (wrapper) {
                wrapper.title = `Daily limit: ${this.dailyEarned}/${this.DAILY_CAP}`;
                wrapper.style.cursor = 'default';
                wrapper.onclick = null;
            }
        } else {
            // Guest Mode
            if (wrapper) {
                const shinyIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="#FFD700" stroke="#B8860B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 5px; filter: drop-shadow(0 0 3px gold);"><circle cx="12" cy="12" r="9"></circle><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#B8860B" font-size="12" font-weight="bold" stroke="none" style="font-family: sans-serif;">$</text></svg>`;

                wrapper.innerHTML = `${shinyIcon}<span style="font-size: 0.8rem; color: #555; cursor: pointer; text-decoration: underline; font-weight: bold;">Log in to earn gold</span>`;

                wrapper.style.display = 'inline-flex';
                wrapper.style.alignItems = 'center';
                wrapper.onclick = () => window.location.href = 'login.html';
                wrapper.title = "Login required to earn gold coins";
            }
        }
    },

    getPayload: function () {
        return {
            gold_coins: this.coins,
            daily_coins_earned: this.dailyEarned
        };
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

    // Passive Income Logic
    passiveTicker: 0,


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
                if (typeof supabase !== 'undefined') {
                    this.sb = supabase;
                } else {
                    this.sb = window.supabase.createClient(this.SUPABASE_URL, this.SUPABASE_ANON_KEY);
                }
            }
        } catch (e) {
            console.warn("Supabase init failed, falling back to local:", e);
        }

        this.createUI();

        // Check Auth & Initial Load
        if (this.sb) {
            try {
                const { data: { session } } = await this.sb.auth.getSession();
                const user = session?.user;
                this.user = user;

                if (user) {
                    console.log("Logged in as:", user.email);
                    // 1. Fetch Server Time (Authority)
                    await this.fetchRemoteTime();

                    // 2. Start Sync Loop (Client -> Server)
                    this.syncInterval = setInterval(() => this.syncTimeRemote(), 30000);
                } else {
                    // Not logged in: Local Authority
                    this.checkDailyResetLocal();
                }
            } catch (err) {
                console.warn("Supabase auth check failed:", err);
                this.checkDailyResetLocal();
                GoldManager.loadFromProfile(null);
            }
        } else {
            this.checkDailyResetLocal();
            GoldManager.loadFromProfile(null);
        }

        // Start the countdown timer (visuals)
        this.startTimer();

        // Always save to local storage as a backup/cache
        this.saveInterval = setInterval(() => this.saveTimeLocal(), 5000);

        // Handle Lifecycle Events
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.saveTimeLocal();
                if (this.user) {
                    this.syncTimeRemote(true); // Force sync on hide
                }
            }
        });

        window.addEventListener('beforeunload', () => {
            this.saveTimeLocal();
            if (this.user) {
                this.saveOnExit();
            }
        });

        // Handle cross-tab updates (e.g. from Shop coupon redemption)
        window.addEventListener('storage', (e) => {
            if (e.key === 'tm_remaining_seconds' && e.newValue) {
                const newSecs = parseInt(e.newValue);
                if (!isNaN(newSecs) && newSecs !== this.remainingSeconds) {
                    console.log("Time updated from another tab/script:", newSecs);
                    this.remainingSeconds = newSecs;
                    this.updateUIDisplay();
                }
            }
        });
    },

    saveOnExit: function () {
        if (!this.user) return;

        try {
            const sessionStr = localStorage.getItem('supabase.auth.token');
            if (!sessionStr) return;

            const session = JSON.parse(sessionStr);
            const token = session.access_token;
            if (!token) return;

            const url = `${this.SUPABASE_URL}/rest/v1/users_profile?id=eq.${this.user.id}`;
            const body = JSON.stringify({
                remaining_seconds: this.remainingSeconds,
                last_reset_date: new Date().toDateString(),
                gold_coins: GoldManager.coins,
                daily_coins_earned: GoldManager.dailyEarned
            });

            fetch(url, {
                method: 'PATCH',
                headers: {
                    'apikey': this.SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: body,
                keepalive: true
            }).catch(err => console.error("Exit sync failed:", err));

        } catch (e) {
            console.error("Error in saveOnExit:", e);
        }
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
            .select('remaining_seconds, last_reset_date, gold_coins, daily_coins_earned')
            .eq('id', this.user.id)

            .single();

        if (data) {
            // Integrate Gold Manager Load FIRST so we have the current coin count
            GoldManager.loadFromProfile(data);

            const today = new Date().toDateString();

            // Check Server Reset Date
            if (data.last_reset_date !== today) {
                // New Day on Server -> Reset to limit
                console.log("New day detected from server. Resetting.");
                this.remainingSeconds = this.DAILY_LIMIT;

                // Reset gold daily limit BEFORE syncing
                GoldManager.resetDaily();

                // We should update server immediately to mark today as visited
                this.syncTimeRemote(true);
            } else {
                // Same day, use server time
                // Handle case where server says null (new user) -> use default
                this.remainingSeconds = data.remaining_seconds != null ? data.remaining_seconds : this.DAILY_LIMIT;
            }

            // Update local storage to match server (trust server, unless local forced override)
            if (!GoldManager.pendingSync) {
                localStorage.setItem('tm_remaining_seconds', this.remainingSeconds);
                localStorage.setItem('tm_last_reset_date', today);
            } else {
                // If GoldManager forced a local override, it implies our session ended abnormally.
                // We should trust LOCAL time as well, as it likely progressed with the coins.
                const localTime = localStorage.getItem('tm_remaining_seconds');
                if (localTime) {
                    this.remainingSeconds = parseInt(localTime);
                    console.log("Restored local time: " + this.remainingSeconds);
                }

                console.log("Syncing local override up to server...");
                this.syncTimeRemote(true);
            }
        } else {
            // Profile might not exist yet, rely on local for now
            this.checkDailyResetLocal();
            GoldManager.loadFromProfile(null);
        }
    },

    syncTimeRemote: async function (force = false) {
        if (!this.user || !this.sb) return;
        if (!this.pendingSync && !GoldManager.pendingSync && !force) return;

        const today = new Date().toDateString();

        // Combine payloads
        const updates = {
            remaining_seconds: this.remainingSeconds,
            last_reset_date: today,
            // Only add gold if it changed or verifying
            ...GoldManager.getPayload()
        };


        const { error, count } = await this.sb
            .from('users_profile')
            .update(updates)
            .eq('id', this.user.id)
            .select('id', { count: 'exact' }); // Get count to check if row existed

        if (error) {
            console.error("Error syncing time (Supabase Code " + error.code + "):", error.message);
        } else if (count === 0) {
            // This is the critical case: No row found to update
            console.error("Sync failed: No profile row found for user " + this.user.id);
            // Optional: Try to recover? (requires username)
        } else {
            this.pendingSync = false;
            GoldManager.markSynced();
            // console.log("Time synced to server.");
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

                // Passive Income for Gold - Disabled
                // this.passiveTicker++;
                // if (this.passiveTicker >= 60) {
                //     GoldManager.addCoins(GoldManager.COINS_PER_MINUTE);
                //     this.passiveTicker = 0;
                // }

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

        // Append Gold UI
        const contentDiv = document.createElement('div');
        contentDiv.style.display = 'contents'; // Wrapper to not break flex
        timerContainer.appendChild(contentDiv);
        GoldManager.setupUI(timerContainer);

        // Try to find header actions container

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
        GoldManager.init();
    });
} else {
    ZoomManager.init();
    TimeManager.init();
    GoldManager.init();
}
