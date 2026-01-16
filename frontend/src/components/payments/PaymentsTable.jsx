import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, Trash2, ChevronLeft, ChevronRight, ArrowUpDown, Download, CheckCircle, XCircle } from 'lucide-react';

const PaymentsTable = ({ payments, loading, onViewReceipt, onDelete }) => {
    const { t } = useTranslation();
    const [currentPage, setCurrentPage] = useState(1);
    const [filter, setFilter] = useState('');
    const itemsPerPage = 8;

    // Safe filtering
    const safePayments = Array.isArray(payments) ? payments : [];
    const filtered = safePayments.filter(p =>
        (p.member?.firstName || '').toLowerCase().includes(filter.toLowerCase()) ||
        (p.member?.lastName || '').toLowerCase().includes(filter.toLowerCase()) ||
        (p.id || '').toString().includes(filter)
    );

    // Pagination
    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    if (loading) return (
        <div className="p-8 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-500">{t('common.loading')}</p>
        </div>
    );

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
            {/* Toolbar */}
            <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row justify-between gap-4 bg-gray-50/50 dark:bg-gray-800/50">
                <input
                    className="flex-1 max-w-sm px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
                    placeholder={t('common.search') + "..."}
                    value={filter}
                    onChange={e => { setFilter(e.target.value); setCurrentPage(1); }}
                />
                <div className="flex gap-2">
                    <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border rounded-lg hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600 shadow-sm transition-all md:hidden lg:flex">
                        <Download size={16} /> {t('common.export')}
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm" dir="rtl">
                    <thead className="bg-gray-50 dark:bg-gray-900 border-b dark:border-gray-700">
                        <tr>
                            <th className="px-6 py-4 font-semibold text-gray-600 dark:text-gray-300 text-right">{t('nav.members')}</th>
                            <th className="px-6 py-4 font-semibold text-gray-600 dark:text-gray-300 cursor-pointer group flex items-center gap-1 text-right">
                                {t('payments.amount')} <ArrowUpDown size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                            </th>
                            <th className="px-6 py-4 font-semibold text-gray-600 dark:text-gray-300 text-right">{t('common.date')}</th>
                            <th className="px-6 py-4 font-semibold text-gray-600 dark:text-gray-300 text-right">{t('payments.method')}</th>
                            <th className="px-6 py-4 font-semibold text-gray-600 dark:text-gray-300 text-right">{t('payInOut.type')}</th>
                            <th className="px-6 py-4 font-semibold text-gray-600 dark:text-gray-300 text-left">{t('common.actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {paginated.map(p => (
                            <tr key={p.id} className="hover:bg-blue-50/50 dark:hover:bg-gray-700/50 transition-colors group">
                                <td className="px-6 py-4 text-right">
                                    <div className="flex flex-col">
                                        <span className="font-bold text-gray-900 dark:text-white">{p.member?.firstName} {p.member?.lastName}</span>
                                        <span className="text-xs text-gray-500">#{p.member?.memberId || p.member?.id?.toString().slice(-4)}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <span className="font-bold text-green-600 bg-green-50 dark:bg-green-900/30 dark:text-green-400 px-2 py-1 rounded text-xs">
                                        {p.amount?.toLocaleString()} EGP
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-gray-600 dark:text-gray-400 text-right">
                                    {new Date(p.date || p.createdAt).toLocaleDateString('ar-EG')}
                                    <div className="text-xs opacity-75">{new Date(p.date || p.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center gap-2 capitalize text-gray-700 dark:text-gray-300">
                                        {p.method === 'cash' ? <span className="w-2 h-2 rounded-full bg-green-500"></span> : <span className="w-2 h-2 rounded-full bg-blue-500"></span>}
                                        {t(`payments.${p.method}`) || p.method}
                                    </div>
                                </td>
                                <td className="px-6 py-4 capitalize text-gray-600 dark:text-gray-400 text-right">
                                    {p.type || t('payments.title')}
                                </td>
                                <td className="px-6 py-4 text-left">
                                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => onViewReceipt(p)}
                                            className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                                            title={t('common.view')}
                                        >
                                            <Eye size={18} />
                                        </button>
                                        <button
                                            onClick={() => onDelete(p.id)}
                                            className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                                            title={t('common.delete')}
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {paginated.length === 0 && (
                            <tr>
                                <td colSpan="6" className="px-6 py-12 text-center text-gray-400">
                                    <div className="flex flex-col items-center">
                                        <XCircle size={48} className="mb-2 opacity-20" />
                                        <p>{t('payments.noPayments')}</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Footer */}
            {totalPages > 1 && (
                <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50" dir="rtl">
                    <span className="text-sm text-gray-500">
                        {t('common.page')} {currentPage} {t('common.of')} {totalPages}
                    </span>
                    <div className="flex gap-2">
                        <button
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            className="p-2 border rounded hover:bg-white disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-700 transition"
                        >
                            <ChevronRight size={16} /> {/* Flipped for RTL */}
                        </button>
                        <button
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            className="p-2 border rounded hover:bg-white disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-700 transition"
                        >
                            <ChevronLeft size={16} /> {/* Flipped for RTL */}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
export default PaymentsTable;
