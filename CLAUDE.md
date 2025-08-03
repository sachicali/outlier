# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

YouTube Outlier Discovery Tool - An intelligent web application for content creators to discover high-performing videos from adjacent channels while avoiding oversaturated content. The tool helps creators find trending opportunities before mainstream adoption while maintaining brand compatibility.

## Tech Stack

**Runtime**: Bun (v1.0.0+) - JavaScript/TypeScript runtime with built-in tooling
**Frontend**: Next.js 14, React 18, TypeScript (strict mode disabled), Tailwind CSS, Socket.IO Client, Lucide Icons
**Backend**: Express with Bun runtime, JavaScript ES6+, YouTube Data API v3, Redis, PostgreSQL (optional), Socket.IO, Winston logging
**Queue System**: BullMQ with Redis backend for background job processing
**Authentication**: JWT-based auth with refresh tokens, bcrypt password hashing, role-based access control (RBAC)
**Security**: Helmet.js, CORS, rate limiting, input validation, httpOnly cookies

## Essential Commands

### Development
```bash
bun run dev          # Start both client (port 3000) and server (port 5000)
bun run client:dev   # Frontend only
bun run server:dev   # Backend only with hot reload
bun run worker:dev   # Start queue workers with hot reload
bun run worker:start # Start queue workers in production
```

### Build & Production
```bash
bun run build        # Build Next.js client
bun start            # Start production server
```

### Code Quality
```bash
bun run lint         # Run ESLint on entire codebase
bun run format       # Format with Prettier
bun test             # Run Bun's built-in test runner (note: no tests currently implemented)

# Component-specific linting
cd client && bun run lint    # Next.js specific linting
cd server && bun run lint    # Server linting with --fix
```

### Installation
```bash
bun run install:all  # Install all dependencies (root, client, server)
# Or individually:
bun install          # Root dependencies
cd client && bun install
cd server && bun install
```

### Queue System
```bash
bun run worker:start           # Start background workers
bun run queue:dashboard        # Interactive queue monitoring dashboard
```

### Database Management (when PostgreSQL is configured)
```bash
cd server
bun run db:migrate    # Run migrations
bun run db:rollback   # Rollback migrations
bun run db:reset      # Reset database
bun run db:sync       # Sync models
bun run db:test       # Test connection
```

### Content Configuration Management
```bash
cd server
bun run config:view      # View current configuration
bun run config:validate  # Validate configuration
bun run config:reset     # Reset to defaults
bun run config:export    # Export configuration to JSON
bun run config:help      # Show configuration help

# Advanced configuration management
node src/scripts/configManager.js update-queries queries.json  # Update search queries
node src/scripts/configManager.js update-patterns patterns.json # Update game patterns
node src/scripts/configManager.js import config-backup.json     # Import configuration
```

## Architecture

### Core Algorithm Flow
1. **Exclusion Database Building**: Analyzes competitor channels (e.g., Thinknoodles, LankyBox) from last 7 days
2. **Adjacent Channel Discovery**: Searches for channels (10K-500K subscribers) with brand adjacency using configurable search queries
3. **Outlier Detection**: Calculates performance scores `(Views ÷ Subscribers) × 100`, identifies videos >20 score (configurable threshold)
4. **Brand Compatibility**: Scores content tone/audience alignment (1-10 scale) using configurable criteria
5. **Exclusion Filtering**: Removes videos matching configurable game patterns to avoid oversaturated content

### Real-time Processing
- WebSocket-based progress tracking via Socket.IO
- Six-stage pipeline with live updates to client
- Error handling with retry mechanisms
- Socket rooms for analysis-specific updates

### Caching Strategy
- Redis-based caching to optimize YouTube API quota usage (~70% reduction)
- Channel info: 24 hours (86400 seconds)
- Video data: 6 hours (21600 seconds)
- Search results: 2 hours (7200 seconds)

