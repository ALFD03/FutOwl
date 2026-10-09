import django_filters

from .models import Player


class PlayerFilter(django_filters.FilterSet):
    team = django_filters.NumberFilter(field_name="memberships__team", distinct=True)
    category = django_filters.NumberFilter(field_name="memberships__category", distinct=True)
    unassigned = django_filters.BooleanFilter(method="filter_unassigned")

    class Meta:
        model = Player
        fields = ["is_active", "document_kind", "guardian"]

    def filter_unassigned(self, queryset, name, value):
        if value:
            return queryset.exclude(memberships__is_active=True)
        return queryset
