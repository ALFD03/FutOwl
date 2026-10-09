from collections.abc import Iterable

from .models import Notification


def notify(users: Iterable, title: str, message: str, *, level: str = "info", link: str = "") -> int:
    seen = set()
    batch = []
    for user in users:
        if user is None or user.pk in seen:
            continue
        seen.add(user.pk)
        batch.append(Notification(recipient=user, title=title, message=message, level=level, link=link))
    Notification.objects.bulk_create(batch)
    return len(batch)


def notify_permission(perm: str, title: str, message: str, **kwargs) -> int:
    """Notifica a todos los usuarios activos con un permiso (p. ej. autoridades)."""
    from django.contrib.auth import get_user_model
    from django.db.models import Q

    app_label, codename = perm.split(".")
    users = get_user_model().objects.filter(is_active=True).filter(
        Q(is_superuser=True)
        | Q(user_permissions__codename=codename, user_permissions__content_type__app_label=app_label)
        | Q(groups__permissions__codename=codename, groups__permissions__content_type__app_label=app_label)
    ).distinct()
    return notify(users, title, message, **kwargs)
