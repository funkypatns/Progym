/**
 * ============================================
 * WHATSAPP UTILITY
 * ============================================
 * 
 * Utility functions for WhatsApp integration
 * Uses wa.me links (no API needed)
 */

/**
 * Normalize phone number for WhatsApp
 * Removes spaces, dashes, and ensures country code
 */
export const normalizePhoneNumber = (phone) => {
    if (!phone) return '';

    // Remove all non-digit characters except +
    let cleaned = phone.replace(/[^\d+]/g, '');

    // Remove leading + if present
    if (cleaned.startsWith('+')) {
        cleaned = cleaned.substring(1);
    }

    // If starts with 0, assume Egypt and replace with 20
    if (cleaned.startsWith('0')) {
        cleaned = '20' + cleaned.substring(1);
    }

    // If less than 10 digits, assume Egypt country code
    if (cleaned.length < 10) {
        return cleaned; // Return as-is, user should fix
    }

    return cleaned;
};

/**
 * Generate WhatsApp URL
 */
export const generateWhatsAppUrl = (phone, message = '') => {
    const normalizedPhone = normalizePhoneNumber(phone);
    const encodedMessage = encodeURIComponent(message);

    if (message) {
        return `https://wa.me/${normalizedPhone}?text=${encodedMessage}`;
    }
    return `https://wa.me/${normalizedPhone}`;
};

/**
 * Open WhatsApp chat
 */
export const openWhatsApp = (phone, message = '') => {
    const url = generateWhatsAppUrl(phone, message);
    window.open(url, '_blank');
};

/**
 * Predefined message templates
 */
export const MESSAGE_TEMPLATES = {
    renewal: {
        id: 'renewal',
        name: 'Subscription Renewal Reminder',
        nameAr: 'تذكير بتجديد الاشتراك',
        message: (memberName, gymName, daysRemaining) =>
            `مرحباً ${memberName}! 👋\n\nنود إعلامك أن اشتراكك في ${gymName} سينتهي خلال ${daysRemaining} يوم.\n\nننتظرك لتجديد اشتراكك والاستمرار في رحلتك الرياضية! 💪\n\nشكراً لك`,
        messageEn: (memberName, gymName, daysRemaining) =>
            `Hi ${memberName}! 👋\n\nThis is a reminder that your subscription at ${gymName} will expire in ${daysRemaining} days.\n\nWe look forward to seeing you renew your subscription! 💪\n\nThank you`
    },
    inactive: {
        id: 'inactive',
        name: 'Inactive Member Reminder',
        nameAr: 'تذكير العضو غير النشط',
        message: (memberName, gymName, lastVisit) =>
            `مرحباً ${memberName}! 👋\n\nاشتقنا لك في ${gymName}! 🏋️\n\nلاحظنا غيابك عن النادي منذ فترة. نتمنى أن تكون بخير.\n\nننتظر عودتك قريباً! 💪`,
        messageEn: (memberName, gymName, lastVisit) =>
            `Hi ${memberName}! 👋\n\nWe miss you at ${gymName}! 🏋️\n\nWe noticed you haven't visited in a while. Hope you're doing well.\n\nLooking forward to seeing you back soon! 💪`
    },
    offer: {
        id: 'offer',
        name: 'Special Offer',
        nameAr: 'عرض خاص',
        message: (memberName, gymName, offerDetails) =>
            `مرحباً ${memberName}! 🎉\n\nلدينا عرض خاص لك في ${gymName}!\n\n${offerDetails || 'تواصل معنا لمعرفة التفاصيل'}\n\nلا تفوت الفرصة! ⚡`,
        messageEn: (memberName, gymName, offerDetails) =>
            `Hi ${memberName}! 🎉\n\nWe have a special offer for you at ${gymName}!\n\n${offerDetails || 'Contact us for details'}\n\nDon't miss out! ⚡`
    },
    general: {
        id: 'general',
        name: 'General Message',
        nameAr: 'رسالة عامة',
        message: (memberName, gymName) =>
            `مرحباً ${memberName}! 👋\n\n`,
        messageEn: (memberName, gymName) =>
            `Hi ${memberName}! 👋\n\n`
    }
};

/**
 * Get message from template
 */
export const getTemplateMessage = (templateId, params, language = 'ar') => {
    const template = MESSAGE_TEMPLATES[templateId];
    if (!template) return '';

    const { memberName = 'Member', gymName = 'النادي', ...rest } = params;

    if (language === 'ar') {
        return template.message(memberName, gymName, rest.daysRemaining || rest.lastVisit || rest.offerDetails);
    }
    return template.messageEn(memberName, gymName, rest.daysRemaining || rest.lastVisit || rest.offerDetails);
};

export default {
    normalizePhoneNumber,
    generateWhatsAppUrl,
    openWhatsApp,
    MESSAGE_TEMPLATES,
    getTemplateMessage
};
