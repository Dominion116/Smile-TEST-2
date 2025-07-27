// server.js - Node.js Backend for SmileID Production Integration with Government DB Matching

const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const { v4: UUID } = require("uuid");
const path = require("path");
require("dotenv").config();

// SmileID Server-to-Server SDK
const SIDCore = require("smile-identity-core");
const SIDSignature = SIDCore.Signature;
const SIDWebAPI = SIDCore.WebApi;

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: "10mb" }));
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);

// Serve static files
app.use(express.static("public"));

// Environment validation
const requiredEnvVars = [
  "SMILE_PARTNER_ID",
  "SMILE_API_KEY",
  "SMILE_SID_SERVER",
];

requiredEnvVars.forEach((envVar) => {
  if (!process.env[envVar]) {
    console.error(`❌ Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
});

console.log("✅ SmileID Production Configuration:");
console.log(`   Partner ID: ${process.env.SMILE_PARTNER_ID}`);
console.log(
  `   Server: ${
    process.env.SMILE_SID_SERVER === "1" ? "PRODUCTION" : "SANDBOX"
  }`
);
console.log(`   Environment: ${process.env.NODE_ENV || "development"}`);

// SmileID Configuration
const smileConfig = {
  partnerId: process.env.SMILE_PARTNER_ID,
  apiKey: process.env.SMILE_API_KEY,
  sidServer: process.env.SMILE_SID_SERVER, // 0 for sandbox, 1 for production
  callbackUrl: process.env.SMILE_CALLBACK_URL || "/api/smileid/callback",
};

// Initialize SmileID connection
function createSmileConnection() {
  return new SIDWebAPI(
    smileConfig.partnerId,
    smileConfig.callbackUrl,
    smileConfig.apiKey,
    smileConfig.sidServer
  );
}

// Generate SmileID Token for Frontend with Customer Info
app.post("/api/smileid/generate-token", async (req, res) => {
  try {
    console.log("🔐 Production token generation request:", {
      user_id: req.body.user_id,
      product: req.body.product,
      has_customer_info: !!req.body.customer_info,
    });

    const { user_id, product, customer_info } = req.body;

    if (!user_id || !product) {
      return res.status(400).json({
        error: "Missing required fields: user_id, product",
      });
    }

    // Validate customer info for production KYC
    if (product === "enhanced_kyc" && !customer_info) {
      return res.status(400).json({
        error: "Customer information required for enhanced KYC",
      });
    }

    // Generate unique job ID
    const jobId = `job-${UUID()}`;

    // Get job type based on product
    const jobType = getJobType(product);

    // Create partner params with customer info
    const partnerParams = {
      user_id: user_id,
      job_id: jobId,
      job_type: jobType,
    };

    // Add customer info if provided
    if (customer_info) {
      partnerParams.customer_info = {
        first_name: customer_info.first_name,
        last_name: customer_info.last_name,
        dob: customer_info.dob,
        country: customer_info.country,
        id_type: customer_info.id_type,
        id_number: customer_info.id_number,
      };
    }

    // Generate signature for token
    const timestamp = Date.now();
    let signature;

    try {
      signature = SIDSignature.generate_sec_key(
        timestamp,
        smileConfig.partnerId,
        smileConfig.apiKey
      );
    } catch (sigError) {
      console.log("⚠️ Using alternative signature generation method");
      signature = require("crypto")
        .createHmac("sha256", smileConfig.apiKey)
        .update(`${timestamp}${smileConfig.partnerId}`)
        .digest("hex");
    }

    // Create token payload
    const tokenPayload = {
      ...partnerParams,
      partner_id: smileConfig.partnerId,
      timestamp: timestamp,
      sec_key: signature,
      environment: smileConfig.sidServer === "1" ? "production" : "sandbox",
    };

    // Encode token (base64 for simplicity, use JWT in production for better security)
    const token = Buffer.from(JSON.stringify(tokenPayload)).toString("base64");

    console.log("✅ Production token generated successfully");
    console.log(`   User ID: ${user_id}`);
    console.log(`   Job ID: ${jobId}`);
    console.log(`   Job Type: ${jobType}`);
    console.log(`   Product: ${product}`);
    if (customer_info) {
      console.log(
        `   Customer: ${customer_info.first_name} ${customer_info.last_name}`
      );
    }

    res.json({
      token: token,
      job_id: jobId,
      user_id: user_id,
      partner_id: smileConfig.partnerId,
      environment: smileConfig.sidServer === "1" ? "production" : "sandbox",
    });
  } catch (error) {
    console.error("❌ Token generation error:", error);
    res.status(500).json({
      error: "Failed to generate token",
      details: error.message,
    });
  }
});

// Submit verification to SmileID with Government Database Matching
app.post("/api/smileid/submit-verification", async (req, res) => {
  try {
    console.log("🚀 Production KYC verification submission");

    const { user_id, images, meta, customer_info, id_info, product } = req.body;

    // Validate required fields
    if (!user_id || !images || !Array.isArray(images)) {
      return res.status(400).json({
        error: "Missing required fields: user_id, images",
      });
    }

    // Validate customer info for government database matching
    if (product === "enhanced_kyc") {
      const requiredFields = [
        "first_name",
        "last_name",
        "dob",
        "country",
        "id_type",
        "id_number",
      ];
      const missingFields = requiredFields.filter((field) => !id_info?.[field]);

      if (missingFields.length > 0) {
        return res.status(400).json({
          error:
            "Missing required customer information for government database matching",
          missing_fields: missingFields,
        });
      }
    }

    // Generate unique job ID for this submission
    const jobId = `job-${UUID()}`;
    const jobType = getJobType(product);

    console.log(
      `📊 Processing KYC for: ${id_info?.first_name} ${id_info?.last_name}`
    );
    console.log(`📄 Document: ${id_info?.id_type} - ${id_info?.id_number}`);
    console.log(`🌍 Country: ${id_info?.country}`);
    console.log(`🔍 Product: ${product}`);

    // Prepare partner params
    const partnerParams = {
      user_id: user_id,
      job_id: jobId,
      job_type: jobType,
      libraryVersion: meta?.version || "web-v2.0.0",
    };

    // Process images - ensure they're in the correct format
    const processedImages = images.map((img, index) => {
      return {
        image: img.image, // base64 image data
        image_type_id: img.image_type_id || (index + 1).toString(),
      };
    });

    console.log(`📸 Processing ${processedImages.length} images`);
    processedImages.forEach((img, index) => {
      const sizeKB = Math.round(img.image.length / 1024);
      console.log(
        `   Image ${index + 1}: Type ${img.image_type_id}, Size: ${sizeKB}KB`
      );
    });

    // Create SmileID connection
    const connection = createSmileConnection();

    // Prepare ID info for government database matching
    const smileIdInfo = {
      country: id_info.country,
      id_type: mapIdTypeToSmileID(id_info.id_type),
      id_number: id_info.id_number,
      first_name: id_info.first_name,
      last_name: id_info.last_name,
      dob: id_info.dob, // Format: YYYY-MM-DD
    };

    // Add optional fields if available
    if (customer_info?.gender) {
      smileIdInfo.gender = customer_info.gender;
    }

    // Submission options for production
    const options = {
      return_job_status: true,
      return_history: true,
      return_images: false, // Don't return images to save bandwidth
      signature: true, // Enable signature verification
      timestamp: true,
    };

    // For enhanced KYC, enable government database matching
    if (product === "enhanced_kyc") {
      options.enhanced_kyc = true;
      options.government_database_check = true;
      console.log("🏛️ Government database matching ENABLED");
    } else {
      console.log("📄 Document verification only (no government DB check)");
    }

    console.log("📤 Submitting to SmileID production servers...");
    console.log("🆔 ID Info:", {
      country: smileIdInfo.country,
      id_type: smileIdInfo.id_type,
      first_name: smileIdInfo.first_name,
      last_name: smileIdInfo.last_name,
      dob: smileIdInfo.dob,
    });

    // Submit job to SmileID with complete ID info
    const result = await connection.submit_job(
      partnerParams,
      processedImages,
      smileIdInfo, // Complete customer info for government DB matching
      options
    );

    console.log("✅ SmileID production submission successful:");
    console.log(`   Job ID: ${result.job_id || jobId}`);
    console.log(`   Status: ${result.job_complete ? "Complete" : "Pending"}`);
    console.log(`   Success: ${result.job_success ? "Yes" : "No"}`);

    // Log government database results if available
    if (result.result && result.result.government_check) {
      const govCheck = result.result.government_check;
      console.log("🏛️ Government Database Results:");
      console.log(
        `   Database Match: ${govCheck.database_match ? "FOUND" : "NOT FOUND"}`
      );
      console.log(
        `   Identity Match: ${govCheck.identity_match ? "VERIFIED" : "FAILED"}`
      );
      console.log(`   Confidence: ${govCheck.confidence || "N/A"}`);
    }

    // Prepare comprehensive response
    const response = {
      status: "success",
      jobId: result.job_id || jobId,
      smileJobComplete: result.job_complete || false,
      smileJobSuccess: result.job_success || false,
      result: result.result || {},
      confidence: result.confidence || null,
      timestamp: new Date().toISOString(),
      images_processed: processedImages.length,
      user_id: user_id,
      product: product,
      government_check_enabled: product === "enhanced_kyc",
    };

    // Add detailed verification results
    if (result.result) {
      response.verification_result = {
        document_verification: result.result.document || {},
        face_verification: result.result.face || {},
        government_database: result.result.government_check || null,
        overall_result: result.result.overall || {},
        confidence_scores: result.result.confidence || {},
      };
    }

    // Add compliance information for production use
    response.compliance = {
      kyc_completed: result.job_complete && result.job_success,
      government_verified:
        result.result?.government_check?.identity_match || false,
      document_authentic: result.result?.document?.authentic || false,
      identity_confidence: result.confidence || 0,
      verification_timestamp: new Date().toISOString(),
      regulatory_status: getComplianceStatus(result, product),
    };

    console.log(
      `✅ KYC verification ${
        response.compliance.kyc_completed ? "COMPLETED" : "PENDING"
      }`
    );
    console.log(
      `🏛️ Government verification: ${
        response.compliance.government_verified ? "PASSED" : "FAILED"
      }`
    );

    res.json(response);
  } catch (error) {
    console.error("❌ Production KYC verification error:", error);

    res.status(500).json({
      error: "KYC verification submission failed",
      details: error.message,
      timestamp: new Date().toISOString(),
      job_id: `error-${UUID()}`,
    });
  }
});

// Enhanced callback endpoint for production results
app.post("/api/smileid/callback", (req, res) => {
  try {
    console.log("📞 SmileID production callback received:");
    console.log(JSON.stringify(req.body, null, 2));

    const callbackData = req.body;

    // Validate callback signature in production
    if (process.env.NODE_ENV === "production") {
      const isValidSignature = validateCallbackSignature(req);
      if (!isValidSignature) {
        console.error("❌ Invalid callback signature");
        return res.status(401).json({ error: "Invalid signature" });
      }
    }

    // Process the callback data
    console.log(
      `📊 Job ${callbackData.job_id} - ${
        callbackData.job_success ? "SUCCESS" : "FAILED"
      }`
    );

    if (callbackData.job_success) {
      console.log("✅ KYC verification successful");

      // Log government database results
      if (callbackData.result?.government_check) {
        const govCheck = callbackData.result.government_check;
        console.log("🏛️ Government Database Results:");
        console.log(`   Match Found: ${govCheck.database_match}`);
        console.log(`   Identity Verified: ${govCheck.identity_match}`);
        console.log(`   Confidence: ${govCheck.confidence}`);
      }

      // Here you would typically:
      // 1. Update customer status in your database
      // 2. Trigger compliance workflows
      // 3. Send notifications to relevant parties
      // 4. Generate audit logs

      // Example: Update customer KYC status
      updateCustomerKYCStatus(callbackData);
    } else {
      console.log("❌ KYC verification failed");
      console.log(`   Reason: ${callbackData.failure_reason || "Unknown"}`);

      // Handle failed verification
      handleFailedKYC(callbackData);
    }

    // Always respond with 200 to acknowledge receipt
    res.status(200).json({
      status: "received",
      timestamp: new Date().toISOString(),
      processed: true,
    });
  } catch (error) {
    console.error("❌ Callback processing error:", error);
    res.status(500).json({ error: "Callback processing failed" });
  }
});

// Get verification status with enhanced details
app.get("/api/smileid/status/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params;

    console.log(`📊 Status check for job: ${jobId}`);

    // In production, you would query your database for job status
    // and optionally check with SmileID for real-time updates

    // Example response structure for production
    res.json({
      job_id: jobId,
      status: "completed", // pending, completed, failed
      kyc_status: "verified", // verified, rejected, pending
      government_check: {
        performed: true,
        status: "verified",
        confidence: 0.95,
      },
      document_verification: {
        status: "authentic",
        confidence: 0.92,
      },
      compliance_status: "approved",
      timestamp: new Date().toISOString(),
      last_updated: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Status check error:", error);
    res.status(500).json({
      error: "Status check failed",
      details: error.message,
    });
  }
});

// Health check endpoint with production status
app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    smileId: {
      partnerId: smileConfig.partnerId,
      server: smileConfig.sidServer === "1" ? "PRODUCTION" : "SANDBOX",
      governmentDbEnabled: smileConfig.sidServer === "1",
    },
    features: {
      enhanced_kyc: true,
      government_database_matching: smileConfig.sidServer === "1",
      document_verification: true,
      face_verification: true,
    },
  });
});

// Helper Functions

function getJobType(product) {
  const jobTypes = {
    doc_verification: 5,
    enhanced_kyc: 1, // Enhanced KYC with government DB matching
    biometric_kyc: 1,
    smartselfie: 4,
    basic_kyc: 1,
    authentication: 2,
  };

  return jobTypes[product] || 5;
}

function mapIdTypeToSmileID(idType) {
  const typeMapping = {
    PASSPORT: "PASSPORT",
    NATIONAL_ID: "NATIONAL_ID",
    DRIVERS_LICENSE: "DRIVERS_LICENSE",
    VOTER_ID: "VOTER_ID",
    RESIDENT_PERMIT: "RESIDENT_PERMIT",
  };

  return typeMapping[idType] || idType;
}

function getComplianceStatus(smileResult, product) {
  if (!smileResult.job_success) {
    return "rejected";
  }

  if (product === "enhanced_kyc") {
    const govCheck = smileResult.result?.government_check;
    if (govCheck?.identity_match && govCheck?.database_match) {
      return "approved";
    } else {
      return "requires_review";
    }
  } else {
    // For document verification only
    const docCheck = smileResult.result?.document;
    if (docCheck?.authentic) {
      return "approved";
    } else {
      return "requires_review";
    }
  }
}

function validateCallbackSignature(req) {
  // Implement signature validation for production security
  // This is a simplified example - implement proper HMAC validation
  const signature = req.headers["x-smile-signature"];
  const payload = JSON.stringify(req.body);

  if (!signature) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac("sha256", smileConfig.apiKey)
    .update(payload)
    .digest("hex");

  return signature === expectedSignature;
}

function updateCustomerKYCStatus(callbackData) {
  // Implement your database update logic here
  console.log(
    `📝 Updating customer KYC status for job: ${callbackData.job_id}`
  );

  // Example database update
  // await db.customers.update(
  //     { job_id: callbackData.job_id },
  //     {
  //         kyc_status: 'verified',
  //         government_verified: callbackData.result?.government_check?.identity_match,
  //         verification_date: new Date(),
  //         compliance_status: 'approved'
  //     }
  // );
}

function handleFailedKYC(callbackData) {
  // Implement your failed KYC handling logic
  console.log(`⚠️ Handling failed KYC for job: ${callbackData.job_id}`);

  // Example actions:
  // - Send notification to compliance team
  // - Update customer status
  // - Log for review
  // - Trigger retry workflow if appropriate
}

// Error handling middleware
app.use((error, req, res, next) => {
  console.error("❌ Server error:", error);
  res.status(500).json({
    error: "Internal server error",
    message: error.message,
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "Endpoint not found",
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
  });
});

// Start server
app.listen(PORT, () => {
  console.log("🚀 SmileID Production KYC Server Started");
  console.log(`   Port: ${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(
    `   SmileID Server: ${
      smileConfig.sidServer === "1" ? "PRODUCTION" : "SANDBOX"
    }`
  );
  console.log(
    `   Government DB Matching: ${
      smileConfig.sidServer === "1" ? "ENABLED" : "DISABLED"
    }`
  );
  console.log("");
  console.log("📍 Available Production KYC Endpoints:");
  console.log(`   POST http://localhost:${PORT}/api/smileid/generate-token`);
  console.log(
    `   POST http://localhost:${PORT}/api/smileid/submit-verification`
  );
  console.log(`   POST http://localhost:${PORT}/api/smileid/callback`);
  console.log(`   GET  http://localhost:${PORT}/api/smileid/status/:jobId`);
  console.log(`   GET  http://localhost:${PORT}/api/health`);
  console.log("");
  console.log("🔧 Production Configuration:");
  console.log(
    `   Set SMILE_SID_SERVER=1 for production government database matching`
  );
  console.log(`   Set SMILE_SID_SERVER=0 for sandbox testing`);
  console.log(
    `   Current: ${
      smileConfig.sidServer === "1" ? "PRODUCTION MODE" : "SANDBOX MODE"
    }`
  );
});

module.exports = app;
