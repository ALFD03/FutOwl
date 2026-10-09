"""Hora oficial de la aplicación: America/Caracas (UTC-4)."""
from datetime import date, datetime

from django.utils import timezone


def now() -> datetime:
    return timezone.localtime(timezone.now())


def today() -> date:
    return now().date()


def age_on(birth_date: date, reference: date | None = None) -> int:
    reference = reference or today()
    return reference.year - birth_date.year - ((reference.month, reference.day) < (birth_date.month, birth_date.day))
