
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = 'postgresql://postgres@localhost:5432/postgres?schema=public';
}

const prisma = new PrismaClient();
const DEMO_TAG = '[DEMO_EXPORT]';

const FIRST_NAMES = ['Omar', 'Ahmed', 'Youssef', 'Khaled', 'Mariam', 'Nour', 'Laila', 'Farah', 'Hassan', 'Rana'];
const LAST_NAMES = ['Ali', 'Hassan', 'Mahmoud', 'Sayed', 'Ibrahim', 'Saleh', 'Mostafa', 'Amin', 'Samir', 'Kareem'];
const PAYMENT_METHODS = ['cash', 'card', 'transfer'];

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min, max) {
    return min + Math.random() * (max - min);
}

function pick(list) {
    return list[randomInt(0, list.length - 1)];
}

function round2(value) {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function normalize(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
        .replace(/\s+/g, ' ');
}

function daysAgo(days, hour = 12) {
    const d = new Date();
    d.setHours(hour, 0, 0, 0);
    d.setDate(d.getDate() - days);
    return d;
}

async function getOrCreatePlan(tx, payload) {
    const existing = await tx.subscriptionPlan.findFirst({
        where: { name: payload.name }
    });
    if (existing) {
        return tx.subscriptionPlan.update({
            where: { id: existing.id },
            data: payload
        });
    }
    return tx.subscriptionPlan.create({ data: payload });
}

async function main() {
    const passwordHash = await bcrypt.hash('demo123', 10);
    let receiptCounter = 0;
    let externalRefCounter = 0;

    const summary = await prisma.$transaction(async (tx) => {
        const admin = await tx.user.upsert({
            where: { username: 'admin' },
            update: {
                firstName: 'System',
                lastName: 'Admin',
                isActive: true
            },
            create: {
                username: 'admin',
                email: 'admin@gym.local',
                password: passwordHash,
                firstName: 'System',
                lastName: 'Admin',
                role: 'admin',
                isActive: true
            }
        });

        const cashier = await tx.user.upsert({
            where: { username: 'demo_cashier' },
            update: { firstName: 'Demo', lastName: 'Cashier', isActive: true },
            create: {
                username: 'demo_cashier',
                email: 'demo_cashier@gym.local',
                password: passwordHash,
                firstName: 'Demo',
                lastName: 'Cashier',
                role: 'staff',
                isActive: true
            }
        });

        const coachUser1 = await tx.user.upsert({
            where: { username: 'demo_coach_1' },
            update: { firstName: 'Demo', lastName: 'Coach One', isActive: true },
            create: {
                username: 'demo_coach_1',
                email: 'demo_coach_1@gym.local',
                password: passwordHash,
                firstName: 'Demo',
                lastName: 'Coach One',
                role: 'staff',
                isActive: true
            }
        });

        const coachUser2 = await tx.user.upsert({
            where: { username: 'demo_coach_2' },
            update: { firstName: 'Demo', lastName: 'Coach Two', isActive: true },
            create: {
                username: 'demo_coach_2',
                email: 'demo_coach_2@gym.local',
                password: passwordHash,
                firstName: 'Demo',
                lastName: 'Coach Two',
                role: 'staff',
                isActive: true
            }
        });

        const trainer1 = await tx.staffTrainer.upsert({
            where: { id: 900001 },
            update: {
                name: 'Trainer Demo 1',
                commissionPercent: 25,
                active: true
            },
            create: {
                id: 900001,
                name: 'Trainer Demo 1',
                phone: '201500000901',
                commissionPercent: 25,
                commissionType: 'percentage',
                commissionValue: 25,
                internalSessionValue: 0,
                active: true
            }
        });

        const trainer2 = await tx.staffTrainer.upsert({
            where: { id: 900002 },
            update: {
                name: 'Trainer Demo 2',
                commissionPercent: 30,
                active: true
            },
            create: {
                id: 900002,
                name: 'Trainer Demo 2',
                phone: '201500000902',
                commissionPercent: 30,
                commissionType: 'percentage',
                commissionValue: 30,
                internalSessionValue: 0,
                active: true
            }
        });

        const machine = await tx.pOSMachine.upsert({
            where: { machineKey: 'demo-export-machine' },
            update: { name: 'Demo Export POS', status: 'active' },
            create: {
                machineKey: 'demo-export-machine',
                name: 'Demo Export POS',
                status: 'active'
            }
        });

        const plans = await Promise.all([
            getOrCreatePlan(tx, {
                name: 'Demo Monthly',
                nameAr: 'Demo Monthly',
                duration: 30,
                durationType: 'days',
                price: 420,
                description: `Demo monthly plan ${DEMO_TAG}`,
                isActive: true,
                sortOrder: 901
            }),
            getOrCreatePlan(tx, {
                name: 'Demo Quarterly',
                nameAr: 'Demo Quarterly',
                duration: 90,
                durationType: 'days',
                price: 1100,
                description: `Demo quarterly plan ${DEMO_TAG}`,
                isActive: true,
                sortOrder: 902
            }),
            getOrCreatePlan(tx, {
                name: 'Demo Annual',
                nameAr: 'Demo Annual',
                duration: 365,
                durationType: 'days',
                price: 3600,
                description: `Demo annual plan ${DEMO_TAG}`,
                isActive: true,
                sortOrder: 903
            })
        ]);

        await tx.refund.deleteMany({ where: { reason: { contains: DEMO_TAG } } });
        await tx.payment.deleteMany({ where: { notes: { contains: DEMO_TAG } } });

        await tx.appointmentFinancialRecord.deleteMany({
            where: {
                appointment: {
                    OR: [
                        { title: { contains: DEMO_TAG } },
                        { notes: { contains: DEMO_TAG } }
                    ]
                }
            }
        });

        await tx.trainerEarning.deleteMany({
            where: {
                appointment: {
                    OR: [
                        { title: { contains: DEMO_TAG } },
                        { notes: { contains: DEMO_TAG } }
                    ]
                }
            }
        });

        await tx.appointment.deleteMany({
            where: {
                OR: [
                    { title: { contains: DEMO_TAG } },
                    { notes: { contains: DEMO_TAG } }
                ]
            }
        });

        await tx.stockMovement.deleteMany({
            where: {
                OR: [
                    { reason: { contains: DEMO_TAG } },
                    { notes: { contains: DEMO_TAG } }
                ]
            }
        });

        await tx.saleTransaction.deleteMany({ where: { notes: { contains: DEMO_TAG } } });

        await tx.cashMovement.deleteMany({
            where: {
                OR: [
                    { reason: { contains: DEMO_TAG } },
                    { notes: { contains: DEMO_TAG } }
                ]
            }
        });

        await tx.trainerPayout.deleteMany({ where: { note: { contains: DEMO_TAG } } });
        await tx.subscription.deleteMany({ where: { notes: { contains: DEMO_TAG } } });
        await tx.cashClosePeriod.deleteMany({ where: { notes: { contains: DEMO_TAG } } });
        await tx.pOSShift.deleteMany({ where: { notes: { contains: DEMO_TAG } } });

        const products = [];
        for (let i = 1; i <= 6; i += 1) {
            const sku = `DEMO-PRD-${String(i).padStart(3, '0')}`;
            const existing = await tx.product.findFirst({ where: { sku } });
            const payload = {
                name: `Demo Product ${i}`,
                description: `${DEMO_TAG} product for export preview`,
                salePrice: round2(randomFloat(35, 220)),
                sku,
                isActive: true
            };
            const product = existing
                ? await tx.product.update({ where: { id: existing.id }, data: payload })
                : await tx.product.create({ data: payload });
            products.push(product);
        }

        const members = [];
        for (let i = 1; i <= 14; i += 1) {
            const firstName = pick(FIRST_NAMES);
            const lastName = pick(LAST_NAMES);
            const memberId = `DEMO-EXP-${String(i).padStart(3, '0')}`;
            const displayName = `${firstName} ${lastName}`.trim();
            const phoneRaw = `2015100${String(i).padStart(5, '0')}`;
            const phoneNorm = phoneRaw.replace(/\D/g, '');

            const member = await tx.member.upsert({
                where: { memberId },
                update: {
                    firstName,
                    lastName,
                    fullName: displayName,
                    displayName,
                    displayNameNorm: normalize(displayName),
                    phone: phoneRaw,
                    phoneNorm,
                    email: `demo_member_${i}@gym.local`,
                    gender: i % 2 === 0 ? 'female' : 'male',
                    isActive: true,
                    notes: DEMO_TAG
                },
                create: {
                    memberId,
                    firstName,
                    lastName,
                    fullName: displayName,
                    displayName,
                    displayNameNorm: normalize(displayName),
                    phone: phoneRaw,
                    phoneNorm,
                    email: `demo_member_${i}@gym.local`,
                    gender: i % 2 === 0 ? 'female' : 'male',
                    isActive: true,
                    notes: DEMO_TAG,
                    joinDate: daysAgo(randomInt(15, 120))
                }
            });
            members.push(member);
        }

        const demoShifts = [];
        for (let i = 0; i < 8; i += 1) {
            const openAt = daysAgo(28 - i * 3, 8);
            const closeAt = new Date(openAt.getTime() + (10 * 60 * 60 * 1000));
            const openingCash = round2(randomFloat(200, 450));
            const closingCash = round2(openingCash + randomFloat(350, 1200));
            const shift = await tx.pOSShift.create({
                data: {
                    machineId: machine.id,
                    openedBy: cashier.id,
                    closedBy: cashier.id,
                    openedAt: openAt,
                    closedAt: closeAt,
                    openingCash,
                    closingCash,
                    expectedCash: closingCash,
                    cashDifference: 0,
                    status: 'closed',
                    activityType: 'NORMAL',
                    notes: `${DEMO_TAG} shift ${i + 1}`
                }
            });
            demoShifts.push(shift);
        }

        const makeReceiptNumber = () => {
            receiptCounter += 1;
            const stamp = Date.now();
            return `DEMO-${stamp}-${String(receiptCounter).padStart(5, '0')}`;
        };

        const makeExternalRef = () => {
            externalRefCounter += 1;
            return `DEMO-EXT-${Date.now()}-${String(externalRefCounter).padStart(4, '0')}`;
        };

        const subscriptions = [];
        const payments = [];
        const refunds = [];

        for (let i = 0; i < members.length; i += 1) {
            const member = members[i];
            const plan = plans[i % plans.length];
            const startAt = daysAgo(randomInt(5, 95), 10);
            const endAt = new Date(startAt.getTime());
            endAt.setDate(endAt.getDate() + Math.max(1, plan.duration || 30));

            const fullPrice = round2(Number(plan.price || 0));
            const paidBase = round2(fullPrice * randomFloat(0.55, 1.15));
            const remaining = round2(fullPrice - paidBase);

            let paymentStatus = 'unpaid';
            if (paidBase >= fullPrice - 0.01) paymentStatus = 'paid';
            else if (paidBase > 0.01) paymentStatus = 'partial';

            const subscriptionStatus = endAt < new Date() ? 'expired' : 'active';

            const subscription = await tx.subscription.create({
                data: {
                    memberId: member.id,
                    planId: plan.id,
                    startDate: startAt,
                    endDate: endAt,
                    status: subscriptionStatus,
                    price: fullPrice,
                    paidAmount: paidBase,
                    remainingAmount: round2(Math.max(remaining, 0)),
                    paymentStatus,
                    discount: 0,
                    notes: `${DEMO_TAG} subscription`
                }
            });
            subscriptions.push(subscription);

            const partsCount = randomInt(1, 2);
            let left = paidBase;
            for (let p = 0; p < partsCount; p += 1) {
                const isLast = p === partsCount - 1;
                const amount = isLast ? left : round2(Math.max(10, left * randomFloat(0.3, 0.7)));
                left = round2(left - amount);
                const paidAt = daysAgo(randomInt(0, 45), randomInt(10, 22));
                const method = pick(PAYMENT_METHODS);
                const shift = pick(demoShifts);
                const payment = await tx.payment.create({
                    data: {
                        memberId: member.id,
                        subscriptionId: subscription.id,
                        amount,
                        method,
                        status: 'completed',
                        receiptNumber: makeReceiptNumber(),
                        notes: `${DEMO_TAG} subscription payment`,
                        paidAt,
                        shiftId: shift.id,
                        createdBy: cashier.id,
                        collectorName: `${cashier.firstName} ${cashier.lastName}`,
                        externalReference: method === 'cash' ? null : makeExternalRef()
                    }
                });
                payments.push(payment);

                if (Math.random() < 0.15) {
                    const refundAmount = round2(Math.min(amount, randomFloat(5, amount * 0.4)));
                    const refund = await tx.refund.create({
                        data: {
                            paymentId: payment.id,
                            amount: refundAmount,
                            reason: `${DEMO_TAG} partial refund`,
                            shiftId: shift.id,
                            createdBy: admin.id,
                            createdAt: new Date(paidAt.getTime() + (2 * 60 * 60 * 1000))
                        }
                    });
                    refunds.push(refund);
                    await tx.payment.update({
                        where: { id: payment.id },
                        data: { refundedTotal: refundAmount, status: 'refunded' }
                    });
                }
            }
        }

        for (const product of products) {
            const shift = pick(demoShifts);
            await tx.stockMovement.create({
                data: {
                    productId: product.id,
                    type: 'IN',
                    quantity: randomInt(30, 80),
                    unitCost: round2(product.salePrice * randomFloat(0.4, 0.7)),
                    reason: `${DEMO_TAG} stock seed`,
                    notes: DEMO_TAG,
                    shiftId: shift.id,
                    employeeId: cashier.id
                }
            });
        }

        const sales = [];
        for (let i = 0; i < 20; i += 1) {
            const shift = pick(demoShifts);
            const saleTime = new Date(shift.openedAt.getTime() + randomInt(1, 8) * 60 * 60 * 1000);
            const itemCount = randomInt(1, 3);
            const lines = [];
            let total = 0;
            for (let line = 0; line < itemCount; line += 1) {
                const product = pick(products);
                const qty = randomInt(1, 3);
                const lineTotal = round2(product.salePrice * qty);
                total = round2(total + lineTotal);
                lines.push({
                    productId: product.id,
                    quantity: qty,
                    unitPrice: product.salePrice,
                    lineTotal
                });
            }
            const sale = await tx.saleTransaction.create({
                data: {
                    shiftId: shift.id,
                    employeeId: cashier.id,
                    paymentMethod: pick(PAYMENT_METHODS),
                    totalAmount: total,
                    notes: `${DEMO_TAG} sale`,
                    createdAt: saleTime,
                    items: {
                        create: lines
                    }
                }
            });
            sales.push(sale);
        }

        const cashMovements = [];
        for (let i = 0; i < 12; i += 1) {
            const shift = pick(demoShifts);
            const type = i % 3 === 0 ? 'OUT' : 'IN';
            const movement = await tx.cashMovement.create({
                data: {
                    type,
                    amount: round2(randomFloat(40, 320)),
                    reason: `${DEMO_TAG} ${type === 'IN' ? 'cash in' : 'cash out'}`,
                    notes: `${DEMO_TAG} movement`,
                    shiftId: shift.id,
                    employeeId: cashier.id,
                    createdAt: new Date(shift.openedAt.getTime() + randomInt(1, 9) * 60 * 60 * 1000)
                }
            });
            cashMovements.push(movement);
        }

        const appointments = [];
        const appointmentRecords = [];
        const trainerEarnings = [];
        const coachUsers = [coachUser1, coachUser2];
        const trainers = [trainer1, trainer2];

        for (let i = 0; i < 18; i += 1) {
            const member = pick(members);
            const coach = pick(coachUsers);
            const trainer = pick(trainers);
            const start = daysAgo(randomInt(2, 40), randomInt(9, 19));
            const end = new Date(start.getTime() + (60 * 60 * 1000));
            const basePrice = round2(randomFloat(160, 480));
            const finalPrice = round2(basePrice + randomFloat(-20, 40));
            const paidAmount = round2(Math.max(0, finalPrice * randomFloat(0.8, 1)));
            const dueAmount = round2(Math.max(0, finalPrice - paidAmount));
            const paymentStatus = dueAmount <= 0.01 ? 'paid' : 'partial';

            const appointment = await tx.appointment.create({
                data: {
                    title: `${DEMO_TAG} Personal Training`,
                    memberId: member.id,
                    bookingType: 'confirmed',
                    fullName: `${member.firstName} ${member.lastName}`,
                    phone: member.phone,
                    coachId: coach.id,
                    trainerId: trainer.id,
                    start,
                    end,
                    price: basePrice,
                    finalPrice,
                    paidAmount,
                    dueAmount,
                    overpaidAmount: 0,
                    paymentStatus,
                    status: 'completed',
                    notes: `${DEMO_TAG} completed session`,
                    createdByEmployeeId: cashier.id,
                    completedByEmployeeId: cashier.id,
                    completedAt: end,
                    isCompleted: true
                }
            });
            appointments.push(appointment);

            const apptPayment = await tx.payment.create({
                data: {
                    memberId: member.id,
                    appointmentId: appointment.id,
                    amount: paidAmount,
                    method: pick(PAYMENT_METHODS),
                    status: 'completed',
                    receiptNumber: makeReceiptNumber(),
                    notes: `${DEMO_TAG} appointment payment`,
                    paidAt: end,
                    shiftId: pick(demoShifts).id,
                    createdBy: cashier.id,
                    collectorName: `${cashier.firstName} ${cashier.lastName}`
                }
            });
            payments.push(apptPayment);

            const commissionPercent = trainer.commissionPercent || 25;
            const commissionAmount = round2(finalPrice * (commissionPercent / 100));
            const gymNetIncome = round2(finalPrice - commissionAmount);

            const finRecord = await tx.appointmentFinancialRecord.create({
                data: {
                    appointmentId: appointment.id,
                    memberId: member.id,
                    coachId: coach.id,
                    sessionPrice: finalPrice,
                    coachCommission: commissionAmount,
                    gymNetIncome,
                    commissionType: 'percentage',
                    commissionValue: commissionPercent,
                    basisAmount: finalPrice,
                    status: 'PENDING',
                    completedAt: end
                }
            });
            appointmentRecords.push(finRecord);

            const earning = await tx.trainerEarning.create({
                data: {
                    trainerId: trainer.id,
                    appointmentId: appointment.id,
                    baseAmount: finalPrice,
                    commissionPercent,
                    commissionAmount,
                    status: Math.random() < 0.35 ? 'PAID' : 'UNPAID'
                }
            });
            trainerEarnings.push(earning);
        }

        const payoutByTrainer = new Map();
        for (const earning of trainerEarnings.filter((row) => row.status === 'PAID')) {
            const current = payoutByTrainer.get(earning.trainerId) || 0;
            payoutByTrainer.set(earning.trainerId, round2(current + earning.commissionAmount));
        }

        const payouts = [];
        for (const [trainerId, amount] of payoutByTrainer.entries()) {
            if (amount <= 0) continue;
            const payout = await tx.trainerPayout.create({
                data: {
                    trainerId,
                    totalAmount: amount,
                    method: Math.random() < 0.5 ? 'CASH' : 'TRANSFER',
                    note: `${DEMO_TAG} trainer payout`,
                    paidAt: daysAgo(randomInt(1, 12), 18),
                    paidByEmployeeId: admin.id
                }
            });
            payouts.push(payout);
            await tx.trainerEarning.updateMany({
                where: {
                    trainerId,
                    status: 'PAID',
                    payoutId: null
                },
                data: { payoutId: payout.id }
            });
        }

        const periods = [
            { start: daysAgo(24, 0), end: daysAgo(17, 23) },
            { start: daysAgo(16, 0), end: daysAgo(9, 23) },
            { start: daysAgo(8, 0), end: daysAgo(2, 23) }
        ];

        const closedPeriods = [];
        for (const period of periods) {
            const periodPayments = await tx.payment.findMany({
                where: {
                    notes: { contains: DEMO_TAG },
                    paidAt: { gte: period.start, lte: period.end },
                    status: { in: ['completed', 'paid', 'refunded', 'Partial Refund', 'partial_refund'] }
                },
                include: {
                    member: { select: { firstName: true, lastName: true } }
                },
                orderBy: { paidAt: 'asc' }
            });
            const periodSales = await tx.saleTransaction.findMany({
                where: {
                    notes: { contains: DEMO_TAG },
                    createdAt: { gte: period.start, lte: period.end }
                },
                orderBy: { createdAt: 'asc' }
            });
            const periodMovements = await tx.cashMovement.findMany({
                where: {
                    notes: { contains: DEMO_TAG },
                    createdAt: { gte: period.start, lte: period.end }
                },
                orderBy: { createdAt: 'asc' }
            });
            const periodPayouts = await tx.trainerPayout.findMany({
                where: {
                    note: { contains: DEMO_TAG },
                    paidAt: { gte: period.start, lte: period.end }
                },
                orderBy: { paidAt: 'asc' }
            });
            const periodRefunds = await tx.refund.findMany({
                where: {
                    reason: { contains: DEMO_TAG },
                    createdAt: { gte: period.start, lte: period.end }
                },
                include: { payment: { select: { method: true } } }
            });

            const cashRevenue = round2(
                periodPayments
                    .filter((p) => String(p.method).toLowerCase() === 'cash')
                    .reduce((sum, p) => sum + Number(p.amount || 0), 0)
            );
            const cardRevenue = round2(
                periodPayments
                    .filter((p) => String(p.method).toLowerCase() === 'card')
                    .reduce((sum, p) => sum + Number(p.amount || 0), 0)
            );
            const transferRevenue = round2(
                periodPayments
                    .filter((p) => String(p.method).toLowerCase() === 'transfer')
                    .reduce((sum, p) => sum + Number(p.amount || 0), 0)
            );
            const cashInTotal = round2(
                periodMovements
                    .filter((m) => String(m.type).toUpperCase() === 'IN')
                    .reduce((sum, m) => sum + Number(m.amount || 0), 0)
            );
            const cashOutTotal = round2(
                periodMovements
                    .filter((m) => String(m.type).toUpperCase() === 'OUT')
                    .reduce((sum, m) => sum + Number(m.amount || 0), 0)
            );
            const payoutsTotal = round2(periodPayouts.reduce((sum, p) => sum + Number(p.totalAmount || 0), 0));
            const cashRefundsTotal = round2(
                periodRefunds
                    .filter((r) => String(r.payment?.method || 'cash').toLowerCase() === 'cash')
                    .reduce((sum, r) => sum + Number(r.amount || 0), 0)
            );

            const expectedCash = round2(cashRevenue + cashInTotal - cashOutTotal - cashRefundsTotal);
            const expectedNonCash = round2(cardRevenue + transferRevenue);
            const expectedTotal = round2(expectedCash + expectedNonCash);

            const diffCash = round2(randomFloat(-45, 65));
            const diffNonCash = round2(randomFloat(-10, 10));
            const actualCash = round2(expectedCash + diffCash);
            const actualNonCash = round2(expectedNonCash + diffNonCash);
            const actualTotal = round2(actualCash + actualNonCash);
            const diffTotal = round2(actualTotal - expectedTotal);

            const snapshot = {
                version: 1,
                generatedAt: new Date().toISOString(),
                period: {
                    startAt: period.start,
                    endAt: period.end
                },
                totals: {
                    expectedCashAmount: expectedCash,
                    expectedNonCashAmount: expectedNonCash,
                    expectedCardAmount: cardRevenue,
                    expectedTransferAmount: transferRevenue,
                    expectedTotalAmount: expectedTotal,
                    actualCashAmount: actualCash,
                    actualNonCashAmount: actualNonCash,
                    actualTotalAmount: actualTotal,
                    differenceCash: diffCash,
                    differenceNonCash: diffNonCash,
                    differenceTotal: diffTotal,
                    revenueTotal: round2(periodPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0)),
                    sessionsTotal: periodPayments.filter((p) => p.appointmentId != null).length,
                    payoutsTotal,
                    cashInTotal,
                    cashRefundsTotal,
                    cashRevenue,
                    cardRevenue,
                    transferRevenue
                },
                breakdown: {
                    payments: {
                        rows: periodPayments.map((p) => ({
                            id: p.id,
                            paidAt: p.paidAt,
                            method: String(p.method || 'cash').toLowerCase(),
                            amount: round2(p.amount || 0),
                            status: p.status,
                            memberName: p.member
                                ? `${p.member.firstName || ''} ${p.member.lastName || ''}`.trim()
                                : null
                        }))
                    },
                    payouts: {
                        rows: [
                            ...periodMovements
                                .filter((m) => String(m.type).toUpperCase() === 'OUT')
                                .map((m) => ({
                                    source: 'CASH_MOVEMENT_OUT',
                                    id: m.id,
                                    method: 'cash',
                                    amount: round2(m.amount || 0),
                                    createdAt: m.createdAt,
                                    note: m.notes || m.reason || null
                                })),
                            ...periodPayouts.map((p) => ({
                                source: 'TRAINER_PAYOUT',
                                id: p.id,
                                method: String(p.method || 'TRANSFER').toLowerCase(),
                                amount: round2(p.totalAmount || 0),
                                createdAt: p.paidAt,
                                note: p.note || null
                            }))
                        ]
                    },
                    cashIn: {
                        rows: periodMovements
                            .filter((m) => String(m.type).toUpperCase() === 'IN')
                            .map((m) => ({
                                source: 'CASH_MOVEMENT',
                                id: m.id,
                                amount: round2(m.amount || 0),
                                createdAt: m.createdAt,
                                note: m.notes || m.reason || null
                            }))
                    },
                    sales: {
                        rows: periodSales.map((s) => ({
                            id: s.id,
                            createdAt: s.createdAt,
                            method: String(s.paymentMethod || 'cash').toLowerCase(),
                            totalAmount: round2(s.totalAmount || 0)
                        }))
                    }
                }
            };

            const close = await tx.cashClosePeriod.create({
                data: {
                    periodType: 'MANUAL',
                    startAt: period.start,
                    endAt: period.end,
                    status: 'CLOSED',
                    snapshotJson: JSON.stringify(snapshot),
                    exportVersion: 1,
                    expectedCashAmount: expectedCash,
                    expectedNonCashAmount: expectedNonCash,
                    expectedCardAmount: cardRevenue,
                    expectedTransferAmount: transferRevenue,
                    expectedTotalAmount: expectedTotal,
                    actualCashAmount: actualCash,
                    actualNonCashAmount: actualNonCash,
                    actualTotalAmount: actualTotal,
                    differenceCash: diffCash,
                    differenceNonCash: diffNonCash,
                    differenceTotal: diffTotal,
                    revenueTotal: snapshot.totals.revenueTotal,
                    sessionsTotal: snapshot.totals.sessionsTotal,
                    payoutsTotal,
                    cashInTotal,
                    cashRefundsTotal,
                    cashRevenue,
                    cardRevenue,
                    transferRevenue,
                    notes: `${DEMO_TAG} closed period`,
                    createdBy: admin.id,
                    closedBy: admin.id,
                    createdAt: new Date(period.end.getTime() - 10 * 60 * 1000),
                    closedAt: period.end
                }
            });
            closedPeriods.push(close);
        }

        const openPeriodCount = await tx.cashClosePeriod.count({
            where: { status: 'OPEN' }
        });
        if (openPeriodCount === 0) {
            await tx.cashClosePeriod.create({
                data: {
                    periodType: 'MANUAL',
                    startAt: daysAgo(1, 0),
                    status: 'OPEN',
                    notes: `${DEMO_TAG} current open period`,
                    createdBy: admin.id
                }
            });
        }

        return {
            members: members.length,
            subscriptions: subscriptions.length,
            payments: payments.length,
            refunds: refunds.length,
            sales: sales.length,
            cashMovements: cashMovements.length,
            appointments: appointments.length,
            appointmentFinancialRecords: appointmentRecords.length,
            trainerEarnings: trainerEarnings.length,
            trainerPayouts: payouts.length,
            cashClosePeriodsClosed: closedPeriods.length
        };
    }, {
        timeout: 120000,
        maxWait: 10000
    });

    console.log('Demo export data seeded successfully.');
    console.log(summary);
}

main()
    .catch((error) => {
        console.error('Failed to seed demo export data.');
        console.error(error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
