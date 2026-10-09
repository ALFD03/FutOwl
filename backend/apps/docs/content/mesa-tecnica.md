---
title: Mesa técnica
summary: Guía del delegado para registrar el partido en vivo, corregir errores y finalizar
section: manual
order: 180
---
**Dónde:** ficha del partido → **Mesa técnica** (se abre sola para el delegado asignado).
**Quién:** el **delegado asignado** con el permiso `competition.operate_match`, o usuarios con `competition.operate_any_match`.
**Cuándo:** con el partido **Confirmado**, **En juego** o **Finalizado**.

Cada acción queda registrada con **hora exacta del servidor (UTC-4)**, número de secuencia y usuario. Los eventos **no se editan ni se borran**.

## 1. Protocolo previo al partido

La pantalla muestra una lista de pasos que deben registrarse **en orden**:

1. **Llegada del delegado** (siempre el primer evento).
2. **Llegada de** cada equipo.
3. **Documentación de** cada equipo **coincide con lo cargado**: requiere que el equipo haya llegado y que haya **cargado su alineación**. Al registrarla, la alineación queda **verificada** y bloqueada.
4. **Iniciar partido**: se habilita cuando ambos equipos tienen la documentación verificada. El partido pasa a **En juego**, tiempo 1.

## 2. Durante el partido

El panel *Control del partido* tiene una zona por equipo con los botones:

| Botón | Selección | Reglas |
|-------|-----------|--------|
| ⚽ **Gol** / 🎯 **Gol de penal** | Jugador **en el campo** | Solo con el balón en juego. |
| ⚽ **Autogol** | Jugador del equipo que lo marca | Suma al **rival**. |
| 🟨 **Tarjeta amarilla** | Jugador en el campo o en el banco | También durante el descanso. **Segunda amarilla = roja automática** («Expulsión por doble amarilla»). |
| 🟥 **Tarjeta roja** | Jugador en el campo o en el banco | El jugador queda **expulsado**: sale del campo y no puede volver ni recibir eventos. |
| 🔁 **Cambio** | *Sale* (en el campo) y *Entra* (en el banco) | Respeta el máximo de cambios del torneo. Quien sale **no puede reingresar**. |

En cada evento puede indicar el **minuto** (si lo deja vacío se calcula con el reloj del servidor) y una **observación**.

Además:

- **Fin de tiempo**: pasa a *Descanso*.
- **Iniciar siguiente tiempo**: desde el descanso, hasta el número de tiempos del torneo.
- **Incidencia** y **Nota**: texto libre (interno, no se publica).
- **Fin del partido**: con confirmación. El partido pasa a **Finalizado** y se notifica a delegado y árbitro para enviar sus informes.

La cabecera de cada equipo muestra cambios realizados y tarjetas. La **cronología completa** se actualiza cada 3 segundos y el sitio público refleja los eventos al instante.

## 3. Corregir errores: anulaciones

Si registró algo por error (gol al jugador equivocado, tarjeta duplicada…):

1. En la **Cronología completa**, pulse **Anular** en el evento.
2. Escriba el **motivo** (mínimo 5 caracteres) y confirme.
3. Registre el evento correcto.

El evento original **se conserva marcado como anulado** y deja de contar en el marcador y las estadísticas. Se pueden anular goles, tarjetas, cambios, incidencias y notas; no los eventos de protocolo (llegadas, documentos, inicio, tiempos, fin). Cada evento solo puede anularse una vez.

> [!TIP]
> Ejemplo: registró gol de *#9 Pérez* pero fue de *#10 Mora*. Anule el evento de Pérez con el motivo «Error de registro: el gol fue de Mora» y registre **Gol** de Mora indicando el minuto real.

## 4. Correcciones después del final

Con el partido **Finalizado** (antes del cierre) aún puede registrar goles, tarjetas o cambios olvidados, anulaciones, incidencias y notas, pero **la observación es obligatoria** como motivo de la corrección.

## Mensajes frecuentes

| Mensaje | Qué significa / qué hacer |
|---------|---------------------------|
| *Primero debe reportar la llegada del delegado.* | Registre el paso 1. |
| *Debe reportar la llegada del equipo antes de revisar documentos.* | Registre la llegada de ese equipo. |
| *El equipo no cargó su alineación en la aplicación.* | El gestor debe cargarla antes (vea [Alineaciones](/app/ayuda/alineaciones)). |
| *Ambos equipos deben tener la documentación verificada antes del inicio.* | Complete el protocolo. |
| *El balón no está en juego (descanso).* | Inicie el siguiente tiempo; en el descanso solo se admiten tarjetas. |
| *El jugador no está en el campo.* | Solo quien está jugando puede marcar o salir en un cambio. |
| *El jugador que entra no está en el banco.* | Elija a un suplente que no haya jugado. |
| *Se alcanzó el máximo de N cambios.* | Límite del torneo. |
| *El jugador fue expulsado.* | No admite más eventos. |
| *Solo el delegado asignado puede operar la mesa técnica de este partido.* | Su usuario no es el del delegado del partido. |
| *La mesa técnica se habilita cuando el partido está confirmado…* | Faltan confirmaciones de oficiales. |

Vea también [Preguntas frecuentes de mesa técnica](/app/ayuda/faq-alineaciones-y-mesa-tecnica).
