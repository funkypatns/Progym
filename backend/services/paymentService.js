/**
 * ============================================
 * PAYMENT SERVICE (Shared Logic)
 * ============================================
 *
 * Single source of truth for payment creation logic
 * Used by: /api/payments and /api/subscriptions
 */

const DEFAULT_IDEMPOTENCY_WINDOW_MS = 30 * 1000;

function generateReceiptNumber() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const time = String(date.getHours()).padStart(2, '0') +
        String(date.getMinutes()).padStart(2, '0') +
        String(date.getSeconds()).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `RCP-${year}${month}-${time}-${random}`;
}

function normalizePaymentMethod(method) {
    const normalized = String(method || 'cash').toLowerCase().trim();
    if (['cash', 'card', 'transfer', 'other', 'visa'].includes(normalized)) {
        return normalized;
    }
    return 'cash';
}

function resolvePaymentReference(method, externalReference, transactionRef) {
    const normalizedMethod = normalizePaymentMethod(method);
    const rawRef = externalReference || transactionRef || null;
    if (normalizedMethod === 'cash') return null;
    if (!rawRef || !String(rawRef).trim()) return null;
    return String(rawRef).trim().toUpperCase();
}

async function createPaymentWithRetry(prisma, data, options = {}) {
    const attempts = Number.isFinite(options.attempts) ? options.attempts : 3;
    const receiptSuffix = options.receiptSuffix || '';
    let lastError = null;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
        const receiptNumber = `${generateReceiptNumber()}${receiptSuffix}`;
        try {
            return await prisma.payment.create({
                data: {
                    ...data,
                    receiptNumber
                }
            });
        } catch (err) {
            const target = String(err.meta?.target || '');
            if (err.code === 'P2002' && target.includes('receiptNumber')) {
                lastError = err;
                continue;
            }
            throw err;
        }
    }
    throw lastError || new Error('Failed to generate unique receipt number');
}

async function recordPaymentTransaction(prisma, input, options = {}) {
    const status = input.status || 'completed';
    const normalizedMethod = normalizePaymentMethod(input.method);
    const paidAt = input.paidAt || new Date();
    const safeRef = resolvePaymentReference(normalizedMethod, input.externalReference, input.transactionRef);

    const idempotencyWindowMs = Number.isFinite(options.idempotencyWindowMs)
        ? options.idempotencyWindowMs
        : DEFAULT_IDEMPOTENCY_WINDOW_MS;
    const shouldCheckDuplicate = !options.skipIdempotency && status === 'completed';

    if (shouldCheckDuplicate) {
        const idempotencyWhere = {
            memberId: parseInt(input.memberId),
            amount: parseFloat(input.amount),
            status: status,
            method: { in: [normalizedMethod, normalizedMethod.toUpperCase()] }
        };

        if (input.subscriptionId) {
            idempotencyWhere.subscriptionId = parseInt(input.subscriptionId);
        }

        if (Number.isInteger(input.createdBy)) {
            idempotencyWhere.createdBy = parseInt(input.createdBy);
        }

        if (safeRef) {
            idempotencyWhere.externalReference = safeRef;
        } else {
            const windowStart = new Date(paidAt.getTime() - idempotencyWindowMs);
            idempotencyWhere.paidAt = { gte: windowStart };
        }

        const existing = await prisma.payment.findFirst({
            where: idempotencyWhere,
            orderBy: { paidAt: 'desc' }
        });

        if (existing) {
            return { payment: existing, created: false };
        }
    }

    let finalNotes = input.notes ? String(input.notes).trim() : '';
    if (safeRef) {
        finalNotes = finalNotes ? `${finalNotes} (Ref: ${safeRef})` : `Ref: ${safeRef}`;
    }

    const prismaData = {
        memberId: parseInt(input.memberId),
        amount: parseFloat(input.amount),
        method: normalizedMethod.toUpperCase(),
        status,
        paidAt
    };

    if (input.subscriptionId) prismaData.subscriptionId = parseInt(input.subscriptionId);
    if (finalNotes) prismaData.notes = finalNotes;
    if (input.shiftId) prismaData.shiftId = parseInt(input.shiftId);
    if (input.createdBy) prismaData.createdBy = parseInt(input.createdBy);
    if (input.collectorName) prismaData.collectorName = String(input.collectorName).trim();

    if (safeRef) prismaData.externalReference = safeRef;
    if (input.verificationMode) prismaData.verificationMode = input.verificationMode;
    if (input.posAmountVerified) prismaData.posAmountVerified = parseFloat(input.posAmountVerified);

    const payment = await createPaymentWithRetry(prisma, prismaData, {
        attempts: options.attempts,
        receiptSuffix: options.receiptSuffix
    });

    return { payment, created: true };
}

module.exports = {
    normalizePaymentMethod,
    resolvePaymentReference,
    recordPaymentTransaction
};
