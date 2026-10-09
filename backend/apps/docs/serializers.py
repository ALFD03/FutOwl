import re

from rest_framework import serializers

from .models import DocPage, DocRevision

# Rutas propias (API `permission-catalog/`, pantalla `/app/ayuda/nueva`) que no pueden usarse como identificador.
RESERVED_SLUGS = {"catalog", "permission-catalog", "nueva"}


class DocPageListSerializer(serializers.ModelSerializer):
    section_display = serializers.CharField(source="get_section_display", read_only=True)

    class Meta:
        model = DocPage
        fields = ["id", "slug", "title", "summary", "section", "section_display", "order", "is_active", "updated_at"]


class DocPageSerializer(DocPageListSerializer):
    updated_by_name = serializers.SerializerMethodField()

    class Meta(DocPageListSerializer.Meta):
        fields = [*DocPageListSerializer.Meta.fields, "content", "updated_by_name"]
        read_only_fields = ["id", "updated_at"]

    def get_updated_by_name(self, obj):
        user = obj.updated_by
        return (user.get_full_name() or user.username) if user else None

    def validate_slug(self, value):
        value = value.strip().lower()
        if not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", value):
            raise serializers.ValidationError("Use minúsculas, números y guiones (p. ej. «mesa-tecnica»).")
        if value in RESERVED_SLUGS:
            raise serializers.ValidationError("Ese identificador está reservado.")
        return value


class DocRevisionSerializer(serializers.ModelSerializer):
    edited_by_name = serializers.SerializerMethodField()

    class Meta:
        model = DocRevision
        fields = ["id", "title", "content", "created_at", "edited_by_name"]

    def get_edited_by_name(self, obj):
        user = obj.edited_by
        return (user.get_full_name() or user.username) if user else "Contenido base"
