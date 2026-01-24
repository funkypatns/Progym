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

    const handleOpenModal = () => {
        setIsModalOpen(true);
    };

    const actions = (
        <Button
            variant="contained"
            startIcon={<Plus size={18} />}
            onClick={handleOpenModal}
            sx={{ color: 'white' }}
        >
            {t('cashClosing.createClosing', 'Create closing')}
        </Button>
    );

    return (
        <ReportsShell
            title={t('cashClosing.title', 'Cash closing')}
            subtitle={t('cashClosing.subtitle', 'Daily cash reconciliation and handover logs')}
            actions={actions}
            centerHeader
        >
            <CashClosingReport isActive={true} />

            <CashClosingModal
                isOpen={isModalOpen}
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
