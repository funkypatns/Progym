import React from 'react';
import ReceiptsReport from '../../components/ReceiptsReport';
import ReportsShell from '../../components/ReportsShell';
import { useTranslation } from 'react-i18next';

const ReceiptLookupPage = () => {
    const { t } = useTranslation();

    return (
        <ReportsShell
            title={t('reports.receipts.title', 'Receipts')}
            subtitle={t('reports.receipts.subtitle', 'Review and reprint receipts')}
            centerHeader
        >
            <ReceiptsReport isActive={true} />
        </ReportsShell>
    );
};

export default ReceiptLookupPage;
