import asyncio
import json
import logging

import redis.asyncio as aioredis
from fastapi import WebSocket

from app.config import settings

logger = logging.getLogger(__name__)


class RedisConnectionManager:
    """Manages WebSocket connections with Redis Pub/Sub for cross-process broadcasting."""

    def __init__(self):
        self.active: dict[str, list[WebSocket]] = {}
        self._redis: aioredis.Redis | None = None
        self._pubsub: aioredis.client.PubSub | None = None
        self._listener_task: asyncio.Task | None = None

    async def init(self):
        """Initialize Redis connection and start listener."""
        try:
            self._redis = aioredis.from_url(settings.redis_url, decode_responses=True)
            self._pubsub = self._redis.pubsub()
            self._listener_task = asyncio.create_task(self._listen())
            logger.info("RedisConnectionManager initialised with Redis at %s", settings.redis_url)
        except Exception:
            logger.warning(
                "Failed to connect to Redis for Pub/Sub – falling back to local-only broadcasting",
                exc_info=True,
            )
            self._redis = None
            self._pubsub = None

    async def shutdown(self):
        """Clean up connections."""
        if self._listener_task:
            self._listener_task.cancel()
            try:
                await self._listener_task
            except asyncio.CancelledError:
                pass
        if self._pubsub:
            await self._pubsub.unsubscribe()
            await self._pubsub.close()
        if self._redis:
            await self._redis.close()

    # ------------------------------------------------------------------
    # Connection lifecycle
    # ------------------------------------------------------------------

    async def connect(self, channel: str, ws: WebSocket):
        await ws.accept()
        self.active.setdefault(channel, []).append(ws)
        # Subscribe to Redis channel if this is the first local connection
        if self._pubsub and len(self.active[channel]) == 1:
            await self._pubsub.subscribe(f"ws:{channel}")

    async def disconnect(self, channel: str, ws: WebSocket):
        if channel in self.active:
            self.active[channel] = [w for w in self.active[channel] if w != ws]
            if not self.active[channel]:
                del self.active[channel]
                if self._pubsub:
                    await self._pubsub.unsubscribe(f"ws:{channel}")

    # ------------------------------------------------------------------
    # Publishing
    # ------------------------------------------------------------------

    async def publish(self, channel: str, message: dict):
        """Publish a message via Redis so all processes broadcast it.

        Falls back to local-only broadcast when Redis is unavailable.
        """
        if self._redis:
            try:
                await self._redis.publish(f"ws:{channel}", json.dumps(message))
                return
            except Exception:
                logger.warning("Redis publish failed – broadcasting locally", exc_info=True)
        # Fallback: broadcast only to this process's connections
        await self._broadcast_local(channel, message)

    async def broadcast(self, channel: str, message: dict):
        """Alias kept for drop-in compatibility with the old ConnectionManager."""
        await self.publish(channel, message)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _broadcast_local(self, channel: str, message: dict):
        """Send to all local WebSocket connections on this channel."""
        dead: list[WebSocket] = []
        for ws in self.active.get(channel, []):
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            await self.disconnect(channel, ws)

    async def _listen(self):
        """Listen for Redis Pub/Sub messages and broadcast to local connections."""
        try:
            async for message in self._pubsub.listen():  # type: ignore[union-attr]
                if message["type"] == "message":
                    channel: str = message["channel"]
                    local_channel = channel[3:] if channel.startswith("ws:") else channel
                    try:
                        data = json.loads(message["data"])
                    except (json.JSONDecodeError, TypeError):
                        continue
                    await self._broadcast_local(local_channel, data)
        except asyncio.CancelledError:
            pass
        except Exception:
            logger.error("Redis Pub/Sub listener crashed", exc_info=True)


# ------------------------------------------------------------------
# Singleton used across the application
# ------------------------------------------------------------------
manager = RedisConnectionManager()


# ------------------------------------------------------------------
# Sync helper for Celery tasks
# ------------------------------------------------------------------
def publish_sync(channel: str, message: dict):
    """Synchronous publish for use inside Celery tasks."""
    import redis

    r = redis.from_url(settings.redis_url, decode_responses=True)
    try:
        r.publish(f"ws:{channel}", json.dumps(message))
    finally:
        r.close()
