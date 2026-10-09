import django_filters
from django.db.models import Q

from .models import Coach, Player


class PlayerFilter(django_filters.FilterSet):
    # Jugadores del equipo: los actuales y los que han pasado por él en algún torneo.
    team = django_filters.NumberFilter(method="filter_team")
    current_team = django_filters.NumberFilter(field_name="current_team")
    tournament = django_filters.NumberFilter(field_name="entries__tournament", distinct=True)
    # Candidatos para la nómina de una inscripción: elegibles por edad y libres en ese torneo.
    available_for = django_filters.NumberFilter(method="filter_available_for")

    class Meta:
        model = Player
        fields = ["is_active", "document_kind", "guardian"]

    def filter_team(self, queryset, name, value):
        return queryset.filter(Q(current_team=value) | Q(entries__registration__team=value)).distinct()

    def filter_available_for(self, queryset, name, value):
        from apps.tournaments.models import TournamentTeam

        registration = TournamentTeam.objects.select_related("category").filter(pk=value).first()
        if registration is None:
            return queryset.none()
        return queryset.filter(birth_date__year__gte=registration.category.birth_year_limit).exclude(
            entries__tournament_id=registration.tournament_id, entries__is_active=True
        )


class CoachFilter(django_filters.FilterSet):
    free = django_filters.BooleanFilter(field_name="team", lookup_expr="isnull")

    class Meta:
        model = Coach
        fields = ["is_active", "team"]
