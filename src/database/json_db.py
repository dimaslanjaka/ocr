import json
import os
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Any

class JsonDatabase:
    """JSON-based database for storing OCR results and metadata"""

    def __init__(self, db_path: str = "data/ocr_results.json"):
        self.db_path = db_path
        self.ensure_db_exists()

    def ensure_db_exists(self):
        """Create database file and directory if they don't exist"""
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        if not os.path.exists(self.db_path):
            self._write_data({"records": [], "metadata": {"created": datetime.now().isoformat()}})

    def _read_data(self) -> Dict:
        """Read data from JSON file"""
        try:
            with open(self.db_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            return {"records": [], "metadata": {"created": datetime.now().isoformat()}}

    def _write_data(self, data: Dict):
        """Write data to JSON file"""
        with open(self.db_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    def create_record(self, image_path: str, ocr_results: List[Dict], metadata: Optional[Dict] = None) -> str:
        """Create a new OCR record or update existing one for the same image path"""
        data = self._read_data()

        # Check if record already exists for this image path
        existing_record = None
        for i, record in enumerate(data["records"]):
            if record["image_path"] == image_path:
                existing_record = record
                existing_index = i
                break

        if existing_record:
            # Update existing record
            existing_record.update({
                "ocr_results": ocr_results,
                "metadata": metadata or {},
                "updated_at": datetime.now().isoformat()
            })
            record_id = existing_record["id"]
        else:
            # Create new record
            record_id = str(uuid.uuid4())
            record = {
                "id": record_id,
                "image_path": image_path,
                "created_at": datetime.now().isoformat(),
                "ocr_results": ocr_results,
                "metadata": metadata or {}
            }
            data["records"].append(record)

        self._write_data(data)
        return record_id

    def get_record(self, record_id: str) -> Optional[Dict]:
        """Get a record by ID"""
        data = self._read_data()
        for record in data["records"]:
            if record["id"] == record_id:
                return record
        return None

    def get_record_by_image_path(self, image_path: str) -> Optional[Dict]:
        """Get a record by image path"""
        data = self._read_data()
        for record in data["records"]:
            if record["image_path"] == image_path:
                return record
        return None

    def get_all_records(self) -> List[Dict]:
        """Get all records"""
        data = self._read_data()
        return data["records"]

    def update_record(self, record_id: str, updates: Dict) -> bool:
        """Update a record"""
        data = self._read_data()
        for record in data["records"]:
            if record["id"] == record_id:
                record.update(updates)
                record["updated_at"] = datetime.now().isoformat()
                self._write_data(data)
                return True
        return False

    def delete_record(self, record_id: str) -> bool:
        """Delete a record"""
        data = self._read_data()
        original_count = len(data["records"])
        data["records"] = [r for r in data["records"] if r["id"] != record_id]

        if len(data["records"]) < original_count:
            self._write_data(data)
            return True
        return False

    def search_records(self, query: str) -> List[Dict]:
        """Search records by text content"""
        data = self._read_data()
        results = []

        for record in data["records"]:
            # Search in OCR results text
            for ocr_result in record.get("ocr_results", []):
                if query.lower() in ocr_result.get("text", "").lower():
                    results.append(record)
                    break

        return results

    def get_stats(self) -> Dict:
        """Get database statistics"""
        data = self._read_data()
        records = data["records"]

        return {
            "total_records": len(records),
            "total_text_elements": sum(len(r.get("ocr_results", [])) for r in records),
            "created": data.get("metadata", {}).get("created"),
            "last_record": records[-1]["created_at"] if records else None
        }
