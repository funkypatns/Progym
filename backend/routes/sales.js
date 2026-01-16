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

router.use(authenticate);

// Validation
const saleValidation = [
    body('items').isArray({ min: 1 }).withMessage('Cart cannot be empty'),
    body('items.*.productId').isInt().withMessage('Invalid product ID'),
    body('items.*.qty').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
    body('paymentMethod').isIn(['cash', 'card', 'transfer', 'mixed']).withMessage('Invalid payment method'),
    body('notes').optional().trim()
];

/**
 * POST /api/sales
 * Process a new sale
 */
router.post('/', requireActiveShift, saleValidation, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    try {
        const { items, paymentMethod, notes } = req.body;
        const shiftId = req.activeShift.id;
        const employeeId = req.user.id;

        // Transactional execution
        const result = await req.prisma.$transaction(async (prisma) => {

            // 1. Calculate Total & Validate Stock
            let totalAmount = 0;
            const saleItemsData = [];

            for (const item of items) {
                const product = await prisma.product.findUnique({
                    where: { id: item.productId },
                    include: { stockMovements: true } // Need to calc stock? Or trust frontend?
                });

                if (!product) throw new Error(`Product ID ${item.productId} not found`);
                if (!product.isActive) throw new Error(`Product ${product.name} is inactive`);

                // Calc current stock
                const currentStock = product.stockMovements.reduce((sum, m) => {
                    return sum + (m.type === 'IN' ? m.quantity :
                        m.type === 'OUT' ? -m.quantity :
                            m.quantity); // ADJUST is signed
                }, 0);

                if (currentStock < item.qty) {
                    throw new Error(`Insufficient stock for ${product.name}. Available: ${currentStock}`);
                }

                const lineTotal = product.salePrice * item.qty;
                totalAmount += lineTotal;

                saleItemsData.push({
                    productId: product.id,
                    quantity: item.qty,
                    unitPrice: product.salePrice, // Lock price at time of sale
                    lineTotal
                });
            }

            // 2. Create Sale Transaction
            const sale = await prisma.saleTransaction.create({
                data: {
                    shiftId,
                    employeeId,
                    paymentMethod,
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
                        shiftId
                    }
                });
            }

            return sale;
        });

        res.status(201).json({ success: true, message: 'Sale completed', data: result });

    } catch (error) {
        console.error('Sale transaction error:', error);
        res.status(400).json({ success: false, message: error.message || 'Transaction failed' });
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
