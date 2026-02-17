const parseJsonSafely = (text, fallback = null) => {
    if (!text || typeof text !== 'string') return fallback;
    try {
        return JSON.parse(text);
    } catch (error) {
        return fallback;
    }
};
const resolveAmountPaid = (inputAmountPaid, planPrice) => {
    if (inputAmountPaid === null || inputAmountPaid === undefined || inputAmountPaid === '') {
        const fallback = Number(planPrice);
        return Number.isFinite(fallback) && fallback >= 0 ? fallback : 0;
    }

    const parsed = Number(inputAmountPaid);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};
const syncStatuses = async (prisma, where = {}) => {
    const now = new Date();
    await prisma.memberPackage.updateMany({
        where: {
            ...where,
            status: 'ACTIVE',
            remainingSessions: { lte: 0 }
        },
        data: { status: 'COMPLETED' }
    });

    await prisma.memberPackage.updateMany({
        where: {
            ...where,
            status: 'ACTIVE',
            endDate: { lt: now }
        },
        data: { status: 'EXPIRED' }
    });
};

const performPackAssignmentCheckIn = async ({
    prisma,
    assignmentId,
    idempotencyKey,
    sessionName,
    sessionPrice,
    actorUserId,
    formatAssignment
}) => {
    if (idempotencyKey) {
        const existing = await prisma.checkInIdempotency.findUnique({ where: { idempotencyKey } });
        if (existing?.responseJson) {
            return {
                payload: parseJsonSafely(existing.responseJson, null),
                replay: true
            };
        }
    }

    try {
        const payload = await prisma.$transaction(async (tx) => {
            await syncStatuses(tx, { id: assignmentId });

            const assignment = await tx.memberPackage.findFirst({
                where: { id: assignmentId, plan: { type: 'PACKAGE' } },
                include: {
                    member: { select: { id: true, memberId: true, firstName: true, lastName: true } },
                    plan: { select: { id: true, name: true } }
                }
            });

            if (!assignment) {
                const err = new Error('Pack assignment not found');
                err.status = 404;
                throw err;
            }
            if (assignment.status === 'PAUSED') {
                const err = new Error('Pack assignment is paused');
                err.status = 409;
                throw err;
            }
            if (assignment.status !== 'ACTIVE') {
                const err = new Error('Pack assignment is not active');
                err.status = 409;
                throw err;
            }
            if (assignment.endDate && assignment.endDate < new Date()) {
                await tx.memberPackage.update({ where: { id: assignment.id }, data: { status: 'EXPIRED' } });
                const err = new Error('Pack assignment is expired');
                err.status = 409;
                throw err;
            }
            if (assignment.remainingSessions <= 0) {
                await tx.memberPackage.update({ where: { id: assignment.id }, data: { status: 'COMPLETED' } });
                const err = new Error('Pack assignment is exhausted');
                err.status = 409;
                throw err;
            }

            const nextRemaining = assignment.remainingSessions - 1;
            const nextStatus = nextRemaining <= 0 ? 'COMPLETED' : 'ACTIVE';

            const usedSessionName = sessionName || assignment.sessionName || assignment.plan?.name || null;
            const usedSessionPrice = sessionPrice !== null && sessionPrice !== undefined ? sessionPrice : (assignment.sessionPrice ?? null);

            const createdCheckIn = await tx.checkIn.create({
                data: {
                    memberId: assignment.memberId,
                    method: 'manual',
                    notes: JSON.stringify({ visitType: 'PACKAGE', assignmentId: assignment.id })
                }
            });

            const usage = await tx.packageSessionUsage.create({
                data: {
                    memberId: assignment.memberId,
                    memberPackageId: assignment.id,
                    checkInId: createdCheckIn.id,
                    sessionName: usedSessionName,
                    sessionPrice: usedSessionPrice,
                    source: 'CHECKIN',
                    createdByEmployeeId: actorUserId || null,
                    notes: null
                }
            });

            const updatedAssignment = await tx.memberPackage.update({
                where: { id: assignment.id },
                data: {
                    remainingSessions: nextRemaining,
                    status: nextStatus,
                    sessionName: usedSessionName,
                    sessionPrice: usedSessionPrice
                },
                include: {
                    member: {
                        select: {
                            id: true,
                            memberId: true,
                            firstName: true,
                            lastName: true
                        }
                    },
                    plan: {
                        select: {
                            id: true,
                            name: true,
                            packageTotalSessions: true,
                            packageValidityDays: true,
                            price: true
                        }
                    }
                }
            });

            const responsePayload = {
                assignment: formatAssignment(updatedAssignment),
                checkin: {
                    id: usage.id,
                    memberId: usage.memberId,
                    assignmentId: usage.memberPackageId,
                    sessionName: usage.sessionName,
                    sessionPrice: usage.sessionPrice,
                    checkedInAt: usage.dateTime
                }
            };

            if (idempotencyKey) {
                await tx.checkInIdempotency.create({
                    data: {
                        idempotencyKey,
                        memberId: updatedAssignment.memberId,
                        memberPackageId: updatedAssignment.id,
                        checkInId: createdCheckIn.id,
                        responseJson: JSON.stringify(responsePayload)
                    }
                });
            }

            return responsePayload;
        });

        return { payload, replay: false };
    } catch (error) {
        if (idempotencyKey && error?.code === 'P2002') {
            const existing = await prisma.checkInIdempotency.findUnique({ where: { idempotencyKey } });
            if (existing?.responseJson) {
                return {
                    payload: parseJsonSafely(existing.responseJson, null),
                    replay: true
                };
            }
        }
        throw error;
    }
};

module.exports = {
    parseJsonSafely,
    resolveAmountPaid,
    syncStatuses,
    performPackAssignmentCheckIn
};
