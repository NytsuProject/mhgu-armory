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
- **Builder** — elige el arma y su nivel, combina cinco piezas y un talismán personalizado; engarza joyas en las ranuras de cada uno; consulta los puntos positivos y negativos y sus umbrales en tiempo real.
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

## Pruebas y herramientas de investigación

Requiere Node.js 18 o posterior (sin dependencias de terceros):

```bash
npm test
npm run bow:scenarios
```

La auditoría del rebalance elemental de arco de la rama de trabajo está en [docs/BOW_ELEMENTAL_REBALANCE_STAGE5.md](docs/BOW_ELEMENTAL_REBALANCE_STAGE5.md); el modelo, sus supuestos y los comandos para comparar hitzones están en [docs/BOW_ELEMENTAL_SIMULATOR_STAGE5.md](docs/BOW_ELEMENTAL_SIMULATOR_STAGE5.md).

## Aviso fan

Proyecto **fan de ayuda a la comunidad, sin ánimo de lucro**, sin publicidad y
**sin afiliación, respaldo ni patrocinio de Capcom**. *Monster Hunter
Generations Ultimate* y todos sus recursos (nombres, datos e iconos) son
propiedad de **© Capcom Co., Ltd.** Los iconos del juego se incluyen como
referencia fan no comercial; si Capcom o cualquier titular lo solicita, se
retirarán de inmediato. Los glifos estructurales en SVG son obra propia.
Código y datos de terceros usados con atribución (MIT). Ver
[`docs/README.md`](docs/README.md) y [`docs/DATA_SOURCES.md`](docs/DATA_SOURCES.md).
En **Builder → Exportar build**, «Copiar enlace» crea una copia del equipo en el
fragmento de la URL (`#builder=v2.…` con arma; compatible con los enlaces v1); no requiere cuenta ni almacenamiento en un
servidor. «Descargar imagen» genera una ficha completa con los engarces por pieza,
el talismán, la defensa, las resistencias y los puntos y efectos de habilidad. La ficha
del arma distingue ataque físico, elemento/estado, afinidad base y potencial; indica
los requisitos de los efectos condicionales.
