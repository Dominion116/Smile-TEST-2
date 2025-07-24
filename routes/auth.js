const express = require('express');
const smileConfig = require('../config/smileid');
const logger = require('../utils/logger');

const router = express.Router();

// Check job status
router.get('/status/:userId/:jobId', async (req, res) => {
    try {
        const { userId, jobId } = req.params;
        
        const connection = smileConfig.getConnection();
        const jobStatus = await connection.get_job_status(userId, jobId);

        res.json({
            success: true,
            status: jobStatus
        });

    } catch (error) {
        logger.error('Job status check failed:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to check job status',
            message: error.message
        });
    }
});

// Submit job manually (for testing)
router.post('/submit-job', async (req, res) => {
    try {
        const jobData = req.body;
        
        const connection = smileConfig.getConnection();
        const result = await connection.submit_job(jobData);

        res.json({
            success: true,
            result: result
        });

    } catch (error) {
        logger.error('Job submission failed:', error);
        res.status(500).json({
            success: false,
            error: 'Job submission failed',
            message: error.message
        });
    }
});

module.exports = router;