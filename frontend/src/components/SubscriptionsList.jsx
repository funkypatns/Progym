import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, User, CreditCard, AlertCircle } from 'lucide-react';

const SubscriptionsList = ({ subscriptions, onCancel, onRenew }) => {
    const { t } = useTranslation();
    const [search, setSearch] = useState('');

    const filtered = subscriptions.filter(s =>
        (s.member?.firstName + ' ' + s.member?.lastName).toLowerCase().includes(search.toLowerCase())
    );

    const getStatusColor = (status) => {
        switch (status) {
            case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
            case 'expired': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
            case 'frozen': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
            default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border dark:border-gray-700 overflow-hidden" dir="rtl">
            {/* Toolbar */}
            <div className="p-4 border-b dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
                <input
                    className="w-full max-w-md px-4 py-2 border rounded-lg text-sm dark:bg-gray-900 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition"
                    placeholder={t('common.search') + "..."}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6 bg-gray-50 dark:bg-gray-900/50 min-h-[400px]">
                {filtered.map(sub => (
                    <div key={sub.id} className="border rounded-xl p-5 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 dark:border-gray-700 bg-white dark:bg-gray-800 relative group flex flex-col justify-between">
                        <div>
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="font-bold text-lg dark:text-white group-hover:text-blue-600 transition-colors">{sub.member?.firstName} {sub.member?.lastName}</h3>
                                    <div className="text-sm text-gray-500 font-medium">{sub.plan?.name}</div>
                                </div>
                                <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${getStatusColor(sub.status)}`}>
                                    {t(`subscriptions.${sub.status}`) || sub.status}
                                </span>
                            </div>

                            <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400 mb-6">
                                <div className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                                    <Calendar size={16} className="text-blue-500" />
                                    <span>{new Date(sub.startDate).toLocaleDateString('ar-EG')} — {new Date(sub.endDate).toLocaleDateString('ar-EG')}</span>
                                </div>
                                <div className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                                    <CreditCard size={16} className="text-green-500" />
                                    <span className="font-bold text-gray-700 dark:text-gray-300">{(sub.price || sub.plan?.price)} EGP</span>
                                </div>
                                {sub.daysRemaining < 7 && sub.status === 'active' && (
                                    <div className="text-orange-600 dark:text-orange-400 flex items-center gap-2 font-bold bg-orange-50 dark:bg-orange-900/20 p-2 rounded-lg animate-pulse">
                                        <AlertCircle size={16} /> {t('subscriptions.daysRemaining')}: {sub.daysRemaining}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex gap-2 pt-4 border-t dark:border-gray-700">
                            {sub.status === 'active' && (
                                <button
                                    onClick={() => onCancel(sub.id)}
                                    className="flex-1 px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 text-sm font-bold transition-colors"
                                >
                                    {t('subscriptions.cancel')}
                                </button>
                            )}
                            {(sub.status === 'expired' || sub.daysRemaining < 30) && (
                                <button
                                    onClick={() => onRenew(sub)}
                                    className="flex-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 text-sm font-bold transition-colors"
                                >
                                    {t('subscriptions.renew')}
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
            {filtered.length === 0 && (
                <div className="p-12 text-center text-gray-500 bg-white dark:bg-gray-800">
                    <p className="text-lg">{t('common.noData')}</p>
                </div>
            )}
        </div>
    );
};
export default SubscriptionsList;
