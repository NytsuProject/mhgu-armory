# MHGU ARMORY

Enciclopedia visual fan de **Monster Hunter Generations Ultimate**: árboles de
herrería de las 14 clases de arma y colección completa de armaduras, con el
aspecto de la pantalla de herrería del juego (pergamino y madera).

**Sitio en vivo:** https://nytsuproject.github.io/mhgu-armory/

## Qué incluye

- **Weapon Forge** — 1.592 líneas de arma y 10.911 armas como rejilla de la
  herrería del juego: una fila por línea, una casilla por nivel, placas de
  madera, selección dorada con anillo azul. Zoom, desplazamiento, contraer /
  expandir ramas, filtros por clase y (en el arco) por tipo de tiro y flecha.
- **Armor Collection** — 1.242 conjuntos y 5.637 piezas (rangos bajo, alto y G)
  con defensa, resistencias, habilidades y ranuras.
- **Buscador global** y tooltips de procedencia (monstruo de origen) en armas,
  conjuntos y piezas.
- Nombres oficiales en español cuando están verificados; etiquetas
  VERIFIED / DERIVED / MISSING. Sin datos inventados.

Los datos están contrastados con las tablas del juego (v1.4.0) y mhgu.db (MIT).
Detalle de fuentes, validación y estructura en [`docs/`](docs/README.md).

## Ejecutar en local

Es una web estática (HTML/CSS/JS/SVG/JSON, sin dependencias ni APIs externas).
Sirve la carpeta con cualquier servidor estático, por ejemplo:

```bash
python -m http.server 8765
# abre http://127.0.0.1:8765/
```

## Aviso fan

Proyecto **fan de ayuda a la comunidad, sin ánimo de lucro**, sin publicidad y
**sin afiliación, respaldo ni patrocinio de Capcom**. *Monster Hunter
Generations Ultimate* y todos sus recursos (nombres, datos e iconos) son
propiedad de **© Capcom Co., Ltd.** Los iconos del juego se incluyen como
referencia fan no comercial; si Capcom o cualquier titular lo solicita, se
retirarán de inmediato. Los glifos estructurales en SVG son obra propia.
Código y datos de terceros usados con atribución (MIT). Ver
[`docs/README.md`](docs/README.md) y [`docs/DATA_SOURCES.md`](docs/DATA_SOURCES.md).