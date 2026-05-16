import json
from uuid import UUID

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.services.realtime import manager
from app.utils.security import decode_access_token

router = APIRouter(tags=["websocket"])


def _authenticate_ws(token: str) -> dict:
    """Validate JWT and return payload."""
    from jose import JWTError
    try:
        return decode_access_token(token)
    except JWTError:
        return {}


@router.websocket("/ws/dashboards/{dashboard_id}")
async def ws_dashboard(websocket: WebSocket, dashboard_id: UUID, token: str = Query(...)):
    payload = _authenticate_ws(token)
    if not payload:
        await websocket.close(code=4001)
        return

    channel = f"dashboard:{dashboard_id}"
    await manager.connect(channel, websocket)

    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            if msg.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        await manager.disconnect(channel, websocket)


@router.websocket("/ws/alerts")
async def ws_alerts(websocket: WebSocket, token: str = Query(...)):
    payload = _authenticate_ws(token)
    if not payload:
        await websocket.close(code=4001)
        return

    org_id = payload.get("org_id", "")
    channel = f"alerts:{org_id}"
    await manager.connect(channel, websocket)

    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            if msg.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        await manager.disconnect(channel, websocket)


@router.websocket("/ws/events")
async def ws_events(websocket: WebSocket, token: str = Query(...)):
    payload = _authenticate_ws(token)
    if not payload:
        await websocket.close(code=4001)
        return

    org_id = payload.get("org_id", "")
    channel = f"events:{org_id}"
    await manager.connect(channel, websocket)

    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            if msg.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
            elif msg.get("type") == "set_filters":
                # Client-side filtering; acknowledge
                await websocket.send_json({"type": "filters_set", "payload": msg.get("payload", {})})
    except WebSocketDisconnect:
        await manager.disconnect(channel, websocket)
