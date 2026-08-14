const COLORES = {
    MORENA: "#8b1538",
    PAN: "#1464b4",
    PRI: "#d71920",
    PRD: "#f4d21f",
    PT: "#e63946",
    PVEM: "#66a630",
    MC: "#f58220",
    APPT: "#7c3aed"
};

const PARTIDOS_GOBIERNO = [
    "MORENA", "PAN", "PRI", "PRD", "PT", "PVEM", "MC"
];

const PARTIDOS_EVOLUCION = [
    { nombre: "PRI", campo: "pri_pct" },
    { nombre: "PAN", campo: "pan_pct" },
    { nombre: "PRD", campo: "prd_pct" },
    { nombre: "MORENA", campo: "morena_pct" },
    { nombre: "PT", campo: "pt_pct" },
    { nombre: "PVEM", campo: "pvem_pct" },
    { nombre: "MC", campo: "mc_pct" }
];

const formatoNumero = new Intl.NumberFormat("es-MX");

let territorio = [];
let diputados = [];
let geometriaAlcaldias;
let mapa;
let capaAlcaldias;
let graficaDiputados;
let graficaEvolucion;

const estado = {
    anio: 2024,
    alcaldia: "TODAS",
    metrica: "gobierno"
};

async function iniciar() {
    const [respuestaTerritorio, respuestaMapa, respuestaDiputados] =
        await Promise.all([
            fetch("./data/territorio.json"),
            fetch("./data/alcaldias.geojson"),
            fetch("./data/diputados.json")
        ]);

    if (!respuestaTerritorio.ok) {
        throw new Error("No se pudo cargar territorio.json");
    }

    if (!respuestaMapa.ok) {
        throw new Error("No se pudo cargar alcaldias.geojson");
    }

    if (!respuestaDiputados.ok) {
        throw new Error("No se pudo cargar diputados.json");
    }

    territorio = await respuestaTerritorio.json();
    geometriaAlcaldias = await respuestaMapa.json();
    diputados = await respuestaDiputados.json();

    prepararFiltros();
    prepararMapa();
    actualizarDashboard();
}

function prepararFiltros() {
    const filtroAnio = document.querySelector("#filtro-anio");
    const filtroAlcaldia = document.querySelector("#filtro-alcaldia");
    const filtroMetrica = document.querySelector("#filtro-metrica");

    const anios = [...new Set(territorio.map(fila => Number(fila.anio)))]
        .sort((a, b) => b - a);

    const alcaldias = [...new Set(territorio.map(fila => fila.alcaldia))]
        .sort((a, b) => a.localeCompare(b, "es"));

    estado.anio = anios[0];

    filtroAnio.innerHTML = anios
        .map(anio => `<option value="${anio}">${anio}</option>`)
        .join("");

    filtroAlcaldia.innerHTML = `
        <option value="TODAS">Todas</option>
        ${alcaldias
            .map(alcaldia =>
                `<option value="${alcaldia}">${alcaldia}</option>`
            )
            .join("")}
    `;

    filtroMetrica.innerHTML = `
        <option value="gobierno">Gobierno</option>
    `;

    filtroAnio.value = estado.anio;
    filtroAlcaldia.value = estado.alcaldia;

    filtroAnio.addEventListener("change", evento => {
        estado.anio = Number(evento.target.value);
        actualizarDashboard();
    });

    filtroAlcaldia.addEventListener("change", evento => {
        estado.alcaldia = evento.target.value;
        actualizarDashboard();
    });

    filtroMetrica.addEventListener("change", evento => {
        estado.metrica = evento.target.value;
        actualizarDashboard();
    });
}

function prepararMapa() {
    mapa = L.map("mapa", {
        scrollWheelZoom: false
    });

    L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom: 18,
            attribution: "&copy; OpenStreetMap"
        }
    ).addTo(mapa);

    agregarLeyenda();
}

function actualizarDashboard() {
    const filasTerritorio = territorio.filter(fila => {
        const coincideAnio = Number(fila.anio) === estado.anio;
        const coincideAlcaldia =
            estado.alcaldia === "TODAS" ||
            fila.alcaldia === estado.alcaldia;

        return coincideAnio && coincideAlcaldia;
    });

    const filasDiputados = diputados.filter(fila => {
        const coincideAnio = Number(fila.anio) === estado.anio;
        const coincideAlcaldia =
            estado.alcaldia === "TODAS" ||
            fila.alcaldia === estado.alcaldia;

        return coincideAnio && coincideAlcaldia;
    });

    renderTarjetas(filasTerritorio);
    renderMapa();
    renderGraficaDiputados(filasDiputados);
    renderGraficaEvolucion();
    renderTablaDiputados(filasDiputados);
}

