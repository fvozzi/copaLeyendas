# Gestion de torneos, zonas y partidos

## Alcance

Este documento define el funcionamiento de la administracion deportiva de Copa Leyendas. El modelo permite mantener ediciones historicas y configurar futuros torneos sin depender de reglas fijas de la edicion Femme.

## Objetos del dominio

### Torneo

Una edicion concreta de la Copa. Contiene nombre, fecha, sede, estado y sus categorias habilitadas. Un torneo tiene categorias, canchas, parejas confirmadas, zonas y partidos.

### Categoria del torneo

Es una categoria aplicada dentro de un torneo. Conserva una referencia a la categoria base y su configuracion deportiva:

- modalidad de partido: set unico o al mejor de sets;
- tantos para ganar cada set;
- cantidad de sets para ganar un partido;
- cantidad de parejas inscriptas: se calcula desde las inscripciones confirmadas, nunca se carga manualmente;
- estado de inscripcion.

Configuracion inicial Copa Leyendas Femme:

```text
Modalidad: set unico
Tantos para ganar: 25
Sets para ganar: 1
```

### Cancha

Recurso reutilizable con nombre, direccion, ciudad, provincia y estado. Una cancha puede utilizarse en varias zonas y torneos, en distintos horarios.

### Equipo/localidad

Representa una pareja inscripta por una localidad. El equipo participa en una categoria. La fuente operativa es la inscripcion confirmada; la localidad no se trata como una pareja por si sola.

### Zona

Pertenece a una categoria del torneo y define:

- nombre o codigo;
- cancha asignada;
- cupo maximo de parejas;
- parejas asignadas;
- partidos de la zona.

El cupo controla la asignacion, pero la cantidad total de inscriptas pertenece a la categoria.

### Partido

Un partido tiene zona, orden, horario opcional, cancha, estado, participantes y resultado. Los participantes pueden ser directos o condicionados por otro partido:

- pareja asignada;
- ganador de un partido previo;
- perdedor de un partido previo.

Estados: `BORRADOR`, `PENDIENTE`, `LISTO_PARA_JUGAR`, `JUGADO`, `SUSPENDIDO`, `CANCELADO`.

## Casos de uso

### CU-01 Crear torneo

El Director crea una edicion, define nombre, fechas, sede y estado. El torneo puede permanecer en borrador hasta habilitar la operacion.

### CU-02 Configurar categoria de torneo

El Director incorpora una categoria al torneo y configura formato de juego. La cantidad de parejas se muestra desde las inscripciones confirmadas para esa categoria.

### CU-03 Administrar canchas

El Director agrega, edita, activa o elimina canchas. Una cancha no puede eliminarse mientras tenga partidos jugados; en ese caso debe desactivarse.

### CU-04 Habilitar equipo/localidad

El Director registra una localidad/equipo y le asigna categoria. Al emitir un token el sistema toma la categoria de esa ficha; no se permite emitir token para un equipo sin categoria activa.

### CU-05 Confirmar inscripcion

Una vez validado el pago o bonificacion, el Director marca la inscripcion como confirmada. Solo esas parejas se consideran para el conteo de la categoria y para armar zonas.

### CU-06 Crear zona

El Director crea una zona para una categoria, asigna cancha y define cupo. El sistema impide exceder el cupo al asignar parejas.

### CU-07 Asignar parejas a zona

El Director asigna parejas confirmadas a una zona. Una pareja no puede pertenecer a dos zonas de la misma categoria del torneo.

### CU-08 Armar fixture de zona de cuatro

El organizador define los dos partidos iniciales:

```text
P1: Pareja A vs Pareja B
P2: Pareja C vs Pareja D
```

El sistema crea los partidos condicionales:

```text
P3: Ganador P1 vs Perdedor P2
P4: Ganador P2 vs Perdedor P1
```

Cada pareja juega exactamente dos partidos. P3 y P4 quedan pendientes hasta que se cargan los resultados de P1 y P2.

### CU-09 Armar fixture de zona de tres

El sistema crea un triangular:

```text
P1: A vs B
P2: A vs C
P3: B vs C
```

Cada pareja juega dos partidos.

### CU-10 Cargar resultado

El organizador carga los tantos de cada participante por set. Para Copa Leyendas Femme se carga un unico resultado a 25 tantos. El sistema valida el formato, determina ganador/perdedor y habilita los partidos condicionales dependientes.

### CU-11 Corregir resultado

Un Director puede corregir un resultado. Si ya existen partidos dependientes jugados, primero debe anular o corregirlos para evitar alterar participantes historicos sin control.

### CU-12 Consultar posiciones

El sistema calcula por zona: jugados, ganados, perdidos, tantos a favor, tantos en contra y diferencia. La regla de desempate configurable por defecto es: ganados, diferencia de tantos, tantos a favor.

## Reglas Copa Leyendas Femme

- Categorias iniciales: Damas A, Damas B, Damas Nucleo A y Damas Nucleo B.
- Partido: un set, 25 tantos.
- Con 16 parejas en una categoria: cuatro zonas de cuatro. Cada zona contiene cuatro partidos con esquema inicial-condicional.
- Con 12 parejas: cuatro zonas de tres. Cada zona juega triangular.
- La cantidad de parejas confirmadas se obtiene de la categoria del torneo, no de la zona.
- Una zona siempre debe estar vinculada a una categoria y una cancha.

## Configuraciones administrativas

| Configuracion | Nivel | Valor inicial |
| --- | --- | --- |
| Tantos por set | Categoria del torneo | 25 |
| Sets para ganar | Categoria del torneo | 1 |
| Metodo de zona de 4 | Categoria del torneo | Dos iniciales + cruces ganador/perdedor |
| Metodo de zona de 3 | Categoria del torneo | Triangular |
| Desempate | Categoria del torneo | Ganados, diferencia, tantos a favor |
| Cupo | Zona | Definido por el Director |
