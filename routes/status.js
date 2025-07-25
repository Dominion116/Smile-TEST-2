const express = require('express');
const smileConfig = require('../config/smileid');
const logger = require('../utils/logger');

const router = express.Router();

// Check job status with better error handling
router.get('/:userId/:jobId', async (req, res) => {
    try {
        const { userId, jobId } = req.params;
        
        logger.info('Job status check requested:', { userId, jobId });
        
        const connection = smileConfig.getConnection();
        
        // Add timeout protection
        const statusPromise = connection.get_job_status(userId, jobId);
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Status check timeout (10s)')), 10000)
        );

        const jobStatus = await Promise.race([statusPromise, timeoutPromise]);

        logger.info('Job status retrieved successfully:', { 
            userId, 
            jobId, 
            status: jobStatus?.job_complete ? 'Complete' : 'In Progress'
        });

        res.json({
            success: true,
            status: jobStatus,
            userId: userId,
            jobId: jobId,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.error('Job status check failed:', {
            userId: req.params.userId,
            jobId: req.params.jobId,
            error: error.message,
            stack: error.stack
        });
        
        // Handle specific SmileID errors
        if (error.message.includes('400') || error.message.includes('Bad Request')) {
            res.json({
                success: false,
                error: 'Job not found or not yet submitted',
                message: 'This job may not have been submitted to SmileID yet, or the job ID is invalid.',
                userId: req.params.userId,
                jobId: req.params.jobId,
                timestamp: new Date().toISOString(),
                suggestion: 'Try submitting the images first, then check status.'
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Failed to check job status',
                message: error.message,
                userId: req.params.userId,
                jobId: req.params.jobId,
                timestamp: new Date().toISOString()
            });
        }
    }
});

// NEW: Manual job submission endpoint
router.post('/submit-job', async (req, res) => {
    try {
        const { userId, jobId, images, jobType = 'biometric_kyc' } = req.body;
        
        if (!userId || !jobId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields',
                message: 'userId and jobId are required'
            });
        }

        logger.info('Manual job submission requested:', { userId, jobId, jobType });
        
        const connection = smileConfig.getConnection();
        
        // Create job data structure
        const jobData = {
            user_id: userId,
            job_id: jobId,
            job_type: jobType,
            // Note: In a real implementation, you'd process the actual image files here
            // For now, we'll create a mock submission
        };

        // Submit the job (this is where actual image processing would happen)
        // const result = await connection.submit_job(jobData);
        
        // For testing, we'll simulate a successful submission
        const mockResult = {
            success: true,
            job_id: jobId,
            user_id: userId,
            message: 'Job submitted successfully (simulated)',
            timestamp: new Date().toISOString()
        };

        logger.info('Job submission completed:', mockResult);

        res.json({
            success: true,
            result: mockResult,
            message: 'Job submitted for processing',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.error('Job submission failed:', {
            error: error.message,
            stack: error.stack,
            body: req.body
        });
        
        res.status(500).json({
            success: false,
            error: 'Job submission failed',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// NEW: Simple status endpoint that doesn't require SmileID API
router.get('/simple/:userId/:jobId', (req, res) => {
    const { userId, jobId } = req.params;
    
    // Return a simple status for testing
    res.json({
        success: true,
        status: {
            user_id: userId,
            job_id: jobId,
            job_complete: false,
            job_status: 'in_progress',
            message: 'Job is being processed',
            confidence_score: null,
            created_at: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
    });
});

module.exports = router;