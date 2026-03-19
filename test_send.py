import json
from twilio.rest import Client
from backend.database import engine
from sqlmodel import Session, select
from backend.models import Channel

with Session(engine) as session:
    channel = session.get(Channel, 2)
    config = json.loads(channel.config)
    
    account_sid = config.get("account_sid")
    auth_token = config.get("auth_token")
    phone_number = config.get("phone_number") # usually without whatsapp:

    print("SID:", account_sid)
    print("Phone:", phone_number)
    
    client = Client(account_sid, auth_token)
    try:
        msg = client.messages.create(
            body="Test from script",
            from_=f"whatsapp:{phone_number}",
            # we don't know the exact format of the user's personal number, but let's see if there's an error creating the request.
            # to check if the issue is the 'from_' number format
            to="whatsapp:+525512345678" # fake number just to see if twilio accepts the syntax
        )
        print("Success:", msg.sid)
    except Exception as e:
        print("Error:", str(e))
