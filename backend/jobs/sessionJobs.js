const AppointmentService = require('../services/appointmentService');

let intervalId = null;
let noShowIntervalId = null;

const SessionJobs = {
    /**
     * Start background scanners.
     * @param {number} intervalMs - session auto-complete interval in milliseconds
     */
    startScanner(intervalMs = 60000) {
        if (intervalId) return;

        console.log('Starting Session Auto-Complete Scanner...');
        console.log('Starting Tentative Booking No-show Scanner...');

        this.runCheck();
        this.runNoShowCheck();

        intervalId = setInterval(() => {
            this.runCheck();
        }, intervalMs);

        noShowIntervalId = setInterval(() => {
            this.runNoShowCheck();
        }, 60 * 60 * 1000);
    },

    stopScanner() {
        if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
        }
        if (noShowIntervalId) {
            clearInterval(noShowIntervalId);
            noShowIntervalId = null;
        }
    },

    async runCheck() {
        try {
            const results = await AppointmentService.autoCompleteSessions();
            if (results && results.length > 0) {
                console.log(`Auto-completed ${results.length} sessions.`);
            }
        } catch (error) {
            console.error('Session Auto-Complete Error:', error.message);
        }
    },

    async runNoShowCheck() {
        try {
            const updatedCount = await AppointmentService.autoMarkTentativeNoShows();
            if (updatedCount > 0) {
                console.log(`Marked ${updatedCount} tentative bookings as no_show.`);
            }
        } catch (error) {
            console.error('Tentative No-show Scanner Error:', error.message);
        }
    }
};

module.exports = SessionJobs;
