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
    Clock
} from 'lucide-react';

const ReportsLayout = () => {
    const { t } = useTranslation();
    const location = useLocation();

    // Full list of reports matching App.jsx routes
    const reportLinks = [
        { path: '/reports', label: t('reports.summary') || 'Dashboard', icon: PieChart, end: true },
        { path: '/reports/product-sales', label: t('nav.products') || 'Product Sales', icon: BarChart2 },
        { path: '/reports/revenue', label: t('reports.revenueReport'), icon: Banknote },
        { path: '/reports/members', label: t('reports.memberReport'), icon: Users },
        { path: '/reports/subscriptions', label: t('reports.subscriptionReport'), icon: CreditCard },
        { path: '/reports/attendance', label: t('reports.attendanceReport'), icon: Calendar },
        { path: '/reports/payments-summary', label: t('reports.fields.paymentCount') || 'Payments', icon: Receipt },

        // Complex Reports
        { path: '/reports/employee-collections', label: t('cashClosing.allEmployees') || 'Employee Collections', icon: Users },
        { path: '/reports/shifts', label: t('cashClosing.periodType.shift') || 'Shifts', icon: Clock },
        { path: '/reports/receipts', label: t('payments.receipt') || 'Receipt Lookup', icon: FileText },
        { path: '/reports/pay-in-out', label: t('payInOut.title'), icon: ArrowRightLeft },
        { path: '/reports/refunds', label: t('reports.fields.refunds.title'), icon: ArrowRightLeft },
        { path: '/reports/cancellations', label: 'Cancellations', icon: XOctagon },

        // Admin Features
        { path: '/reports/outstanding', label: 'Outstanding Balance', icon: AlertCircle },
        { path: '/reports/cash-closing', label: t('cashClosing.title'), icon: Banknote },
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
