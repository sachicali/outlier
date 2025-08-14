# YouTube Outlier Discovery Tool - Qwen Index

## Project Overview

The YouTube Outlier Discovery Tool is an intelligent web application that discovers high-performing YouTube videos from channels adjacent to your exclusion list, helping content creators identify trending opportunities and replicable content formats.

### Core Purpose
- Help content creators avoid saturated markets while finding adjacent opportunities
- Identify videos performing 2-5x above channel average
- Provide statistical analysis for content strategy decisions
- Enable brand alignment with discovered opportunities

## Architecture

### Frontend (client/)
- **Framework**: Next.js 14 with React 18
- **Styling**: Tailwind CSS
- **UI Components**: Lucide React icons
- **State Management**: React Context API
- **Additional Libraries**: 
  - Axios for API calls
  - Socket.IO client for real-time updates
  - React Hook Form for form handling
  - Recharts for data visualization

### Backend (server/)
- **Runtime**: Node.js with Express.js
- **Authentication**: JWT-based with role-based access control (RBAC)
- **Data Storage**: PostgreSQL with Redis caching
- **External APIs**: YouTube Data API v3
- **Queue Processing**: BullMQ for background job processing
- **Monitoring**: Custom monitoring system with Prometheus metrics
- **Security**: Comprehensive security middleware stack
- **Additional Libraries**:
  - Passport.js for authentication strategies
  - Sequelize as ORM
  - Winston for logging
  - Sentry for error tracking

### Alternative Backend (server-python/)
- **Framework**: Flask with Socket.IO
- **Data Storage**: PostgreSQL with Redis caching
- **Security**: Flask-Talisman for security headers

## Key Features

### 1. Exclusion-First Discovery
- Build exclusion lists from competitor channels (e.g., Thinknoodles, LankyBox)
- Analyzes competitor channels to identify saturated content types
- Creates comprehensive exclusion database to avoid content overlap

### 2. Adjacent Channel Detection
- Finds similar channels playing different games/content
- Searches channels in 10k-500k subscriber range
- Validates upload consistency and engagement

### 3. Statistical Outlier Analysis
- Identifies videos performing significantly above channel average
- Calculates performance scores: `(Views ÷ Subscribers) × 100`
- Applies recency and trending multipliers

### 4. Brand Adjacency Scoring
- Rates content compatibility with your brand style
- Analyzes thumbnail styles and title patterns
- Scores content tone and target audience alignment

### 5. Real-time Processing
- Live progress tracking with step-by-step analysis
- WebSocket-based updates during processing
- Asynchronous background job processing with queue system

### 6. Export & Integration
- CSV export of results
- Excel export with detailed analysis sheets
- Google Sheets integration (planned)

## Core Services

### Outlier Detection Service (`server/src/services/outlierDetectionService.js`)
The main analysis engine that performs:
1. **Exclusion List Building**: Analyzes competitor channels to extract game/content types
2. **Adjacent Channel Discovery**: Finds similar but non-overlapping channels
3. **Channel Outlier Analysis**: Identifies videos performing above channel average
4. **Brand Fit Calculation**: Scores content compatibility with user's brand

### YouTube Service (`server/src/services/youtubeService.js`)
- Wrapper around YouTube Data API v3
- Handles channel search, video retrieval, and statistics
- Implements rate limiting and error handling

### Queue Service (`server/src/services/queueService.js`)
- Background job processing with BullMQ
- Analysis job queuing and management
- Progress tracking and status updates

## Data Models

### Analysis Model
- Stores analysis configurations and results
- Tracks processing status and timestamps
- Maintains user ownership for RBAC

### Channel Model
- Stores YouTube channel metadata
- Caches subscriber counts and statistics
- Maintains exclusion status

## API Endpoints

### Core Analysis Endpoints
- `POST /api/outlier/start` - Begin outlier discovery analysis
- `GET /api/outlier/status/:analysisId` - Check processing status
- `GET /api/outlier/results/:analysisId` - Retrieve final results
- `GET /api/outlier/list` - List all analyses for user

