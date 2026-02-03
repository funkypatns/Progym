const collapseSpaces = (value) => String(value || '').trim().replace(/\s+/g, ' ');

const formatDisplayName = (value) => collapseSpaces(value);

const normalizeDisplayName = (value) => collapseSpaces(value).toLowerCase();

const normalizePhone = (value) => String(value || '').replace(/\D/g, '');

const buildDisplayNameSuggestions = async (prisma, baseDisplayName, limit = 5) => {
    const base = formatDisplayName(baseDisplayName);
    const baseNorm = normalizeDisplayName(base);

    if (!baseNorm) {
        return [];
    }

    const existing = await prisma.member.findMany({
        where: {
            displayNameNorm: {
                startsWith: baseNorm
            }
        },
        select: {
            displayNameNorm: true
        }
    });

    const existingSet = new Set(existing.map(row => row.displayNameNorm));
    const suggestions = [];

    let suffix = 1;
    while (suggestions.length < limit && suffix < 500) {
        const candidate = `${base}${suffix}`;
        const candidateNorm = normalizeDisplayName(candidate);
        if (!existingSet.has(candidateNorm)) {
            suggestions.push(candidate);
        }
        suffix += 1;
    }

    return suggestions;
};

module.exports = {
    collapseSpaces,
    formatDisplayName,
    normalizeDisplayName,
    normalizePhone,
    buildDisplayNameSuggestions
};
