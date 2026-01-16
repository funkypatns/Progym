export const analyticsService = {
    generateInsights: async (stats, locale = 'en') => {
        // Simulate "AI Processing" time
        await new Promise(resolve => setTimeout(resolve, 1500));

        const insights = [];

        // 1. Revenue Analysis
        if (stats.revenue.thisMonth > stats.revenue.lastMonth) { // Assuming we had lastMonth data, simplified here
            insights.push({
                type: 'positive',
                title: locale === 'ar' ? 'نمو الإيرادات' : 'Revenue Growth',
                message: locale === 'ar'
                    ? `الإيرادات هذا الشهر ممتازة! زادت بنسبة تقريبية عن المعدل المعتاد.`
                    : `Revenue is performing well this month! It has increased compared to the average.`
            });
        }

        // 2. Active Members Analysis
        if (stats.subscriptions.active > 50) {
            insights.push({
                type: 'neutral',
                title: locale === 'ar' ? 'نشاط الأعضاء' : 'Member Activity',
                message: locale === 'ar'
                    ? `لديك أكثر من ٥٠ عضو نشط حالياً. قد تحتاج إلى التفكير في توسيع ساعات العمل.`
                    : `You have over 50 active members. Consider expanding operating hours if it gets crowded.`
            });
        } else if (stats.subscriptions.active < 10) {
            insights.push({
                type: 'negative',
                title: locale === 'ar' ? 'تنبيه انخفاض الأعضاء' : 'Low Membership Alert',
                message: locale === 'ar'
                    ? `عدد الأعضاء النشطين منخفض. حاول إطلاق عروض ترويجية لجذب مشتركين جدد.`
                    : `Active membership is low. Try launching a promotional campaign to attract new subscribers.`
            });
        }

        // 3. Expirations
        if (stats.subscriptions.expiring > 5) {
            insights.push({
                type: 'warning',
                title: locale === 'ar' ? 'تجديدات قادمة' : 'Upcoming Renewals',
                message: locale === 'ar'
                    ? `هناك عدد كبير من الاشتراكات ستنتهي قريباً. تواصل مع الأعضاء لتذكيرهم بالتجديد.`
                    : `A significant number of subscriptions are expiring soon. Reach out to members for renewal reminders.`
            });
        }

        // 4. Check-ins (Attendance)
        if (stats.checkIns.today > 20) {
            insights.push({
                type: 'positive',
                title: locale === 'ar' ? 'إقبال عالي' : 'High Attendance',
                message: locale === 'ar'
                    ? `النادي مزدحم اليوم! تأكد من توافر المدربين والمشروبات.`
                    : `The gym is busy today! Ensure trainers and amenities are available.`
            });
        }

        // Fallback if no specific insights
        if (insights.length === 0) {
            insights.push({
                type: 'neutral',
                title: locale === 'ar' ? 'نظرة عامة' : 'General Overview',
                message: locale === 'ar'
                    ? `الأداء مستقر حالياً. لا توجد أحداث غير عادية تتطلب انتباهك الفوري.`
                    : `Performance is stable. No unusual events requiring immediate attention.`
            });
        }

        return insights;
    }
};
