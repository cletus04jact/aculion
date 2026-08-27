import asyncio
import json
import logging
from typing import Set, Dict
from datetime import datetime
from supabase_client import supabase, SUPABASE_URL, SUPABASE_KEY

logger = logging.getLogger("traffic-service.realtime")

class RealtimeManager:
    def __init__(self):
        self.queues: Set[asyncio.Queue] = set()
        self.last_records: Dict[str, dict] = {}
        self.loop = None
        self.channel = None
        self.polling_task = None
        self.realtime_task = None
        self.is_running = False

    def register(self, queue: asyncio.Queue):
        self.queues.add(queue)
        logger.info(f"Registered new client queue. Total queues: {len(self.queues)}")

    def unregister(self, queue: asyncio.Queue):
        self.queues.discard(queue)
        logger.info(f"Unregistered client queue. Total queues: {len(self.queues)}")

    def broadcast(self, data: dict):
        if not self.queues:
            return
        
        # Convert any datetime or other non-serializable objects
        serialized_data = self._serialize_record(data)
        message = json.dumps(serialized_data)
        
        logger.info(f"Broadcasting update for camera {data.get('camera_code')} to {len(self.queues)} clients")
        for queue in list(self.queues):
            try:
                queue.put_nowait(message)
            except Exception as e:
                logger.error(f"Error putting message into queue: {e}")

    def _serialize_record(self, data: dict) -> dict:
        serialized = {}
        for k, v in data.items():
            if isinstance(v, datetime):
                serialized[k] = v.isoformat()
            else:
                serialized[k] = v
        return serialized

    def _has_changed(self, old_rec: dict, new_rec: dict) -> bool:
        if not old_rec:
            return True
        old_val = old_rec.get("last_updated") or old_rec.get("id")
        new_val = new_rec.get("last_updated") or new_rec.get("id")
        
        if old_val != new_val:
            return True
            
        return old_rec.get("total_vehicles") != new_rec.get("total_vehicles")

    async def start(self):
        self.is_running = True
        self.loop = asyncio.get_running_loop()
        
        try:
            from supabase import create_async_client
            self.async_client = await create_async_client(SUPABASE_URL, SUPABASE_KEY)
            logger.info("Supabase AsyncClient instantiated successfully.")
        except Exception as e:
            logger.error(f"Failed to instantiate Supabase AsyncClient: {e}")
            self.async_client = None
        
        # Start DB polling fallback loop
        self.polling_task = asyncio.create_task(self._db_polling_loop())
        
        # Start Supabase Realtime subscription task
        self.realtime_task = asyncio.create_task(self._supabase_realtime_loop())

    async def stop(self):
        self.is_running = False
        if self.polling_task:
            self.polling_task.cancel()
        if self.realtime_task:
            self.realtime_task.cancel()
        if self.channel:
            try:
                self.channel.unsubscribe()
            except Exception:
                pass
        logger.info("RealtimeManager stopped.")

    async def _db_polling_loop(self):
        logger.info("Starting database polling loop (fallback)...")
        while self.is_running:
            try:
                response = supabase.table("traffic_master").select("*").execute()
                records = response.data
                if records:
                    for record in records:
                        camera_code = record.get("camera_code")
                        if not camera_code:
                            continue
                        
                        last_rec = self.last_records.get(camera_code)
                        if self._has_changed(last_rec, record):
                            logger.info(f"Database poll detected update for camera: {camera_code}")
                            self.last_records[camera_code] = record
                            self.broadcast(record)
            except Exception as e:
                logger.error(f"Error in database polling loop: {e}")
            
            await asyncio.sleep(3.0)

    async def _supabase_realtime_loop(self):
        logger.info("Starting Supabase Realtime listener setup...")
        while self.is_running:
            try:
                def on_change(payload):
                    logger.info("Realtime event received from Supabase!")
                    new_data = None
                    try:
                        if hasattr(payload, "new"):
                            new_data = payload.new
                        elif isinstance(payload, dict):
                            new_data = payload.get("new") or payload.get("record")
                        
                        if not new_data:
                            new_data = getattr(payload, "record", None)
                            
                        if not new_data and hasattr(payload, "get"):
                            new_data = payload.get("new")
                            
                        if not new_data and isinstance(payload, str):
                            new_data = json.loads(payload).get("new")

                        if new_data:
                            camera_code = new_data.get("camera_code")
                            if camera_code:
                                last_rec = self.last_records.get(camera_code)
                                if self._has_changed(last_rec, new_data):
                                    self.last_records[camera_code] = new_data
                                    if self.loop:
                                        self.loop.call_soon_threadsafe(self.broadcast, new_data)
                    except Exception as ex:
                        logger.error(f"Error processing realtime callback payload: {ex}")

                if not self.async_client:
                    raise ValueError("AsyncClient is not initialized")
                self.channel = self.async_client.channel('traffic-changes')
                self.channel.on_postgres_changes(
                    event="*",
                    schema="public",
                    table="traffic_master",
                    callback=on_change
                )
                await self.channel.subscribe()
                
                logger.info("Successfully subscribed to Supabase Realtime channel for traffic_master.")
                
                while self.is_running:
                    await asyncio.sleep(10.0)
            except Exception as e:
                logger.error(f"Error in Supabase Realtime subscription: {e}. Reconnecting in 5 seconds...")
                await asyncio.sleep(5.0)

manager = RealtimeManager()
