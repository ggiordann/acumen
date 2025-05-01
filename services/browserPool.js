import { chromium } from 'playwright';

class BrowserPool {
    constructor() {
        this.pool = [];
        this.size = 0;
    }

    async initialize(size) {
        try {
            for (let i = 0; i < size; i++) {
                const browser = await chromium.launch({
                    headless: false,
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-gpu'
                    ]
                });
                this.pool.push(browser);
            }
            this.size = size;
            console.log(`Browser pool initialized with ${size} browsers`);
        } catch (error) {
            console.error('Error initializing browser pool:', error);
            throw error;
        }
    }

    async getBrowser(userId) {
        if (this.pool.length === 0) {
            throw new Error('Browser pool not initialized');
        }
        return this.pool[userId % this.size];
    }

    async cleanup() {
        for (const browser of this.pool) {
            await browser.close();
        }
        this.pool = [];
        this.size = 0;
    }
}

export const browserPool = new BrowserPool();
