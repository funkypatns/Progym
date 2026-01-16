const calculateNetRevenue = async (prisma, startDate, endDate, employeeId = null) => {
    const wherePayment = {
        paidAt: {
            gte: startDate,
            lte: endDate
        },
        status: { in: ['completed', 'refunded', 'Partial Refund'] }
    };

    const whereRefund = {
        createdAt: {
            gte: startDate,
            lte: endDate
        }
    };

    if (employeeId) {
        wherePayment.createdBy = employeeId;
        whereRefund.createdBy = employeeId;
        // Note: Refunds created by employee might differ from payments collected by them.
        // User asked for "Total Paid Invoices ... MINUS Total Refunds".
        // Depending on context (Monthly Closing vs Dashboard), employee filter might apply differently.
        // For Dashboard, usually no employee filter.
        // For Monthly Closing, it groups by employee.
    }

    const payments = await prisma.payment.aggregate({
        where: wherePayment,
        _sum: { amount: true },
        _count: true
    });

    const refunds = await prisma.refund.aggregate({
        where: whereRefund,
        _sum: { amount: true },
        _count: true
    });

    const grossRevenue = payments._sum.amount || 0;
    const totalRefunds = refunds._sum.amount || 0;
    const netRevenue = grossRevenue - totalRefunds;

    return {
        grossRevenue,
        totalRefunds,
        netRevenue,
        paymentCount: payments._count,
        refundCount: refunds._count
    };
};

module.exports = { calculateNetRevenue };
