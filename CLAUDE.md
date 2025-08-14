# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

YouTube Outlier Discovery Tool - An intelligent web application for content creators to discover high-performing videos from adjacent channels while avoiding oversaturated content. The tool helps creators find trending opportunities before mainstream adoption while maintaining brand compatibility.

## Tech Stack

**Frontend Runtime**: Bun (v1.0.0+) - JavaScript/TypeScript runtime with built-in tooling
**Frontend**: Next.js 14, React 18, TypeScript (strict mode disabled), Tailwind CSS, Socket.IO Client, Lucide Icons
**Backend Runtime**: Python 3.9+ with uv for package management
**Backend**: FastAPI/Flask, Python 3.9+, YouTube Data API v3, Redis, PostgreSQL (optional), Socket.IO, Winston logging
**Queue System**: Redis-based background job processing
**Authentication**: JWT-based auth with refresh tokens, bcrypt password hashing, role-based access control (RBAC), Two-Factor Authentication (TOTP)
**Security**: Helmet.js, CORS, rate limiting, input validation, httpOnly cookies, encrypted secrets, account lockout protection

## Essential Commands

### Development
```bash
# Start both frontend and backend
bun run dev          # Start both client (port 3000) and server (port 5000)

# Individual services
bun run client:dev   # Frontend only (Next.js with Bun)
cd server-python && uv run python src/index.py  # Backend only (Python with uv)
# Or: cd server-python && python src/index.py

# Background workers
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
# Frontend (Bun)
bun run lint         # Run ESLint on entire codebase
bun run format       # Format with Prettier
bun test             # Run Bun's built-in test runner
cd client && bun run lint    # Next.js specific linting

# Backend (Python with uv)
cd server-python
uv run black src/    # Format Python code
uv run flake8 src/   # Lint Python code
uv run pytest tests/ -v  # Run Python tests
# Or with pip:
python -m black src/
python -m flake8 src/
python -m pytest tests/ -v
```

### Installation
```bash
# Frontend (uses Bun)
cd client && bun install

# Backend (uses uv)
cd server-python && uv sync
# Or with pip if uv not available:
cd server-python && pip install -r requirements.txt

# Root dependencies
bun install
```

### Queue System
```bash
bun run worker:start           # Start background workers
bun run queue:dashboard        # Interactive queue monitoring dashboard
```

### Database Management (when PostgreSQL is configured)
```bash
cd server-python

# Run migrations
python migrations/002_add_2fa_fields.py up

# Check migration status
python migrations/002_add_2fa_fields.py status

# Rollback migrations
python migrations/002_add_2fa_fields.py down
```

### Content Configuration Management
```bash
cd server-python

# Generate system keys for production
python src/utils/crypto_utils.py generate-keys

# Test encryption utilities
python src/utils/crypto_utils.py test-encryption

# Test password hashing
python src/utils/crypto_utils.py test-password
```

