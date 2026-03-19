import json
from sqlmodel import Session
from backend.database import engine
from backend.models import Channel

with Session(engine) as session:
    ch = session.get(Channel, 2)
    config = json.loads(ch.config) if ch and ch.config else {}
    print(f"Channel 2 Config:")
    print(f"- Type: {ch.type if ch else 'None'}")
    print(f"- SID (first 4): {config.get('account_sid', 'MISSING')[:4]}")
    print(f"- Token (first 4): {config.get('auth_token', 'MISSING')[:4]}")
    print(f"- Phone: {config.get('phone_number')}")
