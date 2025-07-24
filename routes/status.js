const express = require('express');
const smileConfig = require('../config/smileid');
const logger = require('../utils/logger');

const router = express.Router();

// Check job status
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

        logger.info('Job status retrieved:', { 
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
            error: error.message
        });
        
        res.status(500).json({
            success: false,
            error: 'Failed to check job status',
            message: error.message,
            userId: req.params.userId,
            jobId: req.params.jobId,
            timestamp: new Date().toISOString()
        });
    }
});

// Submit job manually (for testing)
router.post('/submit', async (req, res) => {
    try {
        const jobData = req.body;
        
        logger.info('Manual job submission:', { 
            userId: jobData.user_id,
            jobType: jobData.job_type 
        });
        
        const connection = smileConfig.getConnection();
        const result = await connection.submit_job(jobData);

        res.json({
            success: true,
            result: result,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.error('Manual job submission failed:', error);
        res.status(500).json({
            success: false,
            error: 'Job submission failed',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

module.exports = router;