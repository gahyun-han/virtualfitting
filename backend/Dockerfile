# ---------------------------------------------------------------------------
# Stage 1 – Builder: install Python dependencies
# ---------------------------------------------------------------------------
FROM python:3.11-slim AS builder

# Install build essentials needed by some Python packages (e.g. rembg, Pillow)
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        libglib2.0-0 \
        libgl1-mesa-glx \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# Copy requirements first so Docker can cache the pip install layer
COPY requirements.txt .

# Install into an isolated prefix so we can COPY just that in stage 2
RUN pip install --upgrade pip \
    && pip install --prefix=/install --no-cache-dir \
        $(grep -v -- '--index-url' requirements.txt | grep -v '^#' | grep -v '^$') \
    && pip install --prefix=/install --no-cache-dir \
        torch \
        --index-url https://download.pytorch.org/whl/cpu


# ---------------------------------------------------------------------------
# Stage 2 – Runtime image
# ---------------------------------------------------------------------------
FROM python:3.11-slim AS runtime

LABEL maintainer="Virtual Fitting Service"
LABEL description="FastAPI backend for AI-powered virtual clothing try-on"

# Runtime dependencies for PIL / OpenCV / rembg
RUN apt-get update && apt-get install -y --no-install-recommends \
        libglib2.0-0 \
        libgl1-mesa-glx \
        libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Copy installed Python packages from builder
COPY --from=builder /install /usr/local

WORKDIR /app

# Copy application source
COPY app/ ./app/

# Pre-download rembg u2net model so the container doesn't need internet at
# runtime (optional – comment out if you prefer lazy download)
# RUN python -c "from rembg import new_session; new_session('u2net')"

# Create a non-root user for security
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser
USER appuser

EXPOSE 8000

# Uvicorn with multiple workers; override via CMD or env for development
CMD ["uvicorn", "app.main:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--workers", "2", \
     "--log-level", "info"]
