class SmileIDIntegration {
    constructor() {
        this.token = null;
        this.jobId = null;
        this.userId = null;
        this.partnerId = null;
        this.environment = null;
        
        this.initializeElements();
        this.attachEventListeners();
        this.checkSmileIDAvailability();
        this.logActivity('info', 'SmileID Integration initialized');
    }

    initializeElements() {
        this.userIdInput = document.getElementById('userId');
        this.productSelect = document.getElementById('product');
        this.initializeBtn = document.getElementById('initializeBtn');
        this.checkStatusBtn = document.getElementById('checkStatusBtn');
        this.clearLogsBtn = document.getElementById('clearLogsBtn');
        this.loading = document.getElementById('loading');
        this.smileCamera = document.getElementById('smileCamera');
        this.statusDisplay = document.getElementById('status-display');
        this.statusContent = document.getElementById('status-content');
        this.results = document.getElementById('results');
    }

    attachEventListeners() {
        this.initializeBtn.addEventListener('click', () => this.initialize());
        this.checkStatusBtn.addEventListener('click', () => this.checkJobStatus());
        this.clearLogsBtn.addEventListener('click', () => this.clearLogs());
        
        // SmileID event listeners
        this.smileCamera.addEventListener('SmileID::ImagesComputed', (event) => {
            this.logActivity('success', 'Images captured successfully', event.detail);
            this.handleImagesComputed(event);
        });

        this.smileCamera.addEventListener('SmileID::JobComplete', (event) => {
            this.logActivity('success', 'Job completed successfully', event.detail);
            this.handleJobComplete(event);
        });

        // FIXED: Corrected the SmileID::Error event listener
        this.smileCamera.addEventListener('SmileID::Error', (event) => {
            this.logActivity('error', 'SmileID error occurred', event.detail);
            this.handleError(event);
        });

        this.smileCamera.addEventListener('SmileID::Close', (event) => {
            this.logActivity('warning', 'SmileID interface closed', event.detail);
            this.handleClose(event);
        });

        // Additional SmileID events
        this.smileCamera.addEventListener('SmileID::Instructions', (event) => {
            this.logActivity('info', 'Instructions displayed', event.detail);
        });

        this.smileCamera.addEventListener('SmileID::CameraReady', (event) => {
            this.logActivity('info', 'Camera ready for capture', event.detail);
        });
    }

    async checkSmileIDAvailability() {
        let attempts = 0;
        const maxAttempts = 10;
        
        const checkInterval = setInterval(() => {
            attempts++;
            
            if (customElements.get('smart-camera-web')) {
                clearInterval(checkInterval);
                this.logActivity('success', 'SmileID web component loaded successfully');
                return;
            }
            
            if (attempts >= maxAttempts) {
                clearInterval(checkInterval);
                this.logActivity('error', 'SmileID web component failed to load after 5 seconds');
                this.showError('SmileID script failed to load. Please refresh the page or check your internet connection.');
                return;
            }
            
            this.logActivity('info', `Waiting for SmileID component... (${attempts}/${maxAttempts})`);
        }, 500);
    }

