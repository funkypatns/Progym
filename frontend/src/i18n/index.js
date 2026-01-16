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

// Get saved language or default to English
const savedLanguage = localStorage.getItem('language') || 'en';

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
