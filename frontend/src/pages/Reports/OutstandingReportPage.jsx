import React from 'react';
import PaymentRemainingReport from '../../components/PaymentRemainingReport';
import ReportsShell from '../../components/ReportsShell';

const OutstandingReportPage = () => {
    return (
        <ReportsShell
            title="Outstanding Payments"
            subtitle="Track unpaid and partial subscriptions"
        >
            <PaymentRemainingReport isActive={true} />
        </ReportsShell>
    );
};

export default OutstandingReportPage;
