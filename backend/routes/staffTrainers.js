const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');

// All staff trainer routes require authentication
router.use(authenticate);

/**
 * GET /api/staff-trainers
 * Return basic list of available trainers for dropdowns
 */
router.get('/', async (req, res) => {
  try {
    const trainers = await req.prisma.staffTrainer.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        active: true
      },
      orderBy: { name: 'asc' }
    });

    return res.json({ success: true, data: trainers });
  } catch (error) {
    console.error('[STAFF TRAINERS] Read error:', error);
    try {
      const fallback = await req.prisma.user.findMany({
        where: { role: 'staff', isActive: true },
        select: { id: true, firstName: true, lastName: true, isActive: true },
        orderBy: { lastName: 'asc' }
      });

      const mapped = fallback.map(u => ({
        id: u.id,
        name: `${u.firstName} ${u.lastName}`.trim() || u.firstName || 'Staff',
        active: u.isActive
      }));

      return res.json({ success: true, data: mapped });
    } catch (fallbackError) {
      console.error('[STAFF TRAINERS] Fallback error:', fallbackError);
      return res.status(500).json({ success: false, message: 'Failed to load staff trainers' });
    }
  }
});

module.exports = router;
