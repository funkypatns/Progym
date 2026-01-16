/**
 * ============================================
 * VOICE ALERTS HOOK
 * ============================================
 * 
 * React hook for notification polling and TTS announcements
 */

import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../utils/api';
import {
    speakNotifications,
    getTTSSettings,
    stopSpeaking,
    initializeVoices
} from '../utils/tts';

const POLL_INTERVAL = 45000; // 45 seconds
const INITIAL_DELAY = 3000; // 3 seconds after login

export const useVoiceAlerts = (enabled = true) => {
    const { i18n } = useTranslation();
    const [announcedIds, setAnnouncedIds] = useState(new Set());
    const [isInitialized, setIsInitialized] = useState(false);
    const pollIntervalRef = useRef(null);
    const hasPlayedInitial = useRef(false);

    const [errorCount, setErrorCount] = useState(0);

    /**
     * Fetch and announce new notifications
     */
    const checkAndAnnounce = async (isInitialCheck = false) => {
        try {
            const settings = getTTSSettings();

            // Skip if voice is disabled
            if (!settings.enableVoice) {
                return;
            }

            // Fetch detailed notifications
            const response = await api.get('/notifications/unseen-detailed?limit=10');

            if (!response.data.success) {
                return;
            }

            // Reset error count on success
            setErrorCount(0);

            const notifications = response.data.data.notifications || [];

            // Filter out already announced notifications
            const newNotifications = notifications.filter(n => !announcedIds.has(n.id));

            if (newNotifications.length === 0) {
                return;
            }

            console.log(`[VOICE ALERTS] Found ${newNotifications.length} new notifications`);

            // Play sound first (if enabled)
            if (settings.enableSound) {
                playAlertSound();
            }

            // Speak notifications
            await speakNotifications(newNotifications, i18n.language, settings);

            // Mark as announced
            setAnnouncedIds(prev => {
                const updated = new Set(prev);
                newNotifications.forEach(n => updated.add(n.id));
                return updated;
            });

        } catch (error) {
            console.error('[VOICE ALERTS] Failed to check notifications:', error);
            setErrorCount(prev => prev + 1);
        }
    };

    /**
     * Play alert sound
     */
    const playAlertSound = () => {
        try {
            // Create and play a simple beep
            const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleC8KEIQ+WFBQZG54d2uDkIpxTDIvKjo8Oz5BWF9pcXx+d2ttaVtIRxEULztBOzQzMj9KVFhdV09FREJBQkBCQ0ZJTVFVWFlaWldWVFJQT05NTk5PUVNVVldYWFlZWllYV1ZVVFRUVFRVVlZXWFhZWVhaWVlZWFhXV1ZWVVVVVVVVVVZWVldXWFhYWFhYWFhXV1dXVldXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXVw==');
            audio.volume = 0.3;
            audio.play().catch(() => {
                // Audio play blocked by browser
            });
        } catch (error) {
            console.error('[VOICE ALERTS] Failed to play sound:', error);
        }
    };

    /**
     * Initialize voices on first user interaction
     */
    useEffect(() => {
        if (!enabled || isInitialized) return;

        const initialize = async () => {
            await initializeVoices();
            setIsInitialized(true);
        };

        // Initialize on any user interaction
        const interactionEvents = ['click', 'keydown', 'touchstart'];
        const handleInteraction = () => {
            initialize();
            interactionEvents.forEach(event => {
                document.removeEventListener(event, handleInteraction);
            });
        };

        interactionEvents.forEach(event => {
            document.addEventListener(event, handleInteraction, { once: true });
        });

        return () => {
            interactionEvents.forEach(event => {
                document.removeEventListener(event, handleInteraction);
            });
        };
    }, [enabled, isInitialized]);

    /**
     * Initial check on mount (after delay)
     */
    useEffect(() => {
        if (!enabled || !isInitialized || hasPlayedInitial.current) return;

        const timer = setTimeout(() => {
            hasPlayedInitial.current = true;
            checkAndAnnounce(true);
        }, INITIAL_DELAY);

        return () => clearTimeout(timer);
    }, [enabled, isInitialized]);

    /**
     * Start polling with backoff
     */
    useEffect(() => {
        if (!enabled || !isInitialized) return;

        // Clear any existing interval
        if (pollIntervalRef.current) {
            clearTimeout(pollIntervalRef.current);
        }

        // Calculate interval with backoff (capped at 5 minutes)
        // 45s, 90s, 135s... max 300s
        const backoffMultiplier = Math.min(errorCount, 5);
        const currentInterval = POLL_INTERVAL * (1 + backoffMultiplier);

        // Start polling
        const scheduleNext = () => {
            pollIntervalRef.current = setTimeout(() => {
                checkAndAnnounce(false).finally(() => {
                    scheduleNext();
                });
            }, currentInterval);
        };

        scheduleNext();

        return () => {
            if (pollIntervalRef.current) {
                clearTimeout(pollIntervalRef.current);
            }
        };
    }, [enabled, isInitialized, announcedIds, i18n.language, errorCount]);

    /**
     * Cleanup on unmount
     */
    useEffect(() => {
        return () => {
            stopSpeaking();
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
            }
        };
    }, []);

    return {
        checkNow: () => checkAndAnnounce(false),
        stopSpeaking,
        isInitialized
    };
};

export default useVoiceAlerts;
