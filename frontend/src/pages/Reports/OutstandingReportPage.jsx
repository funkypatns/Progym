import React from 'react';
import { useTranslation } from 'react-i18next';
import PaymentRemainingReport from '../../components/PaymentRemainingReport';
import ReportsShell from '../../components/ReportsShell';

const OutstandingReportPage = () => {
    const { t } = useTranslation();
    return (
        <ReportsShell
            title={t('reports.outstanding.title', 'Outstanding payments')}
            subtitle={t('reports.outstanding.subtitle', 'Track unpaid and partial subscriptions')}
            centerHeader
        >
            <PaymentRemainingReport isActive={true} />
        </ReportsShell>
    );
};

export default OutstandingReportPage;
