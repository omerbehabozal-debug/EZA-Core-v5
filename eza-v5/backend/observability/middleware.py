# -*- coding: utf-8 -*-
"""Request ID middleware — attach opaque X-Request-ID to request + response."""

from __future__ import annotations

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from backend.observability.request_id import (
    REQUEST_ID_HEADER,
    clear_request_id,
    generate_request_id,
    sanitize_incoming_request_id,
    set_request_id,
)


class RequestIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        incoming = sanitize_incoming_request_id(
            request.headers.get(REQUEST_ID_HEADER)
        )
        request_id = incoming or generate_request_id()
        set_request_id(request_id)
        request.state.request_id = request_id
        try:
            response = await call_next(request)
            response.headers[REQUEST_ID_HEADER] = request_id
            return response
        finally:
            clear_request_id()
