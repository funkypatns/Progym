const AppointmentService = require('../services/appointmentService');

let intervalId = null;

const SessionJobs = {
    /**
     * Start the background scanner for session auto-completion
     * @param {number} intervalMs - Check interval in milliseconds (default 1 min)
     */
    startScanner(intervalMs = 60000) {
        if (intervalId) return;

        console.log('⏰ Starting Session Auto-Complete Scanner...');

        // Run immediately on start
        this.runCheck();

        intervalId = setInterval(() => {
            this.runCheck();
        }, intervalMs);
    },

    /**
     * Stop scanner
     */
    stopScanner() {
        if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
        }
    },

    /**
     * Run the check logic
     */
    async runCheck() {
        try {
            const results = await AppointmentService.autoCompleteSessions();
            if (results && results.length > 0) {
                console.log(`🤖 Auto-completed ${results.length} sessions.`);
                // Here we could emit socket events or create notifications if not handled in service
            }
        } catch (error) {
            console.error('❌ Session Auto-Complete Error:', error.message);
        }
    }
};

module.exports = SessionJobs;
