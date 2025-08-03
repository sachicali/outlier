# Technical Context - YouTube Outlier Discovery Tool

## Technology Stack Overview

### Frontend Stack
- **Framework**: Next.js 14 with React 18
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS 3.3.6
- **Icons**: Lucide React 0.294.0
- **Charts**: Recharts 2.8.0
- **HTTP Client**: Axios 1.6.2
- **Real-time**: Socket.IO Client 4.7.4

### Backend Stack
- **Runtime**: Node.js 18+ 
- **Framework**: Express.js 4.18.2
- **Language**: JavaScript (ES6+)
- **API Integration**: Google APIs 128.0.0 (YouTube Data API v3)
- **Caching**: Redis 4.6.10
- **Database**: PostgreSQL 8.11.3 (optional, for production)
- **Real-time**: Socket.IO 4.7.4
- **Logging**: Winston 3.11.0

### Infrastructure & DevOps
- **Development**: Concurrently for multi-process management
- **Process Manager**: Nodemon for development
- **Testing**: Jest 29.7.0 + Supertest 6.3.3
- **Linting**: ESLint 8.57.0
- **Code Formatting**: Prettier 3.1.1
- **Containerization**: Docker support planned
- **Deployment**: Vercel (frontend), Railway/Heroku (backend)

## Development Environment

### Prerequisites
```bash
Node.js: v18.0.0 or higher
npm: v9.0.0 or higher
Redis: Latest stable (local or cloud)
YouTube Data API v3 Key
PostgreSQL: Optional (for production persistence)
```

### Local Setup
```bash
# Clone and install
cd D:\Codebase\Outlier
npm run install:all

# Environment configuration
cp .env.example .env
# Edit .env with required API keys

# Start development
npm run dev  # Runs both frontend and backend
```

### Environment Variables
```bash
# Required
YOUTUBE_API_KEY=your_youtube_api_key_here
REDIS_URL=redis://localhost:6379

# Optional
DATABASE_URL=postgresql://user:pass@localhost:5432/outlier_db
PORT=5000
CORS_ORIGIN=http://localhost:3000
NODE_ENV=development
```

## API Dependencies & Constraints

### YouTube Data API v3

**Quota Management**
- **Daily Limit**: 10,000 units (default, can be increased)
- **Cost per Analysis**: ~500-1000 units
- **Operations**:
  - Channel search: ~100 units per query
  - Video details: ~1 unit per video  
  - Channel statistics: ~1 unit per channel

**Rate Limiting Strategy**
```javascript
// Current implementation
MAX_CONCURRENT_REQUESTS: 5
BATCH_SIZE: 50
REQUEST_DELAY: 100ms between calls
```

**Caching Strategy**
```javascript
Channel Info: 24 hours (86400s)
Video Data: 6 hours (21600s)  
Search Results: 2 hours (7200s)
```

### Redis Caching

**Configuration**
- **Connection**: Automatic reconnection with exponential backoff
- **Memory Usage**: ~100MB for typical usage patterns
- **Persistence**: RDB snapshots + AOF for durability
- **Clustering**: Ready for Redis Cluster in production

**Cache Keys Structure**
```bash
channel_videos_{channelId}_{maxResults}_{publishedAfter}
channel_info_{channelId}
search_videos_{query}_{publishedAfter}_{maxResults}
```

## Performance Considerations

### Backend Optimization

**Request Batching**
- YouTube API calls batched where possible
- Video statistics fetched in groups of 50
- Channel information cached aggressively

**Memory Management**
```javascript
// In-memory storage for analysis results
const analysisResults = new Map();
// TODO: Move to Redis/PostgreSQL for production
```

**Error Handling**
- Graceful degradation on API failures
- Retry logic with exponential backoff
- Circuit breaker pattern for external services

### Frontend Optimization

**Bundle Size Management**
- Tree shaking enabled
- Code splitting by route
- Lazy loading for non-critical components

**Real-time Updates**
- Socket.IO connection management
- Efficient state updates during analysis
- Progress tracking without UI blocking

## Scalability Architecture

### Current Limitations
- **Single Server**: No horizontal scaling implemented
- **Memory Storage**: Analysis results stored in-memory
- **API Quota Sharing**: Single YouTube API key for all users
- **No Authentication**: Open access (development only)

### Production Scaling Strategy

