/**
 * ============================================
 * REMINDER SERVICE
 * ============================================
 * 
 * Core logic for payment reminder system
 */

const { PrismaClient } = require('@prisma/client');
const { calculateSubscriptionFinancials, determinePaymentStatus } = require('../utils/financialCalculations');
const prisma = new PrismaClient();

/**
 * Message templates for reminders
 */
const MESSAGE_TEMPLATES = {
    ar: {
        DUE_SOON: 'عزيزي {memberName}، يرجى تسديد المبلغ المتبقي {amount} ج.م قبل تاريخ {dueDate}. شكراً لتعاملكم مع {gymName}.',
        OVERDUE: 'عزيزي {memberName}، لديك مبلغ متأخر {amount} ج.م. يرجى التسديد في أقرب وقت. {gymName}.',
        END_OF_MONTH: 'عزيزي {memberName}، نذكرك بتسديد المبلغ المتبقي {amount} ج.م قبل نهاية الشهر. {gymName}.',
        INSTALLMENT: 'عزيزي {memberName}، موعد القسط التالي بمبلغ {amount} ج.م. يرجى التسديد. {gymName}.'
    },
    en: {
        DUE_SOON: 'Dear {memberName}, please pay the remaining amount of {amount} EGP before {dueDate}. Thank you for choosing {gymName}.',
        OVERDUE: 'Dear {memberName}, you have an overdue amount of {amount} EGP. Please pay at your earliest convenience. {gymName}.',
        END_OF_MONTH: 'Dear {memberName}, reminder to pay the remaining amount of {amount} EGP before end of month. {gymName}.',
        INSTALLMENT: 'Dear {memberName}, your next installment of {amount} EGP is due. Please make the payment. {gymName}.'
    }
};

/**
 * Generate message from template
 */
function generateMessage(template, data, language = 'ar') {
    const templates = MESSAGE_TEMPLATES[language] || MESSAGE_TEMPLATES.ar;
    let message = templates[template] || templates.DUE_SOON;

    Object.keys(data).forEach(key => {
        message = message.replace(new RegExp(`{${key}}`, 'g'), data[key] || '');
    });

    return message;
}

/**
 * Get members with remaining payments
 */
async function getMembersWithRemainingPayments() {
    const subscriptions = await prisma.subscription.findMany({
        where: {
            status: { in: ['active', 'expired'] }
        },
        include: {
            member: {
                select: {
                    id: true,
                    memberId: true,
                    firstName: true,
                    lastName: true,
                    phone: true,
                    email: true
                }
            },
            plan: {
                select: {
                    id: true,
                    name: true,
                    price: true,
                    durationType: true
                }
            },
            payments: {
                where: {
                    status: { in: ['completed', 'refunded', 'Partial Refund'] }
                },
                select: {
                    amount: true,
                    refundedTotal: true,
                    paidAt: true
                }
            }
        }
    });

    const results = [];

    for (const sub of subscriptions) {
        // Use shared financial calculation utility
        const financials = calculateSubscriptionFinancials(sub, sub.payments);

        if (financials.remaining > 0) {
            const subVisitsCount = await prisma.checkIn.count({
                where: {
                    memberId: sub.member.id,
                    checkInTime: {
                        gte: sub.startDate,
                        lte: sub.endDate
                    }
                }
            });

            const allTimeVisitsCount = await prisma.checkIn.count({
                where: { memberId: sub.member.id }
            });

            const lastPayment = sub.payments.length > 0
                ? sub.payments.sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt))[0]
                : null;

            const status = determinePaymentStatus(financials.remaining, financials.netPaid);

            results.push({
                memberId: sub.member.id,
                memberCode: sub.member.memberId,
                memberName: `${sub.member.firstName} ${sub.member.lastName}`,
                memberPhone: sub.member.phone,
                memberEmail: sub.member.email,
                subscriptionId: sub.id,
                planName: sub.plan?.name,
                durationType: sub.plan?.durationType || 'days',
                startDate: sub.startDate,
                total: financials.subscriptionPrice,
                paid: financials.netPaid,
                remaining: financials.remaining,
                endDate: sub.endDate,
                lastPaymentDate: lastPayment?.paidAt || null,
                status,
                visits: {
                    subscription: subVisitsCount,
                    allTime: allTimeVisitsCount
                }
            });
        }
    }

    return results;
}

/**
 * Detect due soon members (within X days of end date)
 */
