// Utility functions
function calculateSMA(data, numPeriods, targetIndex, source = 'close') {
    targetIndex = targetIndex ?? data.length - 1;

    if (numPeriods <= 0) throw new RangeError('Num. periods parameter out of range!');
    if (targetIndex >= data.length) throw new RangeError('Target index out of range.');
    if (targetIndex - numPeriods + 1 < 0) throw new RangeError('Not enough data provided for the number of periods specified!');
    if (!['open', 'high', 'low', 'close'].includes(source)) throw new Error(`Source parameter (${JSON.stringify(source)}) is invalid!`);

    const dataSlice = data.slice(targetIndex - numPeriods + 1, targetIndex + 1);
    
    const sum = dataSlice.reduce((p, c) => p + c.ohlc[source], 0);
    const mean = sum / dataSlice.length;

    return mean;
}

function calculateEMA(data, numPeriods, targetIndex, smoothing = 2, source = 'close') {
    targetIndex = targetIndex ?? data.length - 1;

    if (numPeriods <= 0) throw new RangeError('Num. periods parameter out of range!');
    if (targetIndex >= data.length || targetIndex < 0) throw new RangeError('Target index out of range!');
    if (targetIndex - (numPeriods * 2) + 1 < 0) throw new RangeError('Not enough data provided for the number of periods specified!');
    if (smoothing <= 0) throw new RangeError('Smoothing parameter out of range!');
    if (!['open', 'high', 'low', 'close'].includes(source)) throw new Error(`Source parameter (${JSON.stringify(source)}) is invalid!`);

    const dataSlice = data.slice(targetIndex - numPeriods + 1, targetIndex + 1);
    
    const multiplier = smoothing / (numPeriods + 1);
    const result = dataSlice.reduce((p, c) => ((c.ohlc[source] - p) * multiplier) + p, calculateSMA(data, numPeriods, targetIndex - numPeriods, source));

    return result;
}

// Score functions
function emaScore(data, targetIndex, numPeriods, smoothing = 2, source = 'close') {
    if (numPeriods.some((x) => x <= 0)) throw new RangeError('Num. periods parameter out of range!');
    if (targetIndex >= data.length || targetIndex < 1) throw new RangeError('Target index out of range!');
    if (numPeriods.some((x) => targetIndex - (x * 2) < 0)) throw new RangeError('Not enough data provided for the number of periods specified!');
    if (smoothing <= 0) throw new RangeError('Smoothing parameter out of range!');
    if (!['open', 'high', 'low', 'close'].includes(source)) throw new Error(`Source parameter (${JSON.stringify(source)}) is invalid!`);

    const emaValues = numPeriods.map((n) => {
        return {
            previous: calculateEMA(data, n, targetIndex - 1, smoothing, source),
            current: calculateEMA(data, n, targetIndex, smoothing, source)
        };
    });

    let score = 0;
    for (const valueSet of emaValues.slice(1)) {
        if (emaValues[0].previous <= valueSet.previous && emaValues[0].current > valueSet.current) {
            score += 1 / (emaValues.length - 1);
        } else if (emaValues[0].previous > valueSet.previous && emaValues[0].current <= valueSet.current) {
            score -= 1 / (emaValues.length - 1);
        }
    }

    return score;
}

module.exports = {
    emaScore
};