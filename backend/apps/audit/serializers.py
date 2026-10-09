from rest_framework import serializers

from .models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditLog
        fields = [
            "id", "created_at", "user", "username", "action", "app_label", "model", "object_id",
            "object_repr", "changes", "ip_address", "user_agent", "path", "method", "prev_hash", "hash",
        ]
        read_only_fields = fields
