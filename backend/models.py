from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any
from enum import Enum
import uuid


class EntityType(str, Enum):
    CONCEPT = "CONCEPT"
    PERSON = "PERSON"
    ORG = "ORG"
    DATE = "DATE"
    LOCATION = "LOCATION"
    TERM = "TERM"
    EVENT = "EVENT"


ENTITY_COLORS = {
    EntityType.CONCEPT: "#3a7bd5",
    EntityType.PERSON: "#e8676b",
    EntityType.ORG: "#f5a623",
    EntityType.DATE: "#7bed9f",
    EntityType.LOCATION: "#a29bfe",
    EntityType.TERM: "#fd79a8",
    EntityType.EVENT: "#fdcb6e",
}


@dataclass
class Node:
    id: str
    label: str
    type: EntityType
    description: str
    embedding: List[float] = field(default_factory=list)
    source_doc: str = ""
    connection_count: int = 0

    def to_dict(self):
        return {
            "id": self.id,
            "label": self.label,
            "type": self.type.value,
            "description": self.description,
            "color": ENTITY_COLORS.get(self.type, "#3a7bd5"),
            "source_doc": self.source_doc,
            "connection_count": self.connection_count,
        }


@dataclass
class Edge:
    id: str
    source_id: str
    target_id: str
    label: str
    source_sentence: str = ""

    def to_dict(self):
        return {
            "id": self.id,
            "source": self.source_id,
            "target": self.target_id,
            "label": self.label,
            "source_sentence": self.source_sentence,
        }


@dataclass
class GraphSession:
    session_id: str
    nodes: Dict[str, Node] = field(default_factory=dict)
    edges: List[Edge] = field(default_factory=list)
    documents: List[str] = field(default_factory=list)
    label_to_id: Dict[str, str] = field(default_factory=dict)
    vectorizer: Optional[Any] = field(default=None, repr=False)

    def to_dict(self):
        return {
            "session_id": self.session_id,
            "nodes": [n.to_dict() for n in self.nodes.values()],
            "edges": [e.to_dict() for e in self.edges],
            "documents": self.documents,
        }
