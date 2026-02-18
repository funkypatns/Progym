const test = require('node:test');
const assert = require('node:assert/strict');

const posRouter = require('../routes/pos');
const reportsRouter = require('../routes/reports');
const cashClosingRouter = require('../routes/cashClosing');

function getRouteHandler(router, method, path) {
    const layer = router.stack.find((entry) => entry.route && entry.route.path === path && entry.route.methods[method]);
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
        },
        send(payload) {
            this.body = payload;
            return this;
        },
        setHeader() {
            return this;
        }
    };
}

function createCashClosePrismaForNegativeExpected() {
    const users = [{ id: 1, firstName: 'Admin', lastName: 'User' }];
    const usersById = new Map(users.map((user) => [user.id, user]));
    const periodStart = new Date('2026-02-17T08:00:00.000Z');
    const periods = [
        {
            id: 1,
            periodType: 'MANUAL',
            startAt: periodStart,
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
            createdAt: periodStart,
            closedAt: null
        }
    ];

    let periodSeq = 2;

    const cashClosePeriod = {
        findMany: async ({ where = {} } = {}) => {
            let rows = periods.slice();
            if (where.status) {
                rows = rows.filter((row) => row.status === where.status);
            }
            return rows;
        },
        create: async ({ data }) => {
            const row = {
                id: periodSeq++,
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
            return row;
        },
        update: async ({ where, data, include }) => {
            const row = periods.find((item) => item.id === where.id);
            if (!row) throw new Error('Period not found');
            Object.assign(row, data);
            if (!include) return row;
            return {
                ...row,
                createdByUser: row.createdBy ? usersById.get(row.createdBy) || null : null,
                closedByUser: row.closedBy ? usersById.get(row.closedBy) || null : null
            };
        }
    };

    const prisma = {
        payment: { findMany: async () => [] },
        refund: { findMany: async () => [] },
        saleTransaction: { findMany: async () => [] },
        cashMovement: {
            findMany: async () => [
                {
                    id: 91,
                    type: 'OUT',
                    amount: 120,
                    reason: 'Emergency drawer payout',
                    notes: null,
                    createdAt: new Date('2026-02-17T09:00:00.000Z')
                }
            ]
        },
        trainerPayout: { findMany: async () => [] },
        appointment: { count: async () => 0 },
        trainerEarning: { aggregate: async () => ({ _sum: { commissionAmount: 0 } }) },
        auditLog: { create: async ({ data }) => ({ id: 1, ...data }) },
        cashClosePeriod,
        $transaction: async (callback) => callback(prisma)
    };

    return prisma;
}

test('POS shifts date filtering should use overlap logic, not closedAt-only filter', async () => {
    const handler = getRouteHandler(posRouter, 'get', '/shifts');
    let capturedWhere = null;

    const req = {
        query: {
            startDate: '2026-02-01',
            endDate: '2026-02-07'
        },
        user: { role: 'admin' },
        prisma: {
            pOSShift: {
                findMany: async ({ where }) => {
                    capturedWhere = where;
                    return [];
                }
            }
        }
    };
    const res = createMockRes();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.ok(Array.isArray(capturedWhere?.AND), 'Expected overlap filter: openedAt <= end AND (closedAt is null OR closedAt >= start)');
});

test('Employee collections should aggregate by createdBy/creator.id instead of creatorId', async () => {
    const handler = getRouteHandler(reportsRouter, 'get', '/employee-collections');
    const req = {
        query: {
            startDate: '2026-02-10',
            endDate: '2026-02-10'
        },
        prisma: {
            payment: {
                findMany: async () => [
                    {
                        id: 1,
                        amount: 200,
                        method: 'cash',
                        status: 'completed',
                        createdBy: 77,
                        creator: { id: 77, firstName: 'Ali', lastName: 'Cashier' }
                    }
                ]
            }
        }
    };
    const res = createMockRes();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.report[0].id, 77);
});

test('Employee collections should include zero-activity closed shifts as zero rows', async () => {
    const handler = getRouteHandler(reportsRouter, 'get', '/employee-collections');
    const req = {
        query: {
            startDate: '2026-02-10',
            endDate: '2026-02-10'
        },
        prisma: {
            payment: { findMany: async () => [] },
            pOSShift: {
                findMany: async () => [
                    {
                        id: 10,
                        status: 'closed',
                        openedBy: 3,
                        closedBy: 3,
                        openingCash: 0,
                        closingCash: 0,
                        expectedCash: 0,
                        cashDifference: 0
                    }
                ]
            }
        }
    };
    const res = createMockRes();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.ok(res.body.report.length > 0, 'Expected a zero row for a closed shift with no transactions');
});

test('Cash closing should return NEGATIVE_EXPECTED_CASH warning when expected cash goes below zero', async () => {
    const handler = getRouteHandler(cashClosingRouter, 'post', '/');
    const req = {
        user: { id: 1, role: 'admin' },
        body: {
            declaredCashAmount: 0,
            declaredNonCashAmount: 0,
            notes: 'audit warning check'
        },
        prisma: createCashClosePrismaForNegativeExpected()
    };
    const res = createMockRes();

    await handler(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.warningCode, 'NEGATIVE_EXPECTED_CASH');
});
