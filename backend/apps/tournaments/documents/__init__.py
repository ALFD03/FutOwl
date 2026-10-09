"""
Generación de documentos del torneo (PDF y Word) a partir de bloques genéricos.

Cada documento se describe como una lista de bloques independientes del formato,
que luego se renderizan con `render(blocks, fmt)`.
"""
from .blocks import Block, Paragraph, Signatures, Spacer, Subtitle, Table, Title  # noqa: F401
from .builders import lineup_sheet, regulation, substitution_cards  # noqa: F401
from .renderers import CONTENT_TYPES, render  # noqa: F401
