import asyncio
from typing import TypedDict, Annotated
import operator
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver
from langchain_core.messages import HumanMessage, AIMessage

class State(TypedDict):
    messages: Annotated[list, operator.add]

def node(state):
    return {"messages": [AIMessage(content="Hello!")]}

workflow = StateGraph(State)
workflow.add_node("agent", node)
workflow.add_edge(START, "agent")
workflow.add_edge("agent", END)

checkpointer = MemorySaver()
app = workflow.compile(checkpointer=checkpointer)

async def main():
    config = {"configurable": {"thread_id": "test_thread"}}
    await app.ainvoke({"messages": [HumanMessage(content="Hi")]}, config=config)
    
    # Check extraction
    # Option 1: using get_state
    state = app.get_state(config)
    print("State values:", state.values)
    
    # Check list of threads
    # In newer langgraph we can do search
    print("Has storage?", hasattr(checkpointer, 'storage'))
    if hasattr(checkpointer, 'storage'):
         print("Storage keys:", list(checkpointer.storage.keys()))

asyncio.run(main())