function renderTarjetas(filas) {
    const alcaldias = new Set(filas.map(fila => fila.alcaldia)).size;

    const secciones = filas.reduce(
        (total, fila) => total + Number(fila.secciones || 0),
        0
    );

    const padron = filas.reduce(
        (total, fila) => total + Number(fila.padron || 0),
        0
    );

    const listaNominal = filas.reduce(
        (total, fila) => total + Number(fila.lista_nominal || 0),
        0
    );

    const gobiernoFrecuente = obtenerGobiernoFrecuente(filas);
    const cambioGobierno = obtenerCambioGobierno();
    const filaSeleccionada = estado.alcaldia === "TODAS" ? null : filas[0];

    const tarjetasDetalle = filaSeleccionada
        ? `
            <article class="tarjeta">
                <small>Alcalde</small>
                <strong>${filaSeleccionada.alcalde || "Sin dato"}</strong>
            </article>

            <article class="tarjeta">
                <small>Partido gobernante</small>
                <strong>${filaSeleccionada.partido_gobernante || "Sin dato"}</strong>
            </article>
        `
        : "";

    document.querySelector("#tarjetas").innerHTML = `
        <article class="tarjeta">
            <small>Alcaldías</small>
            <strong>${alcaldias}</strong>
        </article>

        <article class="tarjeta">
            <small>Secciones</small>
            <strong>${formatoNumero.format(secciones)}</strong>
        </article>

        <article class="tarjeta">
            <small>Padrón electoral</small>
            <strong>${formatoNumero.format(padron)}</strong>
        </article>

        <article class="tarjeta">
            <small>Lista nominal</small>
            <strong>${formatoNumero.format(listaNominal)}</strong>
        </article>

        <article class="tarjeta">
            <small>Gobierno más frecuente</small>
            <strong>${gobiernoFrecuente}</strong>
        </article>

        <article class="tarjeta">
            <small>${cambioGobierno.etiqueta}</small>
            <strong>${cambioGobierno.valor}</strong>
        </article>

        ${tarjetasDetalle}
    `;
}

function obtenerGobiernoFrecuente(filas) {
    if (filas.length === 0) {
        return "Sin datos";
    }

    const conteo = {};

    filas.forEach(fila => {
        const partido = fila.partido_gobernante || "Sin dato";
        conteo[partido] = (conteo[partido] || 0) + 1;
    });

    return Object.entries(conteo)
        .sort((a, b) => b[1] - a[1])[0][0];
}

function obtenerCambioGobierno() {
    const anios = [...new Set(territorio.map(fila => Number(fila.anio)))]
        .sort((a, b) => a - b);

    const posicion = anios.indexOf(estado.anio);

    if (posicion <= 0) {
        return {
            etiqueta: "Cambio de gobierno",
            valor: "Periodo inicial"
        };
    }

    const anioAnterior = anios[posicion - 1];
    const filasActuales = territorio.filter(
        fila => Number(fila.anio) === estado.anio
    );
    const filasAnteriores = territorio.filter(
        fila => Number(fila.anio) === anioAnterior
    );

    if (estado.alcaldia === "TODAS") {
        const cambios = filasActuales.filter(filaActual => {
            const filaAnterior = filasAnteriores.find(
                fila => normalizar(fila.alcaldia) ===
                    normalizar(filaActual.alcaldia)
            );

            return filaAnterior &&
                filaAnterior.partido_gobernante !==
                    filaActual.partido_gobernante;
        }).length;

        return {
            etiqueta: `Cambio de gobierno vs ${anioAnterior}`,
            valor: `${cambios} de ${filasActuales.length}`
        };
    }

    const actual = filasActuales.find(
        fila => fila.alcaldia === estado.alcaldia
    );
    const anterior = filasAnteriores.find(
        fila => normalizar(fila.alcaldia) === normalizar(estado.alcaldia)
    );

    if (!actual || !anterior) {
        return {
            etiqueta: `Cambio de gobierno vs ${anioAnterior}`,
            valor: "Sin datos"
        };
    }

    const cambio = anterior.partido_gobernante !==
        actual.partido_gobernante;

    return {
        etiqueta: `Cambio de gobierno vs ${anioAnterior}`,
        valor: cambio
            ? `${anterior.partido_gobernante} → ${actual.partido_gobernante}`
            : `Sin cambio (${actual.partido_gobernante})`
    };
}