    async initialize() {
        try {
            // Check if SmileID is available
            if (!customElements.get('smart-camera-web')) {
                throw new Error('SmileID web component not available. Please refresh the page.');
            }

            this.showLoading(true, 'Generating authentication token...');
            this.initializeBtn.disabled = true;

            const userId = this.userIdInput.value.trim();
            const product = this.productSelect.value;

            this.logActivity('info', 'Starting initialization', { 
                userId: userId || 'auto-generated', 
                product 
            });

            const response = await fetch('/api/token/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: userId || undefined,
                    product: product
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            if (data.success) {
                this.token = data.token;
                this.jobId = data.jobId;
                this.userId = data.userId;
                this.partnerId = data.partnerId;
                this.environment = data.environment;

                this.logActivity('success', 'Token generated successfully', {
                    jobId: this.jobId,
                    userId: this.userId,
                    environment: this.environment,
                    duration: data.duration
                });

                await this.setupSmileCamera();
                this.checkStatusBtn.disabled = false;
                this.updateStatus('Ready for verification');
                
            } else {
                throw new Error(data.message || 'Token generation failed');
            }

        } catch (error) {
            this.logActivity('error', 'Initialization failed', { error: error.message });
            this.showError(`Failed to initialize: ${error.message}`);
        } finally {
            this.showLoading(false);
            this.initializeBtn.disabled = false;
        }
    }

    async setupSmileCamera() {
        this.logActivity('info', 'Setting up SmileID camera interface...');
        
        try {
            // Clear any existing attributes
            this.smileCamera.removeAttribute('token');
            this.smileCamera.removeAttribute('partner-id');
            
            // Wait a moment then set new attributes
            await new Promise(resolve => setTimeout(resolve, 500));
            
            this.smileCamera.setAttribute('token', this.token);
            this.smileCamera.setAttribute('partner-id', this.partnerId);
            
            // Show the camera interface
            this.smileCamera.style.display = 'block';
            this.smileCamera.style.width = '100%';
            this.smileCamera.style.height = '500px';
            
            this.logActivity('success', 'SmileID camera interface ready', {
                partnerId: this.partnerId,
                tokenLength: this.token.length
            });
            
            // Verify component is working
            setTimeout(() => {
                this.verifyComponent();
            }, 2000);
            
        } catch (error) {
            this.logActivity('error', 'Camera setup failed', { error: error.message });
            throw error;
        }
    }

    verifyComponent() {
        const rect = this.smileCamera.getBoundingClientRect();
        const isVisible = rect.width > 0 && rect.height > 0;
        
        if (isVisible) {
            this.logActivity('success', 'Component verification passed', {
                dimensions: `${Math.round(rect.width)}x${Math.round(rect.height)}`,
                hasShadowDOM: !!this.smileCamera.shadowRoot
            });
        } else {
            this.logActivity('warning', 'Component may not be rendering properly', {
                dimensions: `${rect.width}x${rect.height}`,
                display: this.smileCamera.style.display
            });
        }
    }

    async checkJobStatus() {
        if (!this.userId || !this.jobId) {
            this.logActivity('error', 'Cannot check status - no active job');
            return;
        }

        try {
            this.logActivity('info', 'Checking job status...', { 
                userId: this.userId, 
                jobId: this.jobId 
            });
            
            const response = await fetch(`/api/status/${this.userId}/${this.jobId}`);
            const data = await response.json();

            if (data.success) {
                this.logActivity('success', 'Job status retrieved', data.status);
                this.updateStatus(data.status);
                
                // Auto-refresh if job is still in progress
                if (data.status && !data.status.job_complete) {
                    setTimeout(() => {
                        if (this.jobId === data.jobId) { // Only if still the same job
                            this.checkJobStatus();
                        }
                    }, 5000);
                }
            } else {
                this.logActivity('error', 'Status check failed', data);
            }

        } catch (error) {
            this.logActivity('error', 'Status check error', { error: error.message });
        }
    }

    handleImagesComputed(event) {
        this.updateStatus('Images captured - Processing...');
        
        // Store image data for potential debugging
        if (event.detail && event.detail.images) {
            this.lastCapturedImages = event.detail.images;
        }
        
        // Start polling for job completion
        setTimeout(() => {
            this.checkJobStatus();
        }, 2000);
    }

    handleJobComplete(event) {
        this.updateStatus('Verification complete!');
        
        // Show completion message
        this.showSuccess('Identity verification completed successfully!');
        
        // Final status check
        setTimeout(() => {
            this.checkJobStatus();
        }, 1000);
    }

    handleError(event) {
        const errorDetails = event.detail || {};
        const errorMessage = errorDetails.message || errorDetails.error || 'Unknown error occurred';
        
        this.updateStatus(`Error: ${errorMessage}`);
        this.showError(`SmileID Error: ${errorMessage}`);
        
        // Log detailed error information
        this.logActivity('error', 'SmileID component error', {
            code: errorDetails.code,
            message: errorMessage,
            details: errorDetails
        });
    }

    handleClose(event) {
        this.updateStatus('Interface closed by user');
        
        // Reset the interface if needed
        setTimeout(() => {
            if (this.token) {
                this.setupSmileCamera();
            }
        }, 1000);
    }

    // UI Helper Methods
    showLoading(show, message = 'Loading...') {
        if (show) {
            this.loading.querySelector('p').textContent = message;
            this.loading.classList.remove('hidden');
        } else {
            this.loading.classList.add('hidden');
        }
    }

    updateStatus(status) {
        if (typeof status === 'string') {
            this.statusContent.textContent = status;
        } else {
            this.statusContent.textContent = JSON.stringify(status, null, 2);
        }
        this.statusDisplay.classList.remove('hidden');
    }

    showError(message) {
        this.logActivity('error', message);
        // You could also show a toast notification here
        alert(`Error: ${message}`);
    }

    showSuccess(message) {
        this.logActivity('success', message);
        // You could also show a toast notification here
        // For now, we'll just log it
    }

    logActivity(level, message, data = null) {
        const timestamp = new Date().toISOString();
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry ${level}`;
        
        const timestampSpan = document.createElement('span');
        timestampSpan.className = 'timestamp';
        timestampSpan.textContent = new Date().toLocaleTimeString();
        
        const levelSpan = document.createElement('span');
        levelSpan.className = 'level';
        levelSpan.textContent = level.toUpperCase();
        
        const messageSpan = document.createElement('span');
        messageSpan.className = 'message';
        messageSpan.textContent = message;
        
        logEntry.appendChild(timestampSpan);
        logEntry.appendChild(levelSpan);
        logEntry.appendChild(messageSpan);
        
        if (data) {
            const dataDiv = document.createElement('div');
            dataDiv.style.marginTop = '8px';
            dataDiv.style.fontSize = '12px';
            dataDiv.style.opacity = '0.8';
            dataDiv.textContent = JSON.stringify(data, null, 2);
            logEntry.appendChild(dataDiv);
        }
        
        // Add to top of results
        this.results.insertBefore(logEntry, this.results.firstChild);
        
        // Keep only last 50 entries
        while (this.results.children.length > 50) {
            this.results.removeChild(this.results.lastChild);
        }
        
        // Console log for debugging
        console[level === 'error' ? 'error' : level === 'warning' ? 'warn' : 'log'](
            `[${level.toUpperCase()}] ${message}`, 
            data || ''
        );
    }

    clearLogs() {
        this.results.innerHTML = '';
        this.logActivity('info', 'Activity log cleared');
    }

    // Public methods for external testing
    getJobInfo() {
        return {
            userId: this.userId,
            jobId: this.jobId,
            partnerId: this.partnerId,
            environment: this.environment,
            hasToken: !!this.token
        };
    }

    async refreshToken() {
        if (!this.userId) {
            this.logActivity('error', 'Cannot refresh token - no user ID');
            return;
        }
        
        try {
            this.logActivity('info', 'Refreshing authentication token...');
            await this.initialize();
        } catch (error) {
            this.logActivity('error', 'Token refresh failed', { error: error.message });
        }
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Initializing SmileID Integration Application...');
    
    // Create global instance for debugging
    window.smileIDApp = new SmileIDIntegration();
    
    // Add some helpful global functions for debugging
    window.debugSmileID = {
        getJobInfo: () => window.smileIDApp.getJobInfo(),
        refreshToken: () => window.smileIDApp.refreshToken(),
        checkStatus: () => window.smileIDApp.checkJobStatus(),
        clearLogs: () => window.smileIDApp.clearLogs()
    };
    
    console.log('✅ SmileID Integration ready!');
    console.log('💡 Use window.debugSmileID for debugging functions');
});

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && window.smileIDApp) {
        console.log('📱 Page became visible - checking component status');
        window.smileIDApp.logActivity('info', 'Page became visible');
    }
});

// Handle errors globally
window.addEventListener('error', (event) => {
    if (window.smileIDApp) {
        window.smileIDApp.logActivity('error', 'Global JavaScript error', {
            message: event.message,
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno
        });
    }
});

// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
    if (window.smileIDApp) {
        window.smileIDApp.logActivity('error', 'Unhandled promise rejection', {
            reason: event.reason
        });
    }
});