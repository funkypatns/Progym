import React from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    PieChart,
    BarChart2,
    Users,
    CreditCard,
    Calendar,
    Receipt,
    ArrowRightLeft,
    FileText,
    AlertCircle,
    XOctagon,
    Banknote,
    Clock,
    Wallet
} from 'lucide-react';

const ReportsLayout = () => {
    const { t, i18n } = useTranslation();
    const location = useLocation();
    const isRTL = i18n.dir() === 'rtl';

    // Robust Safe Translation Helper
    const safeT = (key, fallback) => {
        const val = t(key, { defaultValue: fallback });
        if (!val || val === key) return fallback;
        return val;
    };

    // Full list of reports matching App.jsx routes
    const reportLinks = [
        { path: '/reports', label: safeT('reports.summary', isRTL ? 'ملخص' : 'Summary'), icon: PieChart, end: true },
        { path: '/reports/product-sales', label: safeT('nav.products', isRTL ? 'مبيعات المنتجات' : 'Product Sales'), icon: BarChart2 },
        { path: '/reports/revenue', label: safeT('reports.revenueReport', isRTL ? 'تقرير الإيرادات' : 'Revenue Report'), icon: Banknote },
        { path: '/reports/members', label: safeT('reports.memberReport', isRTL ? 'تقرير الأعضاء' : 'Member Report'), icon: Users },
        { path: '/reports/subscriptions', label: safeT('reports.subscriptionReport', isRTL ? 'تقرير الاشتراكات' : 'Subscription Report'), icon: CreditCard },
        { path: '/reports/attendance', label: safeT('reports.attendanceReport', isRTL ? 'تقرير الحضور' : 'Attendance Report'), icon: Calendar },
        { path: '/reports/payments-summary', label: safeT('reports.paymentsSummary', isRTL ? 'ملخص المدفوعات' : 'Payments Summary'), icon: Receipt },
        { path: '/reports/trainers', label: safeT('reports.trainersReport', isRTL ? 'تقرير المدربين' : 'Trainer Report'), icon: Wallet },
        { path: '/reports/pending-completion', label: safeT('reports.pendingCompletion', isRTL ? 'جلسات تحتاج إكمال' : 'Pending Completion'), icon: Clock },

        // Complex Reports
        { path: '/reports/employee-collections', label: safeT('reports.employeeCollections', isRTL ? 'تحصيلات الموظفين' : 'Employee Collections'), icon: Users },
        { path: '/reports/shifts', label: safeT('reports.shifts.title', isRTL ? 'الورديات' : 'Shifts'), icon: Clock },
        { path: '/reports/receipts', label: safeT('reports.receiptsLookup', isRTL ? 'البحث عن الإيصالات' : 'Receipt Lookup'), icon: FileText },
        { path: '/reports/pay-in-out', label: safeT('payInOut.title', isRTL ? 'صادر / وارد' : 'Pay In/Out'), icon: ArrowRightLeft },
        { path: '/reports/refunds', label: safeT('reports.fields.refunds.title', isRTL ? 'الاسترجاع' : 'Refunds'), icon: ArrowRightLeft },
        { path: '/reports/cancellations', label: safeT('reports.cancellations.title', isRTL ? 'الإلغاءات' : 'Cancellations'), icon: XOctagon },
        { path: '/reports/gym-income-sessions', label: safeT('reports.gymIncomeSessions', isRTL ? 'دخل الجيم - الجلسات' : 'Gym Income - Sessions'), icon: Banknote },

        // Admin Features
        { path: '/reports/outstanding', label: safeT('reports.outstanding', isRTL ? 'الأرصدة المستحقة' : 'Outstanding Balance'), icon: AlertCircle },
        { path: '/reports/cash-closing', label: safeT('cashClosing.title', isRTL ? 'إغلاق الوردية' : 'Cash Closing'), icon: Banknote },
    ];

    return (
        <div className="flex w-full h-full min-h-full bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            {/* Reports Sidebar */}
            <div className="w-64 bg-gray-50/50 dark:bg-gray-900/50 border-r dark:border-gray-700 flex flex-col overflow-y-auto">
                <div className="p-4 border-b dark:border-gray-700">
                    <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <FileText className="w-5 h-5 text-blue-500" />
                        {t('reports.title')}
                    </h3>
                </div>
                <nav className="flex-1 p-2 space-y-1">
                    {reportLinks.map((link) => {
                        const labelText = typeof link.label === 'function' ? link.label() : link.label;
                        return (
                        <NavLink
                            key={link.path}
                            to={link.path}
                            end={link.end}
                            className={({ isActive }) => `
                                flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                                ${isActive
                                    ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-sm border border-gray-100 dark:border-gray-700'
                                    : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 dark:text-gray-400'}
                            `}
                        >
                            <link.icon size={16} />
                            <span className="truncate">{labelText}</span>
                        </NavLink>
                    );})}
                </nav>
            </div>

            {/* Report Content */}
            <div className="flex-1 overflow-auto bg-white dark:bg-gray-800 p-6 relative">
                <Outlet />
            </div>
        </div>
    );
};

export default ReportsLayout;