function renderMapa() {
    if (capaAlcaldias) {
        mapa.removeLayer(capaAlcaldias);
    }

    const filasDelAnio = territorio.filter(
        fila => Number(fila.anio) === estado.anio
    );

    capaAlcaldias = L.geoJSON(geometriaAlcaldias, {
        style: feature => {
            const fila = buscarFila(feature, filasDelAnio);
            const seleccionada =
                estado.alcaldia === "TODAS" ||
                (fila && fila.alcaldia === estado.alcaldia);

            return {
                fillColor: fila
                    ? obtenerColor(fila.partido_gobernante)
                    : "#cbd5e1",
                fillOpacity: seleccionada ? 0.82 : 0.18,
                color: seleccionada ? "#ffffff" : "#64748b",
                weight: seleccionada ? 2 : 1
            };
        },

        onEachFeature: (feature, layer) => {
            const fila = buscarFila(feature, filasDelAnio);
            const nombre = obtenerNombreGeografico(feature);

            if (!fila) {
                layer.bindTooltip(nombre);
                return;
            }

            layer.bindTooltip(`
                <strong>${fila.alcaldia}</strong><br>
                Alcalde: ${fila.alcalde || "Sin dato"}<br>
                Partido: ${fila.partido_gobernante || "Sin dato"}<br>
                Padrón: ${formatoNumero.format(fila.padron || 0)}<br>
                Lista nominal: ${formatoNumero.format(fila.lista_nominal || 0)}
            `);

            layer.on("click", () => {
                estado.alcaldia = fila.alcaldia;
                document.querySelector("#filtro-alcaldia").value =
                    fila.alcaldia;
                actualizarDashboard();
            });
        }
    }).addTo(mapa);

    ajustarVistaMapa();
}

function buscarFila(feature, filas) {
    const nombre = normalizar(obtenerNombreGeografico(feature));

    return filas.find(
        fila => normalizar(fila.alcaldia) === nombre
    );
}

function obtenerNombreGeografico(feature) {
    return (
        feature.properties.NOMGEO ||
        feature.properties.nomgeo ||
        feature.properties.nombre ||
        "Sin nombre"
    );
}

