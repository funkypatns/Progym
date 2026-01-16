
const ARABIC_NUMERALS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

const toArabicNumerals = (str) => {
    return str.toString().replace(/\d/g, (d) => ARABIC_NUMERALS[d]);
};

export const formatNumber = (value, locale = 'en') => {
    if (value === undefined || value === null) return '0';
    const num = Number(value);
    const formatted = num.toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US');
    if (locale === 'ar') return toArabicNumerals(formatted);
    return formatted;
};

export const formatCurrency = (value, locale = 'en', currencyConf = { code: 'USD', symbol: '$' }) => {
    const formattedNum = formatNumber(value, locale);
    const { code, symbol } = currencyConf;

    if (locale === 'ar') {
        if (code === 'EGP') return `${formattedNum} ج.م`;
        return `${formattedNum} ${symbol}`;
    }

    if (code === 'EGP') return `EGP ${formattedNum}`;
    return `${symbol}${formattedNum}`;
};
export function formatDateTime(value, locale = "en", timeZone) {
    if (!value) return "-";

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "-";

    const options = {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    };

    if (timeZone) {
        options.timeZone = timeZone;
    }

    return new Intl.DateTimeFormat(
        locale === "ar" ? "ar-EG" : "en-US",
        options
    ).format(date);
}

