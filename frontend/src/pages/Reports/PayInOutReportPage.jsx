import React from 'react';
import CashMovementsReport from '../../components/CashMovementsReport';
import ReportsShell from '../../components/ReportsShell';
import { useTranslation } from 'react-i18next';

const PayInOutReportPage = () => {
    const { t } = useTranslation();
    return (
        <ReportsShell
            title={t('payInOut.title') || "Pay In / Out"}
            subtitle="Cash drawer manual movements"
        >
            <CashMovementsReport isActive={true} />
        </ReportsShell>
    );
};

export default PayInOutReportPage;
