/**
 * Express.js Application Setup
 * World-class architecture with comprehensive middleware stack
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
const cookieParser = require('cookie-parser');

// Import route modules
const routes = require('./routes');

// Import middlewares
const { errorHandler, asyncHandler } = require('./middlewares/errorHandler');
const requestLogger = require('./middlewares/requestLogger');
const { securityValidation, sanitizeInputs } = require('./middlewares/validation');
const correlationId = require('./middlewares/correlationId');
const tenantContext = require('./middlewares/tenantContext');
const retellPayloadMiddleware = require('./middlewares/retellPayload');
const oauthController = require('./controllers/oauthController');

// Import configuration

/**
 * Create Express application with enterprise-grade configuration
 */
function createApp() {
  const app = express();

  // Trust proxy for Azure App Service
  app.set('trust proxy', 1);

  // Security middleware
  app.use(
    helmet({
      contentSecurityPolicy: false, // Allow for API responses
      crossOriginEmbedderPolicy: false
    })
  );

  // CORS configuration
  // Allows same-origin requests by default
  // For cross-origin requests, explicitly set ALLOWED_ORIGINS env var (comma-separated)
  app.use(
    cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || false,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID']
    })
  );

  // Compression middleware
  app.use(compression());

  // Cookie parsing (required for refresh token cookies)
  app.use(cookieParser());

  // Body parsing middleware
  app.use(
    express.json({
      limit: '10mb',
      verify: (req, res, buf) => {
        // Store raw body for webhook signature verification
        req.rawBody = buf;
      }
    })
  );
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(express.text({ limit: '10mb' }));

  // Rate limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.RATE_LIMIT_MAX || 1000, // requests per window
    message: {
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: req => {
      // Skip rate limiting for health checks
      return req.path === '/health' || req.path === '/warmup';
    }
  });
  app.use(limiter);

  // Correlation ID middleware (must be early)
  app.use(correlationId);

  // Request logging middleware
  app.use(requestLogger);

  // Input sanitization
  app.use(sanitizeInputs);

  // Security validation
  app.use(securityValidation);

  // Tenant context middleware - creates req.tenant for all requests
  // Falls back to environment variables if agentAuth is not used
  app.use(tenantContext);

  // Normalize Retell tool invocation payloads
  app.use(retellPayloadMiddleware);

  // Authentication is now handled at the route level:
  // - Retell webhooks: retellAuth middleware validates HMAC signatures
  // - API endpoints: agentAuth middleware validates Bearer tokens
  // See src/routes/webhooks.js and src/routes/api.js for implementation

  // OAuth routes (not behind agent auth - used for onboarding)
  const oauthRoutes = require('./routes/oauth');
  app.use('/', oauthRoutes);

  // API routes
  app.use('/api', routes);

  if (process.env.NODE_ENV === 'production') {
    const staticDir = path.resolve(__dirname, '../frontend/dist');

    app.use(express.static(staticDir));

    app.get('*', (req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api') || req.path.startsWith('/authcallback')) {
        return next();
      }

      return res.sendFile(path.join(staticDir, 'index.html'));
    });
  }

  // Global error handler (must be last)
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
