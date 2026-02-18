from dataclasses import dataclass
from typing import Optional

@dataclass
class DocumentType:
    id: Optional[str]
    name: str