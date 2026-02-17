import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, History, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { formatCurrency } from '../utils/numberFormatter';
import { formatDateTime as formatDateTimeLabel } from '../utils/dateFormatter';
import { useSettingsStore } from '../store';

const fallbackData = {
    closings: [],
    rows: [],
    summary: {
        totalExpectedCash: 0,
        totalExpectedNonCash: 0,
        totalExpected: 0,
        totalDeclaredCash: 0,
        totalDeclaredNonCash: 0,
        totalDeclared: 0,
        totalDifferenceCash: 0,
        totalDifferenceNonCash: 0,
        totalDifference: 0
    }
};

const parseContentDispositionFilename = (contentDispositionValue, fallbackName) => {
    if (!contentDispositionValue || typeof contentDispositionValue !== 'string') return fallbackName;
    const match = contentDispositionValue.match(/filename="(.+?)"/i);
    return match?.[1] || fallbackName;
};

const getCashClosingErrorMessage = (error, t, fallbackKey = 'cashClosing.historyLoadFailed', fallbackText = 'Failed to load close history') => {
    const errorCode = error?.response?.data?.errorCode;
    if (errorCode === 'DB_SCHEMA_MISMATCH') {
        return t('cashClosing.errors.schemaMismatch', 'قاعدة البيانات غير محدثة. يرجى التواصل مع الدعم.');
    }
    if (errorCode === 'DB_ERROR') {
        return t('cashClosing.errors.dbError', 'حدث خطأ بقاعدة البيانات أثناء التقفيل');
    }
    return error?.response?.data?.message || t(fallbackKey, fallbackText);
};

