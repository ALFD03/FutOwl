"""
Crea datos de demostración: roles, usuarios por rol, categorías, canchas, equipos,
oficiales, un torneo con fixture y una jornada de hoy con un partido en vivo.

    python manage.py seed_demo --password "Demo#2026!"
"""
from datetime import datetime, time, timedelta

from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.accounts import roles
from apps.competition.models import Match, Matchday, MatchEvent
from apps.competition.services import confirmations, fixtures, lineups, live, scheduling
from apps.core import factories as f
from apps.tournaments.models import Group

TEAMS = ["Búhos Dorados", "Halcones Rojos", "Águilas Azules", "Leones del Norte", "Tiburones FC", "Panteras Negras"]


class Command(BaseCommand):
    help = "Carga datos de demostración para explorar FutOwl."

    def add_arguments(self, parser):
        parser.add_argument("--password", default="FutOwl#2026!", help="Contraseña para todos los usuarios demo")

    @transaction.atomic
    def handle(self, *args, **options):
        pwd = options["password"]
        call_command("seed_roles", verbosity=0)
        admin = f.user("admin", superuser=True, password=pwd)
        authority = f.user("autoridad", role=roles.AUTHORITY, password=pwd)
        f.user("jefearbitros", role=roles.HEAD_REFEREE, password=pwd)
        f.user("jefedelegados", role=roles.HEAD_DELEGATE, password=pwd)

        sub12 = f.category("Sub 12", 11)
        f.category("Sub 14", 13)
        main = f.field("Estadio Misael Delgado")
        f.field("Complejo Los Guayos", divisible=True, mini=3)

        delegates = [f.official("Delegate", n, "Delegado", f.user(f"delegado{i}", role=roles.DELEGATE, password=pwd))
                     for i, n in enumerate(["Ana", "José"], start=1)]
        referees = [f.official("Referee", n, "Árbitro", f.user(f"arbitro{i}", role=roles.REFEREE, password=pwd))
                    for i, n in enumerate(["Luis", "Marta", "Pedro", "Rosa", "Iván", "Elena"], start=1)]

        tournament = f.tournament("Copa FutOwl 2026", categories=[sub12], fields=[main], max_substitutions=5,
                                  starters_count=7, max_lineup_players=14,
                                  regulation_text="# Disposiciones generales\n- Partidos de 2 tiempos de 30 "
                                                  "minutos.\n- Cambios ilimitados en el entretiempo.")
        group_a = Group.objects.create(tournament=tournament, category=sub12, name="Grupo A")
        registrations = []
        for i, name in enumerate(TEAMS, start=1):
            manager = f.user(f"gestor{i}", role=roles.TEAM_MANAGER, password=pwd)
            team = f.team(name, sub12, manager=manager, home=main, players=12)
            registrations.append(f.register(tournament, team, sub12, group_a))

        fixtures.generate_fixture(tournament, sub12.id, admin, group_id=group_a.id)
        today = timezone.localdate()
        matchday = Matchday.objects.create(tournament=tournament, number=1, date=today, name="Jornada 1",
                                           created_by=authority)
        start = timezone.make_aware(datetime.combine(today, time(8, 0)))
        for index, match in enumerate(Match.objects.filter(tournament=tournament, round_number=1)):
            match.matchday = matchday
            match.field = main
            match.scheduled_start = start + timedelta(hours=index * 2)
            match.scheduled_end = match.scheduled_start + timedelta(minutes=70)
            match.delegate = delegates[index % 2]
            trio = referees[(index * 3) % 6:(index * 3) % 6 + 3] or referees[:3]
            match.referee, match.assistant_referee_1, match.assistant_referee_2 = (trio + referees)[:3]
            scheduling.validate_schedule(match)
            match.save()
        scheduling.submit_matchday(matchday, authority)

        # Primer partido: confirmado, con alineaciones y en juego
        match = matchday.matches.order_by("scheduled_start").first()
        for party in ("delegate", "referee", "assistant_1", "assistant_2"):
            official = match.party_official(party)
            confirmations.respond(match, official.user, party, "accepted")
        for reg in (match.home, match.away):
            roster = list(reg.roster.order_by("shirt_number"))
            players = [{"team_player": tp.id, "shirt_number": tp.shirt_number, "is_starter": i < 7,
                        "is_captain": i == 0} for i, tp in enumerate(roster)]
            lineups.submit_lineup(match, reg.id, reg.team.managers.first(), players)
        dele = match.delegate.user
        T = MatchEvent.Type
        live.record_event(match, dele, {"type": T.DELEGATE_ARRIVAL})
        for reg in (match.home, match.away):
            live.record_event(match, dele, {"type": T.TEAM_ARRIVAL, "team_id": reg.id})
            live.record_event(match, dele, {"type": T.DOCUMENTS_VERIFIED, "team_id": reg.id})
        live.record_event(match, dele, {"type": T.KICKOFF})
        scorer = match.lineups.get(team=match.home).players.filter(is_starter=True).first().team_player_id
        live.record_event(match, dele, {"type": T.GOAL, "team_id": match.home_id, "player_id": scorer, "minute": 7})

        self.stdout.write(self.style.SUCCESS(
            "Datos demo listos. Usuarios: admin, autoridad, jefearbitros, jefedelegados, delegado1-2, arbitro1-6, "
            "gestor1-6 "
            f"(contraseña: {pwd})."
        ))
