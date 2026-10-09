from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    fieldsets = BaseUserAdmin.fieldsets + (("FutOwl", {"fields": ("phone", "must_change_password")}),)

    def has_delete_permission(self, request, obj=None):
        return False
