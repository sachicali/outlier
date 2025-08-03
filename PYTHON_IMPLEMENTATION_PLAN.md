# Python Backend Implementation Plan

This document outlines a comprehensive plan for migrating the backend of the **YouTube Outlier Discovery Tool** from Node.js/Express to Python.

## 1. Overview and Goals

The primary goal of this migration is to leverage the Python ecosystem for data analysis and machine learning, which aligns well with the project's long-term vision of incorporating more advanced analytics.

**Key Objectives:**

-   Replicate all existing backend functionality in Python.
-   Maintain or improve the performance and scalability of the application.
-   Create a solid foundation for future development, including machine learning-based features.
-   Ensure a smooth transition with minimal disruption to the frontend.

## 2. Proposed Python Tech Stack

-   **Web Framework**: **FastAPI** - A modern, high-performance web framework for building APIs with Python 3.7+ based on standard Python type hints. It offers automatic API documentation (Swagger UI and ReDoc), data validation with Pydantic, and excellent support for asynchronous operations.
-   **ASGI Server**: **Uvicorn** - A lightning-fast ASGI server, recommended for use with FastAPI.
-   **Data Validation**: **Pydantic** - For data validation and settings management using Python type annotations.
-   **YouTube API Client**: **google-api-python-client** - The official Google client library for Python.
-   **Redis Client**: **redis-py** - The standard Python client for Redis.
-   **PostgreSQL Driver**: **asyncpg** - A fast asynchronous PostgreSQL driver for use with FastAPI's async capabilities.
-   **WebSockets**: **FastAPI's built-in WebSocket support** will be used for real-time communication.
-   **Logging**: Python's built-in **logging** module.
-   **Dependency Management**: **pip** with a `requirements.txt` file.

## 3. Proposed Project Structure

A new `server-python` directory will be created to house the Python backend, keeping it separate from the existing Node.js server during the migration.

```
/server-python
├───alembic/              # Database migrations
├───app/
│   ├───__init__.py
│   ├───main.py             # FastAPI application entry point
│   ├───core/
│   │   ├───__init__.py
│   │   ├───config.py       # Pydantic settings management
│   │   └───logging_config.py # Logging configuration
│   ├───api/
│   │   ├───__init__.py
│   │   └───v1/
│   │       ├───__init__.py
│   │       ├───endpoints/
│   │       │   ├───__init__.py
│   │       │   ├───channels.py
│   │       │   └───outlier.py
│   │       └───schemas/
│   │           ├───__init__.py
│   │           ├───channels.py
│   │           └───outlier.py
│   ├───services/
│   │   ├───__init__.py
│   │   ├───youtube_service.py
│   │   └───outlier_detection_service.py
│   └───db/
│       ├───__init__.py
│       ├───session.py      # Database session management
│       └───models.py       # SQLAlchemy models
├───.env
├───requirements.txt
└───Dockerfile
```

## 4. Migration Steps (Phase-based)

### Phase 1: Setup and Basic Server (1-2 days)

1.  **Create Project Structure**: Create the `server-python` directory and the subdirectories as outlined above.
2.  **Setup Virtual Environment**: Create a Python virtual environment.
3.  **Install Dependencies**: Create a `requirements.txt` file with the initial dependencies (`fastapi`, `uvicorn`, `pydantic`, `python-dotenv`) and install them.
4.  **Configuration**: Create `app/core/config.py` using Pydantic's `BaseSettings` to load environment variables.
5.  **Basic Server**: Create `app/main.py` with a basic FastAPI application, including CORS middleware and a `/health` endpoint.
6.  **Logging**: Configure the logger in `app/core/logging_config.py`.

### Phase 2: Porting Services (3-4 days)

1.  **YouTube Service**: Port `server/src/services/youtubeService.js` to `app/services/youtube_service.py`.
    -   Use the `google-api-python-client` to interact with the YouTube Data API.
    -   Use `redis-py` to implement the caching logic.
2.  **Outlier Detection Service**: Port `server/src/services/outlierDetectionService.js` to `app/services/outlier_detection_service.py`.
    -   Translate the core business logic for building exclusion lists, discovering adjacent channels, and calculating outlier scores into Python.

### Phase 3: Porting API Endpoints (3-4 days)

1.  **Schemas**: Create Pydantic schemas in `app/api/v1/schemas/` to define the request and response models for the API endpoints.
2.  **Channels API**: Port `server/src/routes/channels.js` to `app/api/v1/endpoints/channels.py`.
    -   Create a FastAPI `APIRouter`.
    -   Define the routes for searching channels, getting channel info, and retrieving channel videos.
3.  **Outlier API**: Port `server/src/routes/outlier.js` to `app/api/v1/endpoints/outlier.py`.
    -   Create a FastAPI `APIRouter`.
    -   Define the routes for starting an analysis, getting status, and retrieving results.

### Phase 4: Real-time Communication (2-3 days)

1.  **WebSocket Endpoint**: Create a WebSocket endpoint in `app/api/v1/endpoints/outlier.py` to handle real-time progress updates.
2.  **Update Outlier Service**: Modify the `outlier_detection_service.py` to accept a WebSocket connection and send progress updates through it.
3.  **Frontend Integration**: Update the frontend to connect to the new WebSocket endpoint.

### Phase 5: Finalization and Integration (2-3 days)

1.  **Database Integration**: Implement the database session management in `app/db/session.py` and define the SQLAlchemy models in `app/db/models.py`.
2.  **Update Frontend**: Update the frontend to make API calls to the new Python backend.
3.  **Update Root `package.json`**: Modify the `dev` script in the root `package.json` to run the Python server instead of the Node.js server.
4.  **Containerization**: Create a `Dockerfile` for the Python backend to containerize the application.
5.  **Documentation**: Update the `README.md` and `SETUP.md` files to reflect the new Python backend.

## 5. Timeline and Milestones

-   **Week 1**: Complete Phase 1 and 2.
-   **Week 2**: Complete Phase 3 and 4.
-   **Week 3**: Complete Phase 5 and conduct thorough testing.

**Total Estimated Time**: 2-3 weeks.

## 6. Risks and Mitigation

-   **Performance**: The Python backend might be slower than the Node.js backend. **Mitigation**: Leverage FastAPI's async capabilities and use `uvicorn` for production.
-   **YouTube API Quotas**: The migration process might consume a significant amount of YouTube API quotas. **Mitigation**: Use the existing Redis cache and implement a mock YouTube service for development.
-   **Feature Parity**: Ensuring that all features of the Node.js backend are replicated in the Python backend. **Mitigation**: Create a checklist of all features and test them thoroughly.