const CashClosingReport = ({ data, refreshKey = 0 }) => {
    const { t, i18n } = useTranslation();
    const { getSetting } = useSettingsStore();

    const [serverData, setServerData] = useState(fallbackData);
    const [isLoading, setIsLoading] = useState(false);
    const [isDownloadingId, setIsDownloadingId] = useState(null);

    const currencyConf = useMemo(() => ({
        code: getSetting('currency_code', 'USD'),
        symbol: getSetting('currency_symbol', '$')
    }), [getSetting]);

    useEffect(() => {
        if (data) return;
        let isMounted = true;
        const loadHistory = async () => {
            setIsLoading(true);
            try {
                const response = await api.get('/cash-closings/history?page=1&limit=50');
                if (!isMounted) return;
                setServerData(response?.data?.data || fallbackData);
            } catch (error) {
                console.error('Failed to load cash close history', error);
                if (isMounted) {
                    setServerData(fallbackData);
                    toast.error(getCashClosingErrorMessage(
                        error,
                        t,
                        'cashClosing.historyLoadFailed',
                        'Failed to load close history'
                    ));
                }
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        loadHistory();
        return () => {
            isMounted = false;
        };
    }, [data, refreshKey, t]);

    const effectiveData = data || serverData || fallbackData;
    const closings = effectiveData.closings || effectiveData.rows || [];
    const summary = effectiveData.summary || fallbackData.summary;

    const handleExport = async (closeId, format = 'xlsx') => {
        if (!closeId) return;
        setIsDownloadingId(closeId);
        try {
            const response = await api.get(`/cash-closings/${closeId}/export?format=${format}`, {
                responseType: 'blob'
            });
            const fallbackName = `cash-close-${closeId}.${format}`;
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
            console.error('Failed to export close', error);
            toast.error(t('cashClosing.exportFailed', 'Failed to download export'));
        } finally {
            setIsDownloadingId(null);
        }
    };

    return (
        <div className="p-4 md:p-6 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-4">
                    <p className="text-xs text-slate-400">{t('cashClosing.totalClosings', 'Total Closings')}</p>
                    <p className="text-xl font-bold text-white mt-1">{closings.length}</p>
                </div>
                <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-4">
                    <p className="text-xs text-slate-400">{t('cashClosing.expectedTotal', 'Total Expected')}</p>
                    <p className="text-xl font-bold text-indigo-300 mt-1">
                        {formatCurrency(summary.totalExpected || 0, i18n.language, currencyConf)}
                    </p>
                </div>
                <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-4">
                    <p className="text-xs text-slate-400">{t('cashClosing.differenceTotal', 'Total Difference')}</p>
                    <p className={`text-xl font-bold mt-1 ${(summary.totalDifference || 0) >= 0 ? 'text-amber-300' : 'text-red-300'}`}>
                        {formatCurrency(summary.totalDifference || 0, i18n.language, currencyConf)}
                    </p>
                </div>
            </div>

            {isLoading ? (
                <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-10 text-center text-slate-400">
                    {t('common.loading', 'Loading...')}
                </div>
            ) : closings.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/30 p-10 text-center">
                    <History className="mx-auto text-slate-500 mb-3" size={26} />
                    <p className="text-slate-300 font-semibold">{t('cashClosing.noClosings', 'No closings available')}</p>
                    <p className="text-xs text-slate-500 mt-1">{t('cashClosing.createClosing', 'Create Closing')}</p>
                </div>
            ) : (
                <div className="overflow-auto rounded-xl border border-slate-700">
                    <table className="min-w-[980px] w-full text-sm">
                        <thead className="bg-slate-800/80 text-slate-300">
                            <tr>
                                <th className="px-4 py-3 text-start">{t('cashClosing.period', 'Period')}</th>
                                <th className="px-4 py-3 text-start">{t('cashClosing.expectedCash', 'Expected Cash')}</th>
                                <th className="px-4 py-3 text-start">{t('cashClosing.declaredCash', 'Declared Cash')}</th>
                                <th className="px-4 py-3 text-start">{t('cashClosing.differenceCash', 'Cash Difference')}</th>
                                <th className="px-4 py-3 text-start">{t('cashClosing.preview.payouts', 'Payouts')}</th>
                                <th className="px-4 py-3 text-start">{t('cashClosing.preview.cashIn', 'Cash In')}</th>
                                <th className="px-4 py-3 text-start">{t('common.actions', 'Actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {closings.map((row) => {
                                const cashDiff = Number(row.differenceCash || 0);
                                return (
                                    <tr key={row.id} className="border-t border-slate-800/80 hover:bg-slate-900/60">
                                        <td className="px-4 py-3 align-top">
                                            <p className="text-slate-100 font-medium">
                                                {formatDateTimeLabel(row.startAt, i18n.language)}
                                            </p>
                                            <p className="text-xs text-slate-500 mt-1">
                                                {formatDateTimeLabel(row.endAt, i18n.language)}
                                            </p>
                                        </td>
                                        <td className="px-4 py-3 align-top text-emerald-300 font-semibold">
                                            {formatCurrency(row.expectedCashAmount || 0, i18n.language, currencyConf)}
                                        </td>
                                        <td className="px-4 py-3 align-top text-slate-200">
                                            {formatCurrency(row.declaredCashAmount || 0, i18n.language, currencyConf)}
                                        </td>
                                        <td className={`px-4 py-3 align-top font-semibold ${cashDiff >= 0 ? 'text-amber-300' : 'text-red-300'}`}>
                                            <div className="inline-flex items-center gap-1">
                                                <Wallet size={14} />
                                                {formatCurrency(cashDiff, i18n.language, currencyConf)}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 align-top text-slate-300">
                                            {formatCurrency(row.payoutsTotal || 0, i18n.language, currencyConf)}
                                        </td>
                                        <td className="px-4 py-3 align-top text-slate-300">
                                            {formatCurrency(row.cashInTotal || 0, i18n.language, currencyConf)}
                                        </td>
                                        <td className="px-4 py-3 align-top">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => handleExport(row.id, 'xlsx')}
                                                    disabled={isDownloadingId === row.id}
                                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-800 transition-colors"
                                                >
                                                    <Download size={14} />
                                                    {t('cashClosing.downloadExport', 'Download Excel')}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default CashClosingReport;
