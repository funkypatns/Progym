/**
 * ============================================
 * POS SERVICE
 * ============================================
 * 
 * Handles POS Machine registration and Shift Management.
 * Enforces business rules:
 * - One open shift per machine
 * - Reconciliation of cash calculation
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const crypto = require('crypto');

const posService = {
    /**
     * Get or Register a POS machine by its hardware key
     */
    registerMachine: async (machineKey, name = 'Counter POS') => {
        let machine = await prisma.pOSMachine.findUnique({
            where: { machineKey }
        });

        if (!machine) {
            machine = await prisma.pOSMachine.create({
                data: {
                    machineKey,
                    name,
                    status: 'active'
                }
            });
        }

        return machine;
    },

    /**
     * Get machine status (including current open shift)
     */
    getMachineStatus: async (machineId) => {
        const machine = await prisma.pOSMachine.findUnique({
            where: { id: machineId },
            include: {
                shifts: {
                    where: { status: 'open' },
                    include: { opener: true }
                }
            }
        });

        if (!machine) throw new Error('Machine not found');

        const currentShift = machine.shifts[0] || null;

        return {
            machine: { id: machine.id, name: machine.name, status: machine.status },
            currentShift: currentShift
        };
    },

    /**
     * Open a new shift
     */
    openShift: async (machineId, userId, openingCash) => {
        // Parse IDs as integers to ensure correct types
        const parsedMachineId = parseInt(machineId);
        const parsedUserId = parseInt(userId);

        if (isNaN(parsedMachineId) || isNaN(parsedUserId)) {
            throw new Error('Invalid machineId or userId');
        }

        // Validate machine exists
        const machine = await prisma.pOSMachine.findUnique({
            where: { id: parsedMachineId }
        });
        if (!machine) {
            throw new Error(`Terminal not found (id: ${parsedMachineId})`);
        }

        // Validate user exists
        const user = await prisma.user.findUnique({
            where: { id: parsedUserId }
        });
        if (!user) {
            throw new Error(`Employee not found (id: ${parsedUserId})`);
        }

        // 0. Verify User doesn't have an open shift elsewhere
        const existingUserShift = await prisma.pOSShift.findFirst({
            where: {
                openedBy: parsedUserId,
                status: 'open'
            }
        });

        if (existingUserShift) {
            throw new Error(`You already have an open shift (ID: ${existingUserShift.id}) on Machine ${existingUserShift.machineId}. Please close it first.`);
        }

        // 1. Verify no open shift exists on this MACHINE (Double check)
        const existingShift = await prisma.pOSShift.findFirst({
            where: {
                machineId: parsedMachineId,
                status: 'open'
            }
        });

        if (existingShift) {
            throw new Error('A shift is already open on this machine');
        }

        // 2. Create new shift
        const shift = await prisma.pOSShift.create({
            data: {
                machineId: parsedMachineId,
                openedBy: parsedUserId,
                openingCash: parseFloat(openingCash) || 0,
                status: 'open',
                openedAt: new Date()
            },
            include: { opener: true }
        });

        return shift;
    },

    /**
     * Close a shift
     */
    closeShift: async (shiftId, userId, closingCash) => {
        const shift = await prisma.pOSShift.findUnique({
            where: { id: shiftId },
            include: { payments: true }
        });

        if (!shift || shift.status !== 'open') {
            throw new Error('Shift not found or already closed');
        }

        // Calculate expected cash
        // expected = openingCash + sum(cash payments)
        const cashPayments = shift.payments
            .filter(p => p.method === 'cash' && p.status === 'completed');

        const cashPaymentsSum = cashPayments.reduce((sum, p) => sum + p.amount, 0);

        // Dev logging for debugging
        if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV !== 'production') {
            console.log('[Close Shift Debug] Shift ID:', shiftId);
            console.log('[Close Shift Debug] Opening Cash:', shift.openingCash);
            console.log('[Close Shift Debug] Cash Payments:', cashPayments.map(p => ({
                id: p.id,
                amount: p.amount,
                shiftId: p.shiftId,
                createdBy: p.createdBy,
                subscriptionId: p.subscriptionId,
                notes: p.notes?.substring(0, 50)
            })));
            console.log('[Close Shift Debug] Cash Payments Sum:', cashPaymentsSum);
        }

        const expectedCash = shift.openingCash + cashPaymentsSum;
        const cashDifference = parseFloat(closingCash) - expectedCash;

        // 3. Detect "NO ACTIVITY" Shift
        // Criteria: 0 opening cash, 0 closing cash, 0 transactions
        const totalTransactions = shift.payments.length;
        let activityType = 'NORMAL';
        let notes = shift.notes || ''; // Preserve existing notes

        if (totalTransactions === 0 && shift.openingCash === 0 && parseFloat(closingCash) === 0) {
            activityType = 'NO_ACTIVITY';
            const systemNote = 'System: No Transactions Shift';
            notes = notes ? `${notes}\n${systemNote}` : systemNote;
        }

        // Update shift
        const closedShift = await prisma.pOSShift.update({
            where: { id: shiftId },
            data: {
                closedBy: userId,
                closedAt: new Date(),
                closingCash: parseFloat(closingCash),
                expectedCash,
                cashDifference,
                status: 'closed',
                activityType,
                notes
            },
            include: {
                opener: true,
                closer: true
            }
        });

        return closedShift;
    },



    async getShiftSummary(shiftId) {
        const shift = await prisma.pOSShift.findUnique({
            where: { id: parseInt(shiftId) },
            include: {
                payments: {
                    include: { member: { select: { firstName: true, lastName: true } } }
                },
                refunds: {
                    include: {
                        payment: { include: { member: { select: { firstName: true, lastName: true } } } },
                        user: { select: { firstName: true, lastName: true } }
                    }
                },
                opener: { select: { firstName: true, lastName: true } }
            }
        });

        if (!shift) throw new Error('Shift not found');

        // 1. Total Collected (Gross) -> All completed payments
        const totalCollected = shift.payments
            .filter(p => p.status === 'completed' || p.status === 'refunded' || p.status === 'partial_refund')
            .reduce((sum, p) => sum + p.amount, 0);

        // 2. Refunds in this shift
        const totalRefunded = shift.refunds.reduce((sum, r) => sum + r.amount, 0);

        // 3. Net Cash
        const netCash = totalCollected - totalRefunded;

        // 4. Expected Cash = Opening + Net
        const expectedCash = shift.openingCash + netCash;

        return {
            shiftId: shift.id,
            opener: shift.opener,
            openedAt: shift.openedAt,
            openingCash: shift.openingCash,
            totalCollected,
            totalRefunded,
            netCash,
            expectedCash,
            paymentCount: shift.payments.length,
            refundCount: shift.refunds.length,
            refunds: shift.refunds
        };
    },

    /**
     * Get current open shift for a machine (Helper)
     * ...
     */
    getOpenShift: async (machineId) => {
        return await prisma.pOSShift.findFirst({
            where: {
                machineId,
                status: 'open'
            }
        });
    },

    /**
     * Get current open shift for a user
     */
    getOpenShiftForUser: async (userId) => {
        return await prisma.pOSShift.findFirst({
            where: {
                openedBy: parseInt(userId),
                status: 'open'
            }
        });
    }
};

module.exports = posService;
