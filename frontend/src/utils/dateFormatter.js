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
        // DD/MM/YYYY
        const formatted = format(dateObj, 'dd/MM/yyyy', { locale: arEG });
        return toArabicNumerals(formatted);
    }
    // MM/DD/YYYY
    return format(dateObj, 'MM/dd/yyyy', { locale: enUS });
};

export const formatDateTime = (date, locale = 'en') => {
    if (!date) return '';
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) return String(date);

    if (locale === 'ar') {
        // DD/MM/YYYY HH:mm (24h)
        const formatted = format(dateObj, 'dd/MM/yyyy HH:mm', { locale: arEG });
        return toArabicNumerals(formatted);
    }
    // MM/DD/YYYY hh:mm a
    return format(dateObj, 'MM/dd/yyyy hh:mm a', { locale: enUS });
};

export const formatTime = (date, locale = 'en') => {
    if (!date) return '';
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) return String(date);

    if (locale === 'ar') {
        const formatted = format(dateObj, 'HH:mm', { locale: arEG });
        return toArabicNumerals(formatted);
    }
    return format(dateObj, 'hh:mm a', { locale: enUS });
};
