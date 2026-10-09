---
title: "FAQ: torneos, fixture y jornadas"
summary: Inscripciones, generación del fixture, programación, solapamientos y envío de jornadas
section: faq
order: 40
---
### El torneo no aparece en el sitio público

Revise que esté **activo** y en estado **Inscripciones**, **En curso** o **Finalizado**. En **Borrador** no se publica. Los partidos solo se publican desde que están **confirmados**.

### «Ya existe un fixture para esta categoría/grupo»

El fixture solo se genera una vez por categoría (o grupo). Si faltan partidos, créelos con **+ Partido**. Si inscribió un equipo después de generarlo, cree manualmente sus partidos.

### «Se requieren al menos 2 equipos inscritos para generar el fixture»

Inscriba los equipos en esa categoría (o asígnelos al grupo elegido) antes de generar.

### No aparecen partidos en «Agregar partidos» de la jornada

Solo se listan partidos del mismo torneo, en **Borrador** y **sin jornada**. Si ya están en otra jornada, quítelos de ella con la **X** (si esa jornada sigue en borrador).

### El botón «Enviar jornada» está deshabilitado

Algún partido tiene datos incompletos: cada tarjeta muestra **Falta: …** (cancha, inicio, delegado, árbitro o asistentes según el torneo). Complete y pulse **Guardar** en cada tarjeta. También necesita el permiso `competition.submit_matchday`.

### «La cancha … ya tiene N partido(s) en ese horario»

La cancha llegó a su **capacidad simultánea**. Cambie la hora, use otra cancha o, si la cancha realmente se divide, configúrela como **divisible** con su número de mini canchas en **Registro → Canchas**.

### «El delegado / árbitro ya tiene otro partido asignado en ese horario»

Esa persona está en otro partido que se solapa (en cualquier jornada). Elija otro oficial o cambie el horario. Recuerde que la duración incluye el descanso.

### «Uno de los equipos ya juega otro partido en ese horario»

Un equipo no puede tener dos partidos solapados. Revise los horarios de ese equipo.

### «El partido … no está programado el día de la jornada»

La fecha de inicio debe coincidir con el **día de la jornada**. Corrija la hora de inicio o la fecha de la jornada.

### «La jornada ya fue enviada» al intentar editar un partido

Tras el envío las asignaciones se bloquean. Use **Ajustar** en la ficha del partido (con exposición de motivos).

### ¿Cómo cambio la duración de los partidos ya programados?

Cambie la regla en el torneo y vuelva a guardar la hora de inicio de cada partido en borrador (la hora de fin se recalcula). En partidos ya enviados use **Ajustar** para modificar inicio y fin.

### Quiero borrar una jornada

Solo se eliminan jornadas en **Borrador** (ícono de papelera); sus partidos vuelven al fixture. Una jornada enviada no se borra: suspenda los partidos que no se jugarán y ciérrela cuando todos estén cerrados o suspendidos.
