/**
 * ============================================
 * ENHANCED ANALYTICS SERVICE
 * ============================================
 * 
 * Real AI-powered insights based on actual data.
 * Provides peak hours, churn risk, revenue forecasts.
 * 
 * Author: Omar Habib Software
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const analyticsService = {
    /**
     * Calculate peak hours from check-in data
     */
    getPeakHours: async () => {
        try {
            const checkIns = await prisma.checkIn.findMany({
                where: {
                    checkInTime: {
                        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
                    }
                },
                select: { checkInTime: true }
            });

            // Group by hour
            const hourCounts = {};
            for (let i = 0; i < 24; i++) hourCounts[i] = 0;

            checkIns.forEach(c => {
                const hour = new Date(c.checkInTime).getHours();
                hourCounts[hour]++;
            });

            // Find peak hours
            const sorted = Object.entries(hourCounts)
                .sort((a, b) => b[1] - a[1]);

            const peakHour = parseInt(sorted[0][0]);
            const quietHour = parseInt(sorted[sorted.length - 1][0]);

            return {
                peakHour,
                peakHourFormatted: `${peakHour}:00 - ${peakHour + 1}:00`,
                quietHour,
                quietHourFormatted: `${quietHour}:00 - ${quietHour + 1}:00`,
                distribution: hourCounts
            };
        } catch (error) {
            console.error('Peak hours calculation failed:', error);
            return null;
        }
    },

    /**
     * Identify best performing plans
     */
    getBestPlans: async () => {
        try {
            const subscriptions = await prisma.subscription.findMany({
                where: {
                    createdAt: {
                        gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) // Last 90 days
                    }
                },
                include: { plan: true }
            });

            // Count by plan
            const planCounts = {};
            const planRevenue = {};

            subscriptions.forEach(sub => {
                const planName = sub.plan?.name || 'Unknown';
                planCounts[planName] = (planCounts[planName] || 0) + 1;
                planRevenue[planName] = (planRevenue[planName] || 0) + (sub.paidAmount || 0);
            });

            const sorted = Object.entries(planCounts)
                .map(([name, count]) => ({
                    name,
                    count,
                    revenue: planRevenue[name] || 0
                }))
                .sort((a, b) => b.count - a.count);

            return {
                bestPlan: sorted[0] || null,
                allPlans: sorted.slice(0, 5)
            };
        } catch (error) {
            console.error('Best plans calculation failed:', error);
            return null;
        }
    },

    /**
     * Calculate churn risk
     * Members who haven't visited recently
     */
    getChurnRisk: async () => {
        try {
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

            // Get members with active subscriptions
            const activeMembers = await prisma.member.findMany({
                where: {
                    status: 'active',
                    subscriptions: {
                        some: {
                            status: 'active'
                        }
                    }
                },
                include: {
                    checkIns: {
                        orderBy: { checkInTime: 'desc' },
                        take: 1
                    }
                }
            });

            // Find those who haven't checked in recently
            const atRisk = activeMembers.filter(member => {
                const lastCheckIn = member.checkIns[0]?.checkInTime;
                if (!lastCheckIn) return true; // Never checked in
                return new Date(lastCheckIn) < thirtyDaysAgo;
            });

            return {
                totalActive: activeMembers.length,
                atRiskCount: atRisk.length,
                riskPercentage: activeMembers.length > 0
                    ? Math.round((atRisk.length / activeMembers.length) * 100)
                    : 0,
                atRiskMembers: atRisk.slice(0, 10).map(m => ({
                    id: m.id,
                    name: `${m.firstName} ${m.lastName}`,
                    lastVisit: m.checkIns[0]?.checkInTime || null
                }))
            };
        } catch (error) {
            console.error('Churn risk calculation failed:', error);
            return null;
        }
    },

    /**
     * Revenue forecast for next 30 days
     */
    getRevenueForecast: async () => {
        try {
            // Get payments from last 90 days
            const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

            const payments = await prisma.payment.findMany({
                where: {
                    paidAt: { gte: ninetyDaysAgo }
                },
                orderBy: { paidAt: 'asc' }
            });

            // Calculate daily average
            const totalRevenue = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
            const days = 90;
            const dailyAverage = totalRevenue / days;

            // Get upcoming subscription renewals
            const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

            const expiringSubscriptions = await prisma.subscription.findMany({
                where: {
                    status: 'active',
                    endDate: {
                        gte: new Date(),
                        lte: thirtyDaysFromNow
                    }
                },
                include: { plan: true }
            });

            const potentialRenewals = expiringSubscriptions.reduce(
                (sum, sub) => sum + (sub.plan?.price || 0),
                0
            );

            // Simple forecast: daily average * 30 + 60% of potential renewals
            const forecast = (dailyAverage * 30) + (potentialRenewals * 0.6);

            return {
                last90DaysRevenue: Math.round(totalRevenue),
                dailyAverage: Math.round(dailyAverage),
                expiringCount: expiringSubscriptions.length,
                potentialRenewals: Math.round(potentialRenewals),
                forecast30Days: Math.round(forecast),
                confidence: 'medium'
            };
        } catch (error) {
            console.error('Revenue forecast failed:', error);
            return null;
        }
    },

    /**
     * Generate natural language insights
     */
    generateInsights: async (language = 'en') => {
        const insights = [];

        // Peak hours
        const peakData = await analyticsService.getPeakHours();
        if (peakData) {
            if (language === 'ar') {
                insights.push({
                    type: 'peak_hours',
                    icon: '⏰',
                    title: 'أوقات الذروة',
                    message: `أكثر الأوقات ازدحاماً: ${peakData.peakHourFormatted}. أهدأ الأوقات: ${peakData.quietHourFormatted}`
                });
            } else {
                insights.push({
                    type: 'peak_hours',
                    icon: '⏰',
                    title: 'Peak Hours',
                    message: `Busiest time: ${peakData.peakHourFormatted}. Quietest: ${peakData.quietHourFormatted}`
                });
            }
        }

        // Best plans
        const planData = await analyticsService.getBestPlans();
        if (planData?.bestPlan) {
            if (language === 'ar') {
                insights.push({
                    type: 'best_plan',
                    icon: '⭐',
                    title: 'أفضل خطة',
                    message: `"${planData.bestPlan.name}" هي الأكثر شعبية (${planData.bestPlan.count} اشتراك)`
                });
            } else {
                insights.push({
                    type: 'best_plan',
                    icon: '⭐',
                    title: 'Top Plan',
                    message: `"${planData.bestPlan.name}" is most popular (${planData.bestPlan.count} subscriptions)`
                });
            }
        }

        // Churn risk
        const churnData = await analyticsService.getChurnRisk();
        if (churnData && churnData.atRiskCount > 0) {
            if (language === 'ar') {
                insights.push({
                    type: 'churn_risk',
                    icon: '⚠️',
                    title: 'تنبيه المتابعة',
                    message: `${churnData.atRiskCount} عضو لم يزوروا منذ 30 يوم (${churnData.riskPercentage}%)`
                });
            } else {
                insights.push({
                    type: 'churn_risk',
                    icon: '⚠️',
                    title: 'Follow-up Alert',
                    message: `${churnData.atRiskCount} members haven't visited in 30 days (${churnData.riskPercentage}%)`
                });
            }
        }

        // Revenue forecast
        const revenueData = await analyticsService.getRevenueForecast();
        if (revenueData) {
            if (language === 'ar') {
                insights.push({
                    type: 'revenue',
                    icon: '💰',
                    title: 'توقع الإيرادات',
                    message: `متوقع ${revenueData.forecast30Days.toLocaleString()} خلال 30 يوم. ${revenueData.expiringCount} اشتراك سينتهي قريباً.`
                });
            } else {
                insights.push({
                    type: 'revenue',
                    icon: '💰',
                    title: 'Revenue Forecast',
                    message: `Expected ${revenueData.forecast30Days.toLocaleString()} in next 30 days. ${revenueData.expiringCount} subscriptions expiring.`
                });
            }
        }

        return insights;
    }
};

module.exports = analyticsService;
