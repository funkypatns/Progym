const test = require('node:test');
const assert = require('node:assert/strict');
const { performPackAssignmentCheckIn } = require('../services/packAssignmentsService');

function createMockPrisma({ remainingSessions = 2, status = 'ACTIVE', endDate = null } = {}) {
    let checkInCounter = 1;
    let usageCounter = 1;
    const assignment = {
        id: 99,
        memberId: 10,
        planId: 7,
        status,
        remainingSessions,
        totalSessions: 12,
        sessionName: 'PT Session',
        sessionPrice: 100,
        endDate,
        member: { id: 10, memberId: 'GYM-001', firstName: 'Ali', lastName: 'Hassan' },
        plan: { id: 7, name: '12 Sessions', packageTotalSessions: 12, packageValidityDays: 30, price: 1200 }
    };

    const idempotencyMap = new Map();
    const usages = [];

    const tx = {
        memberPackage: {
            updateMany: async ({ where, data }) => {
                const idMatches = !where.id || where.id === assignment.id;
                const statusMatches = !where.status || where.status === assignment.status;
                const remainingMatches = !where.remainingSessions
                    || (where.remainingSessions.lte !== undefined && assignment.remainingSessions <= where.remainingSessions.lte)
                    || (where.remainingSessions.gt !== undefined && assignment.remainingSessions > where.remainingSessions.gt);
                const endDateMatches = !where.endDate
                    || (where.endDate.lt && assignment.endDate && assignment.endDate < where.endDate.lt);
                const shouldApply = idMatches && statusMatches && remainingMatches && endDateMatches;
                if (shouldApply) assignment.status = data.status;
                return { count: shouldApply ? 1 : 0 };
            },
            findFirst: async ({ where }) => {
                if (where.id !== assignment.id) return null;
                if (where.plan?.type && where.plan.type !== 'PACKAGE') return null;
                return { ...assignment };
            },
            update: async ({ where, data }) => {
                assert.equal(where.id, assignment.id);
                assignment.remainingSessions = data.remainingSessions ?? assignment.remainingSessions;
                assignment.status = data.status ?? assignment.status;
                assignment.sessionName = data.sessionName ?? assignment.sessionName;
                assignment.sessionPrice = data.sessionPrice ?? assignment.sessionPrice;
                return {
                    ...assignment,
                    member: assignment.member,
                    plan: assignment.plan
                };
            }
        },
        checkIn: {
            create: async () => ({ id: checkInCounter++ })
        },
        packageSessionUsage: {
            create: async ({ data }) => {
                const usage = {
                    id: usageCounter++,
                    memberId: data.memberId,
                    memberPackageId: data.memberPackageId,
                    sessionName: data.sessionName,
                    sessionPrice: data.sessionPrice,
                    dateTime: new Date()
                };
                usages.push(usage);
                return usage;
            }
        },
        checkInIdempotency: {
            create: async ({ data }) => {
                if (idempotencyMap.has(data.idempotencyKey)) {
                    const err = new Error('duplicate');
                    err.code = 'P2002';
                    throw err;
                }
                idempotencyMap.set(data.idempotencyKey, data.responseJson);
                return { id: 1 };
            },
            findUnique: async ({ where }) => {
                if (!idempotencyMap.has(where.idempotencyKey)) return null;
                return { idempotencyKey: where.idempotencyKey, responseJson: idempotencyMap.get(where.idempotencyKey) };
            }
        }
    };

    return {
        prisma: {
            ...tx,
            $transaction: async (fn) => fn(tx),
            checkInIdempotency: tx.checkInIdempotency
        },
        assignment,
        usages
    };
}

const identityFormat = (row) => row;

test('pack check-in decrements remaining sessions and creates usage', async () => {
    const mock = createMockPrisma({ remainingSessions: 2, status: 'ACTIVE' });

    const result = await performPackAssignmentCheckIn({
        prisma: mock.prisma,
        assignmentId: 99,
        idempotencyKey: '',
        sessionName: '',
        sessionPrice: null,
        actorUserId: 1,
        formatAssignment: identityFormat
    });

    assert.equal(result.replay, false);
    assert.equal(result.payload.assignment.remainingSessions, 1);
    assert.equal(result.payload.assignment.status, 'ACTIVE');
    assert.equal(mock.usages.length, 1);
});

test('idempotency key prevents double deduction', async () => {
    const mock = createMockPrisma({ remainingSessions: 2, status: 'ACTIVE' });

    const first = await performPackAssignmentCheckIn({
        prisma: mock.prisma,
        assignmentId: 99,
        idempotencyKey: 'pack-key-1',
        sessionName: '',
        sessionPrice: null,
        actorUserId: 1,
        formatAssignment: identityFormat
    });

    const second = await performPackAssignmentCheckIn({
        prisma: mock.prisma,
        assignmentId: 99,
        idempotencyKey: 'pack-key-1',
        sessionName: '',
        sessionPrice: null,
        actorUserId: 1,
        formatAssignment: identityFormat
    });

    assert.equal(first.replay, false);
    assert.equal(second.replay, true);
    assert.equal(mock.assignment.remainingSessions, 1);
    assert.equal(mock.usages.length, 1);
});

test('cannot check-in exhausted assignment', async () => {
    const mock = createMockPrisma({ remainingSessions: 0, status: 'ACTIVE' });

    await assert.rejects(
        () => performPackAssignmentCheckIn({
            prisma: mock.prisma,
            assignmentId: 99,
            idempotencyKey: '',
            sessionName: '',
            sessionPrice: null,
            actorUserId: 1,
            formatAssignment: identityFormat
        }),
        (error) => {
            assert.equal(error.status, 409);
            assert.match(error.message, /(exhausted|not active)/i);
            return true;
        }
    );
});
