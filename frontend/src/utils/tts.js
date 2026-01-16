/**
 * ============================================
 * TEXT-TO-SPEECH (TTS) UTILITY
 * ============================================
 * 
 * Voice alerts for payment notifications using Web Speech API
 */

/**
 * Check if browser supports Web Speech API
 */
export const isTTSSupported = () => {
    return 'speechSynthesis' in window;
};

/**
 * Get available voices for a specific language
 */
export const getVoicesForLanguage = (lang = 'ar') => {
    if (!isTTSSupported()) return [];

    const voices = window.speechSynthesis.getVoices();

    // For Arabic
    if (lang === 'ar' || lang === 'ar-EG') {
        return voices.filter(voice =>
            voice.lang.startsWith('ar') ||
            voice.name.toLowerCase().includes('arabic')
        );
    }

    // For English
    if (lang === 'en') {
        return voices.filter(voice =>
            voice.lang.startsWith('en-US') ||
            voice.lang.startsWith('en-GB')
        );
    }

    return voices;
};

/**
 * Get the best voice for a language
 */
export const getBestVoice = (lang = 'ar') => {
    const voices = getVoicesForLanguage(lang);

    if (voices.length === 0) {
        // Fallback to any available voice
        return window.speechSynthesis.getVoices()[0];
    }

    // Prefer local voices over network voices
    const localVoice = voices.find(v => v.localService);
    if (localVoice) return localVoice;

    return voices[0];
};

/**
 * Speak a single notification
 */
export const speakNotification = (notification, language = 'ar', settings = {}) => {
    if (!isTTSSupported()) {
        console.warn('Text-to-Speech is not supported in this browser');
        return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
        const {
            memberName = '',
            remainingAmount = 0,
            currency = 'EGP'
        } = notification;

        // Generate message based on language
        let message = '';
        if (language === 'ar' || language === 'ar-EG') {
            message = `تنبيه: العضو ${memberName} عليه ${remainingAmount} ${currency} لازم يدفعها`;
        } else {
            message = `Alert: ${memberName} has ${remainingAmount} ${currency} remaining to pay`;
        }

        // Create speech utterance
        const utterance = new SpeechSynthesisUtterance(message);

        // Configure voice
        const voice = getBestVoice(language);
        if (voice) {
            utterance.voice = voice;
        }

        utterance.lang = language === 'ar' ? 'ar-EG' : 'en-US';
        utterance.rate = settings.rate || 0.9; // Slightly slower for clarity
        utterance.pitch = settings.pitch || 1.0;
        utterance.volume = settings.volume || 1.0;

        // Event handlers
        utterance.onend = () => {
            console.log('[TTS] Finished speaking:', memberName);
            resolve();
        };

        utterance.onerror = (error) => {
            console.error('[TTS] Error:', error);
            reject(error);
        };

        // Cancel any ongoing speech
        window.speechSynthesis.cancel();

        // Speak
        window.speechSynthesis.speak(utterance);
    });
};

/**
 * Speak multiple notifications sequentially
 */
export const speakNotifications = async (notifications, language = 'ar', settings = {}) => {
    if (!isTTSSupported()) {
        console.warn('Text-to-Speech is not supported in this browser');
        return;
    }

    const maxSpoken = settings.maxSpokenPerBatch || 3;
    const notificationsToSpeak = notifications.slice(0, maxSpoken);

    console.log(`[TTS] Speaking ${notificationsToSpeak.length} notifications`);

    for (const notification of notificationsToSpeak) {
        try {
            await speakNotification(notification, language, settings);
            // Small pause between notifications
            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
            console.error('[TTS] Failed to speak notification:', error);
        }
    }

    console.log('[TTS] Finished speaking all notifications');
};

/**
 * Stop all ongoing speech
 */
export const stopSpeaking = () => {
    if (isTTSSupported()) {
        window.speechSynthesis.cancel();
    }
};

/**
 * Get TTS settings from localStorage
 */
export const getTTSSettings = () => {
    const defaultSettings = {
        enableSound: true,
        enableVoice: true,
        maxSpokenPerBatch: 3,
        rate: 0.9,
        pitch: 1.0,
        volume: 1.0
    };

    try {
        const stored = localStorage.getItem('tts_settings');
        if (stored) {
            return { ...defaultSettings, ...JSON.parse(stored) };
        }
    } catch (error) {
        console.error('[TTS] Failed to load settings:', error);
    }

    return defaultSettings;
};

/**
 * Save TTS settings to localStorage
 */
export const saveTTSSettings = (settings) => {
    try {
        localStorage.setItem('tts_settings', JSON.stringify(settings));
        return true;
    } catch (error) {
        console.error('[TTS] Failed to save settings:', error);
        return false;
    }
};

/**
 * Initialize voices (must be called on user interaction)
 */
export const initializeVoices = () => {
    return new Promise((resolve) => {
        if (!isTTSSupported()) {
            resolve([]);
            return;
        }

        let voices = window.speechSynthesis.getVoices();

        if (voices.length > 0) {
            resolve(voices);
        } else {
            // Voices might load asynchronously
            window.speechSynthesis.onvoiceschanged = () => {
                voices = window.speechSynthesis.getVoices();
                resolve(voices);
            };

            // Timeout fallback
            setTimeout(() => {
                resolve(window.speechSynthesis.getVoices());
            }, 1000);
        }
    });
};

export default {
    isTTSSupported,
    getVoicesForLanguage,
    getBestVoice,
    speakNotification,
    speakNotifications,
    stopSpeaking,
    getTTSSettings,
    saveTTSSettings,
    initializeVoices
};
