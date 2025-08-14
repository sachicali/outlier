FROM python:3.11-slim

# Install uv
COPY --from=ghcr.io/astral-sh/uv:0.2.25 /uv /bin/uv

# Set working directory
WORKDIR /app

# Copy requirements first for better caching
COPY server-python/requirements.txt .

# Install Python dependencies using uv
RUN uv pip install --system -r requirements.txt

# Copy application code
COPY server-python/ .

# Expose port
EXPOSE 5000

# Environment variables
ENV FLASK_ENV=production
ENV FLASK_DEBUG=False

# Run the application
CMD ["uv", "run", "python", "src/index.py"]