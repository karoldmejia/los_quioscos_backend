from .models.document import Document
from .mongo_client import db
from datetime import datetime

class DocumentsRepository:

    def __init__(self):
        self.collection = db["documents"]

    async def create(self, document: Document) -> str:
        result = self.collection.insert_one(document.to_mongo())
        return str(result.inserted_id)
    
    def get_by_id(self, doc_id):
        from bson import ObjectId
        return self.collection.find_one({"_id": ObjectId(doc_id)})

    def list(self):
        return list(self.collection.find({}))