const test = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');

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
        sent: null,
        headers: {},
        status(code) {
            this.statusCode = code;
            return this;
        },
        setHeader(name, value) {
            this.headers[name.toLowerCase()] = value;
            return this;
        },
        json(payload) {
            this.body = payload;
            return this;
        },
        send(payload) {
            this.sent = payload;
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

function createCashClosePeriodPrisma({
    payments = [],
    refunds = [],
    sales = [],
    cashMovements = [],
    trainerPayouts = []
} = {}) {
    const users = [
        { id: 1, firstName: 'Admin', lastName: 'User', role: 'admin' }
    ];
    const usersById = new Map(users.map((user) => [user.id, user]));

    const baseDate = new Date('2026-02-17T00:00:00.000Z');
    const periods = [
        {
            id: 1,
            periodType: 'MANUAL',
            startAt: baseDate,
            endAt: null,
            status: 'OPEN',
            snapshotJson: null,
            exportVersion: 1,
            expectedCashAmount: 0,
            expectedNonCashAmount: 0,
            expectedCardAmount: 0,
            expectedTransferAmount: 0,
            expectedTotalAmount: 0,
            actualCashAmount: 0,
            actualNonCashAmount: 0,
            actualTotalAmount: 0,
            differenceCash: 0,
            differenceNonCash: 0,
            differenceTotal: 0,
            revenueTotal: 0,
            sessionsTotal: 0,
            payoutsTotal: 0,
            cashInTotal: 0,
            cashRefundsTotal: 0,
            cashRevenue: 0,
            cardRevenue: 0,
            transferRevenue: 0,
            notes: null,
            createdBy: 1,
            closedBy: null,
            createdAt: baseDate,
            closedAt: null
        }
    ];

    let periodIdSeq = 2;

    const clone = (row) => ({ ...row });
    const attachUsers = (period) => ({
        ...clone(period),
        createdByUser: period.createdBy ? usersById.get(period.createdBy) || null : null,
        closedByUser: period.closedBy ? usersById.get(period.closedBy) || null : null
    });

    const filterByDateRange = (rows, whereClause, dateField) => {
        if (!whereClause || !whereClause[dateField]) return rows;
        const { gte, lte } = whereClause[dateField];
        return rows.filter((row) => {
            const value = row[dateField];
            if (!value) return false;
            if (gte && value < gte) return false;
            if (lte && value > lte) return false;
            return true;
        });
    };

    const prisma = {
        payment: {
            findMany: async () => payments.map(clone)
        },
        refund: {
            findMany: async () => refunds.map(clone)
        },
        saleTransaction: {
            findMany: async () => sales.map(clone)
        },
        saleItem: {
            findMany: async () => []
        },
        cashMovement: {
            findMany: async () => cashMovements.map(clone)
        },
        trainerPayout: {
            findMany: async () => trainerPayouts.map(clone)
        },
        appointment: {
            count: async () => 0
        },
        trainerEarning: {
            aggregate: async () => ({ _sum: { commissionAmount: 0 } })
        },
        auditLog: {
            create: async ({ data }) => ({ id: 1, ...data })
        },
        cashClosePeriod: {
            findMany: async ({ where = {}, orderBy } = {}) => {
                let rows = periods.map(clone);
                if (where.status) rows = rows.filter((row) => row.status === where.status);
                if (where.id?.in) rows = rows.filter((row) => where.id.in.includes(row.id));
                rows = filterByDateRange(rows, where, 'closedAt');
                rows = filterByDateRange(rows, where, 'startAt');

                if (orderBy?.startAt) {
                    rows.sort((a, b) => orderBy.startAt === 'asc'
                        ? a.startAt - b.startAt
                        : b.startAt - a.startAt);
                }
                if (orderBy?.closedAt) {
                    rows.sort((a, b) => orderBy.closedAt === 'asc'
                        ? (a.closedAt || 0) - (b.closedAt || 0)
                        : (b.closedAt || 0) - (a.closedAt || 0));
                }

                return rows;
            },
            create: async ({ data }) => {
                const row = {
                    id: periodIdSeq++,
                    periodType: data.periodType || 'MANUAL',
                    startAt: data.startAt || new Date(),
                    endAt: data.endAt || null,
                    status: data.status || 'OPEN',
                    snapshotJson: data.snapshotJson || null,
                    exportVersion: data.exportVersion ?? 1,
                    expectedCashAmount: data.expectedCashAmount ?? 0,
                    expectedNonCashAmount: data.expectedNonCashAmount ?? 0,
                    expectedCardAmount: data.expectedCardAmount ?? 0,
                    expectedTransferAmount: data.expectedTransferAmount ?? 0,
                    expectedTotalAmount: data.expectedTotalAmount ?? 0,
                    actualCashAmount: data.actualCashAmount ?? 0,
                    actualNonCashAmount: data.actualNonCashAmount ?? 0,
                    actualTotalAmount: data.actualTotalAmount ?? 0,
                    differenceCash: data.differenceCash ?? 0,
                    differenceNonCash: data.differenceNonCash ?? 0,
                    differenceTotal: data.differenceTotal ?? 0,
                    revenueTotal: data.revenueTotal ?? 0,
                    sessionsTotal: data.sessionsTotal ?? 0,
                    payoutsTotal: data.payoutsTotal ?? 0,
                    cashInTotal: data.cashInTotal ?? 0,
                    cashRefundsTotal: data.cashRefundsTotal ?? 0,
                    cashRevenue: data.cashRevenue ?? 0,
                    cardRevenue: data.cardRevenue ?? 0,
                    transferRevenue: data.transferRevenue ?? 0,
                    notes: data.notes ?? null,
                    createdBy: data.createdBy ?? null,
                    closedBy: data.closedBy ?? null,
                    createdAt: data.createdAt || new Date(),
                    closedAt: data.closedAt || null
                };
                periods.push(row);
                return clone(row);
            },
            updateMany: async ({ where = {}, data = {} }) => {
                let count = 0;
                periods.forEach((period) => {
                    if (where.id?.in && !where.id.in.includes(period.id)) return;
                    if (where.status && period.status !== where.status) return;
                    Object.assign(period, data);
                    count += 1;
                });
                return { count };
            },
            update: async ({ where, data, include }) => {
                const period = periods.find((row) => row.id === where.id);
                if (!period) throw new Error('Period not found');
                Object.assign(period, data);
                return include ? attachUsers(period) : clone(period);
            },
            findUnique: async ({ where, include }) => {
                const period = periods.find((row) => row.id === where.id);
                if (!period) return null;
                return include ? attachUsers(period) : clone(period);
            },
            count: async ({ where = {} } = {}) => {
                let rows = periods.map(clone);
                if (where.status) rows = rows.filter((row) => row.status === where.status);
                return rows.length;
            }
        },
        cashClosing: {
            findUnique: async () => null
        },
        cashClosingAdjustment: {
            create: async () => ({ id: 1 })
        },
        $transaction: async (callback) => callback(prisma)
    };

    return { prisma, periods, payments };
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

test('GET /period/current returns DB_SCHEMA_MISMATCH when cashClosePeriod delegate is unavailable', async () => {
    const handler = getRouteHandler('get', '/period/current');
    const req = {
        user: { id: 1, role: 'admin' },
        prisma: createNoDataPrisma()
    };
    const res = createMockRes();

    await handler(req, res);

    assert.equal(res.statusCode, 500);
    assert.equal(res.body.success, false);
    assert.equal(res.body.errorCode, 'DB_SCHEMA_MISMATCH');
});

test('POST / returns DB_SCHEMA_MISMATCH when cashClosePeriod delegate is unavailable', async () => {
    const handler = getRouteHandler('post', '/');
    const prisma = createNoDataPrisma();
    prisma.$transaction = async (callback) => callback(prisma);
    const req = {
        user: { id: 1, role: 'admin' },
        body: {
            declaredCashAmount: 0,
            declaredNonCashAmount: 0
        },
        prisma
    };
    const res = createMockRes();

    await handler(req, res);

    assert.equal(res.statusCode, 500);
    assert.equal(res.body.success, false);
    assert.equal(res.body.errorCode, 'DB_SCHEMA_MISMATCH');
});

test('GET /history returns DB_SCHEMA_MISMATCH when cashClosePeriod delegate is unavailable', async () => {
    const handler = getRouteHandler('get', '/history');
    const req = {
        user: { id: 1, role: 'admin' },
        query: {
            page: 1,
            limit: 20
        },
        prisma: createNoDataPrisma()
    };
    const res = createMockRes();

    await handler(req, res);

    assert.equal(res.statusCode, 500);
    assert.equal(res.body.success, false);
    assert.equal(res.body.errorCode, 'DB_SCHEMA_MISMATCH');
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

test('closing creates CLOSED period and immediately starts NEW OPEN period', async () => {
    const handler = getRouteHandler('post', '/');
    const { prisma, periods } = createCashClosePeriodPrisma();
    const req = {
        user: { id: 1, role: 'admin' },
        body: {
            declaredCashAmount: 0,
            declaredNonCashAmount: 0,
            notes: 'closing test'
        },
        prisma
    };
    const res = createMockRes();

    await handler(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.success, true);
    assert.ok(Number.isFinite(res.body.data.closeId));

    const closed = periods.find((period) => period.status === 'CLOSED');
    const open = periods.find((period) => period.status === 'OPEN');
    assert.ok(closed, 'Expected a CLOSED period');
    assert.ok(open, 'Expected a NEW OPEN period');
    assert.ok(closed.endAt instanceof Date, 'Closed period endAt should be set');
    assert.ok(open.startAt instanceof Date, 'Open period startAt should be set');
    assert.ok(open.startAt > closed.endAt, 'New OPEN period should start after closed endAt');
});

test('financial preview resets to zero on new open period with no new transactions', async () => {
    const closeHandler = getRouteHandler('post', '/');
    const previewHandler = getRouteHandler('get', '/financial-preview');
    const { prisma } = createCashClosePeriodPrisma();
    const closeReq = {
        user: { id: 1, role: 'admin' },
        body: {
            declaredCashAmount: 0,
            declaredNonCashAmount: 0
        },
        prisma
    };
    const closeRes = createMockRes();
    await closeHandler(closeReq, closeRes);
    assert.equal(closeRes.statusCode, 201);

    const previewReq = {
        user: { id: 1, role: 'admin' },
        query: {},
        prisma
    };
    const previewRes = createMockRes();
    await previewHandler(previewReq, previewRes);

    assert.equal(previewRes.statusCode, 200);
    assert.equal(previewRes.body.success, true);
    assert.deepEqual(previewRes.body.summary, {
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

test('export returns snapshot totals saved at close time', async () => {
    const closeHandler = getRouteHandler('post', '/');
    const exportHandler = getRouteHandler('get', '/:id/export');
    const { prisma, periods, payments } = createCashClosePeriodPrisma({
        payments: [
            {
                id: 1,
                paidAt: new Date('2026-02-17T10:00:00.000Z'),
                amount: 120,
                method: 'cash',
                status: 'completed',
                member: { firstName: 'Ali', lastName: 'Hassan' }
            }
        ]
    });

    const closeReq = {
        user: { id: 1, role: 'admin' },
        body: {
            declaredCashAmount: 120,
            declaredNonCashAmount: 0
        },
        prisma
    };
    const closeRes = createMockRes();
    await closeHandler(closeReq, closeRes);
    assert.equal(closeRes.statusCode, 201);

    const closeId = closeRes.body.data.closeId;
    const closedPeriod = periods.find((period) => period.id === closeId);
    assert.ok(closedPeriod, 'Closed period should exist');

    // Add new payment after close; export must still reflect saved snapshot, not live data.
    payments.push({
        id: 2,
        paidAt: new Date('2026-02-17T11:00:00.000Z'),
        amount: 999,
        method: 'cash',
        status: 'completed',
        member: { firstName: 'Later', lastName: 'Payment' }
    });

    const exportReq = {
        user: { id: 1, role: 'admin' },
        params: { id: String(closeId) },
        query: { format: 'xlsx' },
        prisma
    };
    const exportRes = createMockRes();
    await exportHandler(exportReq, exportRes);

    assert.equal(exportRes.statusCode, 200);
    assert.equal(exportRes.headers['content-type'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    assert.match(exportRes.headers['content-disposition'], /cash-close-\d{1,}-\d{4}-\d{2}-\d{2}\.xlsx/);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(exportRes.sent);
    const summarySheet = workbook.getWorksheet('Summary');
    assert.ok(summarySheet, 'Summary sheet should exist');
    assert.equal(summarySheet.getCell('A10').value, 'Item');
    assert.equal(Number(summarySheet.getCell('B11').value), Number(closedPeriod.expectedCashAmount));
    assert.equal(Number(summarySheet.getCell('B13').value), Number(closedPeriod.expectedTotalAmount));
});
