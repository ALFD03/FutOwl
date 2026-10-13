"""
Datos de prueba masivos para ensayar torneos a mano (sin torneos ni partidos):

- 8 categorías (Sub 6 a Sub 21) con sus reglas de juego.
- 10 canchas (algunas divisibles).
- 21 delegados (20 + el jefe) y 21 árbitros (20 + el jefe), todos con usuario.
- 50 equipos con las 8 categorías, un gestor con usuario y 4 entrenadores (el primero con usuario).
- 22 jugadores por categoría y equipo (8.800), con representante para los menores de edad.

    python manage.py seed_test_data --password "Alfd0101.01"

Todas las cuentas usan la misma contraseña y ya aceptaron los términos vigentes.
"""
import random
from datetime import date

from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import make_password
from django.contrib.auth.models import Group
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.accounts import roles
from apps.legal.models import TermsAcceptance
from apps.legal.services import current_terms
from apps.registry.models import Category, Coach, Delegate, Field, Guardian, Player, Referee, Team

FIRST = ["José", "Luis", "Carlos", "Miguel", "Andrés", "Daniel", "Gabriel", "Diego", "Santiago", "Sebastián",
         "Mateo", "Samuel", "Alejandro", "David", "Javier", "Ricardo", "Fernando", "Manuel", "Jesús", "Ángel",
         "María", "Ana", "Laura", "Daniela", "Valentina", "Camila", "Sofía", "Isabella", "Gabriela", "Andrea"]
LAST = ["González", "Rodríguez", "Pérez", "Hernández", "García", "Martínez", "López", "Díaz", "Sánchez", "Ramírez",
        "Torres", "Rojas", "Flores", "Mendoza", "Castillo", "Moreno", "Suárez", "Blanco", "Romero", "Guerrero",
        "Medina", "Silva", "Vargas", "Morales", "Gutiérrez", "Rivas", "Delgado", "Contreras", "Marcano", "Salazar"]
TEAM_WORDS = ["Halcones", "Lobos", "Tigres", "Leones", "Águilas", "Búhos", "Panteras", "Tiburones", "Toros", "Pumas",
              "Jaguares", "Cóndores", "Delfines", "Linces", "Osos", "Zorros", "Gavilanes", "Caimanes", "Venados", "Potros",
              "Titanes", "Guerreros", "Centauros", "Dragones", "Vikingos"]
TEAM_SUFFIX = ["FC", "Sport"]
PLACES = [("Carabobo", "Valencia"), ("Carabobo", "Naguanagua"), ("Carabobo", "San Diego"), ("Carabobo", "Los Guayos"),
          ("Aragua", "Maracay"), ("Lara", "Barquisimeto"), ("Miranda", "Chacao"), ("Distrito Capital", "Libertador")]
# (nombre, tope de edad, reglas): duración, tiempos, descanso, cambios, planilla, titulares, árbitros
CATEGORIES = [
    ("Sub 6", 5, (30, 2, 5, None, 10, 5, 1)), ("Sub 8", 7, (40, 2, 5, None, 12, 7, 1)),
    ("Sub 10", 9, (50, 2, 10, None, 14, 9, 1)), ("Sub 12", 11, (60, 2, 10, 7, 16, 11, 2)),
    ("Sub 14", 13, (70, 2, 10, 7, 18, 11, 3)), ("Sub 16", 15, (80, 2, 10, 5, 18, 11, 3)),
    ("Sub 18", 17, (90, 2, 15, 5, 18, 11, 3)), ("Sub 21", 20, (90, 2, 15, 5, 18, 11, 3)),
]
RULE_KEYS = ["match_duration_minutes", "periods", "break_minutes", "max_substitutions", "max_lineup_players",
             "starters_count", "referees_required"]
PLAYERS_PER_CATEGORY = 22
TEAMS = 50


