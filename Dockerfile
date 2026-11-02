FROM node:24-alpine AS frontend
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable pnpm
WORKDIR /frontend
COPY ["web/package.json", "web/pnpm-lock.yaml", "web/pnpm-workspace.yaml", "./"]
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
COPY ["web", "./"]
RUN pnpm run build

FROM golang:1.26-alpine AS backend
RUN apk add --no-cache ca-certificates
WORKDIR /src
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod go mod download
COPY cmd ./cmd
COPY internal/backend ./internal/backend
RUN --mount=type=cache,target=/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /dwman ./cmd/dwman

FROM scratch AS runner
WORKDIR /app
COPY --from=backend /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=backend /dwman ./dwman
COPY --from=frontend /frontend/dist ./web/dist
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD ["/app/dwman", "healthcheck"]
ENTRYPOINT ["/app/dwman"]
