import asyncio
from typing import Dict, List, Any
import json

class StreamManager:
    def __init__(self):
        # Maps document_id to a list of connected asyncio.Queues
        self.connections: Dict[int, List[asyncio.Queue]] = {}

    def add_client(self, document_id: int, queue: asyncio.Queue):
        if document_id not in self.connections:
            self.connections[document_id] = []
        self.connections[document_id].append(queue)

    def remove_client(self, document_id: int, queue: asyncio.Queue):
        if document_id in self.connections:
            if queue in self.connections[document_id]:
                self.connections[document_id].remove(queue)
            if not self.connections[document_id]:
                del self.connections[document_id]

    async def broadcast(self, document_id: int, event_type: str, data: Any):
        """Broadcasts an event to all clients listening to a specific document."""
        if document_id in self.connections:
            # Format according to SSE standard
            message = f"event: {event_type}\ndata: {json.dumps(data)}\n\n"
            for q in self.connections[document_id]:
                await q.put(message)

# Global instance
stream_manager = StreamManager()