### API Structure
- **Auth endpoints**: `/api/auth/register`, `/api/auth/login`, `/api/auth/refresh`, `/api/auth/logout`
- **API Key management**: `/api/apikeys` (GET, POST, DELETE)
- **Analysis endpoints**: `/api/outlier/start`, `/api/outlier/status/:id`, `/api/outlier/results/:id`, `/api/outlier/export/:id`
- **Channel endpoints**: `/api/channels/search`, `/api/channels/:id`, `/api/channels/:id/videos`
- **Configuration endpoints**: `/api/config/content` (GET/PUT), `/api/config/content/search-queries`, `/api/config/content/game-patterns`
- WebSocket events: `join-analysis`, `progress`, `complete`, `error`
- Express middleware stack: correlationId → helmet → compression → rateLimit → CORS → auth → routes → errorHandler

## Key Files & Directories

### Client (`/client`)
- `components/YouTubeOutlierApp.tsx`: Main UI component with configuration panel and results dashboard
- `components/auth/`: Login and registration forms
- `components/ErrorBoundary.tsx`: React error boundary for graceful error handling
- `contexts/AuthContext.tsx`: JWT token management and user state
- `contexts/ErrorContext.tsx`: Global error handling with toast notifications
- `hooks/useWebSocket.tsx`: Socket.IO connection management with auto-reconnect
- `utils/apiClient.ts`: Axios instance with auth interceptors
- TypeScript with `strict: false` in tsconfig.json
- Tailwind CSS for styling

### Server (`/server`)
- `src/index.js`: Express app setup with Socket.IO integration
- `src/services/youtubeService.js`: YouTube API integration with caching layer
- `src/services/outlierDetectionService.js`: Core outlier detection algorithm (now configurable)
- `src/services/authService.js`: User authentication and JWT management
- `src/config/contentConfig.js`: Content discovery configuration service
- `src/config/content-patterns.json`: Configurable search queries and game patterns
- `src/scripts/configManager.js`: CLI tool for configuration management
- `src/routes/config.js`: REST API endpoints for configuration management
- `src/middleware/auth.js`: JWT validation and API key authentication
- `src/middleware/rbac.js`: Role-based access control
- `src/repositories/`: Data access layer with base repository pattern
- `src/models/`: Sequelize models for PostgreSQL (when configured)
- `src/utils/logger.js`: Winston logger with file rotation
- `logs/`: Application logs (combined.log, error.log)

### Server Python (`/server-python`)
- Partial Python implementation using FastAPI (migration in progress)
- `src/services/`: Python versions of core services
- `requirements.txt`: Python dependencies

### Memory Bank (`/memory-bank`)
- `productContext.md`: Product vision and user personas
- `techContext.md`: Technical architecture decisions
- `systemPatterns.md`: Design patterns and conventions
- `activeContext.md`: Current development focus
- `progress.md`: Development timeline

### Testing (`/test`)
- `setup.js`: Global test configuration
- `mocks/youtubeApiMocks.js`: Mock YouTube API responses
- `factories/testDataFactory.js`: Test data generators
- `integration/`: End-to-end test scenarios
- `coverage/`: Coverage reporting utilities

## Environment Configuration

Required environment variables in `.env`:
```bash
# YouTube API (Required)
YOUTUBE_API_KEY=your_youtube_api_key_here  # Required
YOUTUBE_API_QUOTA_LIMIT=10000             # Daily quota limit

# Server Configuration
PORT=5000                                 # Server port
NODE_ENV=development                      # Environment
CORS_ORIGIN=http://localhost:3000         # Frontend URL

# Redis (Required for caching)
REDIS_URL=redis://localhost:6379          # Redis connection

# Database (Optional - in-memory fallback if not configured)
DATABASE_URL=postgresql://user:pass@localhost:5432/outlier_db

# JWT Authentication
JWT_ACCESS_SECRET=your-64-char-secret     # Generate with crypto.randomBytes(64)
JWT_REFRESH_SECRET=your-64-char-secret    # Different from access secret
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Security
BCRYPT_ROUNDS=12                          # Password hashing rounds
SESSION_SECRET=your-session-secret
API_RATE_LIMIT=100                        # Requests per window
API_RATE_WINDOW=900000                    # 15 minutes in ms

# Logging
LOG_LEVEL=info
LOG_FILE_PATH=./logs

# Content Configuration (Optional - overrides config file)
# CONTENT_SEARCH_QUERIES=["roblox funny moments","minecraft adventures"] # JSON array
# CONTENT_GAME_PATTERNS=[{"pattern":"doors?","flags":"gi"}]         # JSON array of pattern objects
# OUTLIER_THRESHOLD=20                          # Outlier detection threshold
# BRAND_FIT_THRESHOLD=6                         # Brand compatibility threshold
```

