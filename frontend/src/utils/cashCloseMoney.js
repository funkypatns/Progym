const ARABIC_INDIC_DIGITS = '\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669';
const EASTERN_ARABIC_INDIC_DIGITS = '\u06F0\u06F1\u06F2\u06F3\u06F4\u06F5\u06F6\u06F7\u06F8\u06F9';

const toAsciiDigits = (value) => (
    String(value || '')
        .replace(/[\u0660-\u0669]/g, (digit) => String(ARABIC_INDIC_DIGITS.indexOf(digit)))
        .replace(/[\u06F0-\u06F9]/g, (digit) => String(EASTERN_ARABIC_INDIC_DIGITS.indexOf(digit)))
);

const normalizeDecimalSeparators = (value) => (
    value
        .replace(/\u066B/g, '.')
        .replace(/\u066C/g, ',')
);

const normalizeMultipleDots = (value) => {
    const lastDot = value.lastIndexOf('.');
    if (lastDot <= 0) return value;
    return value
        .split('')
        .filter((char, index) => char !== '.' || index === lastDot)
        .join('');
};

const normalizeCommaAndDots = (value) => {
    const hasComma = value.includes(',');
    const hasDot = value.includes('.');

    if (hasComma && hasDot) {
        const lastComma = value.lastIndexOf(',');
        const lastDot = value.lastIndexOf('.');
        if (lastComma > lastDot) {
            return normalizeMultipleDots(value.replace(/\./g, '').replace(',', '.'));
        }
        return normalizeMultipleDots(value.replace(/,/g, ''));
    }

    if (hasComma) {
        const commaCount = (value.match(/,/g) || []).length;
        if (/^\d{1,3}(,\d{3})+$/.test(value) || commaCount > 1) {
            return value.replace(/,/g, '');
        }
        return value.replace(',', '.');
    }

    if (hasDot) {
        if (/^\d{1,3}(\.\d{3})+$/.test(value)) {
            return value.replace(/\./g, '');
        }
        return normalizeMultipleDots(value);
    }

    return value;
};

export const parseMoney = (input, _locale = 'en') => {
    if (input === null || typeof input === 'undefined') return 0;
    if (typeof input === 'number') return Number.isFinite(input) ? input : 0;

    const raw = String(input).trim();
    if (!raw) return 0;

    const asciiDigits = toAsciiDigits(raw);
    const withNormalizedSeparators = normalizeDecimalSeparators(asciiDigits);
    const cleaned = withNormalizedSeparators
        .replace(/\s+/g, '')
        .replace(/[^\d.,\-]/g, '');

    if (!cleaned || cleaned === '-' || cleaned === '.' || cleaned === ',') return 0;

    const sign = cleaned.startsWith('-') ? -1 : 1;
    const unsigned = cleaned.replace(/-/g, '');
    const normalized = normalizeCommaAndDots(unsigned);

    const parsed = Number.parseFloat(normalized);
    if (!Number.isFinite(parsed)) return 0;
    return sign * parsed;
};

export const roundMoney = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Math.round((numeric + Number.EPSILON) * 100) / 100;
};

export const calculateCashDifference = (declaredCash, expectedCash) => {
    const diff = roundMoney(parseMoney(declaredCash) - parseMoney(expectedCash));
    if (Math.abs(diff) < 0.005) return 0;
    return diff;
};

export const getCashDifferenceState = (diff) => {
    if (diff > 0) return 'overage';
    if (diff < 0) return 'shortage';
    return 'balanced';
};
