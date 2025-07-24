const express = require('express');
const logger = require('../utils/logger');

const router = express.Router();

// Store recent callbacks in memory (in production, use a database)
const recentCallbacks = new Map();

// Handle SmileID callbacks
router.post('/', (req, res) => {
    const receivedAt = new Date().toISOString();
    
    try {
        const callbackData = req.body;
        
        logger.info('SmileID callback received:', {
            userId: callbackData.user_id,
            jobId: callbackData.job_id,
            resultCode: callbackData.ResultCode,
            resultText: callbackData.ResultText,
            receivedAt: receivedAt,
            dataSize: JSON.stringify(callbackData).length
        });

        // Store callback for status checking
        const callbackKey = `${callbackData.user_id}_${callbackData.job_id}`;
        recentCallbacks.set(callbackKey, {
            ...callbackData,
            receivedAt: receivedAt,
            processed: false
        });

        // Process the callback
        processCallback(callbackData);

        // Mark as processed
        const stored = recentCallbacks.get(callbackKey);
        if (stored) {
            stored.processed = true;
            stored.processedAt = new Date().toISOString();
        }

        // Always respond with 200 to acknowledge receipt
        res.status(200).json({
            success: true,
            message: 'Callback received and processed successfully',
            receivedAt: receivedAt,
            jobId: callbackData.job_id
        });

    } catch (error) {
        logger.error('Callback processing error:', {
            error: error.message,
            stack: error.stack,
            body: req.body
        });
        
        res.status(500).json({
            success: false,
            error: 'Callback processing failed',
            message: error.message,
            receivedAt: receivedAt
        });
    }
});

// Get recent callbacks (for debugging)
router.get('/recent', (req, res) => {
    const callbacks = Array.from(recentCallbacks.entries()).map(([key, value]) => ({
        key,
        ...value
    }));
    
    res.json({
        success: true,
        callbacks: callbacks.slice(-20), // Last 20 callbacks
        count: callbacks.length
    });
});

// Get specific callback
router.get('/:userId/:jobId', (req, res) => {
    const { userId, jobId } = req.params;
    const callbackKey = `${userId}_${jobId}`;
    const callback = recentCallbacks.get(callbackKey);
    
    if (callback) {
        res.json({
            success: true,
            callback: callback
        });
    } else {
        res.status(404).json({
            success: false,
            message: 'Callback not found',
            userId: userId,
            jobId: jobId
        });
    }
});

function processCallback(data) {
    const { ResultCode, ResultText, user_id, job_id, job_type } = data;

    if (ResultCode === '0000') {
        logger.info(`✅ Job ${job_id} completed successfully for user ${user_id}`, {
            jobType: job_type,
            resultText: ResultText
        });
        handleSuccessfulVerification(data);
    } else {
        logger.warn(`❌ Job ${job_id} failed for user ${user_id}`, {
            resultCode: ResultCode,
            resultText: ResultText,
            jobType: job_type
        });
        handleFailedVerification(data);
    }
}

function handleSuccessfulVerification(data) {
    // Implement your success logic here
    // Examples:
    // - Update user status in database
    // - Send success notification
    // - Trigger next step in user onboarding
    
    logger.info('Processing successful verification:', {
        userId: data.user_id,
        jobId: data.job_id,
        confidence: data.confidence_score || 'N/A'
    });
    
    // Add your custom success handling here
}

function handleFailedVerification(data) {
    // Implement your failure logic here
    // Examples:
    // - Log failure reason
    // - Trigger retry logic
    // - Send failure notification
    
    logger.warn('Processing failed verification:', {
        userId: data.user_id,
        jobId: data.job_id,
        reason: data.ResultText
    });
    
    // Add your custom failure handling here
}

module.exports = router;