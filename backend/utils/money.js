const roundMoney = (value) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return 0;
    return Math.round((num + Number.EPSILON) * 100) / 100;
};

const clampMoney = (value) => Math.max(0, roundMoney(value));

module.exports = {
    roundMoney,
    clampMoney
};
