
# Create Python venv in server-python/.venv if it doesn't exist
PY_VENV=server-python/.venv
PY_UV=uv
PY_PYTHON=$(PY_VENV)/Scripts/python.exe

# Default target
.PHONY: all
all: install

# Install all dependencies
.PHONY: install
install:
	@echo "Installing dependencies..."
	cd client && bun install
	@if [ ! -d $(PY_VENV) ]; then \
		echo "Creating Python virtual environment..."; \
		cd server-python && $(PY_UV) venv .venv; \
	fi
	@echo "Installing Python core dependencies with uv..."
	cd server-python && $(PY_UV) pip install -r requirements-core.txt
	@echo "Installing Python development dependencies with uv..."
	cd server-python && $(PY_UV) pip install -r requirements-dev.txt
	@echo "Installing database adapter..."
	cd server-python && python install_db_adapter.py || echo "Please install database adapter manually. See server-python/README.md for instructions."

# Development mode
.PHONY: dev
dev: install
	@echo "Starting development servers..."
	cd client && bun run dev --port 3000 & \
	cd server-python && $(PY_UV) run python src/index.py

# Run Python server only
.PHONY: dev-server
dev-server:
	@echo "Starting Python server..."
	cd server-python && $(PY_UV) run python src/index.py

# Run client only
.PHONY: dev-client
dev-client:
	@echo "Starting client..."
	bun run dev --cwd client -- --port 3000

# Install Python dependencies only
.PHONY: install-python
install-python:
	@if [ ! -d $(PY_VENV) ]; then \
		echo "Creating Python virtual environment..."; \
		cd server-python && $(PY_UV) venv .venv; \
	fi
	@echo "Installing Python core dependencies with uv..."
	cd server-python && $(PY_UV) pip install -r requirements-core.txt
	@echo "Installing Python development dependencies with uv..."
	cd server-python && $(PY_UV) pip install -r requirements-dev.txt
	@echo "Installing database adapter..."
	cd server-python && python install_db_adapter.py || echo "Please install database adapter manually. See server-python/README.md for instructions."

# Update Python dependencies
.PHONY: update-python
update-python:
	@echo "Updating Python core dependencies with uv..."
	cd server-python && $(PY_UV) pip install -r requirements-core.txt --upgrade
	@echo "Updating Python development dependencies with uv..."
	cd server-python && $(PY_UV) pip install -r requirements-dev.txt --upgrade
	@echo "Updating database adapter..."
	cd server-python && python install_db_adapter.py || echo "Please update database adapter manually."

# Freeze Python dependencies
.PHONY: freeze-python
freeze-python:
	@echo "Freezing Python dependencies..."
	cd server-python && $(PY_UV) pip freeze > requirements.txt

# Run Python tests
.PHONY: test-python
test-python:
	@echo "Running Python tests..."
	cd server-python && $(PY_UV) run python -m pytest

# Format Python code
.PHONY: format-python
format-python:
	@echo "Formatting Python code..."
	cd server-python && $(PY_UV) run black src/

# Lint Python code
.PHONY: lint-python
lint-python:
	@echo "Linting Python code..."
	cd server-python && $(PY_UV) run flake8 src/

# Run Python with uv
.PHONY: python
python:
	@echo "Starting Python REPL..."
	cd server-python && $(PY_UV) run python

# Clean Python cache
.PHONY: clean-python
clean-python:
	@echo "Cleaning Python cache..."
	cd server-python && rm -rf __pycache__ */__pycache__ *.pyc */*.pyc .pytest_cache

# Clean all
.PHONY: clean
clean: clean-python
	@echo "Cleaning all..."
	cd client && rm -rf node_modules/.cache

# Build targets
.PHONY: build
build: build-client build-server

# Build client for production
.PHONY: build-client
build-client:
	@echo "Building client for production..."
	cd client && bun run build

# Build server for production (Python doesn't need compilation, but we can create a dist package)
.PHONY: build-server
build-server:
	@echo "Preparing server for production..."
	@echo "Note: Python doesn't require compilation. Ensuring dependencies are installed..."
	cd server-python && $(PY_UV) pip install -r requirements-core.txt
	cd server-python && python install_db_adapter.py || echo "Please install database adapter manually."

# Create distribution packages
.PHONY: dist
dist: dist-client dist-server

# Create client distribution
.PHONY: dist-client
dist-client: build-client
	@echo "Creating client distribution..."
	@echo "Client build output is in client/.next directory"

# Create server distribution package
.PHONY: dist-server
dist-server: build-server
	@echo "Creating server distribution package..."
	cd server-python && $(PY_UV) build .

# Deploy targets (these are placeholders - you would customize for your deployment platform)
.PHONY: deploy
deploy: deploy-client deploy-server

.PHONY: deploy-client
deploy-client: build-client
	@echo "Deploying client... (placeholder - customize for your platform)"
	@echo "Example: vercel --prod or netlify deploy --prod"

.PHONY: deploy-server
deploy-server: build-server
	@echo "Deploying server... (placeholder - customize for your platform)"
	@echo "Example: docker build -t outlier-server . && docker push"

# Production start commands
.PHONY: start
start: start-client start-server

.PHONY: start-client
start-client:
	@echo "Starting client in production mode..."
	cd client && bun start

.PHONY: start-server
start-server:
	@echo "Starting server in production mode..."
	cd server-python && $(PY_UV) run python src/index.py
