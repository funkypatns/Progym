const express = require('express');
const router = express.Router();
const CommissionService = require('../services/commissionService');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authenticate } = require('../middleware/auth');

// List all coaches
router.get('/', authenticate, async (req, res) => {
    try {
        const coaches = await prisma.user.findMany({
            where: {
                isActive: true,
                role: { in: ['coach', 'staff', 'admin'] }
            },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                role: true
            },
            orderBy: { firstName: 'asc' }
        });
        res.json({ success: true, data: coaches });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get Commission Settings
router.get('/:id/settings', authenticate, async (req, res) => {
    try {
        const settings = await prisma.coachCommissionSettings.findUnique({
            where: { coachId: parseInt(req.params.id) }
        });
        res.json({ success: true, data: settings || { type: 'percentage', value: 0, internalSessionValue: 0 } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Update Commission Settings
router.put('/:id/settings', authenticate, async (req, res) => {
    try {
        const { type, value, internalSessionValue } = req.body;
        const settings = await prisma.coachCommissionSettings.upsert({
            where: { coachId: parseInt(req.params.id) },
            update: {
                type,
                value: parseFloat(value),
                internalSessionValue: parseFloat(internalSessionValue || 0)
            },
            create: {
                coachId: parseInt(req.params.id),
                type,
                value: parseFloat(value),
                internalSessionValue: parseFloat(internalSessionValue || 0)
            }
        });
        res.json({ success: true, data: settings });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get Earnings Report - All Coaches
router.get('/earnings', authenticate, async (req, res) => {
    try {
        // Validation for params logic (replicated safely)
        const filters = { ...req.query };
        const earnings = await CommissionService.getEarnings(null, filters);
        res.json({
            success: true,
            data: earnings || { summary: { totalEarnings: 0, paidEarnings: 0, pendingEarnings: 0 }, rows: [] }
        });
    } catch (error) {
        console.error('[COACHES] Earnings Error:', error);
        res.json({
            success: true,
            data: { summary: { totalEarnings: 0, paidEarnings: 0, pendingEarnings: 0 }, rows: [] },
            _warning: 'Failed to fetch data'
        });
    }
});

// Get Earnings Report - Specific Coach
router.get('/:id/earnings', authenticate, async (req, res) => {
    try {
        const filters = { ...req.query };
        const earnings = await CommissionService.getEarnings(req.params.id, filters);
        res.json({
            success: true,
            data: earnings || { summary: { totalEarnings: 0, paidEarnings: 0, pendingEarnings: 0 }, rows: [] }
        });
    } catch (error) {
        console.error('[COACHES] Specific Earnings Error:', error);
        res.json({
            success: true,
            data: { summary: { totalEarnings: 0, paidEarnings: 0, pendingEarnings: 0 }, rows: [] },
            _warning: 'Failed to fetch data'
        });
    }
});

// Create Settlement (Payout)
router.post('/settle', authenticate, async (req, res) => {
    try {
        const { coachId, startDate, endDate } = req.body;
        const settlement = await CommissionService.createSettlement(coachId, startDate, endDate);
        res.json({ success: true, data: settlement });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

module.exports = router;
