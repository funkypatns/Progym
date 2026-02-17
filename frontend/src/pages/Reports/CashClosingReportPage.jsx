import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@mui/material';
import { History, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import ReportsShell from '../../components/ReportsShell';
import CashClosingReport from '../../components/CashClosingReport';
import CashClosingModal from '../../components/CashClosingModal';
import api from '../../utils/api';
import { formatCurrency } from '../../utils/numberFormatter';
import { formatDateTime as formatDateTimeLabel } from '../../utils/dateFormatter';
import { useSettingsStore } from '../../store';

const emptyCurrent = {
    openPeriod: null,
    range: { startAt: null, endAt: null },
    expected: {
        expectedCashAmount: 0,
        expectedNonCashAmount: 0,
        expectedTotalAmount: 0,
        payoutsTotal: 0,
        cashInTotal: 0
    },
    summary: {
        totalSessions: 0,
        totalRevenue: 0,
        expectedCash: 0,
        expectedNonCash: 0
    }
};

const CashClosingReportPage = () => {
    const { t, i18n } = useTranslation();
    const { getSetting } = useSettingsStore();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('current');
    const [refreshKey, setRefreshKey] = useState(0);
    const [isLoadingCurrent, setIsLoadingCurrent] = useState(false);
    const [currentPreview, setCurrentPreview] = useState(emptyCurrent);

    const currencyConf = useMemo(() => ({
        code: getSetting('currency_code', 'USD'),
        symbol: getSetting('currency_symbol', '$')
    }), [getSetting]);

    useEffect(() => {
        let isMounted = true;
        const loadCurrentPreview = async () => {
            setIsLoadingCurrent(true);
            try {
                const response = await api.get('/cash-closings/period/current');
                if (!isMounted) return;
                const data = response?.data?.data || emptyCurrent;
                setCurrentPreview({
                    openPeriod: data.openPeriod || null,
                    range: data.range || { startAt: null, endAt: null },
                    expected: { ...emptyCurrent.expected, ...(data.expected || {}) },
                    summary: { ...emptyCurrent.summary, ...(data.summary || {}) }
                });
            } catch (error) {
                console.error('Failed to load current cash close period', error);
                if (isMounted) {
                    setCurrentPreview(emptyCurrent);
                    toast.error(t('cashClosing.loadPreviewFailed', 'Failed to load close preview'));
                }
            } finally {
                if (isMounted) setIsLoadingCurrent(false);
            }
        };

        loadCurrentPreview();
        return () => {
            isMounted = false;
        };
    }, [refreshKey, t]);

    const actions = (
        <div className="flex items-center gap-2">
            <Button
                variant={activeTab === 'history' ? 'outlined' : 'text'}
                startIcon={<History size={16} />}
                onClick={() => setActiveTab('history')}
                sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.2)' }}
            >
                {t('cashClosing.tabs.history', 'Close History')}
            </Button>
            <Button
                variant="contained"
                startIcon={<Plus size={18} />}
                onClick={() => setIsModalOpen(true)}
                sx={{ color: 'white' }}
            >
                {t('cashClosing.createClosing', 'Create closing')}
            </Button>
        </div>
    );

    return (
        <ReportsShell
            title={t('cashClosing.title', 'Cash closing')}
            subtitle={t('cashClosing.subtitle', 'Daily cash reconciliation and handover logs')}
            actions={actions}
            centerHeader
        >
            <div className="p-4 md:p-6 space-y-5">
                <div className="inline-flex rounded-xl bg-slate-900/70 border border-slate-700 p-1">
                    <button
                        type="button"
                        onClick={() => setActiveTab('current')}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${activeTab === 'current'
                            ? 'bg-indigo-600 text-white'
                            : 'text-slate-300 hover:bg-slate-800'
                            }`}
                    >
                        {t('cashClosing.tabs.currentPeriod', 'Current Period')}
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('history')}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${activeTab === 'history'
                            ? 'bg-indigo-600 text-white'
                            : 'text-slate-300 hover:bg-slate-800'
                            }`}
                    >
                        {t('cashClosing.tabs.history', 'Close History')}
                    </button>
                </div>

                {activeTab === 'current' ? (
                    <div className="space-y-4">
                        {isLoadingCurrent ? (
                            <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-8 text-center text-slate-400">
                                {t('common.loading', 'Loading...')}
                            </div>
                        ) : (
                            <>
                                <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-4">
                                    <p className="text-sm text-slate-300 font-semibold">
                                        {t('cashClosing.currentPeriodTitle', 'Current open period')}
                                    </p>
                                    <p className="text-xs text-slate-500 mt-1">
                                        {t('cashClosing.openPeriodStartsAt', 'Open period starts at')}:{' '}
                                        {currentPreview.range?.startAt
                                            ? formatDateTimeLabel(currentPreview.range.startAt, i18n.language)
                                            : '--'}
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                    <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-4">
                                        <p className="text-xs text-slate-400">{t('cashClosing.expectedCash', 'Expected Cash')}</p>
                                        <p className="text-lg font-bold text-emerald-400 mt-1">
                                            {formatCurrency(currentPreview.expected.expectedCashAmount || 0, i18n.language, currencyConf)}
                                        </p>
                                    </div>
                                    <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-4">
                                        <p className="text-xs text-slate-400">{t('cashClosing.expectedNonCash', 'Expected Non-Cash')}</p>
                                        <p className="text-lg font-bold text-blue-400 mt-1">
                                            {formatCurrency(currentPreview.expected.expectedNonCashAmount || 0, i18n.language, currencyConf)}
                                        </p>
                                    </div>
                                    <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-4">
                                        <p className="text-xs text-slate-400">{t('cashClosing.expectedTotal', 'Total Expected')}</p>
                                        <p className="text-lg font-bold text-white mt-1">
                                            {formatCurrency(currentPreview.expected.expectedTotalAmount || 0, i18n.language, currencyConf)}
                                        </p>
                                    </div>
                                    <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-4">
                                        <p className="text-xs text-slate-400">{t('cashClosing.financialSnapshot.totalSessions', 'Total Sessions')}</p>
                                        <p className="text-lg font-bold text-slate-200 mt-1">
                                            {currentPreview.summary.totalSessions || 0}
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-3">
                                        <p className="text-xs text-slate-400">{t('cashClosing.preview.cashIn', 'Cash In')}</p>
                                        <p className="text-sm font-semibold text-emerald-300 mt-1">
                                            {formatCurrency(currentPreview.expected.cashInTotal || 0, i18n.language, currencyConf)}
                                        </p>
                                    </div>
                                    <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-3">
                                        <p className="text-xs text-slate-400">{t('cashClosing.preview.payouts', 'Payouts')}</p>
                                        <p className="text-sm font-semibold text-amber-300 mt-1">
                                            {formatCurrency(currentPreview.expected.payoutsTotal || 0, i18n.language, currencyConf)}
                                        </p>
                                    </div>
                                    <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-3">
                                        <p className="text-xs text-slate-400">{t('cashClosing.financialSnapshot.totalRevenue', 'Total Revenue')}</p>
                                        <p className="text-sm font-semibold text-slate-200 mt-1">
                                            {formatCurrency(currentPreview.summary.totalRevenue || 0, i18n.language, currencyConf)}
                                        </p>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                ) : (
                    <CashClosingReport refreshKey={refreshKey} />
                )}
            </div>

            <CashClosingModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={() => {
                    setRefreshKey((prev) => prev + 1);
                }}
                onViewHistory={() => {
                    setActiveTab('history');
                }}
            />
        </ReportsShell>
    );
};

export default CashClosingReportPage;
