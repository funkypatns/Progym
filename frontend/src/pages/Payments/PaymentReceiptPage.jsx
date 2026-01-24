import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Loader2, Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import apiClient from '../../utils/api';
import { useSettingsStore } from '../../store';
import { PaymentReceipt } from '../../components/payments/ReceiptTemplates';

const PaymentReceiptPage = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { id } = useParams();
    const [searchParams] = useSearchParams();
    const { getSetting } = useSettingsStore();
    const [payment, setPayment] = useState(null);
    const [loading, setLoading] = useState(true);

    const currencyConf = useMemo(() => ({
        code: getSetting('currency_code', 'EGP'),
        symbol: getSetting('currency_symbol', 'EGP')
    }), [getSetting]);

    useEffect(() => {
        let isActive = true;
        const fetchPayment = async () => {
            if (!id) return;
            setLoading(true);
            try {
                const res = await apiClient.get(`/payments/${id}`);
                if (isActive) {
                    if (res.data.success) {
                        setPayment(res.data.data);
                    } else {
                        toast.error(res.data.message || t('common.error', 'Error'));
                        setPayment(null);
                    }
                }
            } catch (err) {
                if (isActive) {
                    const message = err.response?.data?.message || t('common.error', 'Error');
                    toast.error(message);
                    setPayment(null);
                }
            } finally {
                if (isActive) setLoading(false);
            }
        };
        fetchPayment();
        return () => {
            isActive = false;
        };
    }, [id, t]);

    useEffect(() => {
        if (!payment || typeof window === 'undefined') return;
        if (searchParams.get('print') === '1') {
            setTimeout(() => window.print(), 300);
        }
    }, [payment, searchParams]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100 print:bg-white">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100 print:bg-white p-6">
            <div className="max-w-3xl mx-auto">
                <div className="flex items-center justify-between mb-6 print:hidden">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 text-sm font-bold text-gray-600 hover:text-gray-900"
                    >
                        <ArrowLeft size={16} />
                        {t('common.back', 'Back')}
                    </button>
                    <button
                        onClick={() => window.print()}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700"
                    >
                        <Printer size={16} />
                        {t('common.print', 'Print')}
                    </button>
                </div>

                {payment ? (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 print:p-0 print:border-0 print:shadow-none">
                        <PaymentReceipt payment={payment} currencyConf={currencyConf} />
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 text-center text-gray-600">
                        {t('payments.receiptNotFound', 'Receipt not found')}
                    </div>
                )}
            </div>
        </div>
    );
};

export default PaymentReceiptPage;
