import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
    X, Loader2, User, CreditCard, Calendar, Activity,
    Phone, Clock, Shield, DollarSign, RefreshCw, FileText, CheckCircle,
    Download, Copy, QrCode
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeCanvas } from 'qrcode.react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { formatDateTime } from '../utils/dateFormatter';
import { formatCurrency } from '../utils/numberFormatter';
import { useSettingsStore } from '../store';

const MemberDetailsModal = ({ isOpen, onClose, memberId }) => {
    const { t, i18n } = useTranslation();
    const { getSetting } = useSettingsStore();
    const [activeTab, setActiveTab] = useState('overview');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const qrRef = useRef(null);

    const currencyConf = {
        code: getSetting('currency_code', 'EGP'),
        symbol: getSetting('currency_symbol', 'EGP')
    };

    const isRTL = i18n.dir() === 'rtl';

    useEffect(() => {
        if (isOpen && memberId) {
            fetchDetails();
        } else {
            setData(null);
            setLoading(true);
            setActiveTab('overview');
        }
    }, [isOpen, memberId]);

    const fetchDetails = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.get(`/members/${memberId}/details`);
            if (res.data.success) {
                setData(res.data.data);
            } else {
                setError(res.data.message);
            }
        } catch (err) {
            console.error(err);
            setError(t('members.errorLoadingDetails') || 'Failed to load member details');
        } finally {
            setLoading(false);
        }
    };

    const downloadQR = () => {
        if (!qrRef.current) return;
        try {
            const canvas = qrRef.current.querySelector('canvas');
            const url = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.href = url;
            link.download = `member-${data.basicInfo.memberId}-qr.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast.success(t('common.downloadSuccess') || 'Downloaded successfully');
        } catch (err) {
            console.error('QR Download failed', err);
            toast.error('Failed to download QR');
        }
    };

    const copyMemberId = () => {
        if (data?.basicInfo?.memberId) {
            navigator.clipboard.writeText(data.basicInfo.memberId);
            toast.success(t('common.copied') || 'Copied to clipboard');
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    onClick={e => e.stopPropagation()}
                    className="bg-white dark:bg-dark-800 w-full max-w-5xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200 dark:border-dark-700"
                >
                    {/* Header */}
                    <div className="p-4 border-b border-gray-100 dark:border-dark-700 flex justify-between items-center bg-gray-50/50 dark:bg-dark-700/30">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${data?.basicInfo?.status === 'Active' ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-500'}`}>
                                <User className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
                                    {loading ? t('common.loading') : data?.basicInfo?.name}
                                </h2>
                                {!loading && data?.basicInfo && (
                                    <p className="text-xs text-gray-500 flex items-center gap-1">
                                        <Shield size={12} />
                                        {data.basicInfo.memberId}
                                        <span className={`mx-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${data.basicInfo.status === 'Active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                                            {t(`members.${data.basicInfo.status.toLowerCase()}`, data.basicInfo.status)}
                                        </span>
                                    </p>
                                )}
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-dark-600 rounded-lg transition-colors">
                            <X className="w-5 h-5 text-gray-500" />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="flex-1 overflow-y-auto min-h-[400px] bg-gray-50/30 dark:bg-dark-900/20">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center h-full min-h-[400px]">
                                <Loader2 className="w-10 h-10 animate-spin text-primary-500 mb-2" />
                                <p className="text-gray-500">{t('common.loading')}</p>
                            </div>
                        ) : error ? (
                            <div className="flex flex-col items-center justify-center h-full text-red-500 min-h-[400px]">
                                <Shield className="w-12 h-12 mb-2 opacity-50" />
                                <p>{error}</p>
                                <button onClick={fetchDetails} className="mt-4 btn-primary text-sm">
                                    {t('common.retry')}
                                </button>
                            </div>
                        ) : (
                            <div className="p-6">
                                {/* Top Layout: Info Cards + QR */}
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">

                                    {/* Left: Member Photo & Basic Info */}
                                    <div className="lg:col-span-2 flex flex-col sm:flex-row gap-6 bg-white dark:bg-dark-800 p-5 rounded-2xl border border-gray-100 dark:border-dark-700 shadow-sm">
                                        <div className="flex-shrink-0 flex justify-center sm:block">
                                            <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-gray-100 dark:bg-dark-700 overflow-hidden border-4 border-white dark:border-dark-600 shadow-md">
                                                {data.basicInfo.photo ? (
                                                    <img src={data.basicInfo.photo} className="w-full h-full object-cover" alt="Member" />
                                                ) : (
                                                    <User className="w-12 h-12 sm:w-16 sm:h-16 text-gray-400 m-auto mt-6 sm:mt-8" />
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <InfoBlock label={t('members.phone')} value={data.basicInfo.phone} icon={<Phone size={14} />} />
                                            <InfoBlock label={t('members.joinDate')} value={formatDateTime(data.basicInfo.joinDate, i18n.language).split(',')[0]} icon={<Calendar size={14} />} />

                                            <div className="col-span-1 sm:col-span-2 bg-primary-50 dark:bg-primary-900/10 p-4 rounded-xl border border-primary-100 dark:border-primary-900/20">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        <p className="text-xs text-primary-600 dark:text-primary-400 font-bold uppercase mb-1">
                                                            {t('memberDetails.currentPlan')}
                                                        </p>
                                                        <p className="font-bold text-gray-900 dark:text-white text-lg">
                                                            {data.subscriptionInfo ? data.subscriptionInfo.planName : t('memberDetails.noPlan')}
                                                        </p>
                                                    </div>
                                                    {data.subscriptionInfo && (
                                                        <div className="text-right">
                                                            <p className="text-2xl font-black text-primary-600 dark:text-primary-400">
                                                                {data.subscriptionInfo.remainingDays}
                                                            </p>
                                                            <p className="text-[10px] text-gray-500 uppercase font-bold">{t('memberDetails.daysLeft')}</p>
                                                        </div>
                                                    )}
                                                </div>

                                                {data.subscriptionInfo && (
                                                    <div className="w-full bg-white dark:bg-dark-700 h-2 rounded-full overflow-hidden mt-1 shadow-inner">
                                                        <div className="h-full bg-primary-500" style={{ width: '60%' }}></div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right: QR Code */}
                                    <div className="bg-white dark:bg-dark-800 p-5 rounded-2xl border border-gray-100 dark:border-dark-700 shadow-sm flex flex-col items-center justify-center text-center">
                                        <div ref={qrRef} className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm mb-3">
                                            <QRCodeCanvas
                                                value={data.basicInfo.memberId || 'UNKNOWN'}
                                                size={120}
                                                level="H"
                                                includeMargin={true}
                                            />
                                        </div>
                                        <p className="text-xs text-gray-400 mb-3 font-medium">
                                            {t('memberDetails.qrCodeFor')} {data.basicInfo.name}
                                        </p>
                                        <div className="flex gap-2 w-full">
                                            <button
                                                onClick={downloadQR}
                                                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 bg-gray-50 hover:bg-gray-100 dark:bg-dark-700 dark:hover:bg-dark-600 text-xs font-medium text-gray-700 dark:text-gray-300 rounded-lg transition-colors border border-gray-200 dark:border-dark-600"
                                            >
                                                <Download size={12} /> {t('memberDetails.downloadQR')}
                                            </button>
                                            <button
                                                onClick={copyMemberId}
                                                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 bg-gray-50 hover:bg-gray-100 dark:bg-dark-700 dark:hover:bg-dark-600 text-xs font-medium text-gray-700 dark:text-gray-300 rounded-lg transition-colors border border-gray-200 dark:border-dark-600"
                                            >
                                                <Copy size={12} /> {t('memberDetails.copyMemberId')}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Tabs Navigation */}
                                <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 shadow-sm overflow-hidden mb-6">
                                    <div className="flex overflow-x-auto">
                                        <TabButton id="overview" label={t('memberDetails.overview')} icon={<Activity size={16} />} active={activeTab} onClick={setActiveTab} />
                                        <TabButton id="financials" label={t('memberDetails.financials')} icon={<DollarSign size={16} />} active={activeTab} onClick={setActiveTab} />
                                        <TabButton id="history" label={t('memberDetails.attendance')} icon={<Clock size={16} />} active={activeTab} onClick={setActiveTab} />
                                        <TabButton id="refunds" label={t('memberDetails.refunds')} icon={<RefreshCw size={16} />} active={activeTab} onClick={setActiveTab} />
                                    </div>
                                </div>

                                {/* Tab Content */}
                                <div className="min-h-[300px]">
                                    {activeTab === 'overview' && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-4">
                                                <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 text-sm uppercase tracking-wider">
                                                    <CreditCard className="w-4 h-4 text-primary-500" />
                                                    {t('memberDetails.recentPayments')}
                                                </h3>
                                                {data.activity.payments.length > 0 ? (
                                                    <div className="space-y-3">
                                                        {data.activity.payments.map(p => (
                                                            <div key={p.id} className="flex justify-between items-center p-4 bg-white dark:bg-dark-800 rounded-xl border border-gray-100 dark:border-dark-700 shadow-sm hover:shadow-md transition-shadow">
                                                                <div>
                                                                    <p className="font-bold text-gray-900 dark:text-white text-sm">
                                                                        {formatCurrency(p.amount, i18n.language, currencyConf)}
                                                                    </p>
                                                                    <p className="text-xs text-gray-500">{formatDateTime(p.date, i18n.language)}</p>
                                                                </div>
                                                                <span className="text-[10px] font-bold uppercase px-2 py-1 bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-gray-300 rounded border border-gray-200 dark:border-dark-600">
                                                                    {t(`payments.${p.method.toLowerCase()}`, p.method)}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : <EmptyState message={t('memberDetails.noPayments')} />}
                                            </div>

                                            <div className="space-y-4">
                                                <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 text-sm uppercase tracking-wider">
                                                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                                                    {t('memberDetails.recentCheckins')}
                                                </h3>
                                                {data.activity.checkIns.length > 0 ? (
                                                    <div className="space-y-3">
                                                        {data.activity.checkIns.map(c => (
                                                            <div key={c.id} className="flex justify-between items-center p-4 bg-white dark:bg-dark-800 rounded-xl border border-gray-100 dark:border-dark-700 shadow-sm border-l-4 border-l-emerald-500">
                                                                <div>
                                                                    <p className="font-bold text-gray-900 dark:text-white text-sm">
                                                                        {t('nav.checkin')}
                                                                    </p>
                                                                    <p className="text-xs text-gray-500">{formatDateTime(c.date, i18n.language)}</p>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : <EmptyState message={t('memberDetails.noCheckins')} />}
                                            </div>
                                        </div>
                                    )}

                                    {activeTab === 'financials' && (
                                        <div className="space-y-6">
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                <StatCard label={t('memberDetails.totalPaid')} value={data.financialSummary.totalPaid} color="emerald" conf={currencyConf} />
                                                <StatCard label={t('memberDetails.totalRefunded')} value={data.financialSummary.totalRefunded} color="red" conf={currencyConf} />
                                                <StatCard label={t('memberDetails.netPaid')} value={data.financialSummary.net} color="blue" conf={currencyConf} />
                                                <StatCard label={t('memberDetails.totalDue')} value={data.financialSummary.totalDue} color="amber" conf={currencyConf} />
                                            </div>

                                            <div className="p-6 bg-white dark:bg-dark-800 rounded-xl border border-gray-100 dark:border-dark-700 shadow-sm">
                                                <h4 className="text-sm font-bold mb-6 text-gray-900 dark:text-white flex items-center gap-2">
                                                    <DollarSign className="w-4 h-4 text-gray-400" />
                                                    {t('memberDetails.paymentMethodsBreakdown')}
                                                </h4>
                                                <div className="flex flex-wrap gap-8 justify-center sm:justify-start">
                                                    <MethodStat label={t('payments.cash')} value={data.financialSummary.byMethod.cash} color="emerald" conf={currencyConf} />
                                                    <MethodStat label={t('payments.card')} value={data.financialSummary.byMethod.card} color="blue" conf={currencyConf} />
                                                    <MethodStat label={t('payments.transfer')} value={data.financialSummary.byMethod.transfer} color="purple" conf={currencyConf} />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {activeTab === 'refunds' && (
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center mb-2">
                                                <h3 className="font-bold text-gray-900 dark:text-white text-sm uppercase tracking-wider">{t('memberDetails.refundHistory')}</h3>
                                            </div>
                                            {data.activity.refunds.length > 0 ? (
                                                <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-100 dark:border-dark-700 overflow-hidden shadow-sm">
                                                    <table className="w-full text-sm text-left">
                                                        <thead className="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-dark-700/50 border-b border-gray-100 dark:border-dark-700">
                                                            <tr>
                                                                <th className={`p-4 font-semibold ${isRTL ? 'text-right' : 'text-left'}`}>{t('subscriptions.dates')}</th>
                                                                <th className={`p-4 font-semibold ${isRTL ? 'text-right' : 'text-left'}`}>{t('payments.amount')}</th>
                                                                <th className={`p-4 font-semibold ${isRTL ? 'text-right' : 'text-left'}`}>{t('payments.method')}</th>
                                                                <th className={`p-4 font-semibold ${isRTL ? 'text-right' : 'text-left'}`}>{t('subscriptions.plan')}</th>
                                                                <th className={`p-4 font-semibold ${isRTL ? 'text-right' : 'text-left'}`}>{t('common.by')}</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-100 dark:divide-dark-700">
                                                            {data.activity.refunds.map(r => (
                                                                <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-dark-700/50 transition-colors">
                                                                    <td className="p-4 text-gray-600 dark:text-gray-300">{formatDateTime(r.date, i18n.language)}</td>
                                                                    <td className="p-4 font-bold text-red-500">{formatCurrency(r.amount, 'en', currencyConf)}</td>
                                                                    <td className="p-4">
                                                                        <span className="text-xs font-semibold px-2 py-1 bg-gray-100 dark:bg-dark-700 rounded-md">
                                                                            {t(`payments.${r.method.toLowerCase()}`, r.method)}
                                                                        </span>
                                                                    </td>
                                                                    <td className="p-4 text-gray-600 dark:text-gray-300">{r.subscriptionName}</td>
                                                                    <td className="p-4 text-xs text-gray-400">{r.performedBy}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            ) : <EmptyState message={t('memberDetails.noRefunds')} />}
                                        </div>
                                    )}

                                    {activeTab === 'history' && (
                                        <div className="space-y-3">
                                            {data.activity.checkIns.map(c => (
                                                <div key={c.id} className="flex justify-between items-center p-4 bg-white dark:bg-dark-800 rounded-xl border border-gray-100 dark:border-dark-700 shadow-sm border-l-4 border-emerald-500">
                                                    <div>
                                                        <p className="font-bold text-gray-900 dark:text-white text-sm">{t('nav.checkin')}</p>
                                                        <p className="text-xs text-gray-500">{formatDateTime(c.date, i18n.language)}</p>
                                                    </div>
                                                    <span className="text-xs text-emerald-500 font-medium px-2 py-1 bg-emerald-50 dark:bg-emerald-900/20 rounded">
                                                        {t('checkin.success')}
                                                    </span>
                                                </div>
                                            ))}
                                            {data.activity.checkIns.length === 0 && <EmptyState message={t('memberDetails.noHistory')} />}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

// Sub-components
const InfoBlock = ({ label, value, icon, className = '' }) => (
    <div className="p-3 bg-gray-50 dark:bg-dark-700/30 rounded-xl border border-gray-100 dark:border-dark-700/50">
        <p className="text-xs text-gray-400 mb-1 flex items-center gap-1.5 font-medium uppercase tracking-wide">
            {icon} {label}
        </p>
        <p className={`font-semibold text-sm text-gray-900 dark:text-white truncate ${className}`}>{value}</p>
    </div>
);

const TabButton = ({ id, label, icon, active, onClick }) => (
    <button
        onClick={() => onClick(id)}
        className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${active === id
            ? 'border-primary-500 text-primary-600 dark:text-primary-400 bg-primary-50/50 dark:bg-primary-900/10'
            : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-700/50'
            }`}
    >
        {icon}
        {label}
    </button>
);

const StatCard = ({ label, value, color, conf }) => {
    const colors = {
        emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30',
        red: 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 border-red-100 dark:border-red-900/30',
        blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 border-blue-100 dark:border-blue-900/30',
        amber: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400 border-amber-100 dark:border-amber-900/30',
    };
    return (
        <div className={`p-4 rounded-xl border ${colors[color]}`}>
            <p className="text-xs font-bold uppercase opacity-70 mb-1">{label}</p>
            <p className="text-xl font-black">{formatCurrency(value, 'en', conf)}</p>
        </div>
    );
};

const MethodStat = ({ label, value, color, conf }) => {
    const colors = {
        emerald: 'text-emerald-500',
        blue: 'text-blue-500',
        purple: 'text-purple-500'
    };
    return (
        <div className="text-center min-w-[80px]">
            <p className="text-xs text-gray-400 font-bold uppercase mb-1">{label}</p>
            <p className={`font-black text-lg ${colors[color]}`}>{formatCurrency(value, 'en', conf)}</p>
        </div>
    );
};

const EmptyState = ({ message }) => (
    <div className="flex flex-col items-center justify-center py-12 text-gray-400 bg-white dark:bg-dark-800 rounded-xl border border-dashed border-gray-200 dark:border-dark-700">
        <FileText className="w-12 h-12 mb-3 opacity-20" />
        <p className="font-medium">{message}</p>
    </div>
);

export default MemberDetailsModal;
