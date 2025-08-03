const swaggerJSDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'YouTube Outlier Discovery API',
      version: '1.0.0',
      description: `
        An intelligent web application API for content creators to discover high-performing videos 
        from adjacent channels while avoiding oversaturated content.
        
        ## Features
        - User authentication with JWT tokens
        - YouTube channel and video analysis
        - Outlier detection algorithm
        - Excel and CSV export capabilities
        - Real-time analysis updates via WebSocket
        - API key management for external access
        
        ## Authentication
        Most endpoints require authentication. Use the /api/auth/login endpoint to get an access token,
        then include it in the Authorization header as 'Bearer <token>'.
        
        ## Rate Limiting
        API endpoints are rate limited to prevent abuse. Limits vary by endpoint and user role.
      `,
      contact: {
        name: 'API Support',
        email: 'support@youtubeoutlier.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: process.env.API_BASE_URL || 'http://localhost:5000',
        description: 'Development server',
      },
      {
        url: 'https://api.youtubeoutlier.com',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token obtained from /api/auth/login',
        },
        apiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'API key for external access',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            username: { type: 'string' },
            email: { type: 'string', format: 'email' },
            role: { type: 'string', enum: ['user', 'admin'] },
            isEmailVerified: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Analysis: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            description: { type: 'string' },
            status: { type: 'string', enum: ['pending', 'running', 'completed', 'failed'] },
            config: {
              type: 'object',
              properties: {
                exclusionChannels: { type: 'array', items: { type: 'string' } },
                minSubs: { type: 'integer', minimum: 1000 },
                maxSubs: { type: 'integer', minimum: 10000 },
                timeWindow: { type: 'integer', minimum: 1, maximum: 30 },
                outlierThreshold: { type: 'integer', minimum: 10, maximum: 100 },
              },
            },
            startedAt: { type: 'string', format: 'date-time' },
            completedAt: { type: 'string', format: 'date-time' },
            processingTimeMs: { type: 'integer' },
            totalOutliersFound: { type: 'integer' },
            totalChannelsAnalyzed: { type: 'integer' },
            errorMessage: { type: 'string' },
          },
        },
        Video: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            snippet: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                description: { type: 'string' },
                publishedAt: { type: 'string', format: 'date-time' },
                thumbnails: { type: 'object' },
                tags: { type: 'array', items: { type: 'string' } },
              },
            },
            statistics: {
              type: 'object',
              properties: {
                viewCount: { type: 'string' },
                likeCount: { type: 'string' },
                commentCount: { type: 'string' },
              },
            },
            outlierScore: { type: 'number', format: 'float' },
            brandFit: { type: 'number', format: 'float' },
            channelInfo: {
              type: 'object',
              properties: {
                snippet: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    description: { type: 'string' },
                  },
                },
                statistics: {
                  type: 'object',
                  properties: {
                    subscriberCount: { type: 'string' },
                    viewCount: { type: 'string' },
                    videoCount: { type: 'string' },
                  },
                },
              },
            },
          },
        },
        ApiKey: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            scopes: { type: 'array', items: { type: 'string' } },
            lastUsed: { type: 'string', format: 'date-time' },
            expiresAt: { type: 'string', format: 'date-time' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
            details: { type: 'array', items: { type: 'object' } },
          },
        },
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
          },
        },
      },
      responses: {
        UnauthorizedError: {
          description: 'Authentication information is missing or invalid',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
            },
          },
        },
        ForbiddenError: {
          description: 'Insufficient permissions',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
            },
          },
        },
        NotFoundError: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
            },
          },
        },
        ValidationError: {
          description: 'Invalid input data',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
            },
          },
        },
        InternalServerError: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
            },
          },
        },
      },
    },
    security: [
      { bearerAuth: [] },
      { apiKeyAuth: [] },
    ],
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and authorization endpoints',
      },
      {
        name: 'Analysis',
        description: 'YouTube video outlier detection and analysis',
      },
      {
        name: 'API Keys',
        description: 'API key management for external access',
      },
      {
        name: 'Health',
        description: 'System health and monitoring endpoints',
      },
      {
        name: 'Configuration',
        description: 'System configuration management',
      },
    ],
  },
  apis: [
    './src/routes/*.js', // paths to files containing OpenAPI definitions
    './src/controllers/*.js',
  ],
};

const specs = swaggerJSDoc(options);

const swaggerSetup = (app) => {
  // Swagger UI options
  const swaggerOptions = {
    explorer: true,
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      docExpansion: 'none',
      filter: true,
      showExtensions: true,
      showCommonExtensions: true,
      tryItOutEnabled: true,
    },
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info { margin: 20px 0 }
      .swagger-ui .scheme-container { margin: 20px 0; padding: 20px; background: #f5f5f5; border-radius: 5px }
    `,
    customSiteTitle: 'YouTube Outlier Discovery API Documentation',
  };

  // Serve API documentation
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, swaggerOptions));
  
  // Serve raw OpenAPI spec
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(specs);
  });

  return specs;
};

module.exports = {
  swaggerSetup,
  specs,
};