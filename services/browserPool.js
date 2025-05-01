import { chromium, webkit } from 'playwright';

class BrowserPool {
    constructor() {
        this.browserContexts = new Map();
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;

        try {
            // Launch base browsers
            const chromiumBrowser = await chromium.launch({ 
                headless: false,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            const webkitBrowser = await webkit.launch({ 
                headless: false,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });

            this.browsers = {
                chromium: chromiumBrowser,
                webkit: webkitBrowser
            };

            this.initialized = true;
            console.log('Browser pool initialized successfully');
        } catch (error) {
            console.error('Failed to initialize browser pool:', error);
            throw error;
        }
    }

    async getContext(userId, platform) {
        const contextKey = `${userId}-${platform}`;
        
        if (this.browserContexts.has(contextKey)) {
            return this.browserContexts.get(contextKey);
        }

        try {
            const browser = platform === 'gumtree' ? this.browsers.webkit : this.browsers.chromium;
            const sessionPath = `${platform}_session.json`;
            
            const context = await browser.newContext({
                viewport: { width: 1280, height: 720 },
                storageState: sessionPath
            });

            this.browserContexts.set(contextKey, context);
            return context;
        } catch (error) {
            console.error(`Error creating context for ${platform}:`, error);
            throw error;
        }
    }

    async cleanup() {
        for (const context of this.browserContexts.values()) {
            await context.close();
        }
        this.browserContexts.clear();

        for (const browser of Object.values(this.browsers)) {
            await browser.close();
        }
        this.initialized = false;
    }
}

export const browserPool = new BrowserPool();
