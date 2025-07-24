const logger = require('../utils/logger');

const validateTokenRequest = (req, res, next) => {
    const { product } = req.body;
    
    const validProducts = [
        'authentication',
        'basic_kyc', 
        'smartselfie',
        'biometric_kyc',
        'enhanced_kyc',
        'doc_verification'
    ];

    // Validate product if provided
    if (product && !validProducts.includes(product)) {
        logger.warn('Invalid product type requested:', { 
            product, 
            validProducts,
            ip: req.ip 
        });
        
        return res.status(400).json({
            success: false,
            error: 'Invalid product type',
            validProducts: validProducts,
            received: product
        });
    }

    // Log valid request
    logger.info('Token request validation passed:', {
        product: product || 'biometric_kyc (default)',
        userId: req.body.userId || 'auto-generated',
        ip: req.ip
    });

    next();
};

const validateCallback = (req, res, next) => {
    const requiredFields = ['user_id', 'job_id', 'ResultCode'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    
    if (missingFields.length > 0) {
        logger.warn('Invalid callback received:', {
            missingFields,
            body: req.body
        });
        
        return res.status(400).json({
            success: false,
            error: 'Missing required callback fields',
            missingFields: missingFields
        });
    }
    
    next();
};

module.exports = {
    validateTokenRequest,
    validateCallback
};