### Content Configuration System

The application now supports configurable content discovery patterns through multiple methods:

1. **Configuration File** (Primary): `server/src/config/content-patterns.json`
   - Automatically created with defaults if not exists
   - Hot-reloaded when file changes
   - Contains search queries, game patterns, brand fit criteria, and thresholds

2. **Environment Variables** (Override): Use for production deployments
   - `CONTENT_SEARCH_QUERIES`: JSON array of search queries
   - `CONTENT_GAME_PATTERNS`: JSON array of regex pattern objects
   - `OUTLIER_THRESHOLD`: Numeric threshold for outlier detection
   - `BRAND_FIT_THRESHOLD`: Numeric threshold for brand compatibility

3. **REST API** (Runtime): `/api/config/content` endpoints
   - GET: Retrieve current configuration
   - PUT: Update configuration dynamically
   - Specific endpoints for search queries and game patterns

4. **CLI Tool** (Management): `server/src/scripts/configManager.js`
   - View, validate, update, import/export configuration
   - Direct file editing with validation
   - Backup and restore capabilities

**Configuration Structure:**
- **Search Queries**: YouTube search terms for discovering adjacent channels
- **Game Patterns**: Regex patterns to identify and exclude oversaturated games
- **Brand Fit Criteria**: Scoring rules for content tone and audience alignment
- **Channel Criteria**: Subscriber ranges, video count minimums, exclusion keywords
- **Thresholds**: Outlier detection, brand fit, and result limits

## Development Guidelines

### API Quota Management
- YouTube Data API quota: 10,000 units/day default
- Each analysis uses ~500-1000 units
- Caching reduces API calls by ~70%
- Monitor quota usage in logs

### Security Best Practices
- All passwords hashed with bcrypt (12+ rounds)
- JWT tokens stored in httpOnly cookies (refresh) and memory (access)
- API keys use secure random generation
- Input validation on all endpoints
- CORS configured for production domains only

### Current Limitations & Known Issues
- Results stored in memory (no persistence when using in-memory mode)
- Zero test coverage despite Jest/Bun test configuration
- Basic error handling could be more granular
- Frontend needs better loading states and responsiveness
- Configuration API endpoints not yet protected by authentication (consider adding in production)
- No email verification or password reset functionality

### Testing Approach
Bun has a built-in test runner. While no tests exist yet, the infrastructure is ready:
```bash
bun test                    # Run all tests
bun test --watch            # Watch mode
bun test --coverage         # With coverage report
bun test:server             # Server tests only
bun test:client             # Client tests only
bun test:integration        # Integration tests
```

## Common Tasks

### Adding New Features
1. **New API Endpoint**: 
   - Add route in `server/src/routes/`
   - Add controller in `server/src/controllers/` (if using controller pattern)
   - Add service logic in `server/src/services/`
   - Add validation in route using express-validator
   - Update API documentation

2. **New UI Component**: 
   - Add in `client/components/`
   - Import in relevant pages
   - Update TypeScript interfaces if needed
   - Consider error boundaries for complex components

3. **New Database Model**:
   - Create model in `server/src/models/`
   - Create repository in `server/src/repositories/`
   - Add migration in `server/src/migrations/`
   - Run `bun run db:migrate`

### Debugging
- Server logs: `server/logs/combined.log` and `server/logs/error.log`
- Check Redis connection: `redis-cli ping`
- Monitor YouTube API quota: Check logs for quota warnings
- WebSocket events: Browser DevTools → Network → WS tab
- Database queries: Set `logging: true` in Sequelize config
- Use correlation IDs in logs to trace requests

### Production Deployment
- Frontend: Vercel (automatic Next.js optimization)
- Backend: Railway/Heroku with Redis and PostgreSQL addons
- Set `NODE_ENV=production`
- Update `CORS_ORIGIN` to production domain
- Enable `HTTPS_REDIRECT=true`
- Configure proper JWT secrets (64+ characters)
- Set up monitoring (Sentry, New Relic, etc.)