**Horizontal Scaling**
```mermaid
graph TD
    LB[Load Balancer] --> API1[API Server 1]
    LB --> API2[API Server 2] 
    LB --> API3[API Server 3]
    
    API1 --> Redis[(Redis Cluster)]
    API2 --> Redis
    API3 --> Redis
    
    API1 --> PG[(PostgreSQL)]
    API2 --> PG  
    API3 --> PG
```

**Resource Requirements (Estimated)**
```yaml
Small Scale (100 concurrent users):
  - API Servers: 2x 2GB RAM, 2 CPU
  - Redis: 1x 4GB RAM
  - PostgreSQL: 1x 8GB RAM, 4 CPU
  
Medium Scale (1000 concurrent users):
  - API Servers: 4x 4GB RAM, 4 CPU
  - Redis Cluster: 3x 8GB RAM
  - PostgreSQL: 2x 16GB RAM, 8 CPU (Primary/Replica)
```

## Security Considerations

### Current Implementation
- **CORS**: Configured for development environment
- **Rate Limiting**: Express-rate-limit for API endpoints
- **Input Validation**: Express-validator for request validation
- **Headers**: Helmet.js for security headers
- **Compression**: gzip compression enabled

### Production Security Requirements
```javascript
// TODO: Implement for production
Authentication: JWT-based user sessions
Authorization: Role-based access control  
API Key Management: Per-user YouTube API quotas
Data Encryption: At-rest and in-transit
Audit Logging: All user actions tracked
Input Sanitization: Prevent injection attacks
```

## Monitoring & Observability

### Current Logging
```javascript
// Winston logger configuration
levels: { error: 0, warn: 1, info: 2, debug: 3 }
outputs: ['console', 'file']
files: ['logs/error.log', 'logs/combined.log']
```

### Production Monitoring (Planned)
- **APM**: Application Performance Monitoring
- **Error Tracking**: Sentry or similar
- **Metrics**: Prometheus + Grafana
- **Uptime**: External monitoring service
- **Log Aggregation**: ELK Stack or Datadog

## Deployment Strategy

### Development Environment
```bash
# Local development
npm run dev          # Both frontend + backend
npm run client:dev   # Frontend only (port 3000)
npm run server:dev   # Backend only (port 5000)
```

### Production Deployment

**Frontend (Vercel)**
```yaml
Build Command: cd client && npm run build
Output Directory: client/.next
Environment Variables:
  - NEXT_PUBLIC_API_URL: https://api.yourdomain.com
```

**Backend (Railway/Heroku)**
```yaml
Build Command: cd server && npm install
Start Command: cd server && npm start
Environment Variables:
  - YOUTUBE_API_KEY: [YouTube API Key]
  - REDIS_URL: [Redis Connection URL]
  - DATABASE_URL: [PostgreSQL Connection URL]
  - NODE_ENV: production
```

## Technical Debt & Future Improvements

### High Priority
- [ ] Move analysis results from memory to persistent storage
- [ ] Implement user authentication and authorization
- [ ] Add comprehensive error handling and user feedback
- [ ] Set up proper logging and monitoring
- [ ] Implement API rate limiting per user

### Medium Priority  
- [ ] Add unit and integration tests (current coverage: 0%)
- [ ] Implement database migrations for PostgreSQL
- [ ] Add WebSocket authentication
- [ ] Optimize bundle size and loading performance
- [ ] Add health check endpoints

### Low Priority
- [ ] Implement GraphQL API alongside REST
- [ ] Add offline capability with service workers
- [ ] Implement advanced analytics and reporting
- [ ] Add mobile app using React Native
- [ ] Multi-language support (i18n)

## Development Workflow

### Code Standards
```javascript
// ESLint configuration
extends: ['next/core-web-vitals', 'eslint:recommended']
rules: {
  'no-unused-vars': 'error',
  'no-console': 'warn' // Only in production
}
```

### Git Workflow
```bash
main: Production-ready code
develop: Integration branch
feature/*: Feature development
hotfix/*: Critical fixes
```

### Testing Strategy (Planned)
```javascript
Unit Tests: Jest + React Testing Library
Integration Tests: Supertest for API endpoints  
E2E Tests: Playwright or Cypress
Performance Tests: Artillery or K6
```

---

**Last Updated**: 2025-01-08  
**Environment**: Development  
**Confidence Rating**: 9/10