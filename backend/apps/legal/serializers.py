from rest_framework import serializers

from .models import TermsVersion


class TermsVersionSerializer(serializers.ModelSerializer):
    class Meta:
        model = TermsVersion
        fields = ["id", "version", "title", "content", "created_at"]
        read_only_fields = ["id", "created_at"]
