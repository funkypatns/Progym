const test = require('node:test');
const assert = require('node:assert/strict');

const paymentsRouter = require('../routes/payments');

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
        }
    };
}

function createMemberPackageRow(id, paymentStatus, amountPaid = 1200) {
    return {
        id,
        memberId: 11,
        planId: 20,
        startDate: new Date('2026-02-18T08:00:00.000Z'),
        endDate: new Date('2026-03-20T08:00:00.000Z'),
        totalSessions: 12,
        remainingSessions: 6,
        sessionName: 'PT',
        sessionPrice: 100,
        paymentMethod: 'cash',
        paymentStatus,
        amountPaid,
        status: 'ACTIVE',
        createdAt: new Date('2026-02-18T08:00:00.000Z'),
        member: {
            id: 11,
            memberId: 'M-001',
            firstName: 'Ali',
            lastName: 'Hassan',
            phone: '01000000000'
        },
        plan: {
            id: 20,
            name: '12 Sessions',
            price: 1200,
            packageTotalSessions: 12
        },
        createdByEmployee: {
            id: 3,
            firstName: 'Admin',
            lastName: 'User'
        }
    };
}

test('GET /api/payments?type=PACKAGE returns normalized package payment rows', async () => {
    const handler = getRouteHandler(paymentsRouter, 'get', '/');
    const res = createMockRes();
    let capturedPackageWhere = null;

    const req = {
        query: { type: 'PACKAGE' },
        user: { id: 1, role: 'admin' },
        prisma: {
            payment: {
                findMany: async () => [],
                count: async () => 0
            },
            memberPackage: {
                findMany: async ({ where }) => {
                    capturedPackageWhere = where;
                    return [
                        createMemberPackageRow(1, 'paid', 1200),
                        createMemberPackageRow(2, 'completed', 900)
                    ];
                }
            }
        }
    };

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(Array.isArray(res.body.data.payments), true);
    assert.equal(res.body.data.payments.length, 2);
    assert.ok(capturedPackageWhere.paymentStatus);
    assert.equal(res.body.data.payments[0].memberPackage.plan.name, '12 Sessions');
    assert.equal(res.body.data.payments[0].type, 'PACKAGE');
});

test('GET /api/payments?type=SESSION does not fetch package payment records', async () => {
    const handler = getRouteHandler(paymentsRouter, 'get', '/');
    const res = createMockRes();
    let packageQueryCount = 0;
    let paymentWhere = null;

    const req = {
        query: { type: 'SESSION' },
        user: { id: 1, role: 'admin' },
        prisma: {
            payment: {
                findMany: async ({ where }) => {
                    paymentWhere = where;
                    return [];
                },
                count: async () => 0
            },
            memberPackage: {
                findMany: async () => {
                    packageQueryCount += 1;
                    return [];
                }
            }
        }
    };

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(packageQueryCount, 0);
    assert.ok(paymentWhere.appointmentId);
});
