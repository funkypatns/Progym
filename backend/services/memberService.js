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
            suggestions
        };
    }
    if (target.includes('phoneNorm')) {
        return {
            ok: false,
            reason: 'PHONE_EXISTS'
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
            reason: 'NAME_INVALID'
        };
    }

    if (!phoneNorm) {
        return {
            ok: false,
            reason: 'PHONE_INVALID'
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
            suggestions
        };
    }

    if (existing?.phoneNorm === phoneNorm) {
        return {
            ok: false,
            reason: 'PHONE_EXISTS'
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
