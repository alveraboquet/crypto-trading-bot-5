class Period {
    timestamp;  // JS timestamp of start time
    ohlc;

    constructor(timestamp, ohlc) {
        this.timestamp = timestamp;
        this.ohlc = ohlc;
    }
}

module.exports = {
    Period
};