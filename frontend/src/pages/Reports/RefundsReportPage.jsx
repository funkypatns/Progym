import React from 'react';
import RefundsReport from '../../components/RefundsReport';
import ReportsShell from '../../components/ReportsShell';
import { useTranslation } from 'react-i18next';

const RefundsReportPage = () => {
    const { t } = useTranslation();
    return (
        <ReportsShell
            title={t('reports.refundsReport') || "Refunds Log"}
            subtitle="Track refund transactions and history"
        >
            <RefundsReport isActive={true} />
        </ReportsShell>
    );
};

export default RefundsReportPage;
