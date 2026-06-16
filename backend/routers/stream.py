import asyncio
from fastapi import APIRouter, Request # type: ignore
from fastapi.responses import StreamingResponse # type: ignore
import logging

from services.stream_manager import stream_manager

router = APIRouter()
logger = logging.getLogger("stream_router")

@router.get("/stream/{document_id}")
async def sse_stream(document_id: int, request: Request):
    """
    Server-Sent Events endpoint for real-time OCR progress.
    """
    queue = asyncio.Queue()
    stream_manager.add_client(document_id, queue)
    
    async def event_generator():
        try:
            while True:
                # If client disconnects, break
                if await request.is_disconnected():
                    break
                    
                # Wait for next event from queue
                # Use wait_for to periodically check for disconnects
                try:
                    message = await asyncio.wait_for(queue.get(), timeout=2.0)
                    yield message
                except asyncio.TimeoutError:
                    # Keep-alive or just ignore
                    yield ": keep-alive\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            stream_manager.remove_client(document_id, queue)
            logger.info(f"Client disconnected from document {document_id} stream")

    return StreamingResponse(event_generator(), media_type="text/event-stream")
