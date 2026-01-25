/**
 * ============================================
 * SALES ROUTES (POS)
 * ============================================
 * 
 * Handle sales transactions, deduction of stock, and shift linkage.
 */

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authenticate, requireActiveShift } = require('../middleware/auth');
const { createReceipt, parseReceiptJson } = require('../services/receiptService');

router.use(authenticate);

// Validation
const saleValidation = [
    body('items').isArray({ min: 1 }).withMessage('Cart cannot be empty'),
    body('items.*.productId').isInt().withMessage('Invalid product ID'),
    body('items.*.qty').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
    body('paymentMethod').isString().trim().notEmpty().withMessage('Payment method is required'),
    body('shiftId').isInt({ min: 1 }).withMessage('shiftId is required'),
    body('cashierId').isInt({ min: 1 }).withMessage('cashierId is required'),
    body('paid').isFloat({ min: 0 }).withMessage('paid must be a number >= 0'),
    body('total').isFloat({ min: 0 }).withMessage('total must be a number >= 0'),
    body('notes').optional().trim()
];

const VALID_PAYMENT_METHODS = ['cash', 'card', 'transfer', 'wallet', 'mixed'];

const normalizePaymentMethod = (method) => {
    if (method === undefined || method === null) return '';
    return String(method).trim().toLowerCase();
};

const buildFieldErrors = (errorsArray) => {
    return errorsArray.reduce((acc, err) => {
        if (!acc[err.param]) {
            acc[err.param] = err.msg;
        }
        return acc;
    }, {});
};

const createBadRequest = (message, fieldErrors) => {
    const err = new Error(message);
    err.status = 400;
    if (fieldErrors) err.fieldErrors = fieldErrors;
    return err;
};

/**
 * POST /api/sales
 * Process a new sale
 */