### Export Endpoints
- `GET /api/outlier/export/:analysisId` - Export results as CSV
- `GET /api/outlier/export/:analysisId/excel` - Export results as Excel

### Authentication Endpoints
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Token refresh
- `POST /api/auth/logout` - User logout

### Configuration Endpoints
- `GET /api/config/content` - Get content configuration
- `POST /api/config/content` - Update content configuration

## Configuration System

The application uses a flexible configuration system:
- Content patterns for game identification
- Channel validation criteria
- Brand fit scoring rules
- Search queries for adjacent channels
- Processing thresholds and limits

## Security Features

### Authentication & Authorization
- JWT-based authentication with refresh tokens
- HTTP-only cookies for token storage
- Role-based access control (user/admin roles)
- API key management with scoped permissions

### Data Protection
- Input validation and sanitization
- Rate limiting with Redis
- CSRF protection
- Security headers (helmet, talisman)
- Password hashing with bcrypt

### API Security
- Request size limits
- API key rate limiting
- Scope-based access control for API keys
- Monitoring and logging of suspicious activities

## Monitoring & Observability

### Built-in Monitoring
- Real-time metrics collection
- Performance tracking
- Error reporting and logging
- Health check endpoints

### External Integrations
- Sentry for error tracking
- Prometheus for metrics collection
- Jaeger for distributed tracing

## Development Workflow

### Prerequisites
1. Node.js (v18.0.0 or higher)
2. Bun package manager
3. PostgreSQL database
4. Redis instance
5. YouTube Data API v3 key

### Setup Process
1. Install dependencies with `npm run install:all`
2. Configure environment variables in `.env` file
3. Set up PostgreSQL and Redis services
4. Obtain YouTube Data API key
5. Run development servers with `npm run dev`

### Testing
- Unit tests for services and utilities
- Integration tests for API endpoints
- End-to-end tests for critical workflows
- Test coverage reporting

## Deployment

### Backend (Server)
- Deployable to Railway/Heroku or similar platforms
- Docker support with provided Dockerfile
- Environment-based configuration

### Frontend (Client)
- Deployable to Vercel/Netlify or similar platforms
- Static site generation capabilities
- Environment-based API endpoint configuration

## Performance Considerations

### API Rate Limits
- YouTube Data API quota management (10,000 units/day default)
- Caching strategy to minimize API calls
- Batch processing for efficiency

### Caching Strategy
- Channel information cached for 24 hours
- Video data cached for 6 hours
- Search results cached for 2 hours
- Redis-based caching implementation

### Processing Optimization
- Concurrent request handling
- Background job processing with queue system
- Configurable batch sizes and limits

## Future Enhancements

### Roadmap Features
- Machine learning for brand fit prediction
- Automated competitor monitoring
- Historical trend analysis
- Team collaboration features
- Mobile app development
- Advanced analytics dashboard

### Technical Improvements
- Enhanced database persistence
- Improved caching mechanisms
- Advanced search capabilities
- Expanded export options
- Better integration with third-party tools

## Key Files and Directories

```
D:\Codebase\Outlier\
├── client/                 # Next.js frontend application
│   ├── components/         # React UI components
│   ├── pages/              # Next.js pages and routing
│   ├── contexts/           # React context providers
│   └── utils/              # Frontend utilities
├── server/                 # Node.js backend API
│   ├── src/
│   │   ├── controllers/    # Request handlers
│   │   ├── services/       # Business logic
│   │   ├── routes/         # API route definitions
│   │   ├── models/         # Database models
│   │   ├── middleware/     # Express middleware
│   │   └── utils/          # Backend utilities
│   └── logs/               # Application logs
├── server-python/          # Alternative Python backend (Flask)
├── scripts/                # Development and deployment scripts
└── documentation/          # Project documentation files
```

This index provides a comprehensive overview of the YouTube Outlier Discovery Tool, covering its architecture, features, services, and development practices.