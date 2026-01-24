import React from 'react';
import CancellationsReport from '../../components/CancellationsReport';
import ReportsShell from '../../components/ReportsShell';
import { useTranslation } from 'react-i18next';

const CancellationsReportPage = () => {
    const { t } = useTranslation();
    return (
        <ReportsShell
            title={t('reports.cancellations', 'Cancellations')}
            subtitle={t('reports.cancellations.subtitle', 'Monthly cancellation report')}
            centerHeader
        >
            <CancellationsReport isActive={true} />
        </ReportsShell>
    );
};

export default CancellationsReportPage;
