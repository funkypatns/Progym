
import {
    Users,
    DollarSign,
    Calendar,
    CreditCard,
    Receipt,
    FileSpreadsheet,
    AlertCircle,
    UserCheck,
    XCircle,
    Banknote,
    TrendingDown,
    ArrowLeftRight
} from 'lucide-react';

export const REPORTS_REGISTRY = [
    {
        id: 'product-sales',
        path: '/reports/product-sales',
        titleEn: 'Product Sales',
        titleAr: 'مبيعات المنتجات',
        icon: Banknote,
        color: 'from-green-500 to-emerald-600',
        descriptionEn: 'View detailed product sales with line items',
        descriptionAr: 'عرض تفاصيل مبيعات المنتجات',
        endpoint: '/sales/detailed' // Special one, usually
    },
    {
        id: 'subscriptions',
        path: '/reports/subscriptions',
        titleEn: 'Subscriptions',
        titleAr: 'الاشتراكات',
        icon: CreditCard,
        color: 'from-blue-500 to-indigo-600',
        descriptionEn: 'Active and expired subscription analysis',
        descriptionAr: 'تحليل الاشتراكات النشطة والمنتهية',
        endpoint: '/subscriptions'
    },
    {
        id: 'revenue',
        path: '/reports/revenue',
        titleEn: 'Revenue Report',
        titleAr: 'تقرير الإيرادات',
        icon: DollarSign,
        color: 'from-yellow-500 to-orange-600',
        descriptionEn: 'Revenue breakdown by source',
        descriptionAr: 'تفصيل الإيرادات حسب المصدر',
        endpoint: '/revenue'
    },
    {
        id: 'payments-summary',
        path: '/reports/payments-summary',
        titleEn: 'Payments Summary',
        titleAr: 'ملخص المدفوعات',
        icon: Receipt,
        color: 'from-purple-500 to-violet-600',
        descriptionEn: 'Payment method breakdown',
        descriptionAr: 'تفصيل طرق الدفع',
        endpoint: '/payments/summary'
    },
    {
        id: 'receipts',
        path: '/reports/receipts',
        titleEn: 'Receipt Lookup',
        titleAr: 'سجل الإيصالات',
        icon: FileSpreadsheet,
        color: 'from-cyan-500 to-teal-600',
        descriptionEn: 'Search and lookup receipts',
        descriptionAr: 'بحث وعرض الإيصالات',
        endpoint: null // Custom page
    },
    {
        id: 'employee-collections',
        path: '/reports/employee-collections',
        titleEn: 'Employee Collections',
        titleAr: 'تحصيل الموظفين',
        icon: UserCheck,
        color: 'from-pink-500 to-rose-600',
        descriptionEn: 'Collections by employee',
        descriptionAr: 'التحصيلات حسب الموظف',
        endpoint: '/revenue' // With params
    },
    {
        id: 'members',
        path: '/reports/members',
        titleEn: 'Member Report',
        titleAr: 'تقرير الأعضاء',
        icon: Users,
        color: 'from-slate-500 to-gray-600',
        descriptionEn: 'New and active members',
        descriptionAr: 'الأعضاء الجدد والنشطين',
        endpoint: '/members'
    },
    {
        id: 'attendance',
        path: '/reports/attendance',
        titleEn: 'Attendance Report',
        titleAr: 'تقرير الحضور',
        icon: Calendar,
        color: 'from-amber-500 to-yellow-600',
        descriptionEn: 'Check-in/out history',
        descriptionAr: 'سجل الدخول والخروج',
        endpoint: '/attendance'
    },
    {
        id: 'cancellations',
        path: '/reports/cancellations',
        titleEn: 'Cancellations',
        titleAr: 'إلغاءات الشهر',
        icon: XCircle,
        color: 'from-red-500 to-rose-600',
        descriptionEn: 'Monthly cancellation log',
        descriptionAr: 'سجل الإلغاءات الشهري',
        endpoint: '/cancellations'
    },
    {
        id: 'refunds',
        path: '/reports/refunds',
        titleEn: 'Refunds Log',
        titleAr: 'سجل الاسترداد',
        icon: AlertCircle,
        color: 'from-orange-500 to-red-600',
        descriptionEn: 'Refund transactions',
        descriptionAr: 'عمليات الاسترداد',
        endpoint: '/refunds'
    },
    {
        id: 'shifts',
        path: '/reports/shifts',
        titleEn: 'Shift Reports',
        titleAr: 'تقارير الورديات',
        icon: Banknote,
        color: 'from-indigo-500 to-purple-600',
        descriptionEn: 'Shift closing summaries',
        descriptionAr: 'ملخصات إغلاق الورديات',
        endpoint: null // Custom
    },
    {
        id: 'pay-in-out',
        path: '/reports/pay-in-out',
        titleEn: 'Pay In / Out',
        titleAr: 'حركة النقدية',
        icon: ArrowLeftRight,
        color: 'from-teal-500 to-cyan-600',
        descriptionEn: 'Cash drawer movements',
        descriptionAr: 'حركات درج النقدية',
        endpoint: null // Custom
    },
    {
        id: 'outstanding',
        path: '/reports/outstanding',
        titleEn: 'Outstanding Payments',
        titleAr: 'المديونيات',
        icon: AlertCircle,
        color: 'from-red-600 to-red-800',
        descriptionEn: 'Outstanding payments (Admin)',
        descriptionAr: 'المدفوعات المستحقة (مشرف)',
        endpoint: '/payment-remaining',
        adminOnly: true
    },
    {
        id: 'cash-closing',
        path: '/reports/cash-closing',
        titleEn: 'Cash Closing',
        titleAr: 'إغلاق النقدية',
        icon: TrendingDown,
        color: 'from-gray-600 to-gray-800',
        descriptionEn: 'Daily cash closing (Admin)',
        descriptionAr: 'الإغلاق اليومي للنقدية',
        endpoint: null, // Custom
        adminOnly: true
    }
];

export const getReportById = (id) => REPORTS_REGISTRY.find(r => r.id === id);
