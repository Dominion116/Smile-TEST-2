class SmileIDIntegration {
  constructor() {
    this.token = null;
    this.jobId = null;
    this.userId = null;
    this.partnerId = null;
    this.environment = null;
    this.lastCapturedImages = null;

    this.initializeElements();
    this.attachEventListeners();
    this.checkSmileIDAvailability();
    this.logActivity("info", "SmileID Integration initialized");
  }

  initializeElements() {
    this.userIdInput = document.getElementById("userId");
    this.productSelect = document.getElementById("product");
    this.initializeBtn = document.getElementById("initializeBtn");
    this.checkStatusBtn = document.getElementById("checkStatusBtn");
    this.clearLogsBtn = document.getElementById("clearLogsBtn");
    this.loading = document.getElementById("loading");
    this.smileCamera = document.getElementById("smileCamera");
    this.statusDisplay = document.getElementById("status-display");
    this.statusContent = document.getElementById("status-content");
    this.results = document.getElementById("results");
  }

  attachEventListeners() {
    this.initializeBtn.addEventListener("click", () => this.initialize());
    this.checkStatusBtn.addEventListener("click", () => this.checkJobStatus());
    this.clearLogsBtn.addEventListener("click", () => this.clearLogs());

    // Listen for ALL possible SmileID events to catch image capture
    const allPossibleEvents = [
      'SmileID::ImagesComputed',
      'SmileID::ImageCaptured', 
      'SmileID::PhotoTaken',
      'SmileID::SelfieReview',
      'SmileID::ReviewReady',
      'SmileID::CaptureComplete',
      'SmileID::JobComplete'
    ];

    allPossibleEvents.forEach(eventName => {
      this.smileCamera.addEventListener(eventName, (event) => {
        console.log(`🎯 Event fired: ${eventName}`, event.detail);
        this.logActivity('success', `Event detected: ${eventName}`, event.detail);
        
        // Store images if available
        if (event.detail && event.detail.images) {
          this.lastCapturedImages = event.detail.images;
        }
        
        // Force show buttons for any image-related event
        if (eventName.includes('Images') || eventName.includes('Photo') || eventName.includes('Capture') || eventName.includes('Review')) {
          setTimeout(() => {
            this.forceShowButtonsAfterCapture();
          }, 1000);
        }
        
        // Handle the specific events
        if (eventName === 'SmileID::ImagesComputed') {
          this.handleImagesComputed(event);
        } else if (eventName === 'SmileID::JobComplete') {
          this.handleJobComplete(event);
        }
      });
    });

    // Also listen for standard events
    this.smileCamera.addEventListener("SmileID::Error", (event) => {
      this.logActivity("error", "SmileID error occurred", event.detail);
      this.handleError(event);
    });

    this.smileCamera.addEventListener("SmileID::Close", (event) => {
      this.logActivity("warning", "SmileID interface closed", event.detail);
      this.handleClose(event);
    });

    this.smileCamera.addEventListener("SmileID::Instructions", (event) => {
      this.logActivity("info", "Instructions displayed", event.detail);
    });

    this.smileCamera.addEventListener("SmileID::CameraReady", (event) => {
      this.logActivity("info", "Camera ready for capture", event.detail);
      
      // Start monitoring for image capture after camera is ready
      this.startImageCaptureMonitoring();
    });
  }

  // NEW: Monitor for image capture even without proper events
  startImageCaptureMonitoring() {
    console.log('📱 Starting image capture monitoring...');
    
    // Check every 2 seconds if image appears in the component
    const monitorInterval = setInterval(() => {
      const hasImage = this.checkForCapturedImage();
      
      if (hasImage && !document.getElementById('manual-submit-buttons')) {
        console.log('🎯 Image detected via monitoring - showing buttons');
        this.logActivity('success', 'Image capture detected via monitoring');
        this.forceShowButtonsAfterCapture();
        
        // Stop monitoring once buttons are shown
        clearInterval(monitorInterval);
      }
    }, 2000);
    
    // Stop monitoring after 5 minutes
    setTimeout(() => {
      clearInterval(monitorInterval);
    }, 300000);
  }

  // NEW: Check if an image has been captured
  checkForCapturedImage() {
    try {
      // Look for image elements in the SmileID component
      if (this.smileCamera.shadowRoot) {
        const images = this.smileCamera.shadowRoot.querySelectorAll('img, video, canvas');
        const hasVisibleImage = Array.from(images).some(img => 
          img.offsetWidth > 100 && img.offsetHeight > 100
        );
        
        // Also check for review text or captured image indicators
        const reviewText = this.smileCamera.shadowRoot.textContent || '';
        const hasReviewIndicators = reviewText.includes('Review') || 
                                  reviewText.includes('clear enough') || 
                                  reviewText.includes('use this');
        
        return hasVisibleImage || hasReviewIndicators;
      }
      
      // Fallback: check for "Review Selfie" text in the main page
      const pageText = document.body.textContent || '';
      return pageText.includes('Review Selfie') || pageText.includes('Is this clear enough');
      
    } catch (error) {
      console.log('Error checking for captured image:', error);
      return false;
    }
  }

  async checkSmileIDAvailability() {
    let attempts = 0;
    const maxAttempts = 10;

    const checkInterval = setInterval(() => {
      attempts++;

      if (customElements.get("smart-camera-web")) {
        clearInterval(checkInterval);
        this.logActivity("success", "SmileID web component loaded successfully");
        return;
      }

      if (attempts >= maxAttempts) {
        clearInterval(checkInterval);
        this.logActivity("error", "SmileID web component failed to load after 5 seconds");
        this.showError("SmileID script failed to load. Please refresh the page or check your internet connection.");
        return;
      }

      this.logActivity("info", `Waiting for SmileID component... (${attempts}/${maxAttempts})`);
    }, 500);
  }

  async initialize() {
    try {
      // Check if SmileID is available
      if (!customElements.get("smart-camera-web")) {
        throw new Error("SmileID web component not available. Please refresh the page.");
      }

      this.showLoading(true, "Generating authentication token...");
      this.initializeBtn.disabled = true;

      const userId = this.userIdInput.value.trim();
      const product = this.productSelect.value;

      this.logActivity("info", "Starting initialization", {
        userId: userId || "auto-generated",
        product,
      });

      const response = await fetch("/api/token/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: userId || undefined,
          product: product,
        }),
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

        this.logActivity("success", "Token generated successfully", {
          jobId: this.jobId,
          userId: this.userId,
          environment: this.environment,
          duration: data.duration,
        });

        await this.setupSmileCamera();
        this.checkStatusBtn.disabled = false;
        this.updateStatus("Ready for verification");
      } else {
        throw new Error(data.message || "Token generation failed");
      }
    } catch (error) {
      this.logActivity("error", "Initialization failed", {
        error: error.message,
      });
      this.showError(`Failed to initialize: ${error.message}`);
    } finally {
      this.showLoading(false);
      this.initializeBtn.disabled = false;
    }
  }

  async setupSmileCamera() {
    this.logActivity("info", "Setting up SmileID camera interface...");

    try {
      // Remove any existing manual buttons
      const existingButtons = document.getElementById("manual-submit-buttons");
      if (existingButtons) {
        existingButtons.remove();
      }

      // Clear any existing attributes
      this.smileCamera.removeAttribute("token");
      this.smileCamera.removeAttribute("partner-id");

      // Wait a moment then set new attributes
      await new Promise((resolve) => setTimeout(resolve, 500));

      this.smileCamera.setAttribute("token", this.token);
      this.smileCamera.setAttribute("partner-id", this.partnerId);

      // Show the camera interface
      this.smileCamera.style.display = "block";
      this.smileCamera.style.width = "100%";
      this.smileCamera.style.height = "500px";

      this.logActivity("success", "SmileID camera interface ready", {
        partnerId: this.partnerId,
        tokenLength: this.token.length,
      });

      // Verify component is working
      setTimeout(() => {
        this.verifyComponent();
      }, 2000);
    } catch (error) {
      this.logActivity("error", "Camera setup failed", {
        error: error.message,
      });
      throw error;
    }
  }

  verifyComponent() {
    const rect = this.smileCamera.getBoundingClientRect();
    const isVisible = rect.width > 0 && rect.height > 0;

    if (isVisible) {
      this.logActivity("success", "Component verification passed", {
        dimensions: `${Math.round(rect.width)}x${Math.round(rect.height)}`,
        hasShadowDOM: !!this.smileCamera.shadowRoot,
      });
    } else {
      this.logActivity("warning", "Component may not be rendering properly", {
        dimensions: `${rect.width}x${rect.height}`,
        display: this.smileCamera.style.display,
      });
    }
  }

  async checkJobStatus() {
    if (!this.userId || !this.jobId) {
      this.logActivity("error", "Cannot check status - no active job");
      return;
    }

    try {
      this.logActivity("info", "Checking job status...", {
        userId: this.userId,
        jobId: this.jobId,
      });

      const response = await fetch(`/api/status/${this.userId}/${this.jobId}`);
      const data = await response.json();

      if (data.success) {
        this.logActivity("success", "Job status retrieved", data.status);
        this.updateStatus(data.status);

        // Auto-refresh if job is still in progress
        if (data.status && !data.status.job_complete) {
          setTimeout(() => {
            if (this.jobId === data.jobId) {
              this.checkJobStatus();
            }
          }, 5000);
        }
      } else {
        this.logActivity("error", "Status check failed", data);
      }
    } catch (error) {
      this.logActivity("error", "Status check error", { error: error.message });
    }
  }

  // Handle the ImagesComputed event (if it fires)
  handleImagesComputed(event) {
    console.log("🎯 handleImagesComputed called!", event);
    this.logActivity("success", "Images captured - creating submit buttons", event.detail);

    this.updateStatus("Images captured - Ready for review");

    // Store images
    if (event.detail && event.detail.images) {
      this.lastCapturedImages = event.detail.images;
      console.log("Images stored:", Object.keys(event.detail.images));
    }

    // Create buttons after image capture
    this.forceShowButtonsAfterCapture();
  }

  // NEW: Force show buttons after capture (works regardless of events)
  forceShowButtonsAfterCapture() {
    console.log("🔧 Forcing submit buttons after image capture...");
    
    // Remove any existing buttons
    document.querySelectorAll('#manual-submit-buttons').forEach(el => el.remove());
    
    const container = document.createElement('div');
    container.id = 'manual-submit-buttons';
    container.style.cssText = `
      display: flex !important;
      flex-direction: column;
      align-items: center;
      gap: 20px;
      margin: 20px auto;
      padding: 30px;
      background: #ffffff;
      border: 3px solid #22c55e;
      border-radius: 12px;
      max-width: 600px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.15);
      z-index: 1000;
      position: relative;
      animation: slideInFromBottom 0.5s ease-out;
    `;

    // Success message
    const successMessage = document.createElement('div');
    successMessage.style.cssText = `
      background: #dcfce7;
      color: #166534;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
      font-weight: 600;
      font-size: 18px;
      border: 2px solid #22c55e;
      width: 100%;
    `;
    successMessage.innerHTML = `
      <div style="margin-bottom: 10px;">📸 Photo Captured Successfully!</div>
      <div style="font-size: 14px; font-weight: normal;">Please review your photo and choose an action:</div>
    `;

    // Button container
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = 'display: flex; gap: 20px; justify-content: center; flex-wrap: wrap;';

    // Submit button
    const submitBtn = document.createElement('button');
    submitBtn.textContent = '✅ Submit for Verification';
    submitBtn.style.cssText = `
      background: #22c55e !important;
      color: white !important;
      padding: 15px 30px;
      border: none;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      font-size: 16px;
      transition: all 0.3s ease;
      box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);
    `;
    submitBtn.onmouseover = () => {
      submitBtn.style.transform = 'translateY(-2px)';
      submitBtn.style.boxShadow = '0 8px 25px rgba(34, 197, 94, 0.5)';
    };
    submitBtn.onmouseout = () => {
      submitBtn.style.transform = 'translateY(0)';
      submitBtn.style.boxShadow = '0 4px 12px rgba(34, 197, 94, 0.3)';
    };
    submitBtn.onclick = () => this.handleImageSubmission();

    // Retake button
    const retakeBtn = document.createElement('button');
    retakeBtn.textContent = '🔄 Retake Photo';
    retakeBtn.style.cssText = `
      background: #f59e0b !important;
      color: white !important;
      padding: 15px 30px;
      border: none;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      font-size: 16px;
      transition: all 0.3s ease;
      box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
    `;
    retakeBtn.onmouseover = () => {
      retakeBtn.style.transform = 'translateY(-2px)';
      retakeBtn.style.boxShadow = '0 8px 25px rgba(245, 158, 11, 0.5)';
    };
    retakeBtn.onmouseout = () => {
      retakeBtn.style.transform = 'translateY(0)';
      retakeBtn.style.boxShadow = '0 4px 12px rgba(245, 158, 11, 0.3)';
    };
    retakeBtn.onclick = () => this.handleImageRetake();

    buttonContainer.appendChild(submitBtn);
    buttonContainer.appendChild(retakeBtn);

    container.appendChild(successMessage);
    container.appendChild(buttonContainer);

    // Insert after camera
    const camera = document.getElementById('smileCamera');
    camera.parentNode.insertBefore(container, camera.nextSibling);

    this.logActivity('success', 'Submit buttons created and displayed');
    console.log('✅ Submit buttons should now be visible!');
    
    // Verify insertion
    setTimeout(() => {
      const inserted = document.getElementById('manual-submit-buttons');
      console.log('Button verification:', {
        exists: !!inserted,
        visible: inserted?.offsetHeight > 0,
        position: inserted?.getBoundingClientRect()
      });
    }, 100);
  }

  // Handle when user submits the captured image
  async handleImageSubmission() {
    console.log("User submitted the captured image for verification");
    this.logActivity("success", "User submitted image - processing verification");

    // Remove buttons with animation
    const buttons = document.getElementById("manual-submit-buttons");
    if (buttons) {
      buttons.style.animation = "slideOutToBottom 0.3s ease-in";
      setTimeout(() => buttons.remove(), 300);
    }

    this.updateStatus("Submitting job to SmileID...");

    try {
      // Submit the job to backend
      const response = await fetch("/api/status/submit-job", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: this.userId,
          jobId: this.jobId,
          images: this.lastCapturedImages || { selfie: "captured-image-data" },
          jobType: this.productSelect.value,
        }),
      });

      const data = await response.json();

      if (data.success) {
        this.logActivity("success", "Job submitted successfully to SmileID", data);
        this.updateStatus("Job submitted - Processing verification...");

        // Start checking status
        setTimeout(() => {
          this.checkJobStatus();
        }, 3000);
      } else {
        throw new Error(data.message || "Job submission failed");
      }
    } catch (error) {
      this.logActivity("error", "Job submission failed", {
        error: error.message,
      });
      this.showError(`Failed to submit job: ${error.message}`);

      // Show buttons again if submission failed
      setTimeout(() => {
        this.forceShowButtonsAfterCapture();
      }, 1000);
    }
  }

  // Handle when user wants to retake the photo
  handleImageRetake() {
    console.log("User requested to retake the photo");
    this.logActivity("info", "User requested photo retake - resetting camera");

    // Remove buttons with animation
    const buttons = document.getElementById("manual-submit-buttons");
    if (buttons) {
      buttons.style.animation = "slideOutToBottom 0.3s ease-in";
      setTimeout(() => buttons.remove(), 300);
    }

    // Clear stored images
    this.lastCapturedImages = null;

    // Reset camera
    this.updateStatus("Preparing camera for new photo...");
    setTimeout(() => {
      this.setupSmileCamera();
    }, 500);
  }

  handleJobComplete(event) {
    this.updateStatus("Verification complete!");

    // Remove manual buttons if they exist
    const buttons = document.getElementById("manual-submit-buttons");
    if (buttons) buttons.remove();

    // Show completion message
    this.showSuccess("Identity verification completed successfully!");

    // Final status check
    setTimeout(() => {
      this.checkJobStatus();
    }, 1000);
  }

  handleError(event) {
    const errorDetails = event.detail || {};
    const errorMessage = errorDetails.message || errorDetails.error || "Unknown error occurred";

    this.updateStatus(`Error: ${errorMessage}`);
    this.showError(`SmileID Error: ${errorMessage}`);

    // Log detailed error information
    this.logActivity("error", "SmileID component error", {
      code: errorDetails.code,
      message: errorMessage,
      details: errorDetails,
    });
  }

  handleClose(event) {
    this.updateStatus("Interface closed by user");

    // Remove manual buttons if they exist
    const buttons = document.getElementById("manual-submit-buttons");
    if (buttons) buttons.remove();

    // Reset the interface if needed
    setTimeout(() => {
      if (this.token) {
        this.setupSmileCamera();
      }
    }, 1000);
  }

  // UI Helper Methods
  showLoading(show, message = "Loading...") {
    if (show) {
      this.loading.querySelector("p").textContent = message;
      this.loading.classList.remove("hidden");
    } else {
      this.loading.classList.add("hidden");
    }
  }

  updateStatus(status) {
    if (typeof status === "string") {
      this.statusContent.textContent = status;
    } else {
      this.statusContent.textContent = JSON.stringify(status, null, 2);
    }
    this.statusDisplay.classList.remove("hidden");
  }

  showError(message) {
    this.logActivity("error", message);
    alert(`Error: ${message}`);
  }

  showSuccess(message) {
    this.logActivity("success", message);
  }

  logActivity(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = document.createElement("div");
    logEntry.className = `log-entry ${level}`;

    const timestampSpan = document.createElement("span");
    timestampSpan.className = "timestamp";
    timestampSpan.textContent = new Date().toLocaleTimeString();

    const levelSpan = document.createElement("span");
    levelSpan.className = "level";
    levelSpan.textContent = level.toUpperCase();

    const messageSpan = document.createElement("span");
    messageSpan.className = "message";
    messageSpan.textContent = message;

    logEntry.appendChild(timestampSpan);
    logEntry.appendChild(levelSpan);
    logEntry.appendChild(messageSpan);

    if (data) {
      const dataDiv = document.createElement("div");
      dataDiv.style.marginTop = "8px";
      dataDiv.style.fontSize = "12px";
      dataDiv.style.opacity = "0.8";
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
    console[level === "error" ? "error" : level === "warning" ? "warn" : "log"](
      `[${level.toUpperCase()}] ${message}`,
      data || ""
    );
  }

  clearLogs() {
    this.results.innerHTML = "";
    this.logActivity("info", "Activity log cleared");
  }

  // Public methods for external testing
  getJobInfo() {
    return {
      userId: this.userId,
      jobId: this.jobId,
      partnerId: this.partnerId,
      environment: this.environment,
      hasToken: !!this.token,
      hasImages: !!this.lastCapturedImages,
    };
  }

  async refreshToken() {
    if (!this.userId) {
      this.logActivity("error", "Cannot refresh token - no user ID");
      return;
    }

    try {
      this.logActivity("info", "Refreshing authentication token...");
      await this.initialize();
    } catch (error) {
      this.logActivity("error", "Token refresh failed", {
        error: error.message,
      });
    }
  }

  // Force show manual buttons (for debugging)
  forceShowManualButtons() {
    console.log("🔧 Force showing manual buttons for debugging");
    this.forceShowButtonsAfterCapture();
    this.logActivity("info", "Manual buttons forced to show");
  }
}

