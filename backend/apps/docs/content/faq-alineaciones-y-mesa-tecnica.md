---
title: "FAQ: alineaciones y mesa técnica"
summary: Problemas al cargar alineaciones y situaciones del día del partido
section: faq
order: 60
---
### No puedo editar la alineación de mi equipo

La tarjeta se muestra solo lectura si:

- El partido no está *Pendiente* o *Confirmado*, o **ya inició**.
- La alineación ya fue **verificada** por el delegado.
- Usted no es gestor/entrenador vinculado del equipo o le falta `competition.submit_lineup`.

### Un jugador no aparece en la lista de la alineación

Solo aparecen los jugadores **activos en la nómina del equipo para ese torneo**. Inscríbalo en **Equipos → (equipo) → Nómina por torneo** y vuelva a abrir la alineación.

### La importación de la planilla falla

- Use la planilla **Word exportada por FutOwl** (con la columna *ID*) o un CSV con las mismas columnas.
- Marque con `X` las columnas *Convocado*, *Titular* y *Capitán*.
- No borre ni cambie los números de la columna *ID*.
- Después de importar, **revise y pulse Cargar alineación**: importar no guarda.

### No veo la consola de la mesa técnica, solo la cronología

Solo la ve el **delegado asignado** (su usuario vinculado) con `competition.operate_match`, o un usuario con `competition.operate_any_match`. Si es el delegado, revise el vínculo de su usuario en **Mi cuenta**.

### «La mesa técnica se habilita cuando el partido está confirmado…»

Faltan confirmaciones del delegado o de la terna. Contacte a quien falte o a la autoridad.

### No puedo iniciar el partido

El botón **Iniciar partido** exige: llegada del delegado, llegada de **ambos** equipos y **documentación verificada** de ambos. Para verificar documentación, el equipo debe tener su **alineación cargada**.

### Un equipo llegó sin alineación cargada

El gestor o entrenador puede cargarla desde su teléfono **antes del inicio** (o importar la planilla). Si no es posible, registre una **Incidencia** y consulte a la autoridad (por ejemplo, para suspender).

### Registré un gol al jugador equivocado

En la **Cronología completa**, pulse **Anular** en ese gol, escriba el motivo y registre el **Gol** correcto indicando el minuto real. El evento anulado queda visible y tachado.

### Marqué una amarilla dos veces al mismo jugador y se generó una roja

Anule la **segunda amarilla** y también la **roja automática** («Expulsión por doble amarilla»). El jugador vuelve a quedar disponible.

### No me deja hacer un cambio

- *«El jugador que sale no está en el campo»*: ya salió o fue expulsado.
- *«El jugador que entra no está en el banco»*: ya jugó (no hay reingresos) o no estaba convocado.
- *«Se alcanzó el máximo de N cambios»*: límite del torneo.
- Durante el **descanso** no se registran cambios ni goles; inicie el siguiente tiempo.

### Pulsé «Fin del partido» antes de tiempo

El fin no se puede anular. Puede registrar los goles, tarjetas o cambios que falten como **correcciones posteriores** (con observación obligatoria) y dejar una **nota** explicando lo sucedido; la autoridad lo verá antes del cierre.

### Se cayó la conexión durante el partido

Los eventos ya enviados están guardados en el servidor. Al recuperar la conexión, recargue la página: verá la cronología completa. Registre lo pendiente indicando el **minuto real** en cada evento.

### El minuto que muestra no coincide con el del árbitro

El minuto se calcula con el reloj del servidor desde el inicio del tiempo. Puede escribir el minuto exacto en cada evento; si lo deja vacío se usa el calculado.
