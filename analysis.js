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

function calculateStochasticK(data, numPeriods, targetIndex, source = 'close') {
    targetIndex = targetIndex ?? data.length - 1;

    if (numPeriods <= 0) throw new RangeError('Num. periods parameter out of range!');
    if (targetIndex >= data.length || targetIndex < 0) throw new RangeError('Target index out of range!');
    if (targetIndex - numPeriods + 1 < 0) throw new RangeError('Not enough data provided for the number of periods specified!');
    if (!['open', 'high', 'low', 'close'].includes(source)) throw new Error(`Source parameter (${JSON.stringify(source)}) is invalid!`);

    const dataSlice = data.slice(targetIndex - numPeriods + 1, targetIndex + 1);

    const high = Math.max(...dataSlice.map((period) => period.ohlc.high));
    const low = Math.min(...dataSlice.map((period) => period.ohlc.low));
    const currentPrice = dataSlice[dataSlice.length - 1].ohlc[source];
    
    let result = ((currentPrice - low) / (high - low)) * 100;
    if (result === Infinity) result = 100;

    return result;
}

function calculateStochasticD(data, numKPeriods, numDPeriods, targetIndex) {
    targetIndex = targetIndex ?? data.length - 1;

    if (numKPeriods <= 0) throw new RangeError('Num. K periods parameter out of range!');
    if (numDPeriods <= 0) throw new RangeError('Num. D periods parameter out of range!');
    if (targetIndex >= data.length || targetIndex < 0) throw new RangeError('Target index out of range!');
    if (targetIndex - (numKPeriods + numDPeriods) + 1 < 0) throw new RangeError('Not enough data provided for the number of periods specified!');

    const kSlice = [];
    for (let i = targetIndex; i > targetIndex - numDPeriods; i--) {
        kSlice.push(calculateStochasticK(data, numKPeriods, i));
    }

    const sum = kSlice.reduce((p, c) => p + c, 0);
    const mean = sum / kSlice.length;

    return mean;
}

// Score functions
function emaScore(data, targetIndex, numPeriods, smoothing = 2, source = 'close') {
    targetIndex = targetIndex ?? data.length - 1;

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

function stochasticScore(data, targetIndex, numKPeriods, numDPeriods, overboughtLevel, oversoldLevel, source = 'close') {
    targetIndex = targetIndex ?? data.length - 1;

    if (numKPeriods <= 0) throw new RangeError('Num. %K periods parameter out of range!');
    if (numDPeriods <= 0) throw new RangeError('Num. %D periods parameter out of range!');
    if (targetIndex >= data.length || targetIndex < 1) throw new RangeError('Target index out of range!');
    if (targetIndex - (numKPeriods + numDPeriods) < 0) throw new RangeError('Not enough data provided for the number of periods specified!');
    if (!['open', 'high', 'low', 'close'].includes(source)) throw new Error(`Source parameter (${JSON.stringify(source)}) is invalid!`);

    const kValues = {
        previous: calculateStochasticK(data, numKPeriods, targetIndex - 1, source),
        current: calculateStochasticK(data, numKPeriods, targetIndex, source)
    };

    const dValues = {
        previous: calculateStochasticD(data, numKPeriods, numDPeriods, targetIndex - 1),
        current: calculateStochasticD(data, numKPeriods, numDPeriods, targetIndex)
    };

    let score = 0;

    if (kValues.previous <= dValues.previous && kValues.current > dValues.current) {
        score += 0.5;
    } else if (kValues.previous > dValues.previous && kValues.current <= dValues.current) {
        score += -0.5;
    }

    if (kValues.previous <= overboughtLevel && kValues.current > overboughtLevel) {
        score += 0.5;
    } else if (kValues.previoous > oversoldLevel && kValues.current <= oversoldLevel) {
        score += 0.5;
    }

    if (kValues.current > overboughtLevel) {
        if (score <= -0.25) score += 0.25;
        else if (score < 0) score = 0;
    } else if (kValues.current <= oversoldLevel) {
        if (score >= 0.25) score -= 0.25;
        else if (score > 0) score = 0;
    }

    return score;
}

function combineScoreFunctions(functions) {
    return (data, targetIndex) => {
        targetIndex = targetIndex ?? data.length - 1;

        let total = 0;
        for (const {functionName, args, weight} of functions) {
            total += this[functionName](data, targetIndex, ...args) * weight;
        }

        total = Math.round(total * 100) / 100;
        if (total > 1) total = 1;
        else if (total < -1) total = -1;

        return total;
    };
}

module.exports = {
    emaScore,
    stochasticScore,
    combineScoreFunctions
};