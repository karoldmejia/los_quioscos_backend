import time
from pymongo import MongoClient
import os

MONGO_USER = os.getenv("MONGO_ROOT_NAME")
MONGO_PASS = os.getenv("MONGO_PASSWORD")
MONGO_URL = f"mongodb://{MONGO_USER}:{MONGO_PASS}@mongodb:27017/"

for attempt in range(10):
    try:
        client = MongoClient(MONGO_URL, uuidRepresentation='standard', serverSelectionTimeoutMS=5000)
        client.admin.command('ping')
        print("MongoDB connected!")
        break
    except Exception as e:
        print(f"Mongo not ready, retrying... {e}")
        time.sleep(2)
else:
    raise RuntimeError("Could not connect to MongoDB after multiple attempts")

db = client["documents_db"]
