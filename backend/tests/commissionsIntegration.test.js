const test = require('node:test');
const assert = require('node:assert/strict');

const CommissionService = require('../services/commissionService');
const commissionsRouter = require('../routes/commissions');

function getRouteHandler(method, path) {
    const layer = commissionsRouter.stack.find((entry) => entry.route && entry.route.path === path && entry.route.methods[method]);
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

test('processSessionCommission creates trainer commission transaction for completed/paid session', async () => {
    const created = [];
    const updated = [];

    const tx = {
        setting: {
            findUnique: async () => null
        },
        appointment: {
            findUnique: async ({ select }) => {
                if (select && Object.prototype.hasOwnProperty.call(select, 'memberId')) {
                    return { memberId: 11, trainerId: 9 };
                }
                return {
                    id: 55,
                    coachId: 4,
                    coach: { firstName: 'Coach', lastName: 'One' },
                    finalPrice: 200,
                    price: 200,
                    subscriptionId: null
                };
            }
        },
        payment: {
            findMany: async () => [{ amount: 200 }]
        },
        appointmentFinancialRecord: {
            upsert: async () => ({ id: 1 })
        },
        trainerEarning: {
            findUnique: async ({ where }) => {
                if (where.appointmentId === 55 && created.length > 0) {
                    return {
                        id: 101,
                        appointmentId: 55,
                        status: 'UNPAID'
                    };
                }
                return null;
            },
            create: async ({ data }) => {
                created.push(data);
                return { id: 101, ...data };
            },
            update: async ({ data }) => {
                updated.push(data);
                return { id: 101, ...data };
            }
        }
    };

    await CommissionService.processSessionCommission(55, tx);
    await CommissionService.processSessionCommission(55, tx);

    assert.equal(created.length, 1);
    assert.equal(created[0].appointmentId, 55);
    assert.equal(created[0].trainerId, 9);
    assert.equal(created[0].commissionAmount, 40);
    assert.equal(updated.length, 1);
});

function createCommissionPrismaState() {
    const now = new Date('2026-02-17T10:00:00.000Z');
    const earnings = [
        {
            id: 1,
            trainerId: 1,
            appointmentId: 101,
            baseAmount: 100,
            commissionAmount: 20,
            commissionPercent: 20,
            status: 'UNPAID',
            createdAt: new Date('2026-02-17T08:00:00.000Z'),
            payoutId: null,
            trainer: { id: 1, name: 'Trainer One' },
            appointment: {
                id: 101,
                start: new Date('2026-02-17T07:00:00.000Z'),
                end: new Date('2026-02-17T08:00:00.000Z'),
                title: 'PT Session',
                sessionName: 'PT Session',
                price: 100,
                finalPrice: 100,
                status: 'completed',
                paymentStatus: 'paid',
                member: { firstName: 'Ali', lastName: 'Hassan', memberId: 'GYM-1', phone: '0100' },
                payments: [{ id: 9001, amount: 100, method: 'cash', status: 'completed', paidAt: now }]
            }
        },
        {
            id: 2,
            trainerId: 1,
            appointmentId: 102,
            baseAmount: 150,
            commissionAmount: 30,
            commissionPercent: 20,
            status: 'UNPAID',
            createdAt: new Date('2026-02-17T09:00:00.000Z'),
            payoutId: null,
            trainer: { id: 1, name: 'Trainer One' },
            appointment: {
                id: 102,
                start: new Date('2026-02-17T08:30:00.000Z'),
                end: new Date('2026-02-17T09:30:00.000Z'),
                title: 'PT Session',
                sessionName: 'PT Session',
                price: 150,
                finalPrice: 150,
                status: 'completed',
                paymentStatus: 'paid',
                member: { firstName: 'Sara', lastName: 'Mahmoud', memberId: 'GYM-2', phone: '0101' },
                payments: [{ id: 9002, amount: 150, method: 'card', status: 'completed', paidAt: now }]
            }
        }
    ];

    const payouts = [];

    const filterByWhere = (rows, where = {}) => {
        return rows.filter((row) => {
            if (where.trainerId && row.trainerId !== where.trainerId) return false;
            if (where.status && row.status !== where.status) return false;
            if (where.createdAt) {
                const createdAt = new Date(row.createdAt);
                if (where.createdAt.gte && createdAt < new Date(where.createdAt.gte)) return false;
                if (where.createdAt.lte && createdAt > new Date(where.createdAt.lte)) return false;
            }
            return true;
        });
    };

    const prisma = {
        service: {
            findUnique: async () => null
        },
        staffTrainer: {
            findUnique: async ({ where }) => (where.id === 1 ? { id: 1, name: 'Trainer One' } : null)
        },
        trainerEarning: {
            findMany: async ({ where, select, include } = {}) => {
                const filtered = filterByWhere(earnings, where);
                if (select) {
                    return filtered.map((row) => {
                        const selected = {};
                        Object.keys(select).forEach((key) => {
                            selected[key] = row[key];
                        });
                        return selected;
                    });
                }
                if (include) {
                    return filtered.map((row) => ({
                        ...row,
                        payout: row.payoutId ? payouts.find((p) => p.id === row.payoutId) || null : null
                    }));
                }
                return filtered;
            },
            updateMany: async ({ where, data }) => {
                let count = 0;
                earnings.forEach((row) => {
                    if (where.id?.in?.includes(row.id)) {
                        row.status = data.status;
                        row.payoutId = data.payoutId;
                        count += 1;
                    }
                });
                return { count };
            }
        },
        trainerPayout: {
            create: async ({ data }) => {
                const payout = {
                    id: payouts.length + 1,
                    trainerId: data.trainerId,
                    totalAmount: data.totalAmount,
                    method: data.method,
                    note: data.note,
                    paidByEmployeeId: data.paidByEmployeeId,
                    paidAt: now,
                    createdAt: now,
                    trainer: { id: 1, name: 'Trainer One' },
                    paidByEmployee: { id: data.paidByEmployeeId || 1, firstName: 'Admin', lastName: 'User' }
                };
                payouts.push(payout);
                return payout;
            },
            findMany: async ({ where } = {}) => {
                return payouts.filter((item) => {
                    if (where?.trainerId && item.trainerId !== where.trainerId) return false;
                    if (where?.createdAt?.gte && item.createdAt < where.createdAt.gte) return false;
                    if (where?.createdAt?.lte && item.createdAt > where.createdAt.lte) return false;
                    return true;
                });
            }
        },
        $transaction: async (fn) => fn(prisma)
    };

    return prisma;
}

test('settle endpoint decreases outstanding and creates settlement records', async () => {
    const summaryHandler = getRouteHandler('get', '/summary');
    const settleHandler = getRouteHandler('post', '/settle');
    const transactionsHandler = getRouteHandler('get', '/transactions');

    const prisma = createCommissionPrismaState();

    const summaryBeforeReq = {
        query: { trainerId: '1', startDate: '2026-02-17', endDate: '2026-02-17' },
        prisma
    };
    const summaryBeforeRes = createMockRes();
    await summaryHandler(summaryBeforeReq, summaryBeforeRes);
    assert.equal(summaryBeforeRes.body.success, true);
    assert.equal(summaryBeforeRes.body.data.outstanding_total, 50);

    const settleReq = {
        body: {
            trainerId: 1,
            settleAll: true,
            method: 'cash',
            note: 'monthly settlement',
            dateRange: { startDate: '2026-02-17', endDate: '2026-02-17' }
        },
        user: { id: 1 },
        prisma
    };
    const settleRes = createMockRes();
    await settleHandler(settleReq, settleRes);
    assert.equal(settleRes.body.success, true);
    assert.equal(settleRes.body.data.settledAmount, 50);

    const summaryAfterReq = {
        query: { trainerId: '1', startDate: '2026-02-17', endDate: '2026-02-17' },
        prisma
    };
    const summaryAfterRes = createMockRes();
    await summaryHandler(summaryAfterReq, summaryAfterRes);
    assert.equal(summaryAfterRes.body.data.outstanding_total, 0);
    assert.equal(summaryAfterRes.body.data.settled_total, 50);

    const txReq = {
        query: { trainerId: '1', startDate: '2026-02-17', endDate: '2026-02-17' },
        prisma
    };
    const txRes = createMockRes();
    await transactionsHandler(txReq, txRes);
    assert.equal(txRes.body.success, true);
    assert.equal(txRes.body.data.settlements.length, 1);
});
