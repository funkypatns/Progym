import React from 'react';
import ReceiptLookupReport from '../../components/ReceiptLookupReport';
import ReportsShell from '../../components/ReportsShell';
import { useTranslation } from 'react-i18next';

const ReceiptLookupPage = () => {
    const { t } = useTranslation();

    return (
        <ReportsShell
            title="Receipt Lookup"
            subtitle="Scan or search for transaction receipts"
        >
            <ReceiptLookupReport isActive={true} />
        </ReportsShell>
    );
};

export default ReceiptLookupPage;
