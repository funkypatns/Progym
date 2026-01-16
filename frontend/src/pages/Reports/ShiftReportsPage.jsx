import React from 'react';
import ShiftReports from '../../components/ShiftReports';
import ReportsShell from '../../components/ReportsShell';
import { useTranslation } from 'react-i18next';

const ShiftReportsPage = () => {
    const { t } = useTranslation();
    return (
        <ReportsShell
            title={t('reports.shiftReports') || "Shift Reports"}
            subtitle="View and manage daily shift closings"
        >
            <ShiftReports isActive={true} />
        </ReportsShell>
    );
};

export default ShiftReportsPage;
