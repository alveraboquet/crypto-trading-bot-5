class Period {
    timestamp;  // JS timestamp of start time
    duration;  // Period interval in minutes
    ohlc = {};

    constructor(timestamp, duration, ohlc) {
        this.timestamp = timestamp;
        this.duration = duration;
        this.ohlc = ohlc;
    }
}

module.exports = {
    Period
};