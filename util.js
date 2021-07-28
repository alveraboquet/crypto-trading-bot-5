class Period {
    timestamp;  // JS timestamp of start time
    ohlc;

    constructor(timestamp, ohlc) {
        this.timestamp = timestamp;
        this.ohlc = ohlc;
    }
}

class Order {
    txid;
    timestamp;
    periodInterval;
    pair;
    action;
    type;
    price;
    volume;
    cost;
    forceMaker;
    score;
    description;

    constructor(txid, timestamp, periodInterval, pair, action, type, price, volume, cost, forceMaker, score, description) {
        this.txid = txid;
        this.timestamp = timestamp;
        this.periodInterval = periodInterval;
        this.pair = pair;
        this.action = action;
        this.type = type;
        this.price = price;
        this.volume = volume;
        this.cost = cost;
        this.forceMaker = forceMaker;
        this.score = score;
        this.description = description;
    }
}

function formatDate(date) {
    return `${date.toISOString().slice(0, 10)} ${date.toTimeString().slice(0, 17)}`;
}

module.exports = {
    Period,
    Order,
    formatDate
};