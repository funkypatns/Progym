/**
 * ============================================
 * PRODUCTS ROUTES
 * ============================================
 * 
 * Manage products, stock, and inventory movements.
 */

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authenticate, requireActiveShift } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(req.userDataPath, 'uploads', 'products');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'product-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|webp|gif|jfif/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        if (mimetype && extname) return cb(null, true);
        cb(new Error('Error: File upload only supports following filetypes - ' + filetypes));
    }
});

const handleProductUpload = (req, res, next) => {
    upload.single('image')(req, res, (err) => {
        if (err) {
            const message = err.message || 'Invalid image upload';
            return res.status(400).json({ success: false, message });
        }
        return next();
    });
};

router.use(authenticate);

// Validation
const productValidation = [
    body('name').trim().notEmpty().withMessage('Product name is required'),
    body('salePrice').isFloat({ min: 0 }).withMessage('Sale price must be positive'),
    body('sku').optional().trim(),
];

const restockValidation = [
    body('quantity').isInt().withMessage('Quantity must be an integer').custom((val, { req }) => {
        if (val === 0) throw new Error('Quantity cannot be zero');
        if (req.body.type === 'IN' || req.body.type === 'OUT') {
            if (val < 0) throw new Error('Quantity must be positive for IN/OUT movements');
        }
        return true;
    }),
    body('type').isIn(['IN', 'OUT', 'ADJUST']).withMessage('Invalid movement type'),
    body('reason').if(body('type').equals('ADJUST')).notEmpty().withMessage('Reason is required for adjustments')
];

/**
 * GET /api/products
 * List all products with current stock calculated
 */
router.get('/', async (req, res) => {
    try {
        const { search, active } = req.query;

        const where = {};
        if (active === 'true') where.isActive = true;

        if (search) {
            where.OR = [
                { name: { contains: search } }, // Case insensitive usually handled by Prisma text search or raw
                { sku: { contains: search } }
            ];
        }

        const products = await req.prisma.product.findMany({
            where,
            include: {
                stockMovements: {
                    select: { type: true, quantity: true }
                }
            },
            orderBy: { name: 'asc' }
        });

        // Calculate Stock for each product
        const productsWithStock = products.map(p => {
            const stock = p.stockMovements.reduce((sum, m) => {
                if (m.type === 'IN') return sum + m.quantity;
                if (m.type === 'OUT') return sum - m.quantity;
                if (m.type === 'ADJUST') return sum + m.quantity; // Adjust can be negative logic? 
                // Wait, implementation plan said ADJUST quantity is Absolute Value?
                // Depending on how we store it. Let's assume ADJUST stores +/- signed int?
                // Or type ADJUST needs specific logic? 
                // Let's stick to: IN (+), OUT (-). 
                // ADJUST: The request might send negative quantity. 
                // Database schema says quantity Int.
                return sum + 0; // Handled below in logic if we want strict types
            }, 0);

            // Let's refine the specific logic:
            // We'll store signed quantity for ADJUST in input, but DB stores unsigned Int usually?
            // Schema has `quantity Int`. It CAN be negative in SQLite/Postgres Int.
            // So let's store signed values in the DB for ease of sum?
            // "quantity Int // Absolute value" comment in plan.
            // If absolute, we need a sign flag or type logic.
            // Let's strictly follow:
            // IN: +qty
            // OUT: -qty
            // ADJUST: +/-qty (stored as is in DB?)

            // Let's use the DB `quantity` as the signed impact if possible?
            // Or better: use logic based on type. 
            // Plan said: "sum(IN) - sum(OUT) + sum(ADJUST as signed)"

            let currentStock = 0;
            p.stockMovements.forEach(m => {
                if (m.type === 'IN') currentStock += m.quantity;
                else if (m.type === 'OUT') currentStock -= m.quantity;
                else if (m.type === 'ADJUST') currentStock += m.quantity; // stored as signed
            });

            // Remove large relation data before sending
            const { stockMovements, ...productData } = p;
            return { ...productData, stock: currentStock };
        });

        res.json({ success: true, data: productsWithStock });

    } catch (error) {
        console.error('Fetch products error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch products' });
    }
});

