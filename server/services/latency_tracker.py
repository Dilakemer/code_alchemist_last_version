import json
import os
import time
import logging
from typing import Dict, List

STATS_FILE = "latency_stats.json"
LOCK_FILE = "latency_stats.lock"

class LatencyTracker:
    def __init__(self):
        self.stats_file = os.path.join(os.path.dirname(__file__), "..", STATS_FILE)
        self.lock_file = os.path.join(os.path.dirname(__file__), "..", LOCK_FILE)
        self.current_stats = self._load_stats()

    def _load_stats(self) -> Dict:
        if os.path.exists(self.stats_file):
            try:
                with open(self.stats_file, "r") as f:
                    return json.load(f)
            except Exception as e:
                logging.warning(f"Failed to load latency stats: {e}. Falling back to empty stats.")
        return {"runs": [], "averages": {}}

    def record_step(self, step_type: str, duration: float):
        # Primitive lock file to prevent race conditions during concurrent writes
        lock_acquired = False
        start_wait = time.time()
        while time.time() - start_wait < 2.0: # Wait max 2 seconds
            if not os.path.exists(self.lock_file):
                try:
                    with open(self.lock_file, "w") as f:
                        f.write(str(os.getpid()))
                    lock_acquired = True
                    break
                except:
                    pass
            time.sleep(0.05)

        try:
            # Reload stats before writing to ensure we don't overwrite other workers' data
            self.current_stats = self._load_stats()
            
            if step_type not in self.current_stats["averages"]:
                self.current_stats["averages"][step_type] = {"total_time": 0, "count": 0, "avg": 0}
            
            stat = self.current_stats["averages"][step_type]
            stat["total_time"] += duration
            stat["count"] += 1
            stat["avg"] = stat["total_time"] / stat["count"]
            
            self._save_stats()
        finally:
            if lock_acquired:
                try:
                    os.remove(self.lock_file)
                except:
                    pass

    def _save_stats(self):
        try:
            with open(self.stats_file, "w") as f:
                json.dump(self.current_stats, f, indent=2)
        except Exception as e:
            logging.error(f"Failed to save latency stats: {e}")

tracker = LatencyTracker()
