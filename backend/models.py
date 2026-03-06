from typing import Optional, List, Dict, Any
from sqlmodel import Field, SQLModel, Relationship


class ApiKeyBase(SQLModel):
    name: str = Field(index=True)
    key: str = Field(unique=True, index=True)
    valid_scopes: str = Field(description="Comma separated list of valid scopes for this API key")


class ApiKey(ApiKeyBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    agents: List["Agent"] = Relationship(back_populates="api_key")


class ApiKeyCreate(SQLModel):
    name: str = Field(index=True)
    key: str = Field(unique=True, index=True)


class ApiKeyRead(ApiKeyBase):
    id: int


class AgentBase(SQLModel):
    name: str = Field(index=True)
    system_prompt: str
    selected_scopes: str = Field(description="Comma separated list of selected scopes for this Agent")
    api_key_id: Optional[int] = Field(default=None, foreign_key="apikey.id")
    temperature: float = Field(default=0.0)
    model: str = Field(default="gpt-4o")


class Agent(AgentBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    api_key: Optional[ApiKey] = Relationship(back_populates="agents")


class AgentCreate(AgentBase):
    pass


class AgentUpdate(SQLModel):
    name: Optional[str] = None
    system_prompt: Optional[str] = None
    selected_scopes: Optional[str] = None
    temperature: Optional[float] = None
    model: Optional[str] = None


class AgentRead(AgentBase):
    id: int