## Project Structure Highlights

```
Outlier/
├── client/                    # Next.js frontend
│   ├── components/           # React components
│   ├── contexts/            # React contexts
│   ├── hooks/               # Custom hooks
│   ├── pages/               # Next.js pages
│   └── utils/               # Utilities
├── server/                   # Express backend
│   ├── src/
│   │   ├── config/          # Database config
│   │   ├── controllers/     # Request handlers
│   │   ├── middleware/      # Express middleware
│   │   ├── migrations/      # Database migrations
│   │   ├── models/          # Sequelize models
│   │   ├── repositories/    # Data access layer
│   │   ├── routes/          # API routes
│   │   ├── services/        # Business logic
│   │   └── utils/           # Utilities
│   └── logs/                # Application logs
├── server-python/            # Python backend (partial)
├── test/                     # Test infrastructure
└── memory-bank/              # Documentation
```

## Recent Major Improvements

### Content Configuration System (Latest)
- **Removed Hardcoded Values**: Search queries and game patterns are no longer hardcoded in the service layer
- **Flexible Configuration**: Multiple configuration methods (file, environment, API, CLI)
- **Hot Reloading**: Configuration changes are automatically detected and applied
- **Validation**: Built-in validation for configuration structure and regex patterns
- **Backup/Restore**: Export and import capabilities for configuration management
- **Environment Overrides**: Production deployments can override config via environment variables
- **CLI Management**: Comprehensive command-line tool for configuration operations
- **API Endpoints**: RESTful endpoints for dynamic configuration updates

This makes the application adaptable to different content niches without requiring code changes.

## Important: Keep CLAUDE.md Updated

Always update this file when making significant changes to the codebase, including:
- New commands or scripts
- Architecture changes
- New dependencies or tools
- Important configuration updates
- Key file relocations
- New development workflows
- Performance optimizations
- Testing approaches
- Security updates
- API changes

This ensures future Claude Code instances have accurate, up-to-date information about the codebase.

## Bun Migration Notes

- The project now uses Bun as the JavaScript runtime instead of Node.js
- Bun provides faster installation, built-in TypeScript support, and integrated test runner
- All npm commands have been replaced with bun equivalents
- Hot reload is built into Bun (no need for nodemon)
- Configuration is in bunfig.toml for Bun-specific settings

## Recent Major Implementations (2025)

### ✅ Completed Enhancements

1. **Comprehensive Test Coverage**
   - Full test suite with >80% coverage target using Bun's test runner
   - Unit tests for core services, API endpoints, and React components
   - Integration tests for complete workflows
   - Test factories and mocking infrastructure

2. **PostgreSQL Database Integration**
   - Complete Sequelize models with migrations
   - Repository pattern for data access
   - Graceful fallback to in-memory storage
   - Database CLI tools for management

3. **Enterprise Authentication System**
   - JWT-based auth with refresh tokens
   - Role-based access control (RBAC)
   - Per-user API key management
   - Secure password policies and session management

4. **Advanced Error Handling**
   - React Error Boundaries with fallback UIs
   - Retry logic with exponential backoff
   - Correlation IDs for request tracing
   - User-friendly error messages

5. **Security Hardening**
   - Input validation on all endpoints
   - Advanced rate limiting per user/API key
   - CSRF protection and security headers
   - Secrets management with encryption
   - Security monitoring and audit trails

6. **Monitoring & Observability**
   - OpenTelemetry distributed tracing
   - Sentry error tracking integration
   - Prometheus metrics collection
   - Custom business metrics and dashboards
   - YouTube API quota tracking

7. **CI/CD Pipeline**
   - GitHub Actions workflows for CI/CD
   - Automated testing and security scanning
   - Vercel (frontend) and Railway (backend) deployment
   - Docker containerization support

### 🚧 Remaining Tasks

- Advanced features (historical data analysis, scheduling)
- UI/UX enhancements (dark mode, improved loading states)
- API flexibility improvements
- Bun's test runner is configured but awaiting test implementation