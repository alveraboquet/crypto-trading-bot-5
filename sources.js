const config = require('./config.json');
const util = require('./util.js');

const KrakenClient = require('kraken-api');

class Kraken {
    krakenClient;
    msPeriodInterval;
    currentData;

    constructor() {
        this.krakenClient = new KrakenClient(process.env.KRAKEN_KEY, process.env.KRAKEN_SECRET);
        this.msPeriodInterval = config.periodInterval * 60000;
    }

    async getData() {
        if (this.currentData && Math.floor(Date.now() / this.msPeriodInterval) * this.msPeriodInterval === this.currentData[this.currentData.length - 1].timestamp) {
            return this.currentData;
        } else {
            await this.updateData();
            return this.currentData;
        }
    }

    async updateData() {
        const since = Math.floor((Date.now() - (config.source.minDataLength * this.msPeriodInterval)) / 1000);
        const response = (await this.krakenClient.api('OHLC', {pair: config.assetPair, interval: config.periodInterval, since}));
        await util.sleep(50);
        const rawData = Object.entries(response.result).filter((pair) => pair[0] !== 'last')[0][1].slice(0, -1);

        const newData = rawData.map((periodData) => {
            return new util.Period(periodData[0] * 1000, {
                open: parseFloat(periodData[1]),
                high: parseFloat(periodData[2]),
                low: parseFloat(periodData[3]),
                close: parseFloat(periodData[4])
            });
        });
        this.currentData = newData.slice(newData.length > config.source.minDataLength ? newData.length - config.source.minDataLength : 0);
    }
}

module.exports = {
    Kraken
};