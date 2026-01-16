import React, { useState } from 'react';
import { Button } from '@mui/material';
import CashClosingReport from '../../components/CashClosingReport';
import CashClosingModal from '../../components/CashClosingModal';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ReportsShell from '../../components/ReportsShell';

const CashClosingReportPage = () => {
    const { t } = useTranslation();
    const [isModalOpen, setIsModalOpen] = useState(false);

    // This wrapper needs to handle the modal state which was previously in Reports.jsx

    const actions = (
        <Button
            variant="contained"
            startIcon={<Plus size={18} />}
            onClick={() => setIsModalOpen(true)}
            sx={{ color: 'white' }}
        >
            {t('cashClosing.createClosing')}
        </Button>
    );

    return (
        <ReportsShell
            title={t('cashClosing.title') || "Cash Closing"}
            subtitle="Daily cash reconciliation and handover logs"
            actions={actions}
        >
            <CashClosingReport isActive={true} />

            <CashClosingModal
                open={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={() => {
                    // Ideally trigger refresh in report
                    setIsModalOpen(false);
                    // Simple refresh for now will happen when user interacts with report updates
                    // or implement a refresh signal context/prop if needed
                }}
            />
        </ReportsShell>
    );
};

export default CashClosingReportPage;
