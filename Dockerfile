FROM node:20-alpine AS frontend
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable pnpm
WORKDIR /frontend
COPY ["src/frontend/package.json", "./"]
COPY ["src/frontend/pnpm-lock.yaml", "./"]
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
COPY ["src/frontend", "./"]
RUN pnpm run build

FROM python:3.11-slim AS runner

RUN apt-get update && \
	apt-get install -y curl && \
	apt-get clean && rm -rf /var/lib/apt/lists/*

ENV PYTHONFAULTHANDLER=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=off

COPY --from=ghcr.io/astral-sh/uv:0.9.3 /uv /uvx /bin/

WORKDIR /app

RUN --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
    --mount=type=bind,source=uv.lock,target=uv.lock \
    --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-cache

# Creating folders, and files for a project:
COPY ["src/main.py", "./main.py"]
COPY ["src/backend", "./backend"]
COPY ["src/configs", "./configs"]
COPY ["src/frontend/templates", "./frontend/templates"]
COPY --from=frontend ["/frontend/dist", "./src/frontend/dist"]

EXPOSE 8000


CMD ["uv", "run", "main.py"]
