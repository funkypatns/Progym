/**
 * ============================================
 * RECEIPTS ROUTES
 * ============================================
 *
 * Unified receipts listing and export for payments, subscriptions, and sales.
 */

const express = require('express');
const PDFDocument = require('pdfkit');
const router = express.Router();
const { authenticate, requirePermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../utils/permissions');
const { parseDateRange } = require('../utils/dateParams');
const { createReceipt, buildTransactionId, parseReceiptJson } = require('../services/receiptService');
const { addTableSheet, buildColumnsFromRows, createWorkbook, sendWorkbook } = require('../services/excelExportService');

router.use(authenticate);

const sendExcelResponse = async (res, data, filename) => {
    const workbook = createWorkbook();
    const rows = Array.isArray(data) ? data : [];
    addTableSheet(workbook, {
        name: 'Receipts',
        title: 'Receipts Report',
        columns: buildColumnsFromRows(rows),
        rows
    });
    return sendWorkbook(res, workbook, filename);
};

const normalizeReceipt = (receipt) => {
    const parsed = parseReceiptJson(receipt);
    return parsed;
};

const buildPaymentReceiptInput = (payment, member, subscription, plan, staffName) => {
    const totalPrice = subscription?.price ?? plan?.price ?? payment.amount;
    const paidNow = Number(payment.amount || 0);
    const paidToDate = Number.isFinite(Number(subscription?.paidAmount)) ? Number(subscription.paidAmount) : paidNow;
    const remaining = Number.isFinite(Number(subscription?.remainingAmount)) ? Number(subscription.remainingAmount) : 0;

    const items = [];
    if (subscription) {
        items.push({
            type: 'subscription',
            name: plan?.name || 'Subscription',
            qty: 1,
            unitPrice: totalPrice,
            lineTotal: totalPrice,
            duration: plan?.duration,
            startDate: subscription.startDate,
            endDate: subscription.endDate
        });
    } else {
        items.push({
            type: 'payment',
            name: payment.notes || 'Payment',
            qty: 1,
            unitPrice: paidNow,
            lineTotal: paidNow
        });
    }

    return {
        transactionType: 'payment',
        transactionId: payment.id,
        paymentMethod: payment.method,
        customerId: member?.id,
        customerName: member ? `${member.firstName} ${member.lastName}` : null,
        customerPhone: member?.phone || null,
        customerCode: member?.memberId || null,
        staffId: payment.createdBy || null,
        staffName,
        items,
        totals: {
            subtotal: totalPrice,
            discount: subscription?.discount || 0,
            tax: 0,
            total: totalPrice,
            paid: paidNow,
            paidToDate,
            remaining,
            change: 0
        },
        notes: payment.notes || null,
        createdAt: payment.paidAt || payment.createdAt
    };
};

/**
 * POST /api/receipts/from-transaction
 * Create or fetch a receipt by transaction id
 */
router.post('/from-transaction', requirePermission(PERMISSIONS.PAYMENTS_VIEW), async (req, res) => {
    try {
        const { transactionId, type } = req.body || {};
        if (!transactionId) {
            return res.status(400).json({ success: false, message: 'transactionId is required' });
        }

        let transactionKey = String(transactionId);
        let normalizedType = String(type || '').toLowerCase();
        if (!transactionKey.includes('-')) {
            if (!normalizedType) {
                return res.status(400).json({ success: false, message: 'type is required' });
            }
            transactionKey = buildTransactionId(normalizedType, transactionId);
        } else if (!normalizedType) {
            normalizedType = transactionKey.split('-')[0]?.toLowerCase() || '';
        }

        if (normalizedType !== 'payment') {
            return res.status(400).json({ success: false, message: 'Unsupported transaction type' });
        }

        const paymentId = parseInt(String(transactionId).split('-').pop(), 10);
        if (!Number.isInteger(paymentId)) {
            return res.status(400).json({ success: false, message: 'Invalid transactionId' });
        }

        const payment = await req.prisma.payment.findUnique({
            where: { id: paymentId },
            include: {
                member: {
                    select: { id: true, firstName: true, lastName: true, phone: true, memberId: true }
                },
                subscription: {
                    include: { plan: true }
                },
                creator: {
                    select: { id: true, firstName: true, lastName: true }
                }
            }
        });

        if (!payment) {
            return res.status(404).json({ success: false, message: 'Transaction not found' });
        }

        const staffName = payment.collectorName || (payment.creator ? `${payment.creator.firstName} ${payment.creator.lastName}` : 'System');
        let receiptResult = null;
        let receiptError = null;

        try {
            receiptResult = await createReceipt(req.prisma, buildPaymentReceiptInput(
                payment,
                payment.member,
                payment.subscription,
                payment.subscription?.plan,
                staffName
            ));
        } catch (receiptErr) {
            if (receiptErr?.code === 'RECEIPTS_NOT_READY') {
                receiptError = {
                    status: 'not_initialized',
                    message: receiptErr.message
                };
            } else {
                console.error('[RECEIPTS] Create receipt failed:', receiptErr);
                receiptError = {
                    status: 'failed',
                    message: 'Failed to create receipt'
                };
            }
        }

        const receiptData = receiptResult?.receipt ? parseReceiptJson(receiptResult.receipt) : null;
        const receiptCreated = receiptResult?.created ?? false;
        const receiptStatus = receiptError?.status || (receiptData ? 'ready' : 'missing');
        const receiptMessage = receiptError?.message
            || (!receiptCreated && receiptData ? 'Receipt already issued for this transaction' : null);

        res.json({
            success: true,
            data: {
                receipt: receiptData,
                receiptCreated,
                receiptStatus,
                receiptMessage,
                transactionId: transactionKey
            }
        });
    } catch (error) {
        console.error('Receipt creation error:', error);
        res.status(500).json({ success: false, message: 'Failed to create receipt' });
    }
});

/**
 * GET /api/receipts
 * List receipts with filters and export.
 */
router.get('/', requirePermission(PERMISSIONS.REPORTS_VIEW), async (req, res) => {
    try {
        const {
            type,
            startDate,
            endDate,
            from,
            to,
            paymentMethod,
            staffId,
            customerId,
            search,
            page = 1,
            limit = 50,
            format
        } = req.query;

        const { startDate: start, endDate: end, error } = parseDateRange(startDate || from, endDate || to);
        if (error) return res.status(400).json({ success: false, message: error });

        const where = {
            createdAt: { gte: start, lte: end }
        };

        if (type) {
            if (type === 'general') {
                where.transactionType = { in: ['payment', 'subscription'] };
            } else {
                where.transactionType = type;
            }
        }

        if (paymentMethod) {
            where.paymentMethod = paymentMethod;
        }

        if (staffId) {
            where.staffId = parseInt(staffId);
        }

        if (customerId) {
            where.customerId = parseInt(customerId);
        }

        if (search) {
            const q = search.trim();
            if (q) {
                where.OR = [
                    { receiptNo: { contains: q } },
                    { transactionId: { contains: q } },
                    { customerName: { contains: q } },
                    { customerPhone: { contains: q } },
                    { customerCode: { contains: q } }
                ];
            }
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [rows, total] = await Promise.all([
            req.prisma.receipt.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: parseInt(limit)
            }),
            req.prisma.receipt.count({ where })
        ]);

        const normalizedRows = rows.map(normalizeReceipt);

        const summary = normalizedRows.reduce((acc, receipt) => {
            const totals = receipt.totals || {};
            const totalValue = Number(totals.total) || 0;
            const paidValue = Number(totals.paid) || 0;
            const refundedValue = Number(totals.refunded) || 0;
            acc.count += 1;
            acc.totalSales += totalValue;
            acc.totalPaid += paidValue;
            acc.totalRefunded += refundedValue;
            return acc;
        }, { count: 0, totalSales: 0, totalPaid: 0, totalRefunded: 0 });

        if (format === 'excel') {
            const exportRows = normalizedRows.map(r => ({
                receiptNo: r.receiptNo,
                transactionId: r.transactionId,
                type: r.transactionType,
                customerName: r.customerName || '',
                customerPhone: r.customerPhone || '',
                customerCode: r.customerCode || '',
                staffName: r.staffName || '',
                paymentMethod: r.paymentMethod || '',
                total: r.totals?.total || 0,
                paid: r.totals?.paid || 0,
                remaining: r.totals?.remaining || 0,
                createdAt: r.createdAt
            }));
            return sendExcelResponse(res, exportRows, 'receipts-report.xlsx');
        }

        if (format === 'pdf') {
            const doc = new PDFDocument({ margin: 40 });
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename=receipts-report.pdf');
            doc.pipe(res);

            doc.fontSize(16).text('Receipts Report', { align: 'center' });
            doc.moveDown();
            normalizedRows.forEach((r) => {
                doc.fontSize(10).text(`Receipt: ${r.receiptNo} | Transaction: ${r.transactionId}`);
                doc.text(`Type: ${r.transactionType} | Method: ${r.paymentMethod || '-'}`);
                doc.text(`Customer: ${r.customerName || '-'} ${r.customerPhone ? `(${r.customerPhone})` : ''}`);
                doc.text(`Total: ${r.totals?.total || 0} | Paid: ${r.totals?.paid || 0} | Remaining: ${r.totals?.remaining || 0}`);
                doc.text(`Date: ${r.createdAt}`);
                doc.moveDown();
            });

            doc.end();
            return;
        }

        res.json({
            success: true,
            data: {
                rows: normalizedRows,
                summary,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages: Math.ceil(total / parseInt(limit))
                }
            }
        });
    } catch (error) {
        console.error('Receipts list error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch receipts' });
    }
});

/**
 * GET /api/receipts/:id
 * Fetch a single receipt by id
 */
router.get('/:id', requirePermission(PERMISSIONS.REPORTS_VIEW), async (req, res) => {
    try {
        const receipt = await req.prisma.receipt.findUnique({
            where: { id: parseInt(req.params.id) }
        });

        if (!receipt) {
            return res.status(404).json({ success: false, message: 'Receipt not found' });
        }

        res.json({
            success: true,
            data: normalizeReceipt(receipt)
        });
    } catch (error) {
        console.error('Receipt fetch error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch receipt' });
    }
});

module.exports = router;
