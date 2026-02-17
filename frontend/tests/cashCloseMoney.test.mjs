import assert from 'node:assert/strict';

import {
    calculateCashDifference,
    getCashDifferenceState,
    parseMoney,
    roundMoney
} from '../src/utils/cashCloseMoney.js';

const cases = [];

const test = (name, fn) => {
    cases.push({ name, fn });
};

test('parseMoney handles basic and formatted inputs', () => {
    assert.equal(parseMoney('531.71'), 531.71);
    assert.equal(parseMoney('531,71'), 531.71);
    assert.equal(parseMoney('$531.71'), 531.71);
    assert.equal(parseMoney('531.71 '), 531.71);
    assert.equal(parseMoney(''), 0);
    assert.equal(parseMoney('1,234.56'), 1234.56);
    assert.equal(parseMoney('1.234,56'), 1234.56);
});

test('parseMoney handles Arabic digits and separators', () => {
    assert.equal(parseMoney('\u0665\u0663\u0661\u066B\u0667\u0661', 'ar'), 531.71);
    assert.equal(parseMoney('\u0665\u0663\u0661,\u0667\u0661', 'ar'), 531.71);
    assert.equal(parseMoney('\u0661\u066C\u0662\u0663\u0664\u066B\u0665\u0666', 'ar'), 1234.56);
    assert.equal(parseMoney('\u0661\u0662\u0663\u0664\u0665', 'ar'), 12345);
});

test('roundMoney keeps two decimals', () => {
    assert.equal(roundMoney(10), 10);
    assert.equal(roundMoney(10.005), 10.01);
    assert.equal(roundMoney(10.004), 10);
});

test('calculateCashDifference and status mapping are correct', () => {
    const positive = calculateCashDifference('700', '500');
    assert.equal(positive, 200);
    assert.equal(getCashDifferenceState(positive), 'overage');

    const negative = calculateCashDifference('400', '500');
    assert.equal(negative, -100);
    assert.equal(getCashDifferenceState(negative), 'shortage');

    const zero = calculateCashDifference('531.71', '531.71');
    assert.equal(zero, 0);
    assert.equal(getCashDifferenceState(zero), 'balanced');
});

test('calculateCashDifference treats tiny float drifts as zero', () => {
    const diff = calculateCashDifference('531.709999', '531.71');
    assert.equal(diff, 0);
    assert.equal(getCashDifferenceState(diff), 'balanced');
});

let failures = 0;
for (const { name, fn } of cases) {
    try {
        fn();
        console.log(`PASS ${name}`);
    } catch (error) {
        failures += 1;
        console.error(`FAIL ${name}`);
        console.error(error);
    }
}

if (failures > 0) {
    process.exit(1);
}

console.log(`All tests passed (${cases.length})`);
