const test = require('node:test');
const assert = require('node:assert/strict');

const settingsRouter = require('../routes/settings');

function getRouteHandler(method, path) {
    const layer = settingsRouter.stack.find((entry) => entry.route && entry.route.path === path && entry.route.methods[method]);
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

test('settings reset deletes session price adjustments before appointments', async () => {
    const resetHandler = getRouteHandler('post', '/reset');
    const callOrder = [];
    let sessionPriceAdjustmentsDeleted = false;

    const noopDelete = async () => ({ count: 0 });

    const tx = {
        activityLog: { deleteMany: noopDelete },
        auditLog: { deleteMany: noopDelete },
        notification: { deleteMany: noopDelete },
        staffNotification: { deleteMany: noopDelete },
        saleItem: { deleteMany: noopDelete },
        saleTransaction: { deleteMany: noopDelete },
        stockMovement: { deleteMany: noopDelete },
        product: { deleteMany: noopDelete },
        cashMovement: { deleteMany: async () => { callOrder.push('cashMovement.deleteMany'); return { count: 0 }; } },
        refund: { deleteMany: async () => { callOrder.push('refund.deleteMany'); return { count: 0 }; } },
        payment: {
            deleteMany: async ({ where } = {}) => {
                if (where?.appointmentId) {
                    callOrder.push('payment.deleteMany(appointmentId)');
                } else {
                    callOrder.push('payment.deleteMany');
                }
                return { count: 0 };
            }
        },
        coachEarning: { deleteMany: async () => { callOrder.push('coachEarning.deleteMany'); return { count: 0 }; } },
        trainerEarning: { deleteMany: async () => { callOrder.push('trainerEarning.deleteMany'); return { count: 0 }; } },
        appointmentFinancialRecord: { deleteMany: async () => { callOrder.push('appointmentFinancialRecord.deleteMany'); return { count: 0 }; } },
        sessionPriceAdjustment: {
            deleteMany: async () => {
                sessionPriceAdjustmentsDeleted = true;
                callOrder.push('sessionPriceAdjustment.deleteMany');
                return { count: 1 };
            }
        },
        appointment: {
            findMany: async () => [{ id: 101 }],
            deleteMany: async () => {
                callOrder.push('appointment.deleteMany');
                assert.equal(sessionPriceAdjustmentsDeleted, true);
                return { count: 1 };
            }
        },
        coachSettlement: { deleteMany: async () => { callOrder.push('coachSettlement.deleteMany'); return { count: 0 }; } },
        trainerPayout: { deleteMany: async () => { callOrder.push('trainerPayout.deleteMany'); return { count: 0 }; } },
        cashClosingAdjustment: { deleteMany: noopDelete },
        cashClosing: { deleteMany: noopDelete },
        receipt: { deleteMany: noopDelete },
        expense: { deleteMany: noopDelete },
        reminder: { deleteMany: async () => { callOrder.push('reminder.deleteMany'); return { count: 0 }; } },
        packageSessionUsage: { deleteMany: async () => { callOrder.push('packageSessionUsage.deleteMany'); return { count: 0 }; } },
        checkInIdempotency: { deleteMany: async () => { callOrder.push('checkInIdempotency.deleteMany'); return { count: 0 }; } },
        memberPackage: { deleteMany: async () => { callOrder.push('memberPackage.deleteMany'); return { count: 0 }; } },
        checkIn: { deleteMany: async () => { callOrder.push('checkIn.deleteMany'); return { count: 0 }; } },
        lead: { deleteMany: async () => { callOrder.push('lead.deleteMany'); return { count: 0 }; } },
        subscription: { deleteMany: async () => { callOrder.push('subscription.deleteMany'); return { count: 0 }; } },
        member: { deleteMany: async () => { callOrder.push('member.deleteMany'); return { count: 0 }; } },
        pOSShift: {
            updateMany: async () => ({ count: 0 }),
            deleteMany: async () => ({ count: 0 })
        },
        coachCommissionSettings: { deleteMany: noopDelete },
        subscriptionPlan: { deleteMany: noopDelete },
        setting: {
            deleteMany: noopDelete,
            upsert: async () => ({})
        },
        pOSMachine: { upsert: async () => ({}) }
    };

    const req = {
        body: {
            targets: ['members'],
            date: null
        },
        prisma: {
            $transaction: async (fn) => fn(tx)
        }
    };

    const res = createMockRes();
    await resetHandler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);

    const adjustmentIndex = callOrder.indexOf('sessionPriceAdjustment.deleteMany');
    const appointmentIndex = callOrder.indexOf('appointment.deleteMany');
    assert.ok(adjustmentIndex >= 0);
    assert.ok(appointmentIndex >= 0);
    assert.ok(adjustmentIndex < appointmentIndex);
});
