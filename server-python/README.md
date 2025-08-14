# YouTube Outlier Discovery Tool - Python Backend

This is the Python implementation of the YouTube Outlier Discovery Tool backend API, built with Flask.

## Features

- RESTful API for YouTube channel analysis
- WebSocket support for real-time progress updates
- Authentication and authorization with JWT
- Role-based access control (RBAC)
- Redis caching for performance optimization
- YouTube Data API integration

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login and obtain JWT tokens
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout and invalidate tokens
- `GET /api/auth/profile` - Get current user profile
- `PUT /api/auth/profile` - Update user profile
- `GET /api/auth/verify` - Verify JWT token
- `GET /api/auth/status` - Get authentication status

### Outlier Analysis
- `POST /api/outlier/start` - Start a new outlier analysis
- `GET /api/outlier/status/<analysis_id>` - Get analysis status
- `GET /api/outlier/results/<analysis_id>` - Get analysis results
- `GET /api/outlier/list` - List all analyses for user

### Channel Management
- `GET /api/channels/search` - Search for YouTube channels
- `GET /api/channels/<channel_id>` - Get channel information
- `GET /api/channels/<channel_id>/videos` - Get channel videos

### API Keys
- `GET /api/apikeys` - List user's API keys
- `POST /api/apikeys` - Create a new API key
- `DELETE /api/apikeys/<key_id>` - Delete an API key

### Configuration
- `GET /api/config/content` - Get content configuration
- `POST /api/config/content` - Update content configuration

### Health Checks
- `GET /api/health` - Basic health check
- `GET /api/health/security` - Security health check (admin only)

### Queue Management
- `GET /api/queues/status` - Get queue status
- `GET /api/queues/jobs` - List queue jobs
- `GET /api/queues/jobs/<job_id>` - Get specific queue job
- `POST /api/queues/jobs/<job_id>/cancel` - Cancel a queue job

### Dashboard
- `GET /api/dashboard/stats` - Get dashboard statistics
- `GET /api/dashboard/recent-analyses` - Get recent analyses
- `GET /api/dashboard/popular-channels` - Get popular channels

### Favorites
- `GET /api/favorites` - Get user's favorite channels
- `POST /api/favorites` - Add a channel to favorites
- `DELETE /api/favorites/<channel_id>` - Remove a channel from favorites
- `GET /api/favorites/<channel_id>` - Check if a channel is favorited

## Authentication

The API supports two authentication methods:

1. **JWT Tokens**: Pass the token in the `Authorization: Bearer <token>` header
2. **API Keys**: Pass the key in the `X-API-Key` header or `Authorization: ApiKey <key>` header

## Environment Variables

Create a `.env` file with the following variables:

```
YOUTUBE_API_KEY=your_youtube_api_key
JWT_SECRET=your_jwt_secret
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
REDIS_PASSWORD=
FLASK_DEBUG=False
```

## Python Version Compatibility

This project is compatible with Python 3.8.1+ versions. If you encounter SSL compatibility issues, consider using Python 3.11 or earlier.

## Installation

This project uses `uv` for Python dependency management. Make sure you have `uv` installed:

```bash
# Install uv if you haven't already
pip install uv
```

### Standard Installation

```bash
uv pip install -r requirements-core.txt -r requirements-dev.txt
```

### Windows Installation

Windows users may encounter issues installing `psycopg2-binary` due to missing build tools. Here are alternative approaches:

1. **Using conda (recommended for Windows users):**
   ```bash
   conda install psycopg2
   uv pip install -r requirements-core.txt -r requirements-dev.txt
   ```

2. **Using pre-compiled wheels:**
   ```bash
   pip install psycopg2-binary
   uv pip install -r requirements-core.txt -r requirements-dev.txt
   ```

3. **Install build tools and then install:**
   - Install Microsoft C++ Build Tools
   - Then run: `uv pip install psycopg2-binary`

### Using the Makefile:

```bash
make install-python
```

## Running the Server

### Using uv directly:

```bash
uv run python src/index.py
```

### Using the Makefile:

```bash
make dev-server
```

## Development

The server will run on `http://localhost:5000` by default.

For development with auto-reload:
```bash
FLASK_DEBUG=True uv run python src/index.py
```

## Testing

Run tests with pytest:

```bash
# Using uv directly
uv run pytest

# Using the Makefile
make test-python
```

## Code Quality

### Formatting
```bash
# Using uv directly
uv run black src/

# Using the Makefile
make format-python
```

### Linting
```bash
# Using uv directly
uv run flake8 src/

# Using the Makefile
make lint-python
```

## Makefile Commands

The project includes a Makefile with the following commands:

- `make install` - Install all dependencies (Node.js and Python)
- `make dev` - Start both frontend and backend in development mode
- `make dev-server` - Start only the Python backend
- `make dev-client` - Start only the frontend
- `make install-python` - Install Python dependencies with uv
- `make update-python` - Update Python dependencies
- `make freeze-python` - Freeze Python dependencies
- `make test-python` - Run Python tests
- `make format-python` - Format Python code with black
- `make lint-python` - Lint Python code with flake8
- `make python` - Start Python REPL
- `make clean-python` - Clean Python cache files
- `make clean` - Clean all cache files