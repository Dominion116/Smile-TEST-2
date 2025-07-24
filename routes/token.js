const express = require('express');
const { v4: uuidv4 } = require('uuid');
const smileConfig = require('../config/smileid');
const { validateTokenRequest } = require('../middleware/validation');
const logger = require('../utils/logger');

const router = express.Router();

// Generate web token for SmileID SDK
router.post('/generate', validateTokenRequest, async (req, res) => {
    const startTime = Date.now();
    
    try {
        const { userId, product, callbackUrl } = req.body;
        const jobId = uuidv4();
        const finalUserId = userId || `user_${Date.now()}`;

        const requestParams = {
            user_id: finalUserId,
            job_id: jobId,
            product: product || 'biometric_kyc',
            callback_url: callbackUrl || smileConfig.getConfig().defaultCallback
        };

        logger.info('Token generation started:', {
            userId: finalUserId,
            jobId: jobId,
            product: requestParams.product
        });

        const connection = smileConfig.getConnection();
        
        // Add timeout protection
        const tokenPromise = connection.get_web_token(requestParams);
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Token generation timeout (15s)')), 15000)
        );

        const token = await Promise.race([tokenPromise, timeoutPromise]);
        const duration = Date.now() - startTime;

        logger.info('Token generated successfully:', {
            userId: finalUserId,
            jobId: jobId,
            duration: `${duration}ms`
        });

        res.json({
            success: true,
            token: token,
            jobId: jobId,
            userId: finalUserId,
            partnerId: smileConfig.getConfig().partnerId,
            environment: smileConfig.getConfig().environment,
            timestamp: new Date().toISOString(),
            duration: duration
        });

    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error('Token generation failed:', {
            error: error.message,
            duration: `${duration}ms`,
            stack: error.stack
        });
        
        res.status(500).json({
            success: false,
            error: 'Token generation failed',
            message: error.message,
            timestamp: new Date().toISOString(),
            duration: duration
        });
    }
});

// Get available products
router.get('/products', (req, res) => {
    const products = [
        { id: 'authentication', name: 'Authentication', description: 'User authentication' },
        { id: 'basic_kyc', name: 'Basic KYC', description: 'Basic identity verification' },
        { id: 'smartselfie', name: 'SmartSelfie', description: 'Selfie verification' },
        { id: 'biometric_kyc', name: 'Biometric KYC', description: 'Biometric identity verification' },
        { id: 'enhanced_kyc', name: 'Enhanced KYC', description: 'Advanced identity verification' },
        { id: 'doc_verification', name: 'Document Verification', description: 'Document verification only' }
    ];

    res.json({
        success: true,
        products: products,
        timestamp: new Date().toISOString()
    });
});

// Test token generation (for debugging)
router.post('/test', async (req, res) => {
    try {
        const testResult = await smileConfig.testConnection();
        res.json(testResult);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;