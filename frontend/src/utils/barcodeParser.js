/**
 * ============================================
 * BARCODE/QR PARSER UTILITY
 * ============================================
 * 
 * Parses scanned barcode/QR codes from POS receipts to extract:
 * - Transaction reference (RRN, AUTH, STAN, etc.)
 * - Amount (if present)
 * 
 * Supports multiple formats:
 * - Plain text/numeric strings
 * - Key-value pairs (RRN=123|STAN=456)
 * - JSON payloads
 * - Multi-line POS receipts
 */

/**
 * Parse scanned barcode/QR payload to extract transaction reference and amount
 * 
 * @param {string} scannedValue - Raw scanned input
 * @returns {{
 *   transactionRef: string | null,
 *   amount: number | null,
 *   raw: string,
 *   confidence: 'high' | 'medium' | 'low'
 * }}
 */
export function parseBarcodePayload(scannedValue) {
    if (!scannedValue || typeof scannedValue !== 'string') {
        return { transactionRef: null, amount: null, raw: '', confidence: 'low' };
    }

    const trimmed = scannedValue.trim();
    const result = {
        transactionRef: null,
        amount: null,
        raw: trimmed,
        confidence: 'low'
    };

    // Try parsing as JSON first
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
            const parsed = JSON.parse(trimmed);
            return parseJSON(parsed, trimmed);
        } catch (e) {
            // Not valid JSON, continue with other methods
        }
    }

    // Try key-value pairs (RRN=123|STAN=456 or RRN:123;STAN:456)
    if (trimmed.includes('=') || trimmed.includes(':')) {
        const kvResult = parseKeyValuePairs(trimmed);
        if (kvResult.transactionRef) return kvResult;
    }

    // Try multi-line format (common in POS receipts)
    if (trimmed.includes('\n') || trimmed.includes('\r')) {
        const multilineResult = parseMultiline(trimmed);
        if (multilineResult.transactionRef) return multilineResult;
    }

    // Fallback: treat entire value as transaction reference
    // Clean up common prefixes
    let cleaned = trimmed
        .replace(/^(RRN|AUTH|STAN|TRACE|TRANS|REF)[\s:=\-_]*/i, '')
        .replace(/\s+/g, '')
        .toUpperCase();

    if (cleaned.length >= 4) {
        result.transactionRef = cleaned;
        result.confidence = 'medium';
    }

    return result;
}

/**
 * Parse JSON payload
 */
function parseJSON(obj, raw) {
    const result = { transactionRef: null, amount: null, raw, confidence: 'high' };

    // Priority order for transaction reference
    const refKeys = ['rrn', 'RRN', 'auth', 'AUTH', 'authorization', 'stan', 'STAN', 'trace', 'TRACE', 'trans_id', 'transactionId', 'transaction_id', 'ref', 'reference'];

    for (const key of refKeys) {
        if (obj[key]) {
            result.transactionRef = String(obj[key]).trim().toUpperCase();
            break;
        }
    }

    // Extract amount
    const amtKeys = ['amount', 'AMOUNT', 'amt', 'AMT', 'total', 'TOTAL', 'value', 'VALUE'];
    for (const key of amtKeys) {
        if (obj[key]) {
            const parsed = parseFloat(obj[key]);
            if (!isNaN(parsed) && parsed > 0) {
                result.amount = parsed;
                break;
            }
        }
    }

    return result;
}

/**
 * Parse key-value pairs (RRN=123|AUTH=456 or RRN:123;STAN:456)
 */
function parseKeyValuePairs(text) {
    const result = { transactionRef: null, amount: null, raw: text, confidence: 'high' };

    // Split by common delimiters
    const pairs = text.split(/[|;&,\n\r]+/);
    const map = {};

    for (const pair of pairs) {
        const match = pair.match(/([A-Z_]+)[\s:=\-]+([^\s:=\-]+)/i);
        if (match) {
            map[match[1].toLowerCase()] = match[2].trim();
        }
    }

    // Priority extraction
    const refOrder = ['rrn', 'auth', 'authorization', 'stan', 'trace', 'trans_id', 'transactionid', 'ref', 'reference'];
    for (const key of refOrder) {
        if (map[key]) {
            result.transactionRef = map[key].toUpperCase();
            break;
        }
    }

    // Extract amount
    const amtOrder = ['amount', 'amt', 'total', 'value'];
    for (const key of amtOrder) {
        if (map[key]) {
            const parsed = parseFloat(map[key]);
            if (!isNaN(parsed) && parsed > 0) {
                result.amount = parsed;
                break;
            }
        }
    }

    return result;
}

/**
 * Parse multi-line format (common in POS receipts)
 */
function parseMultiline(text) {
    const result = { transactionRef: null, amount: null, raw: text, confidence: 'medium' };
    const lines = text.split(/[\n\r]+/);

    for (const line of lines) {
        const trimmedLine = line.trim();

        // Look for transaction reference patterns
        const refMatch = trimmedLine.match(/(?:RRN|AUTH|STAN|TRACE|TRANS|REF)[\s:=\-_]*([A-Z0-9]+)/i);
        if (refMatch && !result.transactionRef) {
            result.transactionRef = refMatch[1].toUpperCase();
        }

        // Look for amount patterns
        const amtMatch = trimmedLine.match(/(?:AMOUNT|AMT|TOTAL|VALUE)[\s:=\-_]*([\d,.]+)/i);
        if (amtMatch && !result.amount) {
            const cleaned = amtMatch[1].replace(/,/g, '');
            const parsed = parseFloat(cleaned);
            if (!isNaN(parsed) && parsed > 0) {
                result.amount = parsed;
            }
        }
    }

    return result;
}

/**
 * Validate transaction reference format
 * @param {string} ref - Transaction reference to validate
 * @returns {boolean}
 */
export function isValidTransactionRef(ref) {
    if (!ref || typeof ref !== 'string') return false;
    const trimmed = ref.trim();
    // Must be at least 4 characters, alphanumeric
    return trimmed.length >= 4 && /^[A-Z0-9\-_]+$/i.test(trimmed);
}

/**
 * Normalize transaction reference (uppercase, remove spaces)
 * @param {string} ref - Transaction reference
 * @returns {string}
 */
export function normalizeTransactionRef(ref) {
    if (!ref) return '';
    return ref.trim().replace(/\s+/g, '').toUpperCase();
}
