"""
Fábricas de datos para pruebas y para el comando `seed_demo`.
Crean registros válidos con valores por defecto razonables.
"""
import itertools
from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group

from apps.legal.models import TermsAcceptance
from apps.legal.services import current_terms

_seq = itertools.count(1000000)


def next_vat() -> str:
    return str(next(_seq))


def user(username: str, *, role: str | None = None, superuser: bool = False, password: str = "FutOwl#2026!",
         accept_terms: bool = True):
    User = get_user_model()
    obj, created = User.objects.get_or_create(username=username, defaults={"email": f"{username}@futowl.local"})
    if created:
        obj.set_password(password)
        obj.is_superuser = superuser
        obj.is_staff = superuser
        obj.save()
    if role:
        obj.groups.add(Group.objects.get(name=role))
    terms = current_terms()
    if accept_terms and terms:
        TermsAcceptance.objects.get_or_create(user=obj, terms=terms)
    return obj


def category(name="Sub 12", max_age=11, birth_year_limit=2015):
    from apps.registry.models import Category

    return Category.objects.get_or_create(name=name, defaults={"max_age": max_age,
                                                               "birth_year_limit": birth_year_limit})[0]


def field(name="Cancha Principal", divisible=False, mini=1):
    from apps.registry.models import Field

    return Field.objects.get_or_create(name=name, defaults=dict(
        state="Carabobo", municipality="Valencia", address="Av. Bolívar Norte", manager_name="Pedro Pérez",
        manager_phone="+58 412-1234567", length_m=100, width_m=64, is_divisible=divisible,
        mini_fields_count=mini if divisible else 1,
    ))[0]


def coach(first="Carlos", last="Rodríguez"):
    from apps.registry.models import Coach

    return Coach.objects.create(first_name=first, last_name=last, vat_number=next_vat(), phone="+58 414-5550000",
                                license_number=f"LIC-{next_vat()}", license_expiry_year=date.today().year + 1)


def guardian(first="María", last="González"):
    from apps.registry.models import Guardian

    return Guardian.objects.create(first_name=first, last_name=last, vat_number=next_vat(),
                                   phone="+58 424-5551111", relationship="Madre")


def player(first, last, birth_date, *, with_guardian=None):
    from apps.registry.models import Player

    minor = (date.today() - birth_date).days < 18 * 365
    return Player.objects.create(
        first_name=first, last_name=last, birth_date=birth_date, vat_number=next_vat(),
        guardian=(with_guardian or guardian()) if minor else None, phone="+58 412-0000000",
    )


def official(model_name: str, first: str, last: str, user_obj=None):
    from apps.registry import models as m

    model = getattr(m, model_name)
    return model.objects.create(first_name=first, last_name=last, vat_number=next_vat(), user=user_obj,
                                license_status="endorsed", phone="+58 416-5552222")


def team(name, cat, *, manager=None, home=None, players=11, birth_year=None):
    from apps.registry.models import Team, TeamPlayer

    obj = Team.objects.create(name=name, vat_id="J", vat_number=next_vat(), state="Carabobo",
                              municipality="Valencia", address="Calle 1", home_field=home)
    obj.categories.add(cat)
    c = coach(f"DT {name}", "Entrenador")
    obj.coaches.add(c)
    if manager:
        obj.managers.add(manager)
    year = birth_year or cat.birth_year_limit
    for i in range(1, players + 1):
        p = player(f"Jugador{i}", name.split()[0], date(year, (i % 12) + 1, (i % 27) + 1))
        TeamPlayer.objects.create(team=obj, player=p, category=cat, shirt_number=i)
    return obj


def tournament(name="Copa FutOwl", categories=(), fields=(), **kwargs):
    from apps.tournaments.models import Tournament

    obj = Tournament.objects.create(name=name, status=Tournament.Status.IN_PROGRESS,
                                    start_date=date.today(), end_date=date.today() + timedelta(days=90), **kwargs)
    obj.categories.set(categories)
    obj.fields.set(fields)
    return obj


def register(tournament_obj, team_obj, cat, group=None):
    from apps.tournaments.models import TournamentTeam

    return TournamentTeam.objects.create(tournament=tournament_obj, team=team_obj, category=cat, group=group)
