def user_can_authenticate(user) -> bool:
    """Regla usada por SimpleJWT: el usuario debe estar activo y no bloqueado."""
    return user is not None and user.is_active and not getattr(user, "is_locked", False)
