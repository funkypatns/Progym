/**
 * ============================================
 * ANALYTICS ROUTES
 * ============================================
 * 
 * API endpoints for AI-powered insights.
 */

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const analyticsService = require('../services/analyticsService');

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/analytics/insights
 * Get all insights in specified language
 */
router.get('/insights', async (req, res) => {
    try {
        const language = req.query.lang || 'en';
        const insights = await analyticsService.generateInsights(language);

        res.json({
            success: true,
            data: insights
        });
    } catch (error) {
        console.error('Insights error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate insights'
        });
    }
});

/**
 * GET /api/analytics/peak-hours
 */
router.get('/peak-hours', async (req, res) => {
    try {
        const data = await analyticsService.getPeakHours();
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * GET /api/analytics/best-plans
 */
router.get('/best-plans', async (req, res) => {
    try {
        const data = await analyticsService.getBestPlans();
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * GET /api/analytics/churn-risk
 */
router.get('/churn-risk', async (req, res) => {
    try {
        const data = await analyticsService.getChurnRisk();
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * GET /api/analytics/revenue-forecast
 */
router.get('/revenue-forecast', async (req, res) => {
    try {
        const data = await analyticsService.getRevenueForecast();
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
