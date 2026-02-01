const express = require('express');
const router = express.Router();

// GET /api/services
// Query: type (SESSION|SUBSCRIPTION), active (true|false)
router.get('/', async (req, res) => {
    try {
        const { type, active } = req.query;
        const where = {};

        if (type) where.type = type;
        if (active) where.isActive = active === 'true';

        const services = await req.prisma.service.findMany({
            where,
            orderBy: { name: 'asc' }
        });

        res.json({ success: true, data: services });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed to fetch services' });
    }
});

// POST /api/services
router.post('/', async (req, res) => {
    try {
        const { name, type, defaultPrice, defaultDuration, isActive } = req.body;

        if (!name) return res.status(400).json({ success: false, message: 'Name is required' });

        const service = await req.prisma.service.create({
            data: {
                name,
                type: type || 'SESSION',
                defaultPrice: parseFloat(defaultPrice || 0),
                defaultDuration: parseInt(defaultDuration || 60),
                isActive: isActive ?? true
            }
        });

        res.json({ success: true, data: service });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed to create service' });
    }
});

// PUT /api/services/:id
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const data = req.body;

        if (data.defaultPrice) data.defaultPrice = parseFloat(data.defaultPrice);
        if (data.defaultDuration) data.defaultDuration = parseInt(data.defaultDuration);

        const service = await req.prisma.service.update({
            where: { id: parseInt(id) },
            data
        });

        res.json({ success: true, data: service });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed to update service' });
    }
});

// DELETE /api/services/:id (Soft delete prefered, but user asked for delete or disable)
// We'll implement soft delete by setting isActive = false if it's used, but hard delete if unused is cleaner.
// For now, let's just do hard delete as requested in "CRUD", but usually "disable" is safer.
// User requirement: "DELETE or disable service (soft delete preferred)"
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        // Soft delete by setting isActive = false
        const service = await req.prisma.service.update({
            where: { id: parseInt(id) },
            data: { isActive: false }
        });
        res.json({ success: true, message: 'Service deactivated', data: service });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed to delete service' });
    }
});

module.exports = router;
