from backend.services.agent_service import agent_service

convs = agent_service.get_all_conversations()
twilio_convs = [c for c in convs if c.startswith('twilio_')]
if twilio_convs:
    last_conv = twilio_convs[-1]
    history = agent_service.get_conversation_history(last_conv)
    print(f"Conversation: {last_conv}")
    if history:
        last_msg = history[-1]['content']
        print("Last role:", history[-1]['role'])
        print("Message length:", len(last_msg))
        print("Message preview:", last_msg[:150])
    else:
        print("No history for this conv.")
else:
    print("No twilio conversations.")
