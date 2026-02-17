import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarClock, CheckCircle2, Download, History, Wallet, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { formatCurrency } from '../utils/numberFormatter';
import { useSettingsStore } from '../store';

const EMPTY_PREVIEW = {
    openPeriod: null,
    range: { startAt: null, endAt: null },
    expected: {
        expectedCashAmount: 0,
        expectedNonCashAmount: 0,
        expectedTotalAmount: 0,
        expectedCardAmount: 0,
        expectedTransferAmount: 0,
        payoutsTotal: 0,
        cashInTotal: 0,
        cashRefundsTotal: 0
    },
    summary: {
        totalSessions: 0,
        totalRevenue: 0,
        expectedCash: 0,
        expectedNonCash: 0
    }
};

const toLocalInputValue = (date) => {
    if (!date) return '';
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (value) => String(value).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const parseContentDispositionFilename = (contentDispositionValue, fallbackName) => {
    if (!contentDispositionValue || typeof contentDispositionValue !== 'string') return fallbackName;
    const match = contentDispositionValue.match(/filename="(.+?)"/i);
    return match?.[1] || fallbackName;
};

const CashClosingModal = ({ isOpen, onClose, onSuccess, onViewHistory }) => {
    const { t, i18n } = useTranslation();
    const { getSetting } = useSettingsStore();
    const isRTL = i18n.language === 'ar';

    const currencyConf = useMemo(() => ({
        code: getSetting('currency_code', 'USD'),
        symbol: getSetting('currency_symbol', '$')
    }), [getSetting]);

    const [preview, setPreview] = useState(EMPTY_PREVIEW);
    const [isLoadingPreview, setIsLoadingPreview] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [successData, setSuccessData] = useState(null);
    const [formData, setFormData] = useState({
        periodType: 'manual',
        endAt: '',
        declaredCashAmount: '',
        declaredNonCashAmount: '',
        notes: ''
    });

    const resetState = () => {
        setPreview(EMPTY_PREVIEW);
        setIsLoadingPreview(false);
        setIsSubmitting(false);
        setIsDownloading(false);
        setSuccessData(null);
        setFormData({
            periodType: 'manual',
            endAt: toLocalInputValue(new Date()),
            declaredCashAmount: '',
            declaredNonCashAmount: '',
            notes: ''
        });
    };

    useEffect(() => {
        if (!isOpen) return;

        let isMounted = true;
        const loadPreview = async () => {
            setIsLoadingPreview(true);
            try {
                const response = await api.get('/cash-closings/period/current');
                if (!isMounted) return;
                const data = response?.data?.data || EMPTY_PREVIEW;
                setPreview({
                    openPeriod: data.openPeriod || null,
                    range: data.range || { startAt: null, endAt: null },
                    expected: { ...EMPTY_PREVIEW.expected, ...(data.expected || {}) },
                    summary: { ...EMPTY_PREVIEW.summary, ...(data.summary || {}) }
                });
                setFormData((prev) => ({
                    ...prev,
                    endAt: prev.endAt || toLocalInputValue(new Date())
                }));
            } catch (error) {
                console.error('Failed to load cash close preview', error);
                setPreview(EMPTY_PREVIEW);
                toast.error(t('cashClosing.loadPreviewFailed', 'Failed to load close preview'));
            } finally {
                if (isMounted) setIsLoadingPreview(false);
            }
        };

        resetState();
        loadPreview();
        return () => {
            isMounted = false;
        };
    }, [isOpen, t]);

    const expectedCash = Number(preview.expected.expectedCashAmount) || 0;
    const expectedNonCash = Number(preview.expected.expectedNonCashAmount) || 0;
    const expectedTotal = Number(preview.expected.expectedTotalAmount) || 0;
    const declaredCash = Number(formData.declaredCashAmount || 0);
    const declaredNonCash = Number(formData.declaredNonCashAmount || 0);
    const declaredTotal = declaredCash + declaredNonCash;
    const cashDiff = declaredCash - expectedCash;

    const closeModal = () => {
        resetState();
        onClose?.();
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (formData.declaredCashAmount === '') {
            toast.error(t('cashClosing.enterDeclaredCash', 'Please enter declared cash amount'));
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                periodType: formData.periodType,
                declaredCashAmount: Number(formData.declaredCashAmount || 0),
                declaredNonCashAmount: Number(formData.declaredNonCashAmount || 0),
                endAt: formData.endAt ? new Date(formData.endAt).toISOString() : undefined,
                notes: formData.notes?.trim() || undefined
            };
            const response = await api.post('/cash-closings', payload);
            const data = response?.data?.data || {};
            setSuccessData(data);
            onSuccess?.(data);
            toast.success(t('cashClosing.closingCreated', 'Closing created successfully'));
        } catch (error) {
            console.error('Failed to create cash close', error);
            toast.error(error?.response?.data?.message || t('cashClosing.closingFailed', 'Failed to create closing'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDownloadExport = async (format) => {
        if (!successData?.closeId) return;
        setIsDownloading(true);
        try {
            const response = await api.get(`/cash-closings/${successData.closeId}/export?format=${format}`, {
                responseType: 'blob'
            });
            const fallbackName = `cash-close-${successData.closeId}.${format}`;
            const filename = parseContentDispositionFilename(response.headers?.['content-disposition'], fallbackName);
            const blob = new Blob([response.data], { type: response.headers?.['content-type'] || 'application/octet-stream' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Failed to download cash close export', error);
            toast.error(t('cashClosing.exportFailed', 'Failed to download export'));
        } finally {
            setIsDownloading(false);
        }
    };

    const differenceColor = cashDiff > 0.01
        ? 'text-amber-400'
        : cashDiff < -0.01
            ? 'text-red-400'
            : 'text-emerald-400';

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.96, y: 16 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96, y: 16 }}
                    className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
                    dir={isRTL ? 'rtl' : 'ltr'}
                >
                    <div className="sticky top-0 z-10 flex items-center justify-between p-5 border-b border-slate-700 bg-slate-900/95 backdrop-blur">
                        <div>
                            <h2 className="text-xl font-bold text-white">{t('cashClosing.createClosing', 'Create Closing')}</h2>
                            <p className="text-xs text-slate-400 mt-1">
                                {t('cashClosing.openPeriodStartsAt', 'Open period starts at')}:{' '}
                                {preview.range?.startAt ? new Date(preview.range.startAt).toLocaleString(i18n.language) : '--'}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={closeModal}
                            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {successData ? (
                        <div className="p-6 space-y-6">
                            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5">
                                <div className="flex items-center gap-3">
                                    <CheckCircle2 className="text-emerald-400" size={24} />
                                    <div>
                                        <h3 className="text-lg font-semibold text-white">
                                            {t('cashClosing.successTitle', 'Cash close created')}
                                        </h3>
                                        <p className="text-sm text-slate-300">
                                            {t('cashClosing.successMessage', 'Snapshot saved and a new open period has started.')}
                                        </p>
                                    </div>
                                </div>
                                <p className="mt-3 text-xs text-slate-300">
                                    {t('cashClosing.closeId', 'Close ID')}: <span className="font-semibold text-white">#{successData.closeId}</span>
                                </p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => handleDownloadExport('csv')}
                                    disabled={isDownloading}
                                    className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-semibold transition-colors"
                                >
                                    <Download size={16} />
                                    {t('cashClosing.downloadExport', 'تحميل Export')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleDownloadExport('json')}
                                    disabled={isDownloading}
                                    className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-slate-600 hover:bg-slate-800 disabled:opacity-60 text-slate-200 font-semibold transition-colors"
                                >
                                    <Download size={16} />
                                    {t('cashClosing.downloadJson', 'Download JSON')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        onViewHistory?.();
                                        closeModal();
                                    }}
                                    className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-slate-600 hover:bg-slate-800 text-slate-200 font-semibold transition-colors"
                                >
                                    <History size={16} />
                                    {t('cashClosing.viewCloseHistory', 'عرض التقفيلات السابقة')}
                                </button>
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-slate-600 hover:bg-slate-800 text-slate-200 font-semibold transition-colors"
                                >
                                    {t('common.close', 'Close')}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="p-6 space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
                                    <p className="text-xs text-slate-400">{t('cashClosing.expectedCash', 'Expected Cash')}</p>
                                    <p className="text-lg font-bold text-emerald-400 mt-1">
                                        {formatCurrency(expectedCash, i18n.language, currencyConf)}
                                    </p>
                                </div>
                                <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
                                    <p className="text-xs text-slate-400">{t('cashClosing.expectedNonCash', 'Expected Non-Cash')}</p>
                                    <p className="text-lg font-bold text-blue-400 mt-1">
                                        {formatCurrency(expectedNonCash, i18n.language, currencyConf)}
                                    </p>
                                </div>
                                <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
                                    <p className="text-xs text-slate-400">{t('cashClosing.expectedTotal', 'Total Expected')}</p>
                                    <p className="text-lg font-bold text-white mt-1">
                                        {formatCurrency(expectedTotal, i18n.language, currencyConf)}
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-3">
                                    <p className="text-[11px] text-slate-400">{t('cashClosing.preview.cashIn', 'Cash In')}</p>
                                    <p className="text-sm font-semibold text-emerald-300 mt-1">
                                        {formatCurrency(preview.expected.cashInTotal || 0, i18n.language, currencyConf)}
                                    </p>
                                </div>
                                <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-3">
                                    <p className="text-[11px] text-slate-400">{t('cashClosing.preview.payouts', 'Payouts')}</p>
                                    <p className="text-sm font-semibold text-amber-300 mt-1">
                                        {formatCurrency(preview.expected.payoutsTotal || 0, i18n.language, currencyConf)}
                                    </p>
                                </div>
                                <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-3">
                                    <p className="text-[11px] text-slate-400">{t('cashClosing.financialSnapshot.totalSessions', 'Total Sessions')}</p>
                                    <p className="text-sm font-semibold text-slate-200 mt-1">{preview.summary.totalSessions || 0}</p>
                                </div>
                                <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-3">
                                    <p className="text-[11px] text-slate-400">{t('cashClosing.financialSnapshot.totalRevenue', 'Total Revenue')}</p>
                                    <p className="text-sm font-semibold text-slate-200 mt-1">
                                        {formatCurrency(preview.summary.totalRevenue || 0, i18n.language, currencyConf)}
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-slate-400 block mb-2">{t('cashClosing.declaredCash', 'Declared Cash')}</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={formData.declaredCashAmount}
                                        onChange={(event) => setFormData((prev) => ({ ...prev, declaredCashAmount: event.target.value }))}
                                        className="w-full h-11 rounded-lg border border-slate-700 bg-slate-950 px-3 text-white focus:outline-none focus:border-indigo-500"
                                        placeholder="0.00"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400 block mb-2">{t('cashClosing.declaredNonCash', 'Declared Non-Cash')}</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={formData.declaredNonCashAmount}
                                        onChange={(event) => setFormData((prev) => ({ ...prev, declaredNonCashAmount: event.target.value }))}
                                        className="w-full h-11 rounded-lg border border-slate-700 bg-slate-950 px-3 text-white focus:outline-none focus:border-indigo-500"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs text-slate-400 block mb-2">{t('cashClosing.closeAt', 'Close At')}</label>
                                <div className="relative">
                                    <CalendarClock className={`absolute top-1/2 -translate-y-1/2 text-slate-500 ${isRTL ? 'right-3' : 'left-3'}`} size={16} />
                                    <input
                                        type="datetime-local"
                                        value={formData.endAt}
                                        onChange={(event) => setFormData((prev) => ({ ...prev, endAt: event.target.value }))}
                                        className={`w-full h-11 rounded-lg border border-slate-700 bg-slate-950 text-white focus:outline-none focus:border-indigo-500 ${isRTL ? 'pr-10 pl-3' : 'pl-10 pr-3'}`}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs text-slate-400 block mb-2">{t('cashClosing.notes', 'Notes')}</label>
                                <textarea
                                    value={formData.notes}
                                    onChange={(event) => setFormData((prev) => ({ ...prev, notes: event.target.value }))}
                                    className="w-full min-h-[84px] rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:outline-none focus:border-indigo-500 resize-y"
                                    placeholder={t('cashClosing.notesPlaceholder', 'Optional notes')}
                                />
                            </div>

                            <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-4">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                        <Wallet size={16} className="text-slate-400" />
                                        <span className="text-sm text-slate-300">{t('cashClosing.differenceCash', 'Cash Difference')}</span>
                                    </div>
                                    <span className={`text-lg font-bold ${differenceColor}`}>
                                        {formatCurrency(cashDiff, i18n.language, currencyConf)}
                                    </span>
                                </div>
                                <div className="mt-2 text-xs text-slate-400 flex items-center justify-between">
                                    <span>{t('cashClosing.declaredTotal', 'Total Declared')}</span>
                                    <span className="text-slate-200 font-semibold">
                                        {formatCurrency(declaredTotal, i18n.language, currencyConf)}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center justify-between gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800 transition-colors"
                                >
                                    {t('common.cancel', 'Cancel')}
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting || isLoadingPreview}
                                    className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-semibold transition-colors"
                                >
                                    {isSubmitting
                                        ? t('common.loading', 'Loading...')
                                        : t('cashClosing.confirmCreate', 'إنشاء تقفيل')}
                                </button>
                            </div>
                        </form>
                    )}
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default CashClosingModal;