### Two-Factor Authentication Management
```bash
cd server-python

# Check 2FA system status
python -c "from src.services.two_factor_service import TwoFactorService; print('2FA service ready')"

# Run 2FA tests
python -m pytest tests/test_two_factor.py -v
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

### Client (`/client`) - Next.js with Bun
- `components/YouTubeOutlierApp.tsx`: Main UI component with configuration panel and results dashboard
- `components/auth/`: Authentication components including 2FA
  - `LoginForm.tsx`: Enhanced login with 2FA support
  - `TwoFactorSetup.tsx`: Complete 2FA setup wizard with QR codes
  - `TwoFactorVerification.tsx`: 2FA verification during login
  - `TwoFactorManagement.tsx`: 2FA management interface
  - `RegisterForm.tsx`: User registration form
- `components/ErrorBoundary.tsx`: React error boundary for graceful error handling
- `contexts/AuthContext.tsx`: JWT token management, user state, and 2FA support
- `contexts/ErrorContext.tsx`: Global error handling with toast notifications
- `hooks/useWebSocket.tsx`: Socket.IO connection management with auto-reconnect
- `utils/apiClient.ts`: Axios instance with auth interceptors
- TypeScript with `strict: false` in tsconfig.json
- Tailwind CSS for styling

### Server (`/server`) - Legacy Node.js/Bun Implementation
- **NOTE**: This directory contains the legacy implementation. Current development uses `/server-python`
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

### Server Python (`/server-python`) - Primary Backend with uv
- **Primary backend implementation** using Flask/FastAPI with Python 3.9+
- `src/index.py`: Flask application entry point
- `src/services/`: Core business logic services
  - `auth_service.py`: Enhanced authentication with 2FA support
  - `two_factor_service.py`: Complete TOTP 2FA implementation
  - `youtube_service.py`: YouTube API integration
  - `outlier_detection_service.py`: Core outlier detection algorithm
- `src/routes/`: API endpoint definitions
  - `auth.py`: Authentication endpoints
  - `two_factor.py`: 2FA management endpoints
  - `channels.py`: Channel analysis endpoints
  - `outlier.py`: Outlier detection endpoints
- `src/middleware/`: Request processing middleware
  - `auth.py`: JWT validation and 2FA verification
  - `rbac.py`: Role-based access control
  - `error_handler.py`: Global error handling
- `src/models/`: Database models
  - `user.py`: User model with 2FA fields
  - `analysis.py`: Analysis tracking model
- `src/utils/`: Utility modules
  - `crypto_utils.py`: Encryption, hashing, and security utilities
  - `logger.py`: Logging configuration
- `migrations/`: Database migration scripts
  - `002_add_2fa_fields.py`: 2FA database schema migration
- `tests/`: Comprehensive test suite
  - `test_two_factor.py`: 2FA implementation tests
- `requirements.txt`: Python dependencies
- `pyproject.toml`: uv configuration
- `uv.lock`: Locked dependency versions

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

# Two-Factor Authentication (2FA)
TWO_FACTOR_ENCRYPTION_KEY=your-32-byte-base64-key  # Generate with crypto_utils.py
# Use: python server-python/src/utils/crypto_utils.py generate-keys

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

## Runtime & Package Management

### Frontend (Bun)
- Uses Bun as the JavaScript runtime for faster performance
- Built-in TypeScript support and integrated test runner
- Hot reload capabilities without additional tools
- Configuration in bunfig.toml

### Backend (Python with uv)
- Python 3.9+ backend with uv for fast package management
- uv provides faster dependency resolution and installation
- Fallback to pip if uv is not available
- Virtual environment management through uv or venv

### Migration Notes
- Frontend migrated from Node.js to Bun for performance
- Backend implementation moved from Node.js/Express to Python/Flask
- Package management: Bun for frontend, uv for backend
- Both runtimes provide excellent development experience with hot reload

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
   - **Two-Factor Authentication (2FA)**
     - TOTP implementation with QR code setup
     - Backup codes for account recovery
     - Rate limiting and account lockout protection
     - Encrypted secret storage

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
   - **2FA Security Features**
     - AES-256 encryption for sensitive data
     - Constant-time comparison for sensitive operations
     - Session invalidation on security changes
     - Comprehensive audit logging

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

## Two-Factor Authentication (2FA) System

### ✅ Complete Implementation

A comprehensive 2FA system has been implemented with enterprise-grade security:

#### Backend Features
- **TOTP Implementation**: RFC 6238 compliant with 30-second windows
- **QR Code Generation**: Automatic QR codes for authenticator app setup
- **Backup Codes**: 10 single-use recovery codes per user
- **Encrypted Storage**: All secrets encrypted at rest with AES-256
- **Rate Limiting**: Protection against brute force attacks
- **Account Lockout**: Temporary lockout after failed attempts
- **Session Security**: Secure temporary sessions for 2FA flow

#### Frontend Components
- **TwoFactorSetup**: Complete setup wizard with QR code display
- **TwoFactorVerification**: Login verification with TOTP/backup codes
- **TwoFactorManagement**: Full management interface for users
- **Enhanced LoginForm**: Seamless 2FA integration

#### Security Features
- Encrypted TOTP secrets and backup codes
- Rate limiting (5 attempts per 15 minutes)
- Account lockout protection
- Audit logging for all 2FA events
- Session invalidation on security changes
- Constant-time comparison for sensitive operations

#### API Endpoints
- `POST /api/auth/2fa/setup` - Initialize 2FA setup
- `POST /api/auth/2fa/enable` - Enable 2FA after verification
- `POST /api/auth/2fa/verify` - Verify TOTP during login
- `POST /api/auth/2fa/recovery` - Login with backup code
- `POST /api/auth/2fa/disable` - Disable 2FA with password
- `POST /api/auth/2fa/backup-codes` - Regenerate backup codes
- `GET /api/auth/2fa/status` - Get 2FA status

#### Testing
- Comprehensive test suite in `server-python/tests/test_two_factor.py`
- Unit tests for all 2FA services
- Integration tests for complete flows
- Security testing for rate limiting and encryption

#### Documentation
- Complete implementation guide: `server-python/2FA_IMPLEMENTATION.md`
- Security considerations and best practices
- API reference and usage examples
- Troubleshooting and maintenance guides

### 🚧 Remaining Tasks

- Advanced features (historical data analysis, scheduling)
- UI/UX enhancements (dark mode, improved loading states)
- API flexibility improvements
- Frontend test implementation with Bun
- Hardware Security Key (WebAuthn) support
- SMS backup option (with security warnings)