// Initialize the application when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  console.log("🚀 Initializing SmileID Integration Application...");

  // Add CSS animations
  if (!document.querySelector("#manual-button-styles")) {
    const style = document.createElement("style");
    style.id = "manual-button-styles";
    style.textContent = `
      @keyframes slideInFromBottom {
        from {
          opacity: 0;
          transform: translateY(30px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      
      @keyframes slideOutToBottom {
        from {
          opacity: 1;
          transform: translateY(0);
        }
        to {
          opacity: 0;
          transform: translateY(30px);
        }
      }

      /* Ensure buttons are always visible when created */
      #manual-submit-buttons {
        display: flex !important;
        visibility: visible !important;
        opacity: 1 !important;
      }
    `;
    document.head.appendChild(style);
  }

  // Create global instance for debugging
  window.smileIDApp = new SmileIDIntegration();

  // Add helpful global functions for debugging
  window.debugSmileID = {
    getJobInfo: () => window.smileIDApp.getJobInfo(),
    refreshToken: () => window.smileIDApp.refreshToken(),
    checkStatus: () => window.smileIDApp.checkJobStatus(),
    clearLogs: () => window.smileIDApp.clearLogs(),
    forceShowButtons: () => window.smileIDApp.forceShowManualButtons(),
    simulateImageCapture: () => {
      console.log("🧪 Simulating image capture...");
      window.smileIDApp.lastCapturedImages = { selfie: "test-image-data" };
      window.smileIDApp.forceShowButtonsAfterCapture();
    },
    // NEW: Force show buttons immediately (for current situation)
    showButtonsNow: () => {
      console.log("🔧 Showing buttons immediately...");
      window.smileIDApp.forceShowButtonsAfterCapture();
    }
  };

  console.log("✅ SmileID Integration ready!");
  console.log("💡 Use window.debugSmileID for debugging functions");
  console.log("🧪 Try window.debugSmileID.showButtonsNow() to show buttons immediately");
  
  // TEMPORARY: Auto-show buttons after 10 seconds if photo is visible
  setTimeout(() => {
    const pageText = document.body.textContent || '';
    if ((pageText.includes('Review Selfie') || pageText.includes('Is this clear enough')) && 
        !document.getElementById('manual-submit-buttons')) {
      console.log('🎯 Auto-detected photo review - showing buttons');
      window.smileIDApp.forceShowButtonsAfterCapture();
    }
  }, 10000);
});

// Handle page visibility changes
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && window.smileIDApp) {
    console.log("📱 Page became visible - checking component status");
    window.smileIDApp.logActivity("info", "Page became visible");
  }
});

// Handle errors globally
window.addEventListener("error", (event) => {
  if (window.smileIDApp) {
    window.smileIDApp.logActivity("error", "Global JavaScript error", {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  }
});

// Handle unhandled promise rejections
window.addEventListener("unhandledrejection", (event) => {
  if (window.smileIDApp) {
    window.smileIDApp.logActivity("error", "Unhandled promise rejection", {
      reason: event.reason,
    });
  }
});