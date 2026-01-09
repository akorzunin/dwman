FROM node:24-alpine AS frontend
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable pnpm
WORKDIR /frontend
COPY ["web/package.json", "./"]
COPY ["web/pnpm-lock.yaml", "./"]
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
COPY ["web", "./"]
RUN pnpm run build

FROM python:3.14-slim AS runner

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
COPY ["main.py", "./main.py"]
COPY ["internal", "./internal"]
COPY --from=frontend ["/frontend/dist", "./web/dist"]

EXPOSE 8000

CMD [".venv/bin/python", "main.py"]
