from django.db import models

from .crypto import decrypt, encrypt


class EncryptedCharField(models.TextField):
    """
    Campo de texto cifrado en reposo. El valor se cifra al guardar y se descifra
    al leer; en la base de datos nunca se almacena en texto plano.
    Nota: no permite búsquedas directas; para eso usar un índice ciego.
    """

    description = "Texto cifrado (Fernet)"

    def from_db_value(self, value, expression, connection):
        return decrypt(value)

    def to_python(self, value):
        return decrypt(value) if isinstance(value, str) else value

    def get_prep_value(self, value):
        value = super().get_prep_value(value)
        return encrypt(value) if isinstance(value, str) else value
