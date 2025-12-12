
// Supabase Configuration
// TODO: Replace with your actual Supabase URL and Anon Key
const SUPABASE_URL = 'https://rydsgfbhbhenquxqvdct.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5ZHNnZmJoYmhlbnF1eHF2ZGN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUwOTgyMDAsImV4cCI6MjA4MDY3NDIwMH0.nN6MvxbJvUaxEmL-xCk-9DcRKGqWDHUw09xFid9qgQU';

let supabase;

try {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('Supabase initialized');
} catch (e) {
    console.error('Supabase initialization failed. Make sure the CDN script is loaded.', e);
}

const AuthManager = {
    // Check if username is available
    async checkUsername(username) {
        if (!username || username.length < 4) return { available: false, message: 'Too short' };

        const usernameRegex = /^[a-zA-Z0-9._]+$/;
        if (!usernameRegex.test(username)) {
            return { available: false, message: 'Only letters, numbers, . and _ allowed (No spaces)' };
        }

        try {
            const { data, error } = await supabase
                .from('users_profile')
                .select('username')
                .eq('username', username)
                .single();

            if (error && error.code === 'PGRST116') {
                // No rows found, so username is available
                return { available: true, message: '✅ Available' };
            } else if (data) {
                return { available: false, message: '❌ Username already taken' };
            } else {
                return { available: false, message: 'Error checking username' };
            }
        } catch (err) {
            console.error(err);
            return { available: false, message: 'Error checking username' };
        }
    },

    // Check if email is available (optional, Supabase Auth handles this too)
    async checkEmail(email) {
        if (!email || !email.includes('@')) return { available: false, message: 'Invalid email' };

        try {
            const { data, error } = await supabase
                .from('users_profile')
                .select('email')
                .eq('email', email)
                .single();

            if (error && error.code === 'PGRST116') {
                return { available: true, message: '✅ Available' };
            } else if (data) {
                return { available: false, message: '❌ Email already registered' };
            }
            return { available: false, message: 'Error checking email' };
        } catch (err) {
            console.error(err);
            return { available: false, message: 'Error checking email' };
        }
    },

    // Sign Up
    async signUp(username, email, password) {
        try {
            const usernameRegex = /^[a-zA-Z0-9._]+$/;
            if (!usernameRegex.test(username)) {
                return { success: false, message: 'Invalid username format. No spaces allowed.' };
            }

            // 1. Create Auth User
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: email,
                password: password,
            });

            if (authError) throw authError;

            if (authData.user) {
                // 2. Create Profile
                const { error: profileError } = await supabase
                    .from('users_profile')
                    .insert([
                        {
                            id: authData.user.id,
                            username: username,
                            email: email,
                            score: 0
                        }
                    ]);

                if (profileError) {
                    // If profile creation fails, we might want to cleanup the auth user, 
                    // but for now let's just throw
                    throw profileError;
                }

                // Success
                this.setLocalSession(username, authData.session);
                return { success: true };
            }
        } catch (error) {
            return { success: false, message: error.message };
        }
    },

    // Sign In
    async signIn(loginIdentifier, password) {
        try {
            let email = loginIdentifier;

            // If it doesn't look like an email, assume it's a username and lookup email
            if (!loginIdentifier.includes('@')) {
                const { data, error } = await supabase
                    .from('users_profile')
                    .select('email')
                    .eq('username', loginIdentifier)
                    .single();

                if (error || !data) {
                    return { success: false, message: 'Username not found' };
                }
                email = data.email;
            }

            const { data, error } = await supabase.auth.signInWithPassword({
                email: email,
                password: password,
            });

            if (error) throw error;

            // Get username if we logged in with email
            let username = loginIdentifier;
            if (loginIdentifier.includes('@')) {
                const { data: profile } = await supabase
                    .from('users_profile')
                    .select('username')
                    .eq('id', data.user.id)
                    .single();
                if (profile) username = profile.username;
            }

            this.setLocalSession(username, data.session);
            return { success: true };

        } catch (error) {
            return { success: false, message: error.message };
        }
    },

    setLocalSession(username, session) {
        localStorage.setItem('user_name', username);
        localStorage.setItem('is_logged_in', 'true');
        if (session) {
            localStorage.setItem('supabase.auth.token', JSON.stringify(session));
        }
    },

    // Inactivity Tracking
    inactivityTimeout: null,
    inactivityTrackingInitialized: false,
    INACTIVITY_LIMIT: 3 * 60 * 1000, // 3 minutes

    startInactivityTimer() {
        if (this.inactivityTimeout) clearTimeout(this.inactivityTimeout);

        // Robust login check: check flag OR username presence
        const isLoggedIn = localStorage.getItem('is_logged_in') === 'true' || !!localStorage.getItem('user_name');

        if (isLoggedIn) {
            this.inactivityTimeout = setTimeout(() => {
                console.log("User inactive for 3m. Saving and logging out...");
                this.logout();
            }, this.INACTIVITY_LIMIT);
        }
    },

    resetInactivityTimer() {
        this.startInactivityTimer();
    },

    initInactivityTracking() {
        if (this.inactivityTrackingInitialized) return;
        this.inactivityTrackingInitialized = true;

        const events = ['mousemove', 'mousedown', 'keypress', 'touchmove', 'click', 'keydown', 'scroll'];

        let processing = false;
        const reset = () => {
            if (processing) return;
            processing = true;
            this.resetInactivityTimer();
            setTimeout(() => { processing = false; }, 200);
        };

        events.forEach(event => {
            document.addEventListener(event, reset, true);
        });

        this.startInactivityTimer();
    },

    async logout() {
        // Attempt to sync time before logging out
        if (typeof TimeManager !== 'undefined' && TimeManager.user) {
            console.log("Syncing time before logout...");
            try {
                // Force sync and wait up to 1 second
                const syncPromise = TimeManager.syncTimeRemote(true);
                const timeoutPromise = new Promise(resolve => setTimeout(resolve, 1000));
                await Promise.race([syncPromise, timeoutPromise]);
            } catch (e) {
                console.warn("Logout sync failed:", e);
            }
        }

        if (supabase) await supabase.auth.signOut();
        localStorage.removeItem('user_name');
        localStorage.removeItem('is_logged_in');
        localStorage.removeItem('supabase.auth.token');
        // Clear time data so it resets perfectly next time
        localStorage.removeItem('tm_remaining_seconds');
        localStorage.removeItem('tm_last_reset_date');
        localStorage.removeItem('gm_gold_coins');
        localStorage.removeItem('gm_daily_earned');
        window.location.reload();
    }
};

// Initialize on load or immediately if ready
const initAuth = () => {
    if (typeof AuthManager !== 'undefined') {
        AuthManager.initInactivityTracking();
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuth);
} else {
    initAuth();
}
