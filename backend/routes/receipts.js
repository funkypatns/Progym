/**
 * ============================================
 * RECEIPTS ROUTES
 * ============================================
 *
 * Unified receipts listing and export for payments, subscriptions, and sales.
 */

const express = require('express');
const XLSX = require('xlsx');
const PDFDocument = require('pdfkit');
const router = express.Router();
const { authenticate, requirePermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../utils/permissions');
const { parseDateRange } = require('../utils/dateParams');
const { parseReceiptJson } = require('../services/receiptService');

router.use(authenticate);

const sendExcelResponse = (res, data, filename) => {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
};

const normalizeReceipt = (receipt) => {
    const parsed = parseReceiptJson(receipt);
    return parsed;
};

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