async function detectDueSoonMembers(daysBeforeDue = 3) {
    const members = await getMembersWithRemainingPayments();
    const now = new Date();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + daysBeforeDue);

    return members.filter(m => {
        const endDate = new Date(m.endDate);
        return endDate > now && endDate <= cutoffDate;
    });
}

/**
 * Detect overdue members (past end date)
 */
async function detectOverdueMembers() {
    const members = await getMembersWithRemainingPayments();
    const now = new Date();

    return members.filter(m => {
        const endDate = new Date(m.endDate);
        return endDate < now;
    });
}

/**
 * Detect end of month dues
 */
async function detectEndOfMonthDues() {
    const members = await getMembersWithRemainingPayments();
    const now = new Date();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const daysUntilEnd = Math.ceil((endOfMonth - now) / (1000 * 60 * 60 * 24));

    // Only return if within 3 days of end of month
    if (daysUntilEnd > 3) return [];

    return members.filter(m => m.durationType === 'months');
}

/**
 * Check if reminder already exists for this member/type/date
 */
async function hasExistingReminder(memberId, subscriptionId, type) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const existing = await prisma.reminder.findFirst({
        where: {
            memberId,
            subscriptionId,
            type,
            status: { in: ['PENDING', 'SENT'] },
            scheduledAt: {
                gte: today,
                lt: tomorrow
            }
        }
    });

    return !!existing;
}

/**
 * Create a new reminder
 */
async function createReminder(memberData, type, gymName = 'النادي') {
    // Check for duplicates
    const exists = await hasExistingReminder(memberData.memberId, memberData.subscriptionId, type);
    if (exists) {
        return null;
    }

    const message = generateMessage(type, {
        memberName: memberData.memberName,
        amount: memberData.remaining.toFixed(2),
        dueDate: new Date(memberData.endDate).toLocaleDateString('ar-EG'),
        gymName
    }, 'ar');

    const reminder = await prisma.reminder.create({
        data: {
            memberId: memberData.memberId,
            subscriptionId: memberData.subscriptionId,
            type,
            channel: 'IN_APP',
            scheduledAt: new Date(),
            status: 'PENDING',
            message
        }
    });

    return reminder;
}

/**
 * Create staff notifications for a reminder
 */
async function createStaffNotifications(reminder, priority = 'NORMAL') {
    // Get all active staff/admin users
    const users = await prisma.user.findMany({
        where: {
            isActive: true
        },
        select: { id: true }
    });

    const member = await prisma.member.findUnique({
        where: { id: reminder.memberId },
        select: {
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
            memberId: true
        }
    });

    const subscription = reminder.subscriptionId
        ? await prisma.subscription.findUnique({
            where: { id: reminder.subscriptionId },
            include: {
                plan: { select: { name: true, price: true } },
                payments: {
                    where: { status: { in: ['completed', 'refunded', 'Partial Refund'] } },
                    select: { amount: true, refundedTotal: true }
                }
            }
        })
        : null;

    const memberName = member ? `${member.firstName} ${member.lastName}` : 'Member';
    const memberContact = [
        member?.phone ? `Phone: ${member.phone}` : null,
        member?.email ? `Email: ${member.email}` : null
    ].filter(Boolean).join(' | ') || 'Contact: N/A';

    let amountsText = 'Amounts: N/A';
    let planText = 'Plan: N/A';
    let visitsText = 'Visits: N/A';

    if (subscription) {
        const financials = calculateSubscriptionFinancials(subscription, subscription.payments);
        const totalAmount = financials.subscriptionPrice || 0;
        const paidAmount = financials.netPaid || 0;
        const remainingAmount = financials.remaining || 0;
        const planName = subscription.plan?.name || 'Plan';
        const endDate = subscription.endDate
            ? new Date(subscription.endDate).toLocaleDateString('en-US')
            : '-';

        amountsText = `Total: ${totalAmount.toFixed(2)} | Paid: ${paidAmount.toFixed(2)} | Remaining: ${remainingAmount.toFixed(2)}`;
        planText = `Plan: ${planName} | Ends: ${endDate}`;

        const subVisits = await prisma.checkIn.count({
            where: {
                memberId: reminder.memberId,
                checkInTime: {
                    gte: subscription.startDate,
                    lte: subscription.endDate
                }
            }
        });
        const allVisits = await prisma.checkIn.count({
            where: { memberId: reminder.memberId }
        });
        visitsText = `Visits: ${subVisits} (sub) / ${allVisits} (all)`;
    }

    const typeLabels = {
        DUE_SOON: 'Payment Due Soon',
        OVERDUE: 'Payment Overdue',
        END_OF_MONTH: 'End of Month',
        INSTALLMENT: 'Installment Due'
    };

    const notifications = await prisma.staffNotification.createMany({
        data: users.map(u => ({
            userId: u.id,
            reminderId: reminder.id,
            type: reminder.type === 'OVERDUE' ? 'PAYMENT_OVERDUE' : 'PAYMENT_DUE',
            title: typeLabels[reminder.type] || 'Payment Alert',
            message: `${memberName} (${member?.memberId || 'ID N/A'}) | ${memberContact} | ${amountsText} | ${planText} | ${visitsText}`,
            priority
        }))
    });

    return notifications;
}

