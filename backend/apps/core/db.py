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
]

TRIGGER_FUNCTION = """
CREATE OR REPLACE FUNCTION futowl_block_mutation() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'FutOwl: la tabla % es de solo inserción (registro inalterable)', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;
"""


def install_append_only_triggers(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    schema_editor.execute(TRIGGER_FUNCTION)
    for table in APPEND_ONLY_TABLES:
        schema_editor.execute(f'DROP TRIGGER IF EXISTS futowl_append_only ON "{table}";')
        schema_editor.execute(
            f'CREATE TRIGGER futowl_append_only BEFORE UPDATE OR DELETE ON "{table}" '
            "FOR EACH ROW EXECUTE FUNCTION futowl_block_mutation();"
        )


def remove_append_only_triggers(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    for table in APPEND_ONLY_TABLES:
        schema_editor.execute(f'DROP TRIGGER IF EXISTS futowl_append_only ON "{table}";')


def enable_row_level_security(apps, schema_editor):
    """
    Supabase expone las tablas del esquema `public` vía su API REST (PostgREST).
    Activar RLS sin políticas bloquea ese acceso; Django se conecta como propietario
    de las tablas y no se ve afectado.
    """
    if schema_editor.connection.vendor != "postgresql":
        return
    with schema_editor.connection.cursor() as cursor:
        cursor.execute("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")
        tables = [row[0] for row in cursor.fetchall()]
    for table in tables:
        schema_editor.execute(f'ALTER TABLE "{table}" ENABLE ROW LEVEL SECURITY;')
