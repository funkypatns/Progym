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
        const val = t(key);
        if (!val || val === key || val.startsWith('reports.') || val.startsWith('nav.') || val.startsWith('cashClosing.') || val.startsWith('payments.')) {
            return fallback;
        }
        return val;
    };

    // Full list of reports matching App.jsx routes
    const reportLinks = [
        { path: '/reports', label: safeT('reports.summary', isRTL ? 'Ù…Ù„Ø®Øµ' : 'Summary'), icon: PieChart, end: true },
        { path: '/reports/product-sales', label: safeT('nav.products', isRTL ? 'Ù…Ø¨ÙŠØ¹Ø§Øª Ø§Ù„Ù…Ù†ØªØ¬Ø§Øª' : 'Product Sales'), icon: BarChart2 },
        { path: '/reports/revenue', label: safeT('reports.revenueReport', isRTL ? 'ØªÙ‚Ø±ÙŠØ± Ø§Ù„Ø¥ÙŠØ±Ø§Ø¯Ø§Øª' : 'Revenue Report'), icon: Banknote },
        { path: '/reports/members', label: safeT('reports.memberReport', isRTL ? 'ØªÙ‚Ø±ÙŠØ± Ø§Ù„Ø£Ø¹Ø¶Ø§Ø¡' : 'Member Report'), icon: Users },
        { path: '/reports/subscriptions', label: safeT('reports.subscriptionReport', isRTL ? 'ØªÙ‚Ø±ÙŠØ± Ø§Ù„Ø§Ø´ØªØ±Ø§ÙƒØ§Øª' : 'Subscription Report'), icon: CreditCard },
        { path: '/reports/attendance', label: safeT('reports.attendanceReport', isRTL ? 'ØªÙ‚Ø±ÙŠØ± Ø§Ù„Ø­Ø¶ÙˆØ±' : 'Attendance Report'), icon: Calendar },
        { path: '/reports/payments-summary', label: safeT('reports.paymentsSummary', isRTL ? 'Ù…Ù„Ø®Øµ Ø§Ù„Ù…Ø¯ÙÙˆØ¹Ø§Øª' : 'Payments Summary'), icon: Receipt },
        { path: '/reports/trainers', label: safeT('reports.trainersReport', isRTL ? 'تقرير المدربين' : 'Trainer Report'), icon: Wallet },

        // Complex Reports
        { path: '/reports/employee-collections', label: safeT('reports.employeeCollections', isRTL ? 'ØªØ­ØµÙŠÙ„Ø§Øª Ø§Ù„Ù…ÙˆØ¸ÙÙŠÙ†' : 'Employee Collections'), icon: Users },
        { path: '/reports/shifts', label: safeT('reports.shifts', isRTL ? 'Ø§Ù„ÙˆØ±Ø¯ÙŠØ§Øª' : 'Shifts'), icon: Clock },
        { path: '/reports/receipts', label: safeT('reports.receiptsLookup', isRTL ? 'Ø§Ù„Ø¨Ø­Ø« Ø¹Ù† Ø§Ù„Ø¥ÙŠØµØ§Ù„Ø§Øª' : 'Receipt Lookup'), icon: FileText },
        { path: '/reports/pay-in-out', label: safeT('payInOut.title', isRTL ? 'ØµØ§Ø¯Ø± / ÙˆØ§Ø±Ø¯' : 'Pay In/Out'), icon: ArrowRightLeft },
        { path: '/reports/refunds', label: safeT('reports.fields.refunds.title', isRTL ? 'Ø§Ù„Ø§Ø³ØªØ±Ø¬Ø§Ø¹' : 'Refunds'), icon: ArrowRightLeft },
        { path: '/reports/cancellations', label: safeT('reports.cancellations.title', isRTL ? 'Ø§Ù„Ø¥Ù„ØºØ§Ø¡Ø§Øª' : 'Cancellations'), icon: XOctagon },

        // Admin Features
        { path: '/reports/outstanding', label: safeT('reports.outstanding', isRTL ? 'Ø§Ù„Ø£Ø±ØµØ¯Ø© Ø§Ù„Ù…Ø³ØªØ­Ù‚Ø©' : 'Outstanding Balance'), icon: AlertCircle },
        { path: '/reports/cash-closing', label: safeT('cashClosing.title', isRTL ? 'Ø¥ØºÙ„Ø§Ù‚ Ø§Ù„ÙˆØ±Ø¯ÙŠØ©' : 'Cash Closing'), icon: Banknote },
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
                    {reportLinks.map((link) => (
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
                            <span className="truncate">{link.label}</span>
                        </NavLink>
                    ))}
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
