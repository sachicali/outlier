import os

print("Initializing simple database module...")

# Mock Base class for SQLAlchemy models
class MockBase:
    def __init__(self, **kwargs):
        for key, value in kwargs.items():
            setattr(self, key, value)

Base = MockBase

# Simple mock for database session
class MockSessionLocal:
    def __enter__(self):
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        pass
    
    def close(self):
        pass

SessionLocal = MockSessionLocal

def get_db_session():
    return MockSessionLocal()

# Mock Redis client
class MockRedis:
    def __init__(self):
        self.data = {}
    
    def get(self, key):
        return self.data.get(key)
    
    def set(self, key, value):
        self.data[key] = value
        return True
    
    def setex(self, key, expires, value):
        self.data[key] = value
        return True
    
    def ping(self):
        return True

redis_client = MockRedis()

print("Simple database module initialized successfully")