import React from 'react';
import ReceiptLookupReport from '../../components/ReceiptLookupReport';
import ReportsShell from '../../components/ReportsShell';
import { useTranslation } from 'react-i18next';

const ReceiptLookupPage = () => {
    const { t } = useTranslation();

    return (
        <ReportsShell
            title={t('reports.receipts.title', 'Receipt lookup')}
            subtitle={t('reports.receipts.subtitle', 'Scan or search for transaction receipts')}
            centerHeader
        >
            <ReceiptLookupReport isActive={true} />
        </ReportsShell>
    );
};

export default ReceiptLookupPage;
