from dataclasses import asdict, dataclass
from typing import Optional, Dict, Any
from datetime import datetime
import numpy as np


@dataclass
class Document:
    id: Optional[str]
    user_id: str
    doc_type_id: str
    metadata: Dict[str, Any]
    file_hash: str
    is_valid: bool
    validated_at: Optional[datetime]

    def to_mongo(self) -> dict:
        def normalize(value):
            if isinstance(value, np.generic):
                return value.item()

            if isinstance(value, dict):
                return {k: normalize(v) for k, v in value.items()}

            if isinstance(value, (list, tuple)):
                return [normalize(v) for v in value]

            return value

        data = asdict(self)
        data.pop("id", None)

        return normalize(data)
