import React, { forwardRef } from 'react';

const RefundReceiptTemplate = forwardRef(({ data }, ref) => {
    if (!data) return null;

    const {
        receiptNumber,
        date,
        memberName,
        subscriptionName,
        calculationMethod, // 'time' or 'visits'
        startDate,
        endDate,
        cancellationDate,
        totalDays,
        daysUsed,
        totalVisits,
        visitsUsed,
        originalAmount,
        deductionAmount,
        refundAmount,
        currency = 'EGP'
    } = data;

    return (
        <div className="hidden">
            <div ref={ref} className="thermal-receipt">
                <style>{`
                    @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap');
                    
                    .thermal-receipt {
                        width: 80mm;
                        padding: 2mm;
                        background: white;
                        color: black;
                        font-family: 'Tajawal', sans-serif;
                        direction: rtl;
                        font-size: 12px;
                        line-height: 1.4;
                    }

                    .receipt-header {
                        text-align: center;
                        margin-bottom: 5mm;
                        border-bottom: 1px dashed black;
                        padding-bottom: 3mm;
                    }

                    .receipt-title {
                        font-size: 18px;
                        font-weight: bold;
                        margin: 2mm 0;
                    }

                    .receipt-meta {
                        display: flex;
                        justify-content: space-between;
                        font-size: 10px;
                        margin-top: 2mm;
                    }

                    .section {
                        margin-bottom: 4mm;
                        border-bottom: 1px solid #ddd;
                        padding-bottom: 2mm;
                    }

                    .row {
                        display: flex;
                        justify-content: space-between;
                        margin-bottom: 1.5mm;
                    }

                    .label {
                        font-weight: 500;
                    }

                    .value {
                        font-weight: 700;
                    }

                    .highlight-box {
                        border: 1px solid black;
                        padding: 2mm;
                        margin: 2mm 0;
                        border-radius: 4px;
                        background: #f9f9f9;
                    }

                    .financial-section {
                        margin-top: 5mm;
                        border-top: 2px solid black;
                        padding-top: 2mm;
                    }

                    .financial-row {
                        display: flex;
                        justify-content: space-between;
                        margin-bottom: 1mm;
                        font-size: 13px;
                    }

                    .total-row {
                        display: flex;
                        justify-content: space-between;
                        margin-top: 3mm;
                        font-size: 18px;
                        font-weight: bold;
                        border-top: 1px dashed black;
                        padding-top: 2mm;
                    }

                    .footer {
                        text-align: center;
                        margin-top: 5mm;
                        font-size: 10px;
                        border-top: 1px solid #eee;
                        padding-top: 2mm;
                    }

                    @media print {
                        @page {
                            margin: 0;
                            size: 80mm auto;
                        }
                        body {
                            margin: 0;
                            padding: 0;
                        }
                        .thermal-receipt {
                            width: 100%;
                            padding: 0;
                        }
                    }
                `}</style>

                {/* Header */}
                <div className="receipt-header">
                    <div className="font-bold text-lg">GYM LOGO</div>
                    <div className="receipt-title">إشعار استرداد</div>
                    <div className="receipt-meta">
                        <span>{date}</span>
                        <span>#{receiptNumber}</span>
                    </div>
                    <div className="mt-2 font-bold text-sm">{memberName}</div>
                </div>

                {/* Dynamic Body */}
                <div className="section">
                    <div className="row">
                        <span className="label">الاشتراك:</span>
                        <span className="value">{subscriptionName}</span>
                    </div>

                    {calculationMethod === 'time' ? (
                        <>
                            <div className="row">
                                <span className="label">تاريخ البدء:</span>
                                <span className="value">{startDate}</span>
                            </div>
                            <div className="row">
                                <span className="label">تاريخ الانتهاء:</span>
                                <span className="value">{endDate}</span>
                            </div>
                            <div className="row">
                                <span className="label">تاريخ الإلغاء:</span>
                                <span className="value">{cancellationDate}</span>
                            </div>
                            <div className="highlight-box">
                                <div className="row" style={{ margin: 0 }}>
                                    <span className="label">الأيام المستهلكة:</span>
                                    <span className="value">{daysUsed} / {totalDays} يوم</span>
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="row">
                                <span className="label">إجمالي الزيارات:</span>
                                <span className="value">{totalVisits} زيارة</span>
                            </div>
                            <div className="highlight-box">
                                <div className="row" style={{ margin: 0 }}>
                                    <span className="label">الزيارات المستهلكة:</span>
                                    <span className="value">{visitsUsed} زيارة</span>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Financial Section */}
                <div className="financial-section">
                    <div className="financial-row">
                        <span>المبلغ الصافي</span>
                        <span>{originalAmount} {currency}</span>
                    </div>
                    <div className="financial-row text-red-600">
                        <span>قيمة الاستهلاك (-)</span>
                        <span>{deductionAmount} {currency}</span>
                    </div>

                    <div className="total-row">
                        <span>المبلغ المسترد</span>
                        <span>{refundAmount} {currency}</span>
                    </div>
                </div>

                {/* Footer */}
                <div className="footer">
                    تم استرداد مبلغ {refundAmount} {currency} من صافي مبلغ {originalAmount} {currency}
                </div>
            </div>
        </div>
    );
});

export default RefundReceiptTemplate;