class Command(BaseCommand):
    help = "Carga datos de prueba masivos (registro completo, sin torneos ni partidos)."

    def add_arguments(self, parser):
        parser.add_argument("--password", default="Alfd0101.01", help="Contraseña común de todas las cuentas")

    def handle(self, *args, **options):
        if Team.objects.exists() or Category.objects.exists():
            raise CommandError("Ya hay equipos o categorías: este comando es para una base limpia.")
        call_command("seed_roles", verbosity=0)
        self.verbosity = options["verbosity"]
        self.rng = random.Random(2026)
        self.vat = iter(range(10_000_000, 99_999_999))
        self.password = make_password(options["password"])  # un solo hash: cifrar miles de claves sería lento
        self.terms = current_terms()
        with transaction.atomic():
            categories = self.categories()
            fields = self.fields()
            self.officials(Delegate, "delegado", roles.DELEGATE, roles.HEAD_DELEGATE, "jefe_delegados")
            self.officials(Referee, "arbitro", roles.REFEREE, roles.HEAD_REFEREE, "jefe_arbitros")
            players = self.teams(categories, fields)
        self.stdout.write(self.style.SUCCESS(
            f"Listo: {len(categories)} categorías, {len(fields)} canchas, 42 oficiales, {TEAMS} equipos, "
            f"{TEAMS * 4} entrenadores y {players} jugadores. Contraseña de todas las cuentas: {options['password']}"
        ))

    # ------------------------------------------------------------------ utilidades
    def name(self):
        return self.rng.choice(FIRST), f"{self.rng.choice(LAST)} {self.rng.choice(LAST)}"

    def phone(self):
        return f"+58 {self.rng.choice(['412', '414', '416', '424', '426'])}-{self.rng.randint(1000000, 9999999)}"

    def identity(self, obj, vat_id="V"):
        obj.vat_id, obj.vat_number = vat_id, str(next(self.vat))
        obj.vat_hash = obj.compute_vat_hash()  # bulk_create no pasa por save()
        return obj

    def user(self, username, role, first="", last=""):
        user = get_user_model().objects.create(username=username, email=f"{username}@futowl.test", first_name=first,
                                               last_name=last[:150], password=self.password, must_change_password=False)
        user.groups.add(Group.objects.get(name=role))
        if self.terms:
            TermsAcceptance.objects.create(user=user, terms=self.terms)
        return user

    # ------------------------------------------------------------------ registro
    def categories(self):
        return [Category.objects.create(name=name, max_age=age, **dict(zip(RULE_KEYS, rules)))
                for name, age, rules in CATEGORIES]

    def fields(self):
        result = []
        for i in range(1, 11):
            state, municipality = self.rng.choice(PLACES)
            divisible = i % 3 == 0
            result.append(Field.objects.create(
                name=f"Cancha {i} · {municipality}", manager_name=" ".join(self.name()), manager_phone=self.phone(),
                length_m=self.rng.choice([60, 80, 100, 105]), width_m=self.rng.choice([40, 50, 64, 68]),
                is_divisible=divisible, mini_fields_count=3 if divisible else 1,
                state=state, municipality=municipality, address=f"Av. Principal, sector {i}",
            ))
        return result

    def officials(self, model, prefix, role, head_role, head_username):
        for i in range(0, 21):  # 0 = el jefe, que también ejerce como oficial
            first, last = self.name()
            username, user_role = (head_username, head_role) if i == 0 else (f"{prefix}{i:02d}", role)
            user = self.user(username, user_role, first, last)
            self.identity(model(first_name=first, last_name=last, phone=self.phone(), license_status="endorsed",
                                user=user)).save()

    def teams(self, categories, fields):
        names = self.rng.sample([f"{w} {s}" for w in TEAM_WORDS for s in TEAM_SUFFIX], TEAMS)
        year = date.today().year
        players_total = 0
        for index, team_name in enumerate(sorted(names), start=1):
            state, municipality = self.rng.choice(PLACES)
            team = self.identity(Team(name=team_name, state=state, municipality=municipality,
                                      address=f"Calle {index}, {municipality}", home_field=self.rng.choice(fields)), "J")
            team.save()
            team.categories.set(categories)
            first, last = self.name()
            team.managers.add(self.user(f"gestor{index:02d}", roles.TEAM_MANAGER, first, last))

            coaches = []
            for n in range(4):
                first, last = self.name()
                user = self.user(f"dt{index:02d}", roles.COACH, first, last) if n == 0 else None
                coaches.append(self.identity(Coach(first_name=first, last_name=last, phone=self.phone(), team=team,
                                                   user=user, license_number=f"LIC-{index:02d}{n}",
                                                   license_expiry_year=year + 1)))
            Coach.objects.bulk_create(coaches)

            guardians, players = [], []
            for category in categories:
                for n in range(PLAYERS_PER_CATEGORY):
                    first, last = self.name()
                    born = date(year - category.max_age + self.rng.randint(0, 1), self.rng.randint(1, 12),
                                self.rng.randint(1, 28))
                    minor = (date.today() - born).days < 18 * 365
                    young = (date.today() - born).days < 9 * 365  # los más pequeños solo tienen partida de nacimiento
                    player = Player(first_name=first, last_name=last, birth_date=born, current_team=team,
                                    document_kind="birth_certificate" if young else "id_card")
                    if young:
                        player.vat_number, player.vat_hash = "", None
                    else:
                        self.identity(player)
                    if minor:
                        g_first, _ = self.name()
                        guardian = self.identity(Guardian(first_name=g_first, last_name=last, phone=self.phone(),
                                                          relationship=self.rng.choice(["Madre", "Padre", "Tutor"])))
                        guardians.append(guardian)
                        player.guardian = guardian
                    players.append(player)
            Guardian.objects.bulk_create(guardians, batch_size=500)
            Player.objects.bulk_create(players, batch_size=500)
            players_total += len(players)
            if self.verbosity > 1:
                self.stdout.write(f"  {team_name}: {len(players)} jugadores")
        return players_total
