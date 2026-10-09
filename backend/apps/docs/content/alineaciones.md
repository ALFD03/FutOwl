---
title: Alineaciones
summary: Cargar la alineación del equipo, importar la planilla .docx/.csv y verificación en mesa técnica
section: manual
order: 170
---
**Dónde:** ficha del partido → **Alineaciones** (una tarjeta para el local y otra para el visitante).
**Quién:** gestores del equipo o entrenadores con usuario vinculado, con el permiso `competition.submit_lineup` (o usuarios con `competition.operate_any_match`).
**Cuándo:** con el partido *Pendiente* o *Confirmado* y **antes de que inicie**.

## Cargar la alineación

1. Abra el partido → **Alineaciones**. En la tarjeta de su equipo verá la **nómina del torneo**.
2. Por cada jugador que va al partido:
   - Encienda **Conv.** (convocado).
   - Revise el **dorsal** (viene de la nómina; puede cambiarlo para este partido).
   - Encienda **Titular** si sale de inicio.
   - Pulse la **corona** para marcar al **capitán** (solo uno).
3. Elija el **entrenador en banco** (opcional).
4. Adjunte la **planilla firmada** (PDF o imagen, opcional).
5. Pulse **Cargar alineación** (o **Actualizar alineación** si ya la había cargado).

Los contadores muestran *convocados / máximo* y *titulares / máximo* según las reglas del torneo; se ponen en rojo si se pasa.

### Validaciones

| Regla | Mensaje |
|-------|---------|
| Al menos un jugador | *Debe seleccionar al menos un jugador.* |
| Máximo de convocados del torneo | *Máximo 18 jugadores por planilla.* |
| Máximo de titulares | *Máximo 11 titulares.* |
| Un solo capitán | *Solo puede haber un capitán.* |
| Dorsales únicos | *Hay dorsales repetidos.* |
| Solo jugadores activos de la nómina de ese equipo en el torneo | *Jugadores no inscritos en la nómina del equipo en este torneo.* |
| Entrenador del propio equipo | *El entrenador no pertenece al equipo.* |
| Antes del inicio | *La alineación solo puede cargarse antes del inicio del partido.* |

Puede modificarla tantas veces como quiera **hasta que el delegado la verifique** en la mesa técnica.

## Importar la planilla

Para equipos que prefieren llenar la planilla en papel o en Word:

1. Exporte la planilla con **PDF** o **Word** en la tarjeta (sale con la nómina del equipo y la columna *ID*).
2. Llénela marcando con **X** las columnas *Convocado*, *Titular* y *Capitán*, y ajuste los dorsales.
3. Pulse **Importar planilla (.docx/.csv)** y elija el archivo.
4. FutOwl marca los convocados en pantalla. **Revise** y pulse **Cargar alineación** (la importación por sí sola no guarda nada).

Formatos aceptados:

- **Word (.docx)** generado por FutOwl: se lee la tabla cuya primera columna es *ID*.
- **CSV** separado por coma o punto y coma con las columnas `ID | Cédula | Apellidos y nombres | F. nac. | Dorsal | Convocado | Titular | Capitán`.

Se consideran marcadas las celdas con `X`, `si`, `sí`, `1`, `true` o `✓`.

```
ID;Cédula;Apellidos y nombres;F. nac.;Dorsal;Convocado;Titular;Capitán
152;V-30111222;Mora, Luis;05/05/2015;10;X;X;X
153;V-30111333;Pérez, Juan;12/02/2015;7;X;X;
154;;Díaz, Ana;20/08/2016;14;X;;
```

## Verificación en mesa técnica

El día del partido el delegado compara la alineación cargada con los documentos presentados y registra **Documentación verificada** para cada equipo. Desde ese momento la alineación queda **Verificada** y **no admite cambios**.

> [!WARNING]
> Si el equipo **no cargó su alineación**, el delegado no puede verificar su documentación y, por tanto, **el partido no puede iniciar**.

## Con qué se conecta

- **Nómina**: solo sus jugadores pueden convocarse.
- **Mesa técnica**: titulares empiezan *en el campo* y suplentes *en el banco*; solo ellos pueden recibir goles, tarjetas o cambios.
- **Estadísticas**: cada jugador de una alineación de un partido jugado suma un **partido jugado** (PJ).
