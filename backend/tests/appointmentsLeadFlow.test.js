const test = require('node:test');
const assert = require('node:assert/strict');

const AppointmentService = require('../services/appointmentService');
const router = require('../routes/appointments');

function getRouteHandler(method, path) {
    const layer = router.stack.find((entry) => entry.route && entry.route.path === path && entry.route.methods[method]);
    if (!layer) throw new Error(`Route not found: ${method.toUpperCase()} ${path}`);
    return layer.route.stack[layer.route.stack.length - 1].handle;
}

function createMockRes() {
    const res = {
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
    return res;
}

test('POST /appointments creates tentative appointment from tentative payload', async () => {
    const handler = getRouteHandler('post', '/');
    const originalCreateAppointment = AppointmentService.createAppointment;

    const calls = [];
    AppointmentService.createAppointment = async (payload) => {
        calls.push(payload);
        return {
            id: 10,
            bookingType: 'tentative',
            status: 'booked',
            memberId: null,
            fullName: 'Visitor User',
            phone: '01012345678'
        };
    };

    const req = {
        body: {
            start: '2026-02-17T10:00:00.000Z',
            end: '2026-02-17T11:00:00.000Z',
            durationMinutes: 60,
            bookingType: 'tentative',
            fullName: 'Visitor User',
            phone: '01012345678',
            notes: 'first call',
            title: 'PT Session',
            sessionName: 'PT Session',
            sessionPrice: 250,
            price: 250
        },
        user: { id: 3 },
        headers: {}
    };
    const res = createMockRes();

    try {
        await handler(req, res);
    } finally {
        AppointmentService.createAppointment = originalCreateAppointment;
    }

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.bookingType, 'tentative');
    assert.equal(res.body.data.fullName, 'Visitor User');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].coachId, 3);
    assert.equal(calls[0].createdByEmployeeId, 3);
    assert.equal(calls[0].bookingType, 'tentative');
    assert.equal(calls[0].fullName, 'Visitor User');
});

test('POST /appointments/:id/complete returns member conversion payload', async () => {
    const handler = getRouteHandler('post', '/:id/complete');
    const originalCompleteAppointment = AppointmentService.completeAppointment;

    const calls = [];
    AppointmentService.completeAppointment = async (id, payload, user) => {
        calls.push({ id, payload, user });
        return {
            appointment: {
                id: Number(id),
                status: 'completed',
                bookingType: 'confirmed',
                memberId: 55,
                paymentStatus: 'paid'
            },
            sessionPayment: {
                id: 88,
                appointmentId: Number(id),
                status: 'completed',
                amount: 355
            },
            member: {
                id: 55,
                firstName: 'Omar',
                lastName: 'Habib',
                phone: '01012345678'
            },
            alreadyCompleted: false,
            dueAmount: 0,
            overpaidAmount: 0
        };
    };

    const req = {
        params: { id: '79' },
        body: {
            sessionPrice: 355,
            paymentMethod: 'cash',
            paymentStatus: 'paid',
            amount: 355,
            payment: { amount: 355, method: 'cash', status: 'paid' },
            memberDetails: {
                fullName: 'Omar Habib',
                phone: '01012345678'
            }
        },
        user: { id: 1, firstName: 'Admin', lastName: 'User' }
    };
    const res = createMockRes();

    try {
        await handler(req, res);
    } finally {
        AppointmentService.completeAppointment = originalCompleteAppointment;
    }

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.appointment.status, 'completed');
    assert.equal(res.body.member.id, 55);
    assert.equal(res.body.sessionPayment.id, 88);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].id, '79');
    assert.equal(calls[0].payload.sessionPrice, 355);
    assert.equal(calls[0].payload.memberDetails.fullName, 'Omar Habib');
});

test('POST /appointments/:id/complete is idempotent when already completed', async () => {
    const handler = getRouteHandler('post', '/:id/complete');
    const originalCompleteAppointment = AppointmentService.completeAppointment;

    AppointmentService.completeAppointment = async () => ({
        appointment: { id: 79, status: 'completed', memberId: 55 },
        sessionPayment: { id: 88 },
        alreadyCompleted: true
    });

    const req = {
        params: { id: '79' },
        body: {
            sessionPrice: 355,
            paymentMethod: 'cash',
            payment: { amount: 355, method: 'cash', status: 'paid' }
        },
        user: { id: 1, firstName: 'Admin', lastName: 'User' }
    };
    const res = createMockRes();

    try {
        await handler(req, res);
    } finally {
        AppointmentService.completeAppointment = originalCompleteAppointment;
    }

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.alreadyCompleted, true);
    assert.equal(res.body.ok, true);
});
