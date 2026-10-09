"""Protecciones a nivel de base de datos (solo PostgreSQL / Supabase)."""

APPEND_ONLY_TABLES = [
    "audit_auditlog",
    "competition_matchevent",
    "competition_matchconfirmation",
    "competition_matchadjustment",
    "competition_matchreport",
    "competition_reportreturn",
    "competition_matchclosure",
    "competition_matchnote",
    "legal_termsversion",
    "legal_termsacceptance",
    "docs_docrevision",
]

TRIGGER_FUNCTION = """
CREATE OR REPLACE FUNCTION futowl_block_mutation() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'FutOwl: la tabla % es de solo inserción (registro inalterable)', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;
"""


def _existing_tables(schema_editor) -> set[str]:
    with schema_editor.connection.cursor() as cursor:
        cursor.execute("SELECT tablename FROM pg_tables WHERE schemaname = current_schema()")
        return {row[0] for row in cursor.fetchall()}


def install_append_only_triggers(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    # params=None: el `%` de RAISE EXCEPTION no debe interpretarse como placeholder de psycopg.
    schema_editor.execute(TRIGGER_FUNCTION, params=None)
    # Las tablas de apps que migran después (p. ej. docs) se protegen en su propia migración.
    existing = _existing_tables(schema_editor)
    for table in [t for t in APPEND_ONLY_TABLES if t in existing]:
        schema_editor.execute(f'DROP TRIGGER IF EXISTS futowl_append_only ON "{table}";')
        schema_editor.execute(
            f'CREATE TRIGGER futowl_append_only BEFORE UPDATE OR DELETE ON "{table}" '
            "FOR EACH ROW EXECUTE FUNCTION futowl_block_mutation();"
        )


def remove_append_only_triggers(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    existing = _existing_tables(schema_editor)
    for table in [t for t in APPEND_ONLY_TABLES if t in existing]:
        schema_editor.execute(f'DROP TRIGGER IF EXISTS futowl_append_only ON "{table}";')


def enable_row_level_security(apps, schema_editor):
    """
    Supabase expone las tablas del esquema `public` vía su API REST (PostgREST).
    Activar RLS sin políticas bloquea ese acceso; Django se conecta como propietario
    de las tablas y no se ve afectado. Se aplica al esquema activo (`public` en
    producción, `qa` en previews).
    """
    if schema_editor.connection.vendor != "postgresql":
        return
    for table in sorted(_existing_tables(schema_editor)):
        schema_editor.execute(f'ALTER TABLE "{table}" ENABLE ROW LEVEL SECURITY;')
