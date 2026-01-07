import logging
import sys
import time
import uuid

import structlog
from fastapi import FastAPI, Request, Response
from structlog.types import EventDict, Processor
from uvicorn.protocols.utils import get_path_with_query_string


def drop_color_message_key(_, __, event_dict: EventDict) -> EventDict:
    """
    Uvicorn logs the message a second time in the extra `color_message`, but we don't
    need it. This processor drops the key from the event dict if it exists.
    """
    event_dict.pop("color_message", None)
    return event_dict


def setup_logging(
    json_logs: bool = True,
    log_level: str = "INFO",
    ugly_exceptions: bool = True,
):
    shared_processors: list[Processor] = [
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.processors.EventRenamer("message", "_event"),
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.stdlib.ExtraAdder(),
        structlog.contextvars.merge_contextvars,
        structlog.processors.StackInfoRenderer(),
        structlog.processors.CallsiteParameterAdder(
            [
                structlog.processors.CallsiteParameter.THREAD_NAME,
                structlog.processors.CallsiteParameter.PROCESS,
                structlog.processors.CallsiteParameter.PROCESS_NAME,
            ]
        ),
        drop_color_message_key,
    ]

    if json_logs or ugly_exceptions:
        # Format the exception only for JSON logs, as we want to pretty-print
        # them when using the ConsoleRenderer
        shared_processors.append(structlog.processors.format_exc_info)

    structlog.configure(
        processors=shared_processors
        + [
            # Prepare event dict for `ProcessorFormatter`.
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )

    formatter = structlog.stdlib.ProcessorFormatter(
        # These run ONLY on `logging` entries that do NOT originate within
        # structlog.
        foreign_pre_chain=shared_processors,
        # These run on ALL entries after the pre_chain is done.
        processors=[
            # Remove _record & _from_structlog.
            structlog.stdlib.ProcessorFormatter.remove_processors_meta,
            (
                structlog.processors.JSONRenderer()
                if json_logs
                else structlog.dev.ConsoleRenderer()
            ),  # type: ignore
        ],
    )

    handler = logging.StreamHandler()
    # Use OUR `ProcessorFormatter` to format all `logging` entries.
    handler.setFormatter(formatter)
    root_logger = logging.getLogger()
    root_logger.handlers.clear()
    root_logger.addHandler(handler)
    root_logger.setLevel(log_level)

    for _log in ["uvicorn", "uvicorn.error"]:
        # Clear the log handlers for uvicorn loggers, and enable propagation
        # so the messages are caught by our root logger and formatted correctly
        # by structlog
        logging.getLogger(_log).handlers.clear()
        logging.getLogger(_log).propagate = True

    # Since we re-create the access logs ourselves, to add all information
    # in the structured log (see the `logging_middleware` in main.py), we clear
    # the handlers and prevent the logs to propagate to a logger higher up in the
    # hierarchy (effectively rendering them silent).
    logging.getLogger("uvicorn.access").handlers.clear()
    logging.getLogger("uvicorn.access").propagate = False

    def handle_exception(exc_type, exc_value, exc_traceback):
        """
        Log any uncaught exception instead of letting it be printed by Python
        (but leave KeyboardInterrupt untouched to allow users to Ctrl+C to stop)
        See https://stackoverflow.com/a/16993115/3641865
        """
        if issubclass(exc_type, KeyboardInterrupt):
            sys.__excepthook__(exc_type, exc_value, exc_traceback)
            return

        root_logger.critical(
            "Uncaught exception", exc_info=(exc_type, exc_value, exc_traceback)
        )

    sys.excepthook = handle_exception


def setup_uvicorn_logging(
    app: FastAPI,
    access_logger: structlog.stdlib.BoundLogger,
):
    @app.middleware("http")
    async def logging_middleware(request: Request, call_next) -> Response:
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(request_id=str(uuid.uuid4()))

        start_time = time.perf_counter_ns()
        response = Response(status_code=500)
        try:
            response = await call_next(request)
        except Exception as e:
            structlog.stdlib.get_logger("api.error").exception(
                f"Uncaught exception {e}"
            )
        finally:
            process_time = str((time.perf_counter_ns() - start_time) / 10**9)
            url = get_path_with_query_string(request.scope)
            access_logger.info(
                f"{request.method} {url} HTTP/{request.scope['http_version']} {response.status_code}",
                http={
                    "url": request.scope.get("path"),
                    "status_code": response.status_code,
                    "method": request.method,
                },
                headers={"X-Process-Time": process_time},
                network={
                    "client": {
                        "ip": request.client.host,
                        "port": request.client.port,
                    }
                },
            )
            response.headers["X-Process-Time"] = process_time
        return response


logger = logging.getLogger(__name__)
