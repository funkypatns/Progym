/**
 * ============================================
 * RECEIPT SERVICE
 * ============================================
 *
 * Generates unique daily receipt numbers and stores unified receipts
 * for payments, subscriptions, and POS sales.
 */

const MAX_RECEIPT_ATTEMPTS = 3;

function formatDateKey(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
}

function buildTransactionId(type, id) {
    const cleanType = String(type || 'unknown').toUpperCase();
    return `${cleanType}-${id}`;
}

async function nextReceiptNumber(prisma, date = new Date()) {
    const dateKey = formatDateKey(date);
    const counter = await prisma.receiptCounter.upsert({
        where: { date: dateKey },
        create: { date: dateKey, lastNumber: 1 },
        update: { lastNumber: { increment: 1 } }
    });
    const sequence = counter.lastNumber;
    const receiptNo = `RC-${dateKey}-${String(sequence).padStart(6, '0')}`;
    return { receiptNo, dateKey, sequence };
}

function safeJsonStringify(value, fallback) {
    try {
        return JSON.stringify(value ?? fallback ?? null);
    } catch (error) {
        return JSON.stringify(fallback ?? null);
    }
}

function ensureReceiptModels(prisma) {
    const hasReceipt = prisma && prisma.receipt && prisma.receiptCounter;
    if (!hasReceipt) {
        const err = new Error('Receipts tables are not initialized. Run prisma migrate/generate.');
        err.code = 'RECEIPTS_NOT_READY';
        err.status = 400;
        throw err;
    }
}

async function createReceipt(prisma, input) {
    ensureReceiptModels(prisma);
    const transactionType = String(input.transactionType || 'payment').toLowerCase();
    const transactionId = buildTransactionId(transactionType, input.transactionId);

    const existing = await prisma.receipt.findUnique({
        where: { transactionId }
    });
    if (existing) {
        return { receipt: existing, created: false };
    }

    const itemsJson = safeJsonStringify(input.items || [], []);
    const totalsJson = safeJsonStringify(input.totals || {}, {});
    const createdAt = input.createdAt || new Date();

    let lastError = null;
    for (let attempt = 0; attempt < MAX_RECEIPT_ATTEMPTS; attempt += 1) {
        const { receiptNo } = await nextReceiptNumber(prisma, createdAt);
        try {
            const receipt = await prisma.receipt.create({
                data: {
                    receiptNo,
                    transactionId,
                    transactionType,
                    paymentMethod: input.paymentMethod || null,
                    customerId: input.customerId || null,
                    customerName: input.customerName || null,
                    customerPhone: input.customerPhone || null,
                    customerCode: input.customerCode || null,
                    staffId: input.staffId || null,
                    staffName: input.staffName || null,
                    branchName: input.branchName || null,
                    itemsJson,
                    totalsJson,
                    status: input.status || 'issued',
                    notes: input.notes || null,
                    createdAt
                }
            });

            return { receipt, created: true };
        } catch (error) {
            const target = String(error.meta?.target || '');
            if (error.code === 'P2002' && target.includes('receiptNo')) {
                lastError = error;
                continue;
            }
            if (error.code === 'P2002' && target.includes('transactionId')) {
                const dupe = await prisma.receipt.findUnique({ where: { transactionId } });
                return { receipt: dupe, created: false };
            }
            throw error;
        }
    }

    throw lastError || new Error('Failed to generate receipt');
}

function parseReceiptJson(receipt) {
    if (!receipt) return receipt;
    let items = [];
    let totals = {};
    try {
        items = receipt.itemsJson ? JSON.parse(receipt.itemsJson) : [];
    } catch (error) {
        items = [];
    }
    try {
        totals = receipt.totalsJson ? JSON.parse(receipt.totalsJson) : {};
    } catch (error) {
        totals = {};
    }
    return { ...receipt, items, totals };
}

module.exports = {
    buildTransactionId,
    createReceipt,
    parseReceiptJson
};
