import asyncio
import json
import logging
import random
from typing import Set, Dict
from datetime import datetime

logger = logging.getLogger("traffic-service.realtime")

MOCK_CAMERAS = [
    {"camera_code": "ACU-AN-001", "location_name": "Anna Nagar – Shanthi Colony Junction"},
    {"camera_code": "ACU-TN-002", "location_name": "T Nagar – Usman Road Flyover"},
    {"camera_code": "ACU-AM-003", "location_name": "Alwarpet – TTK Road Junction"},
    {"camera_code": "ACU-LH-004", "location_name": "Little Mount – GST Road Crossing"}
]

def generate_mock_record(camera_code: str) -> dict:
    location_name = "Anna Nagar – Shanthi Colony Junction"
    for cam in MOCK_CAMERAS:
        if cam["camera_code"] == camera_code:
            location_name = cam["location_name"]
            break
            
    total = random.randint(30, 120)
    bikes = int(total * random.uniform(0.4, 0.6))
    economy = int(total * random.uniform(0.2, 0.35))
    premium = int(total * random.uniform(0.08, 0.15))
    luxury = int(total * random.uniform(0.02, 0.06))
    ultra_luxury = int(total * random.uniform(0.0, 0.02))
    commercial = total - (bikes + economy + premium + luxury + ultra_luxury)
    if commercial < 0:
        commercial = 0
        
    return {
        "id": f"mock-{camera_code}",
        "location_name": location_name,
        "camera_code": camera_code,
        "total_vehicles": total,
        "bikes": bikes,
        "economy": economy,
        "premium": premium,
        "luxury": luxury,
        "ultra_luxury": ultra_luxury,
        "commercial": commercial,
        "avg_exposure_time": round(random.uniform(5.0, 15.0), 1),
        "max_exposure_time": round(random.uniform(20.0, 45.0), 1),
        "estimated_reach": int(total * random.uniform(1.2, 1.8)),
        "flow_rate": round(total / 60.0, 2),
        "peak_traffic_hour": "08:00 AM - 09:30 AM",
        "is_live": True,
        "last_updated": datetime.utcnow()
    }

class RealtimeManager:
    def __init__(self):
        self.queues: Set[asyncio.Queue] = set()
        self.last_records: Dict[str, dict] = {}
        self.loop = None
        self.simulator_task = None
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

    async def start(self):
        self.is_running = True
        self.loop = asyncio.get_running_loop()
        
        # Start DB simulator loop
        self.simulator_task = asyncio.create_task(self._simulation_loop())
        logger.info("RealtimeManager started with traffic simulator.")

    async def stop(self):
        self.is_running = False
        if self.simulator_task:
            self.simulator_task.cancel()
        logger.info("RealtimeManager stopped.")

    async def _simulation_loop(self):
        logger.info("Starting simulated traffic updates loop...")
        while self.is_running:
            try:
                for cam in MOCK_CAMERAS:
                    camera_code = cam["camera_code"]
                    record = generate_mock_record(camera_code)
                    self.last_records[camera_code] = record
                    self.broadcast(record)
            except Exception as e:
                logger.error(f"Error in simulation loop: {e}")
            
            # Broadcast simulated updates every 4 seconds
            await asyncio.sleep(4.0)

manager = RealtimeManager()
