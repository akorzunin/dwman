"""Main app for Spotify DW saver web server"""

import asyncio
import os
import sys
from datetime import datetime, timedelta, timezone

import structlog
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.openapi.utils import get_openapi
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBasicCredentials
from fastapi.templating import Jinja2Templates
from starlette.staticfiles import StaticFiles

from backend.app.auth import check_credentials, security
from backend.app.logger import setup_logging, setup_uvicorn_logging
from backend.app.routes.api_routes import router as api_routes
from backend.app.routes.front_routes import router as front_routes
from backend.app.routes.proxy_routes import router as proxy_routes
from backend.app.task_handler import (
    send_notifications_task,
)

IGNORE_CORS = bool(eval(os.getenv("IGNORE_CORS", "False")))

templates = Jinja2Templates(directory="src/frontend/templates")


setup_logging(
    json_logs=not sys.stderr.isatty(),
    log_level=os.getenv("LOG_LEVEL", "INFO"),
)
access_logger = structlog.stdlib.get_logger("api.access")
# log = structlog.stdlib.get_logger(__name__)

app = FastAPI(
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)

setup_uvicorn_logging(app, access_logger)


@app.get("/docs", tags=["Docs"])
async def get_documentation(
    credentials: HTTPBasicCredentials = Depends(security),
):
    check_credentials(credentials)
    return get_swagger_ui_html(openapi_url="/openapi.json", title="docs")


@app.get("/openapi.json", tags=["Docs"])
async def get_open_api_endpoint():
    return JSONResponse(
        get_openapi(title="FastAPI", version="1", routes=app.routes)
    )


app.mount(
    "/assets",
    app=StaticFiles(
        directory="src/frontend/dist/assets",
    ),
    name="assets",
)

app.include_router(front_routes)
app.include_router(api_routes)
app.include_router(proxy_routes)

if IGNORE_CORS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["*"],
    )

if __name__ == "__main__":
    import uvicorn

    loop = asyncio.new_event_loop()
    config = uvicorn.Config(
        app="main:app",
        host="0.0.0.0",
        port=int(os.getenv("UVICORN_PORT", "8000")),
        loop=loop,
    )
    loop.create_task(uvicorn.Server(config).serve())

    # Launch tasks
    scheduler = AsyncIOScheduler(event_loop=loop)
    # scheduler.add_job(
    #     task_tick,
    #     trigger="interval",
    #     seconds=3600,
    #     name="task_tick",
    # )
    scheduler.add_job(
        send_notifications_task,
        trigger="interval",
        minutes=31,
        name="send_notifications",
        next_run_time=datetime.now(timezone.utc) + timedelta(seconds=1),
    )
    # revive_user_tasks()
    scheduler.start()

    loop.run_forever()
