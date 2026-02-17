const test = require('node:test');
const assert = require('node:assert/strict');

const cashClosingRouter = require('../routes/cashClosing');
const { calculateCashClosingStats } = require('../utils/financialCalculations');

function getRouteHandler(method, path) {
    const layer = cashClosingRouter.stack.find((entry) => entry.route && entry.route.path === path && entry.route.methods[method]);
    if (!layer) throw new Error(`Route not found: ${method.toUpperCase()} ${path}`);
    return layer.route.stack[layer.route.stack.length - 1].handle;
}

function createMockRes() {
    return {
        statusCode: 200,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.body = payload;
            return this;
        }
    };
}

function createNoDataPrisma() {
    return {
        payment: { findMany: async () => [] },
        refund: { findMany: async () => [] },
        saleTransaction: { findMany: async () => [] },
        cashMovement: { findMany: async () => [] },
        trainerPayout: { findMany: async () => [] },
        appointment: { count: async () => 0 },
        trainerEarning: { aggregate: async () => ({ _sum: { commissionAmount: 0 } }) }
    };
}

test('GET /financial-preview returns zero summary when no data exists', async () => {
    const handler = getRouteHandler('get', '/financial-preview');
    const req = {
        query: {
            startAt: '2026-02-17T00:00:00.000Z',
            endAt: '2026-02-17T23:59:59.999Z'
        },
        prisma: createNoDataPrisma()
    };
    const res = createMockRes();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.deepEqual(res.body.summary, {
        totalSessions: 0,
        totalRevenue: 0,
        cashRevenue: 0,
        cardRevenue: 0,
        transferRevenue: 0,
        trainerCommissions: 0,
        payoutsTotal: 0,
        cashInTotal: 0,
        expectedCash: 0,
        expectedNonCash: 0
    });
});

test('payout and cash-in are included in expected cash calculation', async () => {
    const prisma = {
        payment: {
            findMany: async () => [
                { amount: 100, method: 'cash' },
                { amount: 200, method: 'card' }
            ]
        },
        refund: {
            findMany: async () => [
                { amount: 10, payment: { method: 'cash' } },
                { amount: 20, payment: { method: 'card' } }
            ]
        },
        saleTransaction: { findMany: async () => [] },
        cashMovement: {
            findMany: async () => [
                { type: 'IN', amount: 50 },
                { type: 'OUT', amount: 20 }
            ]
        },
        trainerPayout: {
            findMany: async () => [
                { totalAmount: 30, method: 'CASH' },
                { totalAmount: 40, method: 'TRANSFER' }
            ]
        }
    };

    const stats = await calculateCashClosingStats(
        prisma,
        new Date('2026-02-17T00:00:00.000Z'),
        new Date('2026-02-17T23:59:59.999Z')
    );

    // Example validation: expectedCash = cashRevenue(100) + cashIn(50) - payoutsCash(20+30) - cashRefunds(10) = 90
    assert.equal(stats.expectedCashAmount, 90);
    assert.equal(stats.expectedNonCashAmount, 140);
    assert.equal(stats.expectedTotalAmount, 230);
    assert.equal(stats.payoutsTotal, 90);
    assert.equal(stats.cashInTotal, 50);
});
