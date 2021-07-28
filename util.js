class Period {
    timestamp;  // JS timestamp of start time
    ohlc;

    constructor(timestamp, ohlc) {
        this.timestamp = timestamp;
        this.ohlc = ohlc;
    }
}

function formatDate(date) {
    return `${date.toISOString().slice(0, 10)} ${date.toTimeString().slice(0, 17)}`;
}

module.exports = {
    Period,
    formatDate
};