/**
 * Run the daily reminder job
 */
async function runDailyReminderJob(gymName = 'النادي', dueSoonDays = 3) {
    console.log('[REMINDER JOB] Starting daily reminder generation...');

    const results = {
        dueSoon: 0,
        overdue: 0,
        endOfMonth: 0,
        notifications: 0,
        errors: []
    };

    try {
        // 1. Due Soon reminders
        const dueSoonMembers = await detectDueSoonMembers(dueSoonDays);
        for (const m of dueSoonMembers) {
            try {
                const reminder = await createReminder(m, 'DUE_SOON', gymName);
                if (reminder) {
                    results.dueSoon++;
                    await createStaffNotifications(reminder, 'NORMAL');
                    results.notifications++;
                }
            } catch (e) {
                results.errors.push(`DUE_SOON for ${m.memberId}: ${e.message}`);
            }
        }

        // 2. Overdue reminders
        const overdueMembers = await detectOverdueMembers();
        for (const m of overdueMembers) {
            try {
                const reminder = await createReminder(m, 'OVERDUE', gymName);
                if (reminder) {
                    results.overdue++;
                    await createStaffNotifications(reminder, 'HIGH');
                    results.notifications++;
                }
            } catch (e) {
                results.errors.push(`OVERDUE for ${m.memberId}: ${e.message}`);
            }
        }

        // 3. End of month reminders (for monthly subs)
        const endOfMonthMembers = await detectEndOfMonthDues();
        for (const m of endOfMonthMembers) {
            try {
                const reminder = await createReminder(m, 'END_OF_MONTH', gymName);
                if (reminder) {
                    results.endOfMonth++;
                    await createStaffNotifications(reminder, 'NORMAL');
                    results.notifications++;
                }
            } catch (e) {
                results.errors.push(`END_OF_MONTH for ${m.memberId}: ${e.message}`);
            }
        }

        console.log('[REMINDER JOB] Completed:', results);
        return results;

    } catch (error) {
        console.error('[REMINDER JOB] Fatal error:', error);
        throw error;
    }
}

/**
 * Get reminder dashboard stats
 */
async function getDashboardStats(dueSoonDays = 3) {
    const members = await getMembersWithRemainingPayments();
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dueSoonDate = new Date(today);
    dueSoonDate.setDate(dueSoonDate.getDate() + dueSoonDays);

    const dueToday = members.filter(m => {
        const end = new Date(m.endDate);
        return end >= today && end < tomorrow;
    });

    const dueSoon = members.filter(m => {
        const end = new Date(m.endDate);
        return end >= tomorrow && end <= dueSoonDate;
    });

    const overdue = members.filter(m => {
        const end = new Date(m.endDate);
        return end < today;
    });

    return {
        dueToday: {
            count: dueToday.length,
            total: dueToday.reduce((sum, m) => sum + m.remaining, 0)
        },
        dueSoon: {
            count: dueSoon.length,
            total: dueSoon.reduce((sum, m) => sum + m.remaining, 0)
        },
        overdue: {
            count: overdue.length,
            total: overdue.reduce((sum, m) => sum + m.remaining, 0)
        },
        all: members
    };
}

module.exports = {
    getMembersWithRemainingPayments,
    detectDueSoonMembers,
    detectOverdueMembers,
    detectEndOfMonthDues,
    createReminder,
    createStaffNotifications,
    runDailyReminderJob,
    getDashboardStats,
    generateMessage,
    MESSAGE_TEMPLATES
};

