/**
 * ============================================
 * INTERNATIONALIZATION (i18n) SETUP
 * ============================================
 * 
 * Supports Arabic (RTL) and English (LTR)
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './en.json';
import ar from './ar.json';

// Get saved language or default to Arabic
const savedLanguage = localStorage.getItem('language') || 'ar';

i18n
    .use(initReactI18next)
    .init({
        resources: {
            en: { translation: en },
            ar: { translation: ar },
        },
        lng: savedLanguage,
        fallbackLng: 'en',
        interpolation: {
            escapeValue: false,
        },
        // Safety net: valid fallback if key missing
        parseMissingKeyHandler: (key) => {
            if (import.meta.env.DEV) {
                console.warn(`[i18n] Missing key: "${key}"`);
            }
            // Return readable English-like fallback from key (e.g. 'common.cancel' -> 'cancel')
            return key.split('.').pop().replace(/([A-Z])/g, ' $1').trim();
        },
        saveMissing: true, // Optional, helps dev
    });

// Update document direction based on language
const updateDirection = (lng) => {
    document.documentElement.dir = lng === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lng;

    // Update font family for Arabic
    if (lng === 'ar') {
        document.body.classList.add('font-arabic');
    } else {
        document.body.classList.remove('font-arabic');
    }
};

// Set initial direction
updateDirection(savedLanguage);

// Listen for language changes
i18n.on('languageChanged', (lng) => {
    localStorage.setItem('language', lng);
    updateDirection(lng);
});

export default i18n;