function normalizar(texto) {
    return String(texto || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace("la magdalena contreras", "magdalena contreras")
        .trim();
}

function obtenerColor(partido) {
    const nombre = String(partido || "").toUpperCase();
    return COLORES[nombre] || "#94a3b8";
}

function ajustarVistaMapa() {
    let capaSeleccionada;

    if (estado.alcaldia !== "TODAS") {
        capaAlcaldias.eachLayer(layer => {
            const nombre = obtenerNombreGeografico(layer.feature);

            if (normalizar(nombre) === normalizar(estado.alcaldia)) {
                capaSeleccionada = layer;
            }
        });
    }

    if (capaSeleccionada) {
        mapa.fitBounds(capaSeleccionada.getBounds(), {
            padding: [25, 25],
            maxZoom: 12
        });
    } else {
        mapa.fitBounds(capaAlcaldias.getBounds(), {
            padding: [20, 20]
        });
    }

    setTimeout(() => mapa.invalidateSize(), 100);
}

function agregarLeyenda() {
    const leyenda = L.control({
        position: "bottomright"
    });

    leyenda.onAdd = function () {
        const contenedor = L.DomUtil.create(
            "div",
            "leyenda-mapa"
        );

        contenedor.innerHTML = `
            <strong>Gobierno</strong>
            ${PARTIDOS_GOBIERNO
                .map(
                    partido => `
                        <div>
                            <span style="
                                background:${COLORES[partido]};
                                display:inline-block;
                                width:12px;
                                height:12px;
                                margin-right:5px;
                            "></span>
                            ${partido}
                        </div>
                    `
                )
                .join("")}
        `;

        return contenedor;
    };

    leyenda.addTo(mapa);
}

function renderGraficaDiputados(filas) {
    if (graficaDiputados) {
        graficaDiputados.destroy();
    }

    const registrosUnicos = new Map();

    filas.forEach(fila => {
        const clave = `${fila.distrito}|${fila.diputado_local}`;
        registrosUnicos.set(clave, fila);
    });

    const conteo = {};

    registrosUnicos.forEach(fila => {
        const partido = fila.partido_diputado || "SIN DATO";
        conteo[partido] = (conteo[partido] || 0) + 1;
    });

    const partidos = Object.keys(conteo)
        .sort((a, b) => conteo[b] - conteo[a]);

    graficaDiputados = new Chart(
        document.querySelector("#grafica-diputados"),
        {
            type: "bar",
            data: {
                labels: partidos,
                datasets: [{
                    label: "Distritos representados",
                    data: partidos.map(partido => conteo[partido]),
                    backgroundColor: partidos.map(obtenerColor),
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                indexAxis: "y",
                plugins: {
                    legend: {
                        display: false
                    },
                    title: {
                        display: true,
                        text: `Diputados locales por partido · ${estado.anio}`
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0
                        }
                    }
                }
            }
        }
    );
}

function renderTablaDiputados(filas) {
    const tabla = document.querySelector("#tabla-diputados");

    const ordenadas = [...filas].sort((a, b) => {
        if (a.distrito !== b.distrito) {
            return a.distrito - b.distrito;
        }
        return a.alcaldia.localeCompare(b.alcaldia, "es");
    });

    tabla.innerHTML = `
        <caption>
            Diputados locales y distritos · ${estado.anio}
        </caption>
        <thead>
            <tr>
                <th>Distrito</th>
                <th>Alcaldía</th>
                <th>Diputado local</th>
                <th>Partido</th>
            </tr>
        </thead>
        <tbody>
            ${ordenadas.length
                ? ordenadas.map(fila => `
                    <tr>
                        <td>${fila.distrito}</td>
                        <td>${fila.alcaldia}</td>
                        <td>${fila.diputado_local}</td>
                        <td>
                            <span style="color:${obtenerColor(fila.partido_diputado)}">
                                ●
                            </span>
                            ${fila.partido_diputado}
                        </td>
                    </tr>
                `).join("")
                : `
                    <tr>
                        <td colspan="4">No hay registros para esta selección.</td>
                    </tr>
                `
            }
        </tbody>
    `;
}

function renderGraficaEvolucion() {
    if (graficaEvolucion) {
        graficaEvolucion.destroy();
    }

    const anios = [...new Set(territorio.map(fila => Number(fila.anio)))]
        .sort((a, b) => a - b);

    const datasets = PARTIDOS_EVOLUCION.map(partido => ({
        label: partido.nombre,
        data: anios.map(anio => {
            const filas = territorio.filter(fila => {
                const coincideAnio = Number(fila.anio) === anio;
                const coincideAlcaldia =
                    estado.alcaldia === "TODAS" ||
                    fila.alcaldia === estado.alcaldia;

                return coincideAnio && coincideAlcaldia;
            });

            const valores = filas
                .map(fila => Number(fila[partido.campo]))
                .filter(Number.isFinite);

            if (!valores.length) {
                return null;
            }

            const total = valores.reduce((suma, valor) => suma + valor, 0);
            return Number((total / valores.length).toFixed(2));
        }),
        borderColor: obtenerColor(partido.nombre),
        backgroundColor: obtenerColor(partido.nombre),
        tension: 0.25,
        pointRadius: 4,
        pointHoverRadius: 6,
        borderWidth: 2,
        spanGaps: true
    }));

    const contexto = estado.alcaldia === "TODAS"
        ? "Promedio de las 16 alcaldías"
        : estado.alcaldia;

    graficaEvolucion = new Chart(
        document.querySelector("#grafica-evolucion"),
        {
            type: "line",
            data: {
                labels: anios,
                datasets
            },
            options: {
                responsive: true,
                interaction: {
                    mode: "index",
                    intersect: false
                },
                plugins: {
                    title: {
                        display: true,
                        text: `Evolución del porcentaje por partido · ${contexto}`
                    },
                    legend: {
                        position: "bottom"
                    },
                    tooltip: {
                        callbacks: {
                            label: elemento =>
                                `${elemento.dataset.label}: ${elemento.parsed.y.toFixed(2)} %`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: "Porcentaje"
                        },
                        ticks: {
                            callback: valor => `${valor} %`
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: "Año"
                        }
                    }
                }
            }
        }
    );
}

function mostrarError(error) {
    console.error(error);

    document.querySelector("#mapa").innerHTML = `
        <div style="padding:20px;color:#b91c1c;">
            No se pudieron cargar los datos. Revisa los archivos de la
            carpeta data.
        </div>
    `;
}

iniciar().catch(mostrarError);
