# Setup Instructions for YouTube Outlier Discovery Tool

## Prerequisites

Before running this application, ensure you have:

1. **Node.js** (v18.0.0 or higher)
2. **npm** (v9.0.0 or higher)
3. **YouTube Data API v3 Key**
4. **Redis** (for caching)
5. **PostgreSQL** (optional, for production)

## Quick Start

### 1. Clone and Install Dependencies

```bash
cd D:\Codebase\Outlier
npm run install:all
```

This will install dependencies for the root project, client, and server.

### 2. Environment Setup

Copy the example environment file:
```bash
copy .env.example .env
```

Edit `.env` and add your configurations:

```bash
# REQUIRED: YouTube Data API Key
YOUTUBE_API_KEY=your_youtube_api_key_here

# Database (use default for development)
DATABASE_URL=postgresql://username:password@localhost:5432/outlier_db
REDIS_URL=redis://localhost:6379

# Server Configuration
PORT=5000
CORS_ORIGIN=http://localhost:3000
```

### 3. Get YouTube API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable "YouTube Data API v3"
4. Create credentials (API Key)
5. Copy the API key to your `.env` file

### 4. Start Redis (Windows)

**Option A: Install Redis for Windows**
```bash
# Download from: https://github.com/MicrosoftArchive/redis/releases
# Or use Docker:
docker run -d -p 6379:6379 redis:alpine
```

**Option B: Use Redis Cloud (Free)**
1. Sign up at [Redis Cloud](https://redis.com/try-free/)
2. Create a free database
3. Copy the connection URL to your `.env`

### 5. Start the Application

```bash
# Development mode (both client and server)
npm run dev
```

This will start:
- **Backend API**: http://localhost:5000
- **Frontend**: http://localhost:3000

### 6. Access the Application

Open your browser and go to: http://localhost:3000

## Production Deployment

### Backend (Server)

1. **Railway/Heroku**:
   ```bash
   cd server
   npm run build
   npm start
   ```

2. **Environment Variables**:
   - `YOUTUBE_API_KEY`
   - `DATABASE_URL` 
   - `REDIS_URL`
   - `NODE_ENV=production`

### Frontend (Client)

1. **Vercel/Netlify**:
   ```bash
   cd client
   npm run build
   ```

2. **Environment Variables**:
   - `NEXT_PUBLIC_API_URL=https://your-api-domain.com`

## Configuration

### API Rate Limits

The YouTube Data API has a default quota of 10,000 units per day. Each analysis uses approximately:
- Channel search: ~100 units per query
- Video details: ~1 unit per video
- Channel stats: ~1 unit per channel

**Total per analysis**: ~500-1000 units

### Caching Strategy

To optimize API usage:
- Channel info: 24 hours
- Video data: 6 hours  
- Search results: 2 hours

### Performance Tuning

For better performance:
- Increase `MAX_CONCURRENT_REQUESTS` (default: 5)
- Adjust `BATCH_SIZE` (default: 50)
- Enable Redis clustering for high traffic

## Troubleshooting

### Common Issues

1. **"YouTube API quota exceeded"**
   - Wait 24 hours for quota reset
   - Or enable billing in Google Cloud Console

2. **"Redis connection failed"**
   - Ensure Redis is running
   - Check REDIS_URL in `.env`

3. **"Analysis stuck in processing"**
   - Check server logs: `server/logs/combined.log`
   - Restart the server

4. **"No results found"**
   - Check if exclusion channels exist
   - Verify subscriber range settings
   - Ensure time window has recent videos

### Logs

- **Server logs**: `server/logs/`
- **Error logs**: `server/logs/error.log`
- **Combined logs**: `server/logs/combined.log`

### API Testing

Test the backend API directly:

```bash
# Health check
curl http://localhost:5000/health

# Start analysis
curl -X POST http://localhost:5000/api/outlier/start \
  -H "Content-Type: application/json" \
  -d '{
    "exclusionChannels": ["Thinknoodles"],
    "minSubs": 10000,
    "maxSubs": 500000,
    "timeWindow": 7,
    "outlierThreshold": 20
  }'
```

## Development

### Project Structure

```
D:\Codebase\Outlier\
├── client/                 # Next.js frontend
│   ├── components/         # React components
│   ├── pages/             # Next.js pages
│   └── styles/            # CSS styles
├── server/                # Express.js backend
│   ├── src/
│   │   ├── controllers/   # Request handlers
│   │   ├── services/      # Business logic
│   │   ├── routes/        # API routes
│   │   └── utils/         # Utilities
│   └── logs/              # Application logs
└── package.json           # Root package.json
```

### Adding Features

1. **New API Endpoint**:
   - Add route in `server/src/routes/`
   - Add controller in `server/src/controllers/`
   - Update service in `server/src/services/`

2. **New UI Component**:
   - Add component in `client/components/`
   - Import in pages or other components
   - Update TypeScript interfaces if needed

### Database Migration (Future)

When ready to add persistent storage:

```bash
# Install additional dependencies
npm install sequelize pg-hstore

# Create models in server/src/models/
# Add database initialization in server/src/index.js
```

## Support

For issues or questions:
1. Check the logs first
2. Verify environment variables
3. Test API endpoints individually
4. Check YouTube API quota usage

## Next Steps

Once the basic setup works:
- [ ] Add user authentication
- [ ] Implement data persistence
- [ ] Add advanced analytics
- [ ] Create team collaboration features
- [ ] Add automated scheduling
