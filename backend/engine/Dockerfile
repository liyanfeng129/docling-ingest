# syntax=docker/dockerfile:1
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies (cached unless this block changes)
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update --fix-missing && \
    apt-get install -y --no-install-recommends \
    build-essential \
    libxcb1 \
    libxcb-shm0 \
    libxcb-render0 \
    libxrender1 \
    libxext6 \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    poppler-utils

# Copy requirements and install Python dependencies (cached unless requirements.txt changes)
COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install -r requirements.txt

# Copy application code (only this layer rebuilds on code changes)
COPY . .

# Expose port
EXPOSE 8000

# Run without auto-reload
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
