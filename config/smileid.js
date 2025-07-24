const smileIdentityCore = require('smile-identity-core');
const logger = require('../utils/logger');

class SmileIDConfig {
    constructor() {
        this.partnerId = process.env.SMILE_PARTNER_ID;
        this.apiKey = process.env.SMILE_API_KEY;
        this.serverMode = parseInt(process.env.SMILE_SERVER_MODE) || 0;
        this.defaultCallback = process.env.SMILE_DEFAULT_CALLBACK;
        
        this.validateConfig();
        this.initializeConnection();
    }

    validateConfig() {
        const requiredFields = ['partnerId', 'apiKey', 'defaultCallback'];
        const missingFields = requiredFields.filter(field => !this[field]);
        
        if (missingFields.length > 0) {
            const error = `Missing required SmileID configuration: ${missingFields.join(', ')}`;
            logger.error(error);
            throw new Error(error);
        }
        
        logger.info('SmileID configuration validated successfully');
    }

    initializeConnection() {
        try {
            const { WebApi } = smileIdentityCore;
            this.connection = new WebApi(
                this.partnerId,
                this.defaultCallback,
                this.apiKey,
                this.serverMode.toString()
            );
            logger.info('SmileID connection initialized successfully', {
                partnerId: this.partnerId,
                serverMode: this.serverMode === 0 ? 'sandbox' : 'production',
                callback: this.defaultCallback
            });
        } catch (error) {
            logger.error('Failed to initialize SmileID connection:', error);
            throw error;
        }
    }

    getConnection() {
        return this.connection;
    }

    getConfig() {
        return {
            partnerId: this.partnerId,
            serverMode: this.serverMode,
            defaultCallback: this.defaultCallback,
            environment: this.serverMode === 0 ? 'sandbox' : 'production'
        };
    }

    // Test connection
    async testConnection() {
        try {
            // This is a simple test to verify the connection works
            const testParams = {
                user_id: `test_${Date.now()}`,
                job_id: `job_${Date.now()}`,
                product: 'biometric_kyc'
            };
            
            const token = await this.connection.get_web_token(testParams);
            logger.info('SmileID connection test successful');
            return { success: true, token: !!token };
        } catch (error) {
            logger.error('SmileID connection test failed:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = new SmileIDConfig();