/**
 * POST /api/products
 * Create new product
 */
router.post('/', handleProductUpload, productValidation, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { name, description, salePrice, sku, isActive } = req.body;
        const salePriceValue = parseFloat(salePrice);
        if (!Number.isFinite(salePriceValue)) {
            return res.status(400).json({ success: false, message: 'Sale price must be a valid number' });
        }

        let imageUrl = null;
        if (req.file) {
            imageUrl = `/uploads/products/${req.file.filename}`;
        }

        const product = await req.prisma.product.create({
            data: {
                name,
                description,
                salePrice: salePriceValue,
                sku: sku || null,
                isActive: isActive === 'true' || isActive === true,
                imageUrl
            }
        });

        res.status(201).json({ success: true, data: product });
    } catch (error) {
        console.error('Create product error:', error);
        if (error.code === 'P2002') {
            return res.status(400).json({ success: false, message: 'SKU must be unique' });
        }
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

/**
 * PUT /api/products/:id
 * Update product
 */
router.put('/:id', handleProductUpload, productValidation, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, salePrice, sku, isActive } = req.body;
        const salePriceValue = parseFloat(salePrice);
        if (!Number.isFinite(salePriceValue)) {
            return res.status(400).json({ success: false, message: 'Sale price must be a valid number' });
        }

        const product = await req.prisma.product.findUnique({ where: { id: parseInt(id) } });
        if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

        let imageUrl = product.imageUrl;
        if (req.file) {
            imageUrl = `/uploads/products/${req.file.filename}`;
            // Optional: We could delete the old image file here to save space
        }

        const updated = await req.prisma.product.update({
            where: { id: parseInt(id) },
            data: {
                name,
                description,
                salePrice: salePriceValue,
                sku: sku || null,
                isActive: isActive === 'true' || isActive === true,
                imageUrl
            }
        });

        res.json({ success: true, data: updated });

    } catch (error) {
        console.error('Update product error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

/**
 * POST /api/products/:id/stock
 * Add stock movement (Restock or Adjust)
 */
router.post('/:id/stock', restockValidation, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    try {
        const { id } = req.params;
        const { type, quantity, reason, notes, unitCost } = req.body; // quantity should be signed for ADJUST if negative

        // Verify product exists
        const product = await req.prisma.product.findUnique({ where: { id: parseInt(id) } });
        if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

        const movementData = {
            productId: parseInt(id),
            type, // IN or ADJUST
            quantity: parseInt(quantity), // Store as is (signed for ADJUST if passed that way)
            reason: reason || 'Manual Update',
            notes,
            unitCost: unitCost ? parseFloat(unitCost) : null,
            employeeId: req.user.id
        };

        // If active shift, link it? Restocking might not be shift bound, but good for audit.
        // We can optionally check `req.activeShift` if using middleware, or look it up.
        // Let's assume generic restock doesn't REQUIRE a shift, but if we have one, link it.
        // For simplicity, leaving shiftId null for warehouse operations unless strictly POS.

        const movement = await req.prisma.stockMovement.create({
            data: movementData
        });

        res.json({ success: true, data: movement });

    } catch (error) {
        console.error('Stock update error:', error);
        res.status(500).json({ success: false, message: 'Failed to update stock' });
    }
});

/**
 * GET /api/products/movements
 * Global stock movements report
 */
router.get('/movements/all', async (req, res) => {
    try {
        const movements = await req.prisma.stockMovement.findMany({
            take: 100,
            orderBy: { createdAt: 'desc' },
            include: {
                product: { select: { name: true, sku: true } },
                employee: { select: { firstName: true, lastName: true } }
            }
        });
        res.json({ success: true, data: movements });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching movements' });
    }
});

module.exports = router;