router.post('/', requireActiveShift, saleValidation, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const fieldErrors = buildFieldErrors(errors.array());
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            fieldErrors
        });
    }

    try {
        if (!req.user) {
            return res.status(401).json({ success: false, message: 'Not authenticated' });
        }
        if (!req.activeShift) {
            return res.status(403).json({ success: false, message: 'No active shift found' });
        }

        const { items, paymentMethod, notes, shiftId, cashierId, paid, total } = req.body;
        const normalizedMethod = normalizePaymentMethod(paymentMethod);
        if (!VALID_PAYMENT_METHODS.includes(normalizedMethod)) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                fieldErrors: { paymentMethod: 'Invalid payment method' }
            });
        }

        const parsedShiftId = parseInt(shiftId, 10);
        const parsedCashierId = parseInt(cashierId, 10);
        if (parsedShiftId !== req.activeShift.id) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                fieldErrors: { shiftId: 'shiftId does not match the active shift' }
            });
        }
        if (parsedCashierId !== req.user.id) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                fieldErrors: { cashierId: 'cashierId does not match the logged-in user' }
            });
        }

        const paidAmount = Number(paid);
        const totalAmountInput = Number(total);
        if (!Number.isFinite(paidAmount) || paidAmount < 0) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                fieldErrors: { paid: 'paid must be a number >= 0' }
            });
        }
        if (!Number.isFinite(totalAmountInput) || totalAmountInput < 0) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                fieldErrors: { total: 'total must be a number >= 0' }
            });
        }

        const shiftIdValue = req.activeShift.id;
        const employeeId = req.user.id;
        const staffName = `${req.user.firstName} ${req.user.lastName}`;

        // Transactional execution
        const result = await req.prisma.$transaction(async (prisma) => {

            // 1. Calculate Total & Validate Stock
            let totalAmount = 0;
            const saleItemsData = [];
            const receiptItems = [];

            for (const item of items) {
                const productId = parseInt(item.productId, 10);
                const qty = parseInt(item.qty, 10);
                if (!Number.isInteger(productId) || !Number.isInteger(qty) || qty < 1) {
                    throw createBadRequest('Invalid sale item', {
                        items: 'Each item must include a valid productId and qty'
                    });
                }

                const product = await prisma.product.findUnique({
                    where: { id: productId },
                    include: { stockMovements: true } // Need to calc stock? Or trust frontend?
                });

                if (!product) {
                    throw createBadRequest(`Product ID ${productId} not found`, {
                        productId: `Product ${productId} not found`
                    });
                }
                if (!product.isActive) throw new Error(`Product ${product.name} is inactive`);

                // Calc current stock
                const currentStock = product.stockMovements.reduce((sum, m) => {
                    return sum + (m.type === 'IN' ? m.quantity :
                        m.type === 'OUT' ? -m.quantity :
                            m.quantity); // ADJUST is signed
                }, 0);

                if (currentStock < qty) {
                    throw createBadRequest(`Insufficient stock for ${product.name}. Available: ${currentStock}`, {
                        stock: `Insufficient stock for ${product.name}`
                    });
                }

                const lineTotal = product.salePrice * qty;
                totalAmount += lineTotal;

                saleItemsData.push({
                    productId: product.id,
                    quantity: qty,
                    unitPrice: product.salePrice, // Lock price at time of sale
                    lineTotal
                });

                receiptItems.push({
                    type: 'product',
                    name: product.name,
                    qty,
                    unitPrice: product.salePrice,
                    lineTotal
                });
            }

            if (Math.abs(totalAmountInput - totalAmount) > 0.01) {
                throw createBadRequest('Total does not match cart amount', {
                    total: 'Total does not match the cart total'
                });
            }

            if (Math.abs(paidAmount - totalAmountInput) > 0.01) {
                throw createBadRequest('Paid amount must equal total for POS sales', {
                    paid: 'Paid amount must equal total'
                });
            }

            // 2. Create Sale Transaction
            const sale = await prisma.saleTransaction.create({
                data: {
                    shiftId: shiftIdValue,
                    employeeId,
                    paymentMethod: normalizedMethod,
                    totalAmount,
                    notes,
                    items: {
                        create: saleItemsData
                    }
                }
            });

            // 3. Create Stock Movements (OUT)
            // We do this loop again or mapping from saleItemsData
            for (const item of saleItemsData) {
                await prisma.stockMovement.create({
                    data: {
                        productId: item.productId,
                        type: 'OUT',
                        quantity: item.quantity,
                        reason: `Sale #${sale.id}`,
                        employeeId,
                        shiftId: shiftIdValue
                    }
                });
            }

            const receiptResult = await createReceipt(prisma, {
                transactionType: 'sale',
                transactionId: sale.id,
                paymentMethod: normalizedMethod,
                customerName: null,
                customerPhone: null,
                staffId: employeeId,
                staffName,
                items: receiptItems,
                totals: {
                    subtotal: totalAmount,
                    discount: 0,
                    tax: 0,
                    total: totalAmount,
                    paid: paidAmount,
                    remaining: Math.max(totalAmount - paidAmount, 0),
                    change: 0
                },
                createdAt: sale.createdAt
            });

            return { sale, receipt: receiptResult.receipt, receiptCreated: receiptResult.created };
        });

        const responseReceipt = parseReceiptJson(result.receipt);
        res.status(201).json({
            success: true,
            message: result.receiptCreated ? 'Sale completed' : 'Receipt already issued for this transaction',
            data: {
                sale: result.sale,
                receipt: responseReceipt,
                receiptCreated: result.receiptCreated
            }
        });

    } catch (error) {
        if (error && error.status === 400) {
            return res.status(400).json({
                success: false,
                message: error.message || 'Validation failed',
                fieldErrors: error.fieldErrors || undefined
            });
        }
        console.error('Sale transaction error:', error);
        res.status(500).json({
            success: false,
            message: 'Sale creation failed',
            details: error.message || 'Transaction failed'
        });
    }
});

/**
 * GET /api/sales
 * List recent sales
 */
router.get('/', async (req, res) => {
    try {
        const { startDate, endDate, shiftId, employeeId } = req.query;

        const where = {};
        if (shiftId) where.shiftId = parseInt(shiftId);
        if (employeeId) where.employeeId = parseInt(employeeId);
        if (startDate && endDate) {
            where.createdAt = {
                gte: new Date(startDate),
                lte: new Date(endDate)
            };
        }

        const sales = await req.prisma.saleTransaction.findMany({
            where,
            include: {
                items: {
                    include: { product: { select: { name: true } } }
                },
                employee: { select: { firstName: true, lastName: true } }
            },
            orderBy: { createdAt: 'desc' },
            take: 100
        });

        res.json({ success: true, data: sales });

    } catch (error) {
        console.error('Fetch sales error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch sales history' });
    }
});

module.exports = router;
