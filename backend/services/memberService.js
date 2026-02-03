const {
    formatDisplayName,
    normalizeDisplayName,
    normalizePhone,
    buildDisplayNameSuggestions
} = require('../utils/memberNormalization');

const resolveUniqueConflict = async (prisma, displayName, displayNameNorm, phoneNorm, target) => {
    if (target.includes('displayNameNorm')) {
        const suggestions = await buildDisplayNameSuggestions(prisma, displayName);
        return {
            ok: false,
            reason: 'NAME_EXISTS',
            message: 'الاسم موجود بالفعل. اختر Nickname مختلف.',
            suggestions
        };
    }
    if (target.includes('phoneNorm')) {
        return {
            ok: false,
            reason: 'PHONE_EXISTS',
            message: 'رقم الهاتف مسجل بالفعل.'
        };
    }
    return null;
};

const createMemberWithUniqueness = async (prisma, data) => {
    const displayNameInput = data.displayName || `${data.firstName || ''} ${data.lastName || ''}`;
    const displayName = formatDisplayName(displayNameInput);
    const displayNameNorm = normalizeDisplayName(displayName);
    const phoneNorm = normalizePhone(data.phone);

    if (!displayNameNorm) {
        return {
            ok: false,
            reason: 'NAME_INVALID',
            message: 'الاسم غير صالح.'
        };
    }

    if (!phoneNorm) {
        return {
            ok: false,
            reason: 'PHONE_INVALID',
            message: 'رقم الهاتف غير صالح.'
        };
    }

    const existing = await prisma.member.findFirst({
        where: {
            OR: [
                { displayNameNorm },
                { phoneNorm }
            ]
        },
        select: {
            displayNameNorm: true,
            phoneNorm: true
        }
    });

    if (existing?.displayNameNorm === displayNameNorm) {
        const suggestions = await buildDisplayNameSuggestions(prisma, displayName);
        return {
            ok: false,
            reason: 'NAME_EXISTS',
            message: 'الاسم موجود بالفعل. اختر Nickname مختلف.',
            suggestions
        };
    }

    if (existing?.phoneNorm === phoneNorm) {
        return {
            ok: false,
            reason: 'PHONE_EXISTS',
            message: 'رقم الهاتف مسجل بالفعل.'
        };
    }

    try {
        const member = await prisma.member.create({
            data: {
                ...data,
                displayName,
                displayNameNorm,
                phoneNorm
            }
        });

        return {
            ok: true,
            member
        };
    } catch (error) {
        if (error?.code === 'P2002') {
            const target = String(error.meta?.target || '');
            const conflict = await resolveUniqueConflict(prisma, displayName, displayNameNorm, phoneNorm, target);
            if (conflict) {
                return conflict;
            }
        }
        throw error;
    }
};

module.exports = {
    createMemberWithUniqueness
};
