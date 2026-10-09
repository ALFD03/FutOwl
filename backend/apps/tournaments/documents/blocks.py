from dataclasses import dataclass, field


@dataclass
class Block:
    pass


@dataclass
class Title(Block):
    text: str


@dataclass
class Subtitle(Block):
    text: str


@dataclass
class Paragraph(Block):
    text: str
    bold: bool = False


@dataclass
class Spacer(Block):
    height: int = 8


@dataclass
class Table(Block):
    headers: list[str]
    rows: list[list[str]]
    widths: list[float] = field(default_factory=list)  # proporciones relativas


@dataclass
class Signatures(Block):
    labels: list[str]


@dataclass
class PageBreak(Block):
    pass
