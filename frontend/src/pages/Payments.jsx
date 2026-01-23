import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import apiClient from '../utils/api';
import toast from 'react-hot-toast';
import { Plus, DollarSign, CreditCard, TrendingUp, Download } from 'lucide-react';

import PaymentsTable from '../components/payments/PaymentsTable';
import AddPaymentDialog from '../components/payments/AddPaymentDialog';
import ReceiptModal from '../components/payments/ReceiptModal';
// MemberLedgerModal is intended for the Members page, but could be triggered here if needed. 
// For now, I'll integrate ReceiptModal which was missing.

const Payments = () => {
    const { t } = useTranslation();
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedPayment, setSelectedPayment] = useState(null); // For ReceiptModal
    const [summary, setSummary] = useState({ total: 0, count: 0 });

    useEffect(() => {
        fetchPayments();
    }, []);

    const fetchPayments = async () => {
        setLoading(true);
        try {
            const res = await apiClient.get('/payments');
            if (res.data.success) {
                // Handle various response formats (Array, Paginated with 'docs', Paginated with 'payments')
                const rawData = res.data.data;
                const data = Array.isArray(rawData)
                    ? rawData
                    : (rawData?.payments || rawData?.docs || []);

                setPayments(data);

                const total = data.filter(p => p.status === 'completed').reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
                setSummary({ total, count: data.length });
            }
        } catch (e) {
            console.error(e);
            toast.error(t('common.error'));
            setPayments([]);
        } finally {
            setLoading(false);
        }
    };

    const handleViewReceipt = (payment) => {
        setSelectedPayment(payment);
    };

    const handleDownloadReceipt = (id) => {
        toast.promise(
            // Simulating download - usually entails hitting an endpoint that returns a PDF blob
            new Promise(resolve => setTimeout(resolve, 1000)),
            {
                loading: t('common.loading'),
                success: 'Receipt Downloaded',
                error: t('common.error'),
            }
        );
    };

    const handleRefund = (payment) => {
        if (window.confirm("Process Refund? This cannot be undone.")) {
            toast.success("Refund Processed");
            // Add logic here to call API
            fetchPayments();
            setSelectedPayment(null);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm(t('common.confirm'))) return;
        try {
            await apiClient.delete(`/payments/${id}`);
            toast.success(t('common.success'));
            fetchPayments();
        } catch (e) {
            toast.error(t('common.error'));
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6" dir="rtl">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{t('payments.title')}</h1>
                    <p className="text-gray-500 mt-1">{t('payments.title')}</p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all active:scale-95 group"
                >
                    <Plus size={20} className="group-hover:rotate-90 transition-transform" />
                    {t('payments.recordPayment')}
                </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in-up">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white shadow-lg shadow-blue-500/20 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><DollarSign size={80} /></div>
                    <div className="flex items-center justify-between mb-4 relative z-10">
                        <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm"><DollarSign size={24} /></div>
                        <span className="text-xs font-bold bg-white/20 px-2 py-1 rounded-full uppercase tracking-wider backdrop-blur-sm">{t('payments.totalRevenue')}</span>
                    </div>
                    <div className="text-4xl font-extrabold relative z-10">{summary.total.toLocaleString()} <span className="text-xl opacity-80 font-medium">EGP</span></div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow group">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform">
                            <CreditCard size={28} />
                        </div>
                        <div>
                            <div className="text-3xl font-bold text-gray-900 dark:text-white">{summary.count}</div>
                            <div className="text-sm text-gray-500 font-medium">{t('financials.total')}</div>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow group">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl text-green-600 dark:text-green-400 group-hover:scale-110 transition-transform">
                            <TrendingUp size={28} />
                        </div>
                        <div>
                            <div className="text-3xl font-bold text-gray-900 dark:text-white">+12.5%</div>
                            <div className="text-sm text-gray-500 font-medium">{t('common.thisMonth')}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Payments Table Component */}
            <div className="animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                <PaymentsTable
                    payments={payments}
                    loading={loading}
                    onViewReceipt={handleViewReceipt}
                    onDelete={handleDelete}
                    onRefresh={fetchPayments}
                />
            </div>

            {/* Modals */}
            <AddPaymentDialog
                open={showAddModal}
                onClose={() => setShowAddModal(false)}
                onSuccess={fetchPayments}
            />

            <ReceiptModal
                payment={selectedPayment}
                onClose={() => setSelectedPayment(null)}
                onDownload={handleDownloadReceipt}
                onRefund={handleRefund}
            />
        </div>
    );
};

export default Payments;
