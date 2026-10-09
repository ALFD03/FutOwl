from django.db import migrations

from apps.core.db import enable_row_level_security, install_append_only_triggers, remove_append_only_triggers


class Migration(migrations.Migration):
    dependencies = [
        ("competition", "0001_initial"),
        ("audit", "0001_initial"),
        ("legal", "0001_initial"),
        ("notifications", "0001_initial"),
        ("token_blacklist", "0013_alter_blacklistedtoken_options_and_more"),
        ("sessions", "0001_initial"),
        ("admin", "0003_logentry_add_action_flag_choices"),
    ]

    operations = [
        migrations.RunPython(install_append_only_triggers, remove_append_only_triggers),
        migrations.RunPython(enable_row_level_security, migrations.RunPython.noop),
    ]
