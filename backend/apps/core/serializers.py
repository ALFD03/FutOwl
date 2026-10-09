from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers


class CleanModelSerializer(serializers.ModelSerializer):
    """Ejecuta `Model.clean()` con los datos entrantes para reutilizar las reglas de negocio del modelo."""

    def validate(self, attrs):
        attrs = super().validate(attrs)
        model = self.Meta.model
        m2m = {f.name for f in model._meta.many_to_many}
        instance = self.instance or model()
        original = {}
        for key, value in attrs.items():
            if key in m2m:
                continue
            original[key] = getattr(instance, key, None)
            setattr(instance, key, value)
        try:
            instance.clean()
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict if hasattr(exc, "error_dict") else exc.messages)
        finally:
            if self.instance is not None:
                for key, value in original.items():
                    setattr(instance, key, value)
        # `clean()` puede normalizar valores (p. ej. mini canchas)
        for key in list(attrs):
            if key not in m2m and hasattr(instance, key) and self.instance is None:
                attrs[key] = getattr(instance, key)
        return attrs


class IdentityFieldsMixin(serializers.Serializer):
    vat_display = serializers.CharField(read_only=True)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        model = self.Meta.model
        vat_id = attrs.get("vat_id", getattr(self.instance, "vat_id", None))
        vat_number = attrs.get("vat_number", getattr(self.instance, "vat_number", None))
        if vat_number:
            probe = model(vat_id=vat_id, vat_number=vat_number)
            qs = model._base_manager.filter(vat_hash=probe.compute_vat_hash())
            if self.instance is not None:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError({"vat_number": "Ya existe un registro con este documento."})
        return attrs
