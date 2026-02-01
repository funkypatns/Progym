import { format } from 'date-fns';
import { enUS, arEG } from 'date-fns/locale';

const ARABIC_NUMERALS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

const toArabicNumerals = (str) => {
    return str.toString().replace(/\d/g, (d) => ARABIC_NUMERALS[d]);
};

export const formatDate = (date, locale = 'en') => {
    if (!date) return '';
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) return String(date);

    if (locale === 'ar') {
        // 27 يناير 2026
        const formatted = format(dateObj, 'd MMMM yyyy', { locale: arEG });
        return toArabicNumerals(formatted);
    }
    // Jan 27, 2026
    return format(dateObj, 'MMM d, yyyy', { locale: enUS });
};

export const formatTime = (date, locale = 'en') => {
    if (!date) return '';
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) return String(date);

    if (locale === 'ar') {
        // 02:30 م
        const formatted = format(dateObj, 'hh:mm a', { locale: arEG });
        return toArabicNumerals(formatted);
    }
    // 02:30 PM
    return format(dateObj, 'hh:mm a', { locale: enUS });
};

export const formatDateTime = (date, locale = 'en') => {
    if (!date) return '';
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) return String(date);

    const d = formatDate(date, locale);
    const t = formatTime(date, locale);

    return `${d} · ${t}`;
};
