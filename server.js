const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
require('dotenv').config();

const tokenRoutes = require('./routes/token');
const callbackRoutes = require('./routes/callback');
const statusRoutes = require('./routes/status');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.smileidentity.com"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "blob:"],
            mediaSrc: ["'self'", "blob:"],
            connectSrc: ["'self'", "https://api.smileidentity.com", "https://testapi.smileidentity.com"],
            frameSrc: ["'self'", "https://cdn.smileidentity.com"]
        }
    }
}));

app.use(cors({
    origin: ['http://localhost:3000', 'https://localhost:3000'],
    credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files
app.use(express.static('public'));

// API Routes
app.use('/api/token', tokenRoutes);
app.use('/api/callback', callbackRoutes);
app.use('/api/status', statusRoutes);

// Root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Debug route
app.get('/debug', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'debug.html'));
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        smileId: {
            partnerId: process.env.SMILE_PARTNER_ID ? 'Set' : 'Missing',
            apiKey: process.env.SMILE_API_KEY ? 'Set' : 'Missing',
            serverMode: process.env.SMILE_SERVER_MODE
        }
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    logger.error('Server Error:', err);
    res.status(500).json({ 
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
    logger.info(`SmileID Server running on port ${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV}`);
    logger.info(`Visit: http://localhost:${PORT}`);
    logger.info(`Debug: http://localhost:${PORT}/debug`);
    logger.info(`Health: http://localhost:${PORT}/health`);
});

module.exports = app;