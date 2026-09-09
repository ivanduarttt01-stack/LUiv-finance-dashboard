// ========================================
// DATOS
// ========================================

let ventasGuardadas =
    JSON.parse(localStorage.getItem("ventas")) || [];

let gastosGuardados =
    JSON.parse(localStorage.getItem("gastos")) || [];

const CATEGORIA_GASTO_POR_DEFECTO = "Varios / Otros";
let filtroGastosActual = "all";
let busquedaGasto = "";

function escaparHTML(valor) {
    const contenedor = document.createElement("div");
    contenedor.textContent = String(valor ?? "");
    return contenedor.innerHTML;
}

function fechaLocalISO(fecha = new Date()) {
    const ajuste = fecha.getTimezoneOffset() * 60000;
    return new Date(fecha.getTime() - ajuste).toISOString().slice(0, 10);
}

function fechaGastoAFecha(valor) {
    if (!valor) return null;
    const texto = String(valor);
    if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
        const [anio, mes, dia] = texto.split("-").map(Number);
        return new Date(anio, mes - 1, dia);
    }
    const partes = texto.split("/");
    if (partes.length === 3) return new Date(Number(partes[2]), Number(partes[1]) - 1, Number(partes[0]));
    return null;
}

function formatoFechaGasto(valor) {
    const fecha = fechaGastoAFecha(valor);
    return fecha && !Number.isNaN(fecha.getTime()) ? fecha.toLocaleDateString("es-AR") : "Sin fecha";
}

function mismaFechaGasto(valor, fechaTexto) {
    const gastoFecha = fechaGastoAFecha(valor);
    const referencia = fechaGastoAFecha(fechaTexto);
    return Boolean(gastoFecha && referencia && gastoFecha.toDateString() === referencia.toDateString());
}

function normalizarGastosGuardados() {
    let cambio = false;
    const ids = new Set();
    gastosGuardados = gastosGuardados.map((gasto, indice) => {
        const normalizado = gasto && typeof gasto === "object" ? { ...gasto } : {};
        if (!normalizado.id || ids.has(String(normalizado.id))) {
            normalizado.id = `${Date.now()}-${indice}-${Math.random().toString(16).slice(2)}`;
            cambio = true;
        }
        ids.add(String(normalizado.id));
        if (!normalizado.categoria) { normalizado.categoria = CATEGORIA_GASTO_POR_DEFECTO; cambio = true; }
        if (typeof normalizado.notas !== "string") { normalizado.notas = ""; cambio = true; }
        if (!normalizado.fecha) { normalizado.fecha = fechaLocalISO(); cambio = true; }
        normalizado.monto = Number(normalizado.monto) || 0;
        return normalizado;
    });
    if (cambio) localStorage.setItem("gastos", JSON.stringify(gastosGuardados));
}

normalizarGastosGuardados();

let productosGuardados =
    JSON.parse(localStorage.getItem("productosLUiv")) || [];

let filtroVentasActual = "all";

let busquedaVenta = "";

let busquedaProducto = "";

let ordenProductos = "units";

let ventasChart = null;

let periodoActual = "7";


// ========================================
// ELEMENTOS
// ========================================

const listaVentas =
    document.getElementById("listaVentas");

const listaGastos =
    document.getElementById("listaGastos");

const listaProductos =
    document.getElementById("listaProductos");

const botonVenta =
    document.getElementById("agregarVenta");

const botonGasto =
    document.getElementById("agregarGasto");

const buscadorVenta =
    document.getElementById("buscarVenta");

const buscadorProducto =
    document.getElementById("buscarProducto");


// ========================================
// COLORES
// ========================================

const COLOR_VENTAS = "#2563eb";

const COLOR_GASTOS = "#f59e0b";

const COLOR_PROFIT = "#22c55e";

const COLOR_PERDIDA = "#ef4444";


// ========================================
// FORMATO DINERO
// ========================================

function formatoDinero(valor) {

    return "$" +
        Number(valor || 0)
            .toLocaleString("es-AR");

}

function numeroDesdeFormato(valor) {
    if (typeof valor === "number") return valor;
    return Number(String(valor ?? "").replace(/\./g, "").replace(/[^0-9,-]/g, "").replace(",", ".")) || 0;
}

function aplicarMascaraMiles(campo) {
    const digitos = String(campo.value || "").replace(/\D/g, "");
    campo.value = digitos ? Number(digitos).toLocaleString("es-AR") : "";
}

function activarMascarasMonetarias() {
    document.querySelectorAll("[data-mascara-monto]").forEach(campo => {
        aplicarMascaraMiles(campo);
        campo.addEventListener("input", () => aplicarMascaraMiles(campo));
    });
}


// ========================================
// FECHAS
// ========================================

function obtenerFechaVenta(venta) {

    if (!venta || !venta.fecha) {
        return null;
    }

    const partes =
        String(venta.fecha).split("/");

    if (partes.length !== 3) {
        return null;
    }

    return new Date(
        Number(partes[2]),
        Number(partes[1]) - 1,
        Number(partes[0])
    );
}


function esHoy(fecha) {

    if (!fecha) {
        return false;
    }

    const hoy = new Date();

    return (
        fecha.getDate() === hoy.getDate() &&
        fecha.getMonth() === hoy.getMonth() &&
        fecha.getFullYear() === hoy.getFullYear()
    );

}


function esEstaSemana(fecha) {

    if (!fecha) {
        return false;
    }

    const hoy = new Date();

    const inicioSemana = new Date(hoy);

    const dia = hoy.getDay();

    inicioSemana.setDate(
        hoy.getDate() -
        (
            dia === 0
                ? 6
                : dia - 1
        )
    );

    inicioSemana.setHours(
        0,
        0,
        0,
        0
    );

    const finSemana =
        new Date(inicioSemana);

    finSemana.setDate(
        inicioSemana.getDate() + 6
    );

    finSemana.setHours(
        23,
        59,
        59,
        999
    );

    return (
        fecha >= inicioSemana &&
        fecha <= finSemana
    );

}


function esEsteMes(fecha) {

    if (!fecha) {
        return false;
    }

    const hoy = new Date();

    return (
        fecha.getMonth() === hoy.getMonth() &&
        fecha.getFullYear() === hoy.getFullYear()
    );

}


// ========================================
// NORMALIZAR TEXTO
// ========================================

function normalizarTexto(texto) {

    return String(texto || "")
        .trim()
        .toLowerCase();

}


// ========================================
// VENTAS FILTRADAS
// ========================================

function obtenerVentasFiltradas() {

    let ventas = [...ventasGuardadas];

    if (busquedaVenta !== "") {

        ventas =
            ventas.filter(
                venta => {

                    const producto =
                        normalizarTexto(
                            venta.producto
                        );

                    return producto.includes(
                        busquedaVenta
                    );

                }
            );

    }

    if (filtroVentasActual !== "all") {

        ventas =
            ventas.filter(
                venta => {

                    const fecha =
                        obtenerFechaVenta(
                            venta
                        );

                    if (
                        filtroVentasActual === "today"
                    ) {

                        return esHoy(fecha);

                    }

                    if (
                        filtroVentasActual === "week"
                    ) {

                        return esEstaSemana(fecha);

                    }

                    if (
                        filtroVentasActual === "month"
                    ) {

                        return esEsteMes(fecha);

                    }

                    return true;

                }
            );

    }

    return ventas;

}


// ========================================
// MOSTRAR VENTAS
// ========================================

function mostrarVentas() {

    if (!listaVentas) {
        return;
    }

    listaVentas.innerHTML = "";

    const ventasFiltradas =
        obtenerVentasFiltradas();

    const resultado =
        document.getElementById(
            "resultadoVentas"
        );

    if (resultado) {

        resultado.textContent =
            ventasFiltradas.length === 1
                ? "1 venta encontrada"
                : `${ventasFiltradas.length} ventas encontradas`;

    }

    if (ventasFiltradas.length === 0) {

        listaVentas.innerHTML = `

            <div class="sin-resultados">

                No encontramos ventas con esos filtros.

            </div>

        `;

        return;

    }

    ventasFiltradas.forEach(
        venta => {

            const indiceReal =
                ventasGuardadas.indexOf(
                    venta
                );

            listaVentas.innerHTML += `

                <div class="venta">

                    <strong>
                        ${venta.producto || "Sin producto"}
                    </strong>

                    <span>
                        ${Number(
                            venta.cantidad || 0
                        )}
                    </span>

                    <span>
                        ${formatoDinero(
                            venta.precio
                        )}
                    </span>

                    <span>
                        ${formatoDinero(
                            venta.total
                        )}
                    </span>

                    <span class="fecha-venta">
                        ${venta.fecha || "Sin fecha"}
                    </span>

                    <button
                        class="eliminar"
                        type="button"
                        onclick="eliminarVenta(${indiceReal})"
                        title="Eliminar venta"
                    >
                        🗑️
                    </button>

                </div>

            `;

        }
    );

}


// ========================================
// FILTROS VENTAS
// ========================================

document
    .querySelectorAll(".sales-filter")
    .forEach(
        boton => {

            boton.addEventListener(
                "click",
                () => {

                    filtroVentasActual =
                        boton.dataset.filter;

                    document
                        .querySelectorAll(
                            ".sales-filter"
                        )
                        .forEach(
                            btn =>
                                btn.classList.remove(
                                    "active"
                                )
                        );

                    boton.classList.add(
                        "active"
                    );

                    mostrarVentas();

                }
            );

        }
    );


if (buscadorVenta) {

    buscadorVenta.addEventListener(
        "input",
        () => {

            busquedaVenta =
                buscadorVenta.value
                    .trim()
                    .toLowerCase();

            mostrarVentas();

        }
    );

}


// ========================================
// BUSCAR PRODUCTO POR NOMBRE
// ========================================

function buscarProductoPorNombre(nombre) {

    if (!nombre) {
        return null;
    }

    const nombreNormalizado =
        normalizarTexto(nombre);

    return productosGuardados.find(
        producto =>
            normalizarTexto(
                producto.nombre
            ) === nombreNormalizado
    ) || null;

}


// ========================================
// BUSCAR PRODUCTO POR CÓDIGO
// ========================================

function buscarProductoPorCodigo(codigo) {

    if (!codigo) {
        return null;
    }

    const codigoNormalizado =
        String(codigo)
            .trim()
            .replace(/\s+/g, "");

    if (codigoNormalizado === "") {
        return null;
    }

    return productosGuardados.find(
        producto => {

            const codigoProducto =
                String(
                    producto.codigoBarras || ""
                )
                    .trim()
                    .replace(/\s+/g, "");

            return (
                codigoProducto ===
                codigoNormalizado
            );

        }
    ) || null;

}


// ========================================
// GUARDAR PRODUCTOS
// ========================================

function guardarProductos() {

    localStorage.setItem(
        "productosLUiv",
        JSON.stringify(
            productosGuardados
        )
    );

}


// ========================================
// GUARDAR PRODUCTO
// ========================================

function guardarProducto(producto) {

    if (!producto) {
        return;
    }

    if (producto.activo === undefined) {
        producto.activo = true;
    }

    productosGuardados.push(
        producto
    );

    guardarProductos();

}


// ========================================
// DAR DE BAJA PRODUCTO
// ========================================

function darDeBajaProducto(nombre) {

    if (!nombre) {
        return;
    }

    const nombreNormalizado =
        normalizarTexto(nombre);

    // ========================================
    // PRIMERO BUSCAMOS EN PRODUCTOS REGISTRADOS
    // ========================================

    let producto =
        productosGuardados.find(
            item =>
                normalizarTexto(
                    item.nombre
                ) === nombreNormalizado
        );

    // ========================================
    // SI NO EXISTE COMO PRODUCTO REGISTRADO
    // LO CREAMOS A PARTIR DE SUS VENTAS
    // ========================================

    if (!producto) {

        const ventaRelacionada =
            ventasGuardadas.find(
                venta =>
                    normalizarTexto(
                        venta.producto
                    ) === nombreNormalizado
            );

        if (ventaRelacionada) {

            producto = {

                nombre:
                    String(
                        ventaRelacionada.producto
                    ).trim(),

                codigoBarras:
                    "",

                precioVenta:
                    Number(
                        ventaRelacionada.precio || 0
                    ),

                precio:
                    Number(
                        ventaRelacionada.precio || 0
                    ),

                costo:
                    0,

                stock:
                    0,

                stockMinimo:
                    0,

                ultimoPrecio:
                    Number(
                        ventaRelacionada.precio || 0
                    ),

                activo:
                    true

            };

            productosGuardados.push(
                producto
            );

        }

    }

    // ========================================
    // SI AÚN NO EXISTE
    // ========================================

    if (!producto) {

        alert(
            "No se encontró el producto."
        );

        return;

    }

    // ========================================
    // YA ESTÁ DADO DE BAJA
    // ========================================

    if (
        producto.activo === false
    ) {

        alert(
            `"${producto.nombre}" ya está dado de baja.`
        );

        return;

    }

    // ========================================
    // CONFIRMACIÓN
    // ========================================

    const confirmar =
        confirm(

            `¿Querés dar de baja "${producto.nombre}"?\n\n` +

            `El producto dejará de aparecer entre los productos activos, ` +

            `pero se conservarán todas sus ventas, facturación e historial.`

        );

    if (!confirmar) {
        return;
    }

    // ========================================
    // MARCAR COMO INACTIVO
    // ========================================

    producto.activo = false;

    guardarProductos();

    // ========================================
    // ACTUALIZAR TODO
    // ========================================

    actualizarTodo();

}


// ========================================
// ELIMINAR VENTA
// ========================================

function eliminarVenta(index) {

    if (
        index < 0 ||
        index >= ventasGuardadas.length
    ) {

        return;

    }

    const confirmar =
        confirm(
            "¿Querés eliminar esta venta?"
        );

    if (!confirmar) {
        return;
    }

    const ventaEliminada =
        ventasGuardadas[index];

    // ========================================
    // DEVOLVER STOCK
    // ========================================

    if (ventaEliminada) {

        const producto =
            buscarProductoPorNombre(
                ventaEliminada.producto
            );

        if (producto) {

            const cantidad =
                Number(
                    ventaEliminada.cantidad || 0
                );

            const stockActual =
                Number(
                    producto.stock || 0
                );

            producto.stock =
                stockActual +
                cantidad;

            guardarProductos();

        }

    }

    ventasGuardadas.splice(
        index,
        1
    );

    localStorage.setItem(
        "ventas",
        JSON.stringify(
            ventasGuardadas
        )
    );

    actualizarTodo();

}


// ========================================
// AGREGAR VENTA
// ========================================

// ========================================
// REGISTRAR VENTA (FUNCIÓN CENTRAL)
// Usada por Nueva Venta y Modo Caja.
// NO actualiza la UI: el llamador decide
// si llamar actualizarTodo() o no.
// ========================================

function registrarVentaProducto(nombreProducto, precio, cantidad, opciones = {}) {

    const silencioso =
        opciones.silencioso === true;

    const omitirConfirmacionStock =
        opciones.omitirConfirmacionStock === true;

    const producto =
        String(nombreProducto || "").trim();

    const precioNum =
        numeroDesdeFormato(precio);

    const cantidadNum =
        Number(cantidad);

    if (
        producto === "" ||
        !Number.isFinite(precioNum) ||
        precioNum <= 0 ||
        !Number.isFinite(cantidadNum) ||
        cantidadNum <= 0
    ) {

        if (!silencioso) {
            alert(
                "Completá todos los datos de la venta."
            );
        }

        return {
            ok: false,
            error: "datos_invalidos"
        };

    }

    const productoRegistrado =
        buscarProductoPorNombre(
            producto
        );

    // ========================================
    // PRODUCTO DADO DE BAJA
    // ========================================

    if (
        productoRegistrado &&
        productoRegistrado.activo === false
    ) {

        if (!silencioso) {
            alert(
                `El producto "${productoRegistrado.nombre}" está dado de baja y no puede recibir nuevas ventas.`
            );
        }

        return {
            ok: false,
            error: "dado_de_baja"
        };

    }

    // ========================================
    // VALIDAR STOCK
    // ========================================

    if (productoRegistrado) {

        const stock =
            Number(
                productoRegistrado.stock
            );

        if (
            Number.isFinite(stock) &&
            stock >= 0 &&
            productoRegistrado.stock !== "" &&
            productoRegistrado.stock !== null &&
            productoRegistrado.stock !== undefined
        ) {

            if (
                stock < cantidadNum &&
                !omitirConfirmacionStock
            ) {

                if (!silencioso) {

                    const continuar =
                        confirm(
                            `El producto "${producto}" tiene solamente ${stock} unidades de stock. ¿Querés registrar igualmente la venta?`
                        );

                    if (!continuar) {
                        return {
                            ok: false,
                            error: "stock_cancelado"
                        };
                    }

                }

            }

        }

    }

    // ========================================
    // CREAR VENTA (misma estructura actual)
    // ========================================

    const nuevaVenta = {

        producto,

        precio: precioNum,

        cantidad: cantidadNum,

        total:
            precioNum *
            cantidadNum,

        fecha:
            new Date()
                .toLocaleDateString(
                    "es-AR"
                )

    };

    ventasGuardadas.push(
        nuevaVenta
    );

    localStorage.setItem(
        "ventas",
        JSON.stringify(
            ventasGuardadas
        )
    );

    // ========================================
    // ACTUALIZAR PRODUCTO / STOCK
    // ========================================

    if (productoRegistrado) {

        productoRegistrado.ultimoPrecio =
            precioNum;

        productoRegistrado.precio =
            precioNum;

        productoRegistrado.precioVenta =
            precioNum;

        if (
            productoRegistrado.stock !== undefined &&
            productoRegistrado.stock !== null &&
            productoRegistrado.stock !== ""
        ) {

            const stockActual =
                Number(
                    productoRegistrado.stock
                );

            if (
                Number.isFinite(
                    stockActual
                )
            ) {

                productoRegistrado.stock =
                    Math.max(
                        0,
                        stockActual - cantidadNum
                    );

            }

        }

        guardarProductos();

    }

    return {
        ok: true,
        venta: nuevaVenta
    };

}


// ========================================
// AGREGAR VENTA (formulario Nueva Venta)
// ========================================

function agregarVenta() {

    const productoElemento =
        document.getElementById(
            "producto"
        );

    const precioElemento =
        document.getElementById(
            "precio"
        );

    const cantidadElemento =
        document.getElementById(
            "cantidad"
        );

    if (
        !productoElemento ||
        !precioElemento ||
        !cantidadElemento
    ) {

        return;

    }

    const resultado =
        registrarVentaProducto(
            productoElemento.value,
            precioElemento.value,
            cantidadElemento.value
        );

    if (!resultado.ok) {
        return;
    }

    productoElemento.value = "";

    precioElemento.value = "";

    cantidadElemento.value = "1";

    productoSeleccionadoId = null;

    actualizarTodo();

}


// ========================================
// EVENTO AGREGAR VENTA
// ========================================

if (botonVenta) {

    botonVenta.addEventListener(
        "click",
        agregarVenta
    );

}


// ========================================
// OBTENER PRODUCTOS
// ========================================

function obtenerProductos() {

    const productos = {};

    // ========================================
    // PRODUCTOS REGISTRADOS
    // ========================================

    productosGuardados.forEach(
        producto => {

            const nombre =
                String(
                    producto.nombre || ""
                ).trim();

            if (nombre === "") {
                return;
            }

            const clave =
                nombre.toLowerCase();

            productos[clave] = {

                ...producto,

                nombre,

                activo:
                    producto.activo !== false,

                codigoBarras:
                    producto.codigoBarras || "",

                precioVenta:
                    Number(
                        producto.precioVenta ||
                        producto.precio ||
                        0
                    ),

                precio:
                    Number(
                        producto.precio ||
                        producto.precioVenta ||
                        0
                    ),

                costo:
                    Number(
                        producto.costo || 0
                    ),

                stock:
                    Number(
                        producto.stock || 0
                    ),

                stockMinimo:
                    Number(
                        producto.stockMinimo || 0
                    ),

                unidades:
                    0,

                unidadesVendidas:
                    0,

                facturacion:
                    0,

                ultimoPrecio:
                    Number(
                        producto.ultimoPrecio ||
                        producto.precioVenta ||
                        producto.precio ||
                        0
                    )

            };

        }
    );

    // ========================================
    // PRODUCTOS DE LAS VENTAS
    // ========================================

    ventasGuardadas.forEach(
        venta => {

            const nombre =
                String(
                    venta.producto || ""
                ).trim();

            if (nombre === "") {
                return;
            }

            const clave =
                nombre.toLowerCase();

            // ========================================
            // SI NO EXISTE EN PRODUCTOS REGISTRADOS
            // ========================================

            if (!productos[clave]) {

                productos[clave] = {

                    nombre,

                    codigoBarras: "",

                    precioVenta:
                        Number(
                            venta.precio || 0
                        ),

                    precio:
                        Number(
                            venta.precio || 0
                        ),

                    costo:
                        0,

                    stock:
                        0,

                    stockMinimo:
                        0,

                    activo:
                        true,

                    unidades:
                        0,

                    unidadesVendidas:
                        0,

                    facturacion:
                        0,

                    ultimoPrecio:
                        Number(
                            venta.precio || 0
                        )

                };

            }

            // ========================================
            // SUMAR VENTA
            // ========================================

            const cantidad =
                Number(
                    venta.cantidad || 0
                );

            const total =
                Number(
                    venta.total ||
                    (
                        Number(
                            venta.precio || 0
                        ) *
                        cantidad
                    )
                );

            productos[clave].unidades +=
                cantidad;

            productos[clave].unidadesVendidas +=
                cantidad;

            productos[clave].facturacion +=
                total;

            productos[clave].ultimoPrecio =
                Number(
                    venta.precio || 0
                );

            productos[clave].precioVenta =
                Number(
                    venta.precio || 0
                );

            productos[clave].precio =
                Number(
                    venta.precio || 0
                );

        }
    );

    return Object.values(
        productos
    );

}


// ========================================
// ESCAPAR HTML
// ========================================

function escaparHTML(texto) {

    return String(
        texto || ""
    )
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


// ========================================
// MOSTRAR PRODUCTOS
// ========================================

function mostrarProductos() {

    if (!listaProductos) {
        return;
    }

    let productos =
        obtenerProductos();

    // ========================================
    // SOLO PRODUCTOS ACTIVOS
    // ========================================

    productos =
        productos.filter(
            producto =>
                producto.activo !== false
        );

    // ========================================
    // BUSCADOR
    // ========================================

    if (
        busquedaProducto !== ""
    ) {

        productos =
            productos.filter(
                producto => {

                    const nombre =
                        normalizarTexto(
                            producto.nombre
                        );

                    const codigo =
                        normalizarTexto(
                            producto.codigoBarras
                        );

                    return (
                        nombre.includes(
                            busquedaProducto
                        ) ||
                        codigo.includes(
                            busquedaProducto
                        )
                    );

                }
            );

    }

    // ========================================
    // ORDEN
    // ========================================

    productos.sort(
        (a, b) =>

            ordenProductos === "revenue"

                ? b.facturacion -
                    a.facturacion

                : b.unidades -
                    a.unidades
    );

    listaProductos.innerHTML = "";

    // ========================================
    // SIN PRODUCTOS
    // ========================================

    if (
        productos.length === 0
    ) {

        listaProductos.innerHTML = `

            <div class="product-empty">

                ${
                    productosGuardados.length === 0 &&
                    ventasGuardadas.length === 0

                        ? "Todavía no tenés productos registrados."

                        : "No encontramos productos con esa búsqueda."
                }

            </div>

        `;

        return;

    }

    // ========================================
    // CREAR TARJETAS
    // ========================================

    productos.forEach(
        (producto, index) => {

            const stock =
                Number(
                    producto.stock || 0
                );

            const stockMinimo =
                Number(
                    producto.stockMinimo || 0
                );

            let estadoStock =
                "Sin configurar";

            let colorStock =
                "#8993a4";

            // ========================================
            // STOCK BAJO
            // ========================================

            if (
                stockMinimo > 0 &&
                stock <= stockMinimo
            ) {

                estadoStock =
                    "Stock bajo";

                colorStock =
                    COLOR_PERDIDA;

            }

            // ========================================
            // STOCK DISPONIBLE
            // ========================================

            else if (
                stock > 0
            ) {

                estadoStock =
                    "Stock disponible";

                colorStock =
                    COLOR_PROFIT;

            }

            // ========================================
            // SIN STOCK
            // ========================================

            else {

                estadoStock =
                    "Sin stock";

                colorStock =
                    COLOR_PERDIDA;

            }

            const nombreSeguro =
                escaparHTML(
                    producto.nombre
                );

            const codigoSeguro =
                escaparHTML(
                    producto.codigoBarras
                );

            // ========================================
            // TARJETA
            // ========================================

            listaProductos.innerHTML += `

                <article class="product-card">

                    <div class="product-rank">
                        ${index + 1}
                    </div>

                    <h3 class="product-name">
                        ${nombreSeguro}
                    </h3>

                    <div class="product-price">

                        Precio de venta:

                        <strong>
                            ${formatoDinero(
                                producto.ultimoPrecio
                            )}
                        </strong>

                    </div>

                    <div class="product-data">

                        <div class="product-data-box">

                            <span>
                                Stock
                            </span>

                            <strong>
                                ${stock}
                            </strong>

                        </div>

                        <div class="product-data-box">

                            <span>
                                Vendidos
                            </span>

                            <strong>
                                ${producto.unidades}
                            </strong>

                        </div>

                        <div class="product-data-box">

                            <span>
                                Facturación
                            </span>

                            <strong>
                                ${formatoDinero(
                                    producto.facturacion
                                )}
                            </strong>

                        </div>

                        <div class="product-data-box">

                            <span>
                                Estado
                            </span>

                            <strong
                                style="color: ${colorStock};"
                            >
                                ${estadoStock}
                            </strong>

                        </div>

                    </div>

                    ${
                        producto.codigoBarras

                            ? `

                                <div
                                    style="
                                        margin-top: 14px;
                                        color: #566274;
                                        font-size: 10px;
                                    "
                                >

                                    Código:

                                    <strong
                                        style="
                                            color: #8f9bab;
                                            font-weight: 500;
                                        "
                                    >
                                        ${codigoSeguro}
                                    </strong>

                                </div>

                            `

                            : ""

                    }

                    <!-- ========================================
                         DAR DE BAJA
                    ========================================= -->

                    <div
                        class="product-actions"
                        style="
                            margin-top: 24px;
                            padding-top: 18px;
                            border-top: 1px solid rgba(255,255,255,0.06);
                        "
                    >

                        <button
                            type="button"
                            class="product-deactivate"
                            data-product-name="${nombreSeguro}"
                        >
                            Dar de baja
                        </button>

                    </div>

                </article>

            `;

        }
    );

    // ========================================
    // EVENTOS DE DAR DE BAJA
    // ========================================

    document
        .querySelectorAll(
            ".product-deactivate"
        )
        .forEach(
            boton => {

                boton.addEventListener(
                    "click",
                    function () {

                        const nombre =
                            this.dataset.productName;

                        if (!nombre) {
                            return;
                        }

                        // Decodificar entidades HTML
                        const textarea =
                            document.createElement(
                                "textarea"
                            );

                        textarea.innerHTML =
                            nombre;

                        const nombreReal =
                            textarea.value;

                        darDeBajaProducto(
                            nombreReal
                        );

                    }
                );

            }
        );

}


// ========================================
// BUSCADOR PRODUCTOS
// ========================================

if (buscadorProducto) {

    buscadorProducto.addEventListener(
        "input",
        () => {

            busquedaProducto =
                buscadorProducto.value
                    .trim()
                    .toLowerCase();

            mostrarProductos();

        }
    );

}


// ========================================
// ORDENAR PRODUCTOS
// ========================================

document
    .querySelectorAll(
        ".product-sort"
    )
    .forEach(
        boton => {

            boton.addEventListener(
                "click",
                () => {

                    ordenProductos =
                        boton.dataset.sort;

                    document
                        .querySelectorAll(
                            ".product-sort"
                        )
                        .forEach(
                            btn =>
                                btn.classList.remove(
                                    "active"
                                )
                        );

                    boton.classList.add(
                        "active"
                    );

                    mostrarProductos();

                }
            );

        }
    );


// ========================================
// GASTOS
// ========================================

function gastosFiltrados() {
    const consulta = busquedaGasto.trim().toLocaleLowerCase();
    return gastosGuardados.filter(gasto => {
        const fecha = fechaGastoAFecha(gasto.fecha);
        const coincidePeriodo = filtroGastosActual === "all" || (filtroGastosActual === "today" && esHoy(fecha)) || (filtroGastosActual === "week" && esEstaSemana(fecha)) || (filtroGastosActual === "month" && esEsteMes(fecha));
        const texto = `${gasto.descripcion || ""} ${gasto.categoria || ""} ${gasto.notas || ""}`.toLocaleLowerCase();
        return coincidePeriodo && (!consulta || texto.includes(consulta));
    });
}

function mostrarGastos() {
    if (!listaGastos) return;
    const gastos = gastosFiltrados().sort((a, b) => (fechaGastoAFecha(b.fecha) || 0) - (fechaGastoAFecha(a.fecha) || 0));
    const resultado = document.getElementById("resultadoGastos");
    const total = gastos.reduce((suma, gasto) => suma + Number(gasto.monto || 0), 0);
    if (resultado) resultado.textContent = `${gastos.length} ${gastos.length === 1 ? "resultado" : "resultados"} · ${formatoDinero(total)}`;
    listaGastos.innerHTML = gastos.length ? gastos.map(gasto => `
        <div class="venta gasto-item">
            <strong>${escaparHTML(gasto.descripcion || "Sin descripción")}</strong>
            <span class="gasto-badge">${escaparHTML(gasto.categoria || CATEGORIA_GASTO_POR_DEFECTO)}</span>
            <span class="gasto-nota">${escaparHTML(gasto.notas || "—")}</span>
            <span>${formatoDinero(gasto.monto)}</span>
            <span class="fecha-venta">${formatoFechaGasto(gasto.fecha)}</span>
            <button class="eliminar" type="button" data-gasto-id="${escaparHTML(gasto.id)}" title="Eliminar gasto">🗑️</button>
        </div>`).join("") : '<div class="sin-resultados">No encontramos gastos con esos filtros.</div>';
    listaGastos.querySelectorAll("[data-gasto-id]").forEach(boton => boton.addEventListener("click", () => eliminarGasto(boton.dataset.gastoId)));
}

function eliminarGasto(id) {
    const indice = gastosGuardados.findIndex(gasto => String(gasto.id) === String(id));
    if (indice < 0 || !confirm("¿Querés eliminar este gasto?")) return;
    gastosGuardados.splice(indice, 1);
    localStorage.setItem("gastos", JSON.stringify(gastosGuardados));
    actualizarTodo();
}

function actualizarPanelGastos() {
    const hoy = new Date();
    const gastosMes = gastosGuardados.filter(gasto => esEsteMes(fechaGastoAFecha(gasto.fecha)));
    const totalMes = gastosMes.reduce((suma, gasto) => suma + Number(gasto.monto || 0), 0);
    const porCategoria = gastosMes.reduce((acumulado, gasto) => { const categoria = gasto.categoria || CATEGORIA_GASTO_POR_DEFECTO; acumulado[categoria] = (acumulado[categoria] || 0) + Number(gasto.monto || 0); return acumulado; }, {});
    const categoriaTop = Object.entries(porCategoria).sort((a, b) => b[1] - a[1])[0];
    const mayor = [...gastosGuardados].sort((a, b) => Number(b.monto || 0) - Number(a.monto || 0))[0];
    const diasTranscurridos = Math.max(1, hoy.getDate());
    const asignar = (id, valor) => { const elemento = document.getElementById(id); if (elemento) elemento.textContent = valor; };
    asignar("totalGastosMes", formatoDinero(totalMes));
    asignar("categoriaTopGastos", categoriaTop ? `${categoriaTop[0]} · ${formatoDinero(categoriaTop[1])}` : "—");
    asignar("promedioGasto", formatoDinero(totalMes / diasTranscurridos));
    asignar("mayorGastoUnico", mayor ? `${mayor.descripcion} · ${formatoDinero(mayor.monto)}` : "—");
    const desglose = document.getElementById("desgloseCategorias");
    if (desglose) desglose.innerHTML = Object.entries(gastosGuardados.reduce((acumulado, gasto) => { const categoria = gasto.categoria || CATEGORIA_GASTO_POR_DEFECTO; acumulado[categoria] = (acumulado[categoria] || 0) + Number(gasto.monto || 0); return acumulado; }, {})).sort((a, b) => b[1] - a[1]).map(([categoria, monto]) => { const total = gastosGuardados.reduce((suma, gasto) => suma + Number(gasto.monto || 0), 0); const porcentaje = total ? monto / total * 100 : 0; return `<div class="expense-category-row"><strong>${escaparHTML(categoria)}</strong><span>${formatoDinero(monto)} · ${porcentaje.toFixed(1)}%</span><div class="expense-progress"><span style="width:${porcentaje}%"></span></div></div>`; }).join("") || '<span class="expense-result">Aún no hay categorías para desglosar.</span>';
    const inicioAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
    const finAnterior = new Date(hoy.getFullYear(), hoy.getMonth(), 0, 23, 59, 59);
    const totalAnterior = gastosGuardados.filter(gasto => { const fecha = fechaGastoAFecha(gasto.fecha); return fecha && fecha >= inicioAnterior && fecha <= finAnterior; }).reduce((suma, gasto) => suma + Number(gasto.monto || 0), 0);
    const ventasMes = ventasGuardadas.filter(venta => esEsteMes(obtenerFechaVenta(venta))).reduce((suma, venta) => suma + Number(venta.total || 0), 0);
    const variacion = totalAnterior ? ((totalMes - totalAnterior) / totalAnterior) * 100 : null;
    const insights = document.getElementById("insightsGastosContainer");
    if (insights) insights.innerHTML = [
        categoriaTop && totalMes && categoriaTop[1] / totalMes > .3 ? `<article class="expense-insight"><strong>Mayor impacto</strong>${escaparHTML(categoriaTop[0])} concentra ${(categoriaTop[1] / totalMes * 100).toFixed(1)}% de los gastos del mes.</article>` : '<article class="expense-insight"><strong>Mayor impacto</strong>Ninguna categoría supera el 30% de los gastos mensuales.</article>',
        `<article class="expense-insight"><strong>Comparativa mensual</strong>${variacion === null ? "No hay gastos del mes anterior para comparar." : `Los gastos variaron ${Math.abs(variacion).toFixed(1)}% ${variacion >= 0 ? "al alza" : "a la baja"} frente al mes anterior.`}</article>`,
        `<article class="expense-insight"><strong>Margen operativo</strong>${ventasMes ? (totalMes / ventasMes * 100 > 70 ? "Alerta: los gastos consumen más del 70% de las ventas del mes." : `Los gastos representan ${(totalMes / ventasMes * 100).toFixed(1)}% de las ventas del mes.`) : "Aún no hay ventas de este mes para evaluar el margen."}</article>`
    ].join("");
}

function agregarGasto() {
    const descripcionElemento = document.getElementById("descripcionGasto");
    const montoElemento = document.getElementById("montoGasto");
    const categoriaElemento = document.getElementById("categoriaGasto");
    const fechaElemento = document.getElementById("fechaGasto");
    const notasElemento = document.getElementById("notasGasto");
    if (!descripcionElemento || !montoElemento) return;
    const descripcion = descripcionElemento.value.trim();
    const monto = numeroDesdeFormato(montoElemento.value);
    if (!descripcion || !Number.isFinite(monto) || monto <= 0) { alert("Ingresá una descripción y un importe mayor que cero."); return; }
    gastosGuardados.push({ id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, descripcion, monto, fecha: fechaElemento?.value || fechaLocalISO(), categoria: categoriaElemento?.value || CATEGORIA_GASTO_POR_DEFECTO, notas: notasElemento?.value.trim() || "" });
    localStorage.setItem("gastos", JSON.stringify(gastosGuardados));
    descripcionElemento.value = ""; montoElemento.value = ""; if (notasElemento) notasElemento.value = ""; if (fechaElemento) fechaElemento.value = fechaLocalISO();
    actualizarTodo();
}

if (botonGasto) botonGasto.addEventListener("click", agregarGasto);
document.getElementById("buscarGasto")?.addEventListener("input", evento => { busquedaGasto = evento.target.value; mostrarGastos(); });
document.querySelectorAll(".gasto-filter").forEach(boton => boton.addEventListener("click", () => { filtroGastosActual = boton.dataset.filterGasto || "all"; document.querySelectorAll(".gasto-filter").forEach(item => item.classList.toggle("active", item === boton)); mostrarGastos(); }));
const fechaGastoInicial = document.getElementById("fechaGasto");
if (fechaGastoInicial && !fechaGastoInicial.value) fechaGastoInicial.value = fechaLocalISO();


// ========================================
// RESUMEN
// ========================================

function actualizarResumen() {

    const totalVentas =
        ventasGuardadas.reduce(
            (total, venta) =>
                total +
                Number(
                    venta.total || 0
                ),
            0
        );

    const totalGastos =
        gastosGuardados.reduce(
            (total, gasto) =>
                total +
                Number(
                    gasto.monto || 0
                ),
            0
        );

    const unidades =
        ventasGuardadas.reduce(
            (total, venta) =>
                total +
                Number(
                    venta.cantidad || 0
                ),
            0
        );

    const productos =
        obtenerProductos();

    const productosConVentas =
        productos.filter(
            producto =>
                producto.unidades > 0
        );

    const top =
        [...productosConVentas].sort(
            (a, b) =>
                b.unidades -
                a.unidades
        )[0];

    const hoy =
        new Date()
            .toLocaleDateString(
                "es-AR"
            );

    const ventasHoy =
        ventasGuardadas
            .filter(
                venta =>
                    venta.fecha === hoy
            )
            .reduce(
                (total, venta) =>
                    total +
                    Number(
                        venta.total || 0
                    ),
                0
            );

    const ganancia =
        totalVentas -
        totalGastos;

    const valores = {

        totalVentas,

        totalGastos,

        ganancia,

        unidadesVendidas:
            unidades,

        ticketPromedio:
            Math.round(
                ventasGuardadas.length
                    ? totalVentas /
                        ventasGuardadas.length
                    : 0
            ),

        productoMasVendido:
            top
                ? top.nombre
                : "—",

        cantidadProductoTop:
            top
                ? `${top.unidades} unidades vendidas`
                : "Sin ventas todavía",

        ventasHoy

    };

    Object.entries(
        valores
    ).forEach(
        ([id, valor]) => {

            const elemento =
                document.getElementById(
                    id
                );

            if (!elemento) {
                return;
            }

            if (
                typeof valor === "number"
            ) {

                if (
                    id ===
                    "unidadesVendidas"
                ) {

                    elemento.textContent =
                        valor.toLocaleString(
                            "es-AR"
                        );

                } else {

                    elemento.textContent =
                        formatoDinero(
                            valor
                        );

                }

            } else {

                elemento.textContent =
                    valor;

            }

        }
    );

    const elementoGanancia =
        document.getElementById(
            "ganancia"
        );

    if (elementoGanancia) {

        elementoGanancia.style.color =
            ganancia >= 0
                ? COLOR_PROFIT
                : COLOR_PERDIDA;

    }

}


// ========================================
// DATOS GRÁFICO
// ========================================

function obtenerDatosGrafico() {

    const hoy = new Date();

    let fechas = [];

    let modo = "days";

    if (
        periodoActual === "7"
    ) {

        for (
            let i = 6;
            i >= 0;
            i--
        ) {

            const fecha =
                new Date(hoy);

            fecha.setDate(
                hoy.getDate() - i
            );

            fechas.push(
                fecha.toLocaleDateString(
                    "es-AR"
                )
            );

        }

    }

    else if (
        periodoActual === "30"
    ) {

        for (
            let i = 29;
            i >= 0;
            i--
        ) {

            const fecha =
                new Date(hoy);

            fecha.setDate(
                hoy.getDate() - i
            );

            fechas.push(
                fecha.toLocaleDateString(
                    "es-AR"
                )
            );

        }

    }

    else if (
        periodoActual === "month"
    ) {

        modo = "month";

        const año =
            hoy.getFullYear();

        const mes =
            hoy.getMonth();

        const ultimoDia =
            new Date(
                año,
                mes + 1,
                0
            );

        for (
            let dia = 1;
            dia <= ultimoDia.getDate();
            dia++
        ) {

            const fecha =
                new Date(
                    año,
                    mes,
                    dia
                );

            fechas.push(
                fecha.toLocaleDateString(
                    "es-AR"
                )
            );

        }

    }

    const ventas =
        fechas.map(
            fecha =>
                ventasGuardadas
                    .filter(
                        venta =>
                            venta.fecha ===
                            fecha
                    )
                    .reduce(
                        (total, venta) =>
                            total +
                            Number(
                                venta.total || 0
                            ),
                        0
                    )
        );

    const gastos =
        fechas.map(
            fecha =>
                gastosGuardados
                    .filter(
                        gasto =>
                            mismaFechaGasto(
                                gasto.fecha,
                                fecha
                            )
                    )
                    .reduce(
                        (total, gasto) =>
                            total +
                            Number(
                                gasto.monto || 0
                            ),
                        0
                    )
        );

    const resultado =
        fechas.map(
            (_, index) =>
                ventas[index] -
                gastos[index]
        );

    return {

        fechas,

        ventas,

        gastos,

        resultado,

        modo

    };

}


// ========================================
// GRÁFICO
// ========================================

function actualizarGraficoVentas() {

    const canvas =
        document.getElementById(
            "ventasChart"
        );

    if (
        !canvas ||
        typeof Chart === "undefined"
    ) {

        return;

    }

    const datos =
        obtenerDatosGrafico();

    if (ventasChart) {

        ventasChart.destroy();

        ventasChart = null;

    }

    const labels =
        datos.fechas.map(
            fecha => {

                if (
                    periodoActual === "month"
                ) {

                    return fecha.split(
                        "/"
                    )[0];

                }

                return fecha;

            }
        );

    const ctx =
        canvas.getContext("2d");

    const gradientVentas =
        ctx.createLinearGradient(
            0,
            0,
            0,
            300
        );

    gradientVentas.addColorStop(
        0,
        "rgba(37,99,235,0.20)"
    );

    gradientVentas.addColorStop(
        1,
        "rgba(37,99,235,0)"
    );

    const gradientGastos =
        ctx.createLinearGradient(
            0,
            0,
            0,
            300
        );

    gradientGastos.addColorStop(
        0,
        "rgba(245,158,11,0.20)"
    );

    gradientGastos.addColorStop(
        1,
        "rgba(245,158,11,0)"
    );

    ventasChart =
        new Chart(
            canvas,
            {

                type: "line",

                data: {

                    labels,

                    datasets: [

                        {

                            label: "Ventas",

                            data:
                                datos.ventas,

                            borderColor:
                                COLOR_VENTAS,

                            backgroundColor:
                                gradientVentas,

                            tension: 0.35,

                            fill: true,

                            borderWidth: 2,

                            pointRadius: 3,

                            pointHoverRadius: 5,

                            pointBackgroundColor:
                                COLOR_VENTAS,

                            pointBorderColor:
                                COLOR_VENTAS

                        },

                        {

                            label: "Gastos",

                            data:
                                datos.gastos,

                            borderColor:
                                COLOR_GASTOS,

                            backgroundColor:
                                gradientGastos,

                            tension: 0.35,

                            fill: true,

                            borderWidth: 2,

                            pointRadius: 3,

                            pointHoverRadius: 5,

                            pointBackgroundColor:
                                COLOR_GASTOS,

                            pointBorderColor:
                                COLOR_GASTOS

                        },

                        {

                            label: "Resultado",

                            data:
                                datos.resultado,

                            borderColor:
                                context => {

                                    const index =
                                        context.dataIndex;

                                    const valor =
                                        datos.resultado[index];

                                    return valor >= 0
                                        ? COLOR_PROFIT
                                        : COLOR_PERDIDA;

                                },

                            backgroundColor:
                                "transparent",

                            tension: 0.35,

                            fill: false,

                            borderWidth: 3,

                            pointRadius: 4,

                            pointHoverRadius: 6,

                            pointBackgroundColor:
                                context => {

                                    const index =
                                        context.dataIndex;

                                    const valor =
                                        datos.resultado[index];

                                    return valor >= 0
                                        ? COLOR_PROFIT
                                        : COLOR_PERDIDA;

                                },

                            pointBorderColor:
                                context => {

                                    const index =
                                        context.dataIndex;

                                    const valor =
                                        datos.resultado[index];

                                    return valor >= 0
                                        ? COLOR_PROFIT
                                        : COLOR_PERDIDA;

                                },

                            segment: {

                                borderColor:
                                    context => {

                                        const inicio =
                                            context.p0.parsed.y;

                                        const final =
                                            context.p1.parsed.y;

                                        if (
                                            inicio >= 0 &&
                                            final >= 0
                                        ) {

                                            return COLOR_PROFIT;

                                        }

                                        if (
                                            inicio < 0 &&
                                            final < 0
                                        ) {

                                            return COLOR_PERDIDA;

                                        }

                                        return inicio >= 0
                                            ? COLOR_PROFIT
                                            : COLOR_PERDIDA;

                                    }

                            }

                        }

                    ]

                },

                options: {

                    responsive: true,

                    maintainAspectRatio: false,

                    interaction: {

                        mode: "index",

                        intersect: false

                    },

                    plugins: {

                        legend: {

                            display: true,

                            position: "top",

                            labels: {

                                usePointStyle: true,

                                padding: 20

                            }

                        },

                        tooltip: {

                            callbacks: {

                                label:
                                    function(context) {

                                        const valor =
                                            Number(
                                                context.raw || 0
                                            );

                                        return (
                                            context.dataset.label +
                                            ": " +
                                            formatoDinero(
                                                valor
                                            )
                                        );

                                    }

                            }

                        }

                    },

                    scales: {

                        y: {

                            beginAtZero: false,

                            ticks: {

                                callback:
                                    function(value) {

                                        return formatoDinero(
                                            value
                                        );

                                    }

                            }

                        },

                        x: {

                            grid: {

                                display: false

                            }

                        }

                    }

                }

            }
        );

    const totalVentas =
        datos.ventas.reduce(
            (total, valor) =>
                total + valor,
            0
        );

    const totalGastos =
        datos.gastos.reduce(
            (total, valor) =>
                total + valor,
            0
        );

    const totalResultado =
        totalVentas -
        totalGastos;

    const graficoVentasTotal =
        document.getElementById(
            "graficoVentasTotal"
        );

    const graficoGastosTotal =
        document.getElementById(
            "graficoGastosTotal"
        );

    const graficoResultadoTotal =
        document.getElementById(
            "graficoResultadoTotal"
        );

    if (graficoVentasTotal) {

        graficoVentasTotal.textContent =
            formatoDinero(
                totalVentas
            );

    }

    if (graficoGastosTotal) {

        graficoGastosTotal.textContent =
            formatoDinero(
                totalGastos
            );

    }

    if (graficoResultadoTotal) {

        graficoResultadoTotal.textContent =
            formatoDinero(
                totalResultado
            );

        graficoResultadoTotal.style.color =
            totalResultado >= 0
                ? COLOR_PROFIT
                : COLOR_PERDIDA;

    }

}


// ========================================
// BOTONES GRÁFICO
// ========================================

document
    .querySelectorAll(
        ".filter-button"
    )
    .forEach(
        boton => {

            boton.addEventListener(
                "click",
                () => {

                    periodoActual =
                        boton.dataset.period;

                    document
                        .querySelectorAll(
                            ".filter-button"
                        )
                        .forEach(
                            btn =>
                                btn.classList.remove(
                                    "active"
                                )
                        );

                    boton.classList.add(
                        "active"
                    );

                    const periodoTexto =
                        document.getElementById(
                            "periodoGrafico"
                        );

                    if (periodoTexto) {

                        if (
                            periodoActual === "7"
                        ) {

                            periodoTexto.textContent =
                                "Últimos 7 días";

                        }

                        else if (
                            periodoActual === "30"
                        ) {

                            periodoTexto.textContent =
                                "Últimos 30 días";

                        }

                        else {

                            periodoTexto.textContent =
                                "Mes actual";

                        }

                    }

                    actualizarGraficoVentas();

                }
            );

        }
    );


// ========================================
// VENTAS DE FECHA
// ========================================

function ventasDeFecha(fecha) {

    return ventasGuardadas
        .filter(
            venta =>
                venta.fecha === fecha
        )
        .reduce(
            (total, venta) =>
                total +
                Number(
                    venta.total || 0
                ),
            0
        );

}


// ========================================
// COMPARACIÓN
// ========================================

function actualizarComparacion() {

    const actual =
        document.getElementById(
            "ventasPeriodoActual"
        );

    if (!actual) {
        return;
    }

    const hoy = new Date();

    let actuales = 0;

    let anteriores = 0;

    for (
        let i = 0;
        i < 14;
        i++
    ) {

        const fecha =
            new Date(hoy);

        fecha.setDate(
            hoy.getDate() - i
        );

        if (i < 7) {

            actuales +=
                ventasDeFecha(
                    fecha.toLocaleDateString(
                        "es-AR"
                    )
                );

        }

        else {

            anteriores +=
                ventasDeFecha(
                    fecha.toLocaleDateString(
                        "es-AR"
                    )
                );

        }

    }

    actual.textContent =
        formatoDinero(
            actuales
        );

    const anterior =
        document.getElementById(
            "ventasPeriodoAnterior"
        );

    if (anterior) {

        anterior.textContent =
            formatoDinero(
                anteriores
            );

    }

    const variacion =
        document.getElementById(
            "variacionVentas"
        );

    const texto =
        document.getElementById(
            "textoVariacionVentas"
        );

    if (anteriores === 0) {

        if (variacion) {

            variacion.textContent =
                "—";

            variacion.style.color =
                "";

        }

        if (texto) {

            texto.textContent =
                "Todavía no hay suficientes datos para comparar.";

        }

        return;

    }

    const porcentaje =
        (
            (
                actuales -
                anteriores
            ) /
            anteriores
        ) *
        100;

    if (variacion) {

        variacion.textContent =
            (
                porcentaje >= 0
                    ? "+"
                    : ""
            ) +
            porcentaje.toFixed(1) +
            "%";

        variacion.style.color =
            porcentaje >= 0
                ? COLOR_PROFIT
                : COLOR_PERDIDA;

    }

    if (texto) {

        texto.textContent =
            porcentaje > 0

                ? "Tus ventas aumentaron respecto al período anterior."

                : porcentaje < 0

                    ? "Tus ventas disminuyeron respecto al período anterior."

                    : "Tus ventas se mantuvieron estables.";

    }

}


// ========================================
// CAPITALIZAR
// ========================================

function capitalizar(texto) {

    return texto
        ? texto.charAt(0).toUpperCase() +
            texto.slice(1)
        : "—";

}


// ========================================
// ANÁLISIS INTELIGENTE
// ========================================

function generarInsights() {

    const container =
        document.getElementById(
            "insightsContainer"
        );

    if (!container) {
        return;
    }

    if (
        ventasGuardadas.length === 0
    ) {

        container.innerHTML = `

            <article class="insight-card">

                <div class="insight-type">
                    INICIO
                </div>

                <h3>
                    Empezá a registrar tus ventas
                </h3>

                <p>
                    Cuando tengas algunas operaciones,
                    LUiv podrá analizar el comportamiento
                    de tu negocio.
                </p>

                <span class="insight-value">
                    Sin datos todavía
                </span>

            </article>

        `;

        return;

    }

    const totalVentas =
        ventasGuardadas.reduce(
            (total, venta) =>
                total +
                Number(
                    venta.total || 0
                ),
            0
        );

    const totalGastos =
        gastosGuardados.reduce(
            (total, gasto) =>
                total +
                Number(
                    gasto.monto || 0
                ),
            0
        );

    const porcentajeGastos =
        totalVentas > 0
            ? (
                totalGastos /
                totalVentas
            ) * 100
            : 0;

    const productos =
        obtenerProductos();

    const productosConVentas =
        productos.filter(
            producto =>
                producto.unidades > 0
        );

    const productoTop =
        productosConVentas.length > 0
            ? [...productosConVentas].sort(
                (a, b) =>
                    b.unidades -
                    a.unidades
            )[0]
            : null;

    const productoMayorFacturacion =
        productosConVentas.length > 0
            ? [...productosConVentas].sort(
                (a, b) =>
                    b.facturacion -
                    a.facturacion
            )[0]
            : null;

    const hoy = new Date();

    let ventasActuales = 0;

    let ventasAnteriores = 0;

    for (
        let i = 0;
        i < 14;
        i++
    ) {

        const fecha =
            new Date(hoy);

        fecha.setDate(
            hoy.getDate() - i
        );

        const fechaTexto =
            fecha.toLocaleDateString(
                "es-AR"
            );

        const ventasDia =
            ventasDeFecha(
                fechaTexto
            );

        if (i < 7) {

            ventasActuales +=
                ventasDia;

        }

        else {

            ventasAnteriores +=
                ventasDia;

        }

    }

    let variacionVentas = null;

    if (
        ventasAnteriores > 0
    ) {

        variacionVentas =
            (
                (
                    ventasActuales -
                    ventasAnteriores
                ) /
                ventasAnteriores
            ) * 100;

    }

    // ========================================
    // PRODUCTO DESTACADO
    // ========================================

    let insightProducto = "";

    if (productoTop) {

        insightProducto = `

            <article class="insight-card">

                <div class="insight-type">
                    PRODUCTO DESTACADO
                </div>

                <h3>
                    ${capitalizar(
                        productoTop.nombre
                    )}
                </h3>

                <p>
                    Es el producto que más unidades
                    vendiste hasta ahora.
                </p>

                <span class="insight-value">
                    ${productoTop.unidades}
                    unidades vendidas
                </span>

            </article>

        `;

    }

    // ========================================
    // TENDENCIA
    // ========================================

    let insightTendencia = "";

    if (
        variacionVentas === null
    ) {

        insightTendencia = `

            <article class="insight-card">

                <div class="insight-type">
                    TENDENCIA
                </div>

                <h3>
                    Todavía no hay suficiente historial
                </h3>

                <p>
                    LUiv necesita más datos para
                    comparar tus ventas con precisión.
                </p>

                <span class="insight-value">
                    Seguimos analizando
                </span>

            </article>

        `;

    }

    else if (
        variacionVentas > 0
    ) {

        insightTendencia = `

            <article class="insight-card">

                <div class="insight-type">
                    TENDENCIA POSITIVA
                </div>

                <h3>
                    Tus ventas están creciendo
                </h3>

                <p>
                    Durante los últimos 7 días
                    vendiste más que en los 7 días
                    anteriores.
                </p>

                <span
                    class="insight-value"
                    style="color: ${COLOR_PROFIT};"
                >
                    +${variacionVentas.toFixed(1)}%
                </span>

            </article>

        `;

    }

    else if (
        variacionVentas < 0
    ) {

        insightTendencia = `

            <article class="insight-card">

                <div class="insight-type">
                    ATENCIÓN
                </div>

                <h3>
                    Tus ventas disminuyeron
                </h3>

                <p>
                    Durante los últimos 7 días
                    vendiste menos que en el período
                    anterior.
                </p>

                <span
                    class="insight-value"
                    style="color: ${COLOR_PERDIDA};"
                >
                    ${variacionVentas.toFixed(1)}%
                </span>

            </article>

        `;

    }

    else {

        insightTendencia = `

            <article class="insight-card">

                <div class="insight-type">
                    TENDENCIA
                </div>

                <h3>
                    Tus ventas se mantienen estables
                </h3>

                <p>
                    No hubo cambios importantes
                    respecto al período anterior.
                </p>

                <span class="insight-value">
                    Sin variación
                </span>

            </article>

        `;

    }

    // ========================================
    // GASTOS
    // ========================================

    let insightGastos = "";

    if (
        porcentajeGastos > 70
    ) {

        insightGastos = `

            <article class="insight-card">

                <div class="insight-type">
                    ALERTA DE GASTOS
                </div>

                <h3>
                    Revisá tus gastos
                </h3>

                <p>
                    Tus gastos representan una parte
                    muy importante de tus ventas.
                </p>

                <span
                    class="insight-value"
                    style="color: ${COLOR_PERDIDA};"
                >
                    ${Math.round(
                        porcentajeGastos
                    )}% de las ventas
                </span>

            </article>

        `;

    }

    else if (
        porcentajeGastos > 40
    ) {

        insightGastos = `

            <article class="insight-card">

                <div class="insight-type">
                    CONTROL
                </div>

                <h3>
                    Vigilá tus gastos
                </h3>

                <p>
                    Los gastos tienen un peso
                    considerable sobre tus ventas.
                </p>

                <span class="insight-value">
                    ${Math.round(
                        porcentajeGastos
                    )}% de las ventas
                </span>

            </article>

        `;

    }

    else {

        insightGastos = `

            <article class="insight-card">

                <div class="insight-type">
                    CONTROL
                </div>

                <h3>
                    Gastos bajo control
                </h3>

                <p>
                    Tus gastos representan una
                    proporción moderada de tus ventas.
                </p>

                <span
                    class="insight-value"
                    style="color: ${COLOR_PROFIT};"
                >
                    ${Math.round(
                        porcentajeGastos
                    )}% de las ventas
                </span>

            </article>

        `;

    }

    // ========================================
    // MAYOR FACTURACIÓN
    // ========================================

    let insightFacturacion = "";

    if (
        productoMayorFacturacion
    ) {

        insightFacturacion = `

            <article class="insight-card">

                <div class="insight-type">
                    MAYOR FACTURACIÓN
                </div>

                <h3>
                    ${capitalizar(
                        productoMayorFacturacion.nombre
                    )}
                </h3>

                <p>
                    Es el producto que más dinero
                    generó para tu negocio.
                </p>

                <span
                    class="insight-value"
                    style="color: ${COLOR_PROFIT};"
                >
                    ${formatoDinero(
                        productoMayorFacturacion.facturacion
                    )}
                    facturados
                </span>

            </article>

        `;

    }

    // ========================================
    // DEPENDENCIA DE PRODUCTO
    // ========================================

    let insightDependencia = "";

    if (
        productoMayorFacturacion &&
        totalVentas > 0
    ) {

        const porcentajeProducto =
            (
                productoMayorFacturacion.facturacion /
                totalVentas
            ) * 100;

        if (
            porcentajeProducto >= 60
        ) {

            insightDependencia = `

                <article class="insight-card">

                    <div class="insight-type">
                        ATENCIÓN
                    </div>

                    <h3>
                        Gran parte de tus ventas depende de un producto
                    </h3>

                    <p>
                        ${capitalizar(
                            productoMayorFacturacion.nombre
                        )}
                        representa una parte muy importante
                        de la facturación de tu negocio.
                    </p>

                    <span
                        class="insight-value"
                        style="color: ${COLOR_PERDIDA};"
                    >
                        ${Math.round(
                            porcentajeProducto
                        )}% de la facturación
                    </span>

                </article>

            `;

        }

        else if (
            porcentajeProducto >= 40
        ) {

            insightDependencia = `

                <article class="insight-card">

                    <div class="insight-type">
                        OPORTUNIDAD
                    </div>

                    <h3>
                        Tenés un producto muy importante
                    </h3>

                    <p>
                        ${capitalizar(
                            productoMayorFacturacion.nombre
                        )}
                        tiene un peso importante dentro
                        de la facturación de tu negocio.
                    </p>

                    <span class="insight-value">
                        ${Math.round(
                            porcentajeProducto
                        )}% de la facturación
                    </span>

                </article>

            `;

        }

        else {

            insightDependencia = `

                <article class="insight-card">

                    <div class="insight-type">
                        DIVERSIFICACIÓN
                    </div>

                    <h3>
                        Tus ventas están diversificadas
                    </h3>

                    <p>
                        Ningún producto concentra una parte
                        excesiva de tu facturación.
                    </p>

                    <span
                        class="insight-value"
                        style="color: ${COLOR_PROFIT};"
                    >
                        ${Math.round(
                            porcentajeProducto
                        )}% máximo
                    </span>

                </article>

            `;

        }

    }

    // ========================================
    // RECOMENDACIÓN
    // ========================================

    let recomendacionProducto = "";

    if (
        productoMayorFacturacion &&
        totalVentas > 0
    ) {

        const porcentajeProducto =
            (
                productoMayorFacturacion.facturacion /
                totalVentas
            ) * 100;

        if (
            porcentajeProducto >= 60
        ) {

            recomendacionProducto = `

                <article class="insight-card recommendation-card">

                    <div class="insight-type">
                        RECOMENDACIÓN
                    </div>

                    <h3>
                        Reducí tu dependencia de este producto
                    </h3>

                    <p>
                        ${capitalizar(
                            productoMayorFacturacion.nombre
                        )}
                        genera el
                        ${Math.round(
                            porcentajeProducto
                        )}%
                        de tu facturación.
                        Considerá impulsar otros productos
                        para distribuir mejor tus ventas.
                    </p>

                    <span class="insight-value">
                        Próximo objetivo: aumentar la participación
                        de otros productos.
                    </span>

                </article>

            `;

        }

        else if (
            porcentajeProducto >= 40
        ) {

            recomendacionProducto = `

                <article class="insight-card recommendation-card">

                    <div class="insight-type">
                        RECOMENDACIÓN
                    </div>

                    <h3>
                        Potenciá tus otros productos
                    </h3>

                    <p>
                        ${capitalizar(
                            productoMayorFacturacion.nombre
                        )}
                        concentra el
                        ${Math.round(
                            porcentajeProducto
                        )}%
                        de tu facturación.
                        Podría ser una buena oportunidad
                        para hacer crecer otros productos.
                    </p>

                    <span class="insight-value">
                        Buscá aumentar la participación
                        de tus productos secundarios.
                    </span>

                </article>

            `;

        }

        else {

            recomendacionProducto = `

                <article class="insight-card recommendation-card">

                    <div class="insight-type">
                        RECOMENDACIÓN
                    </div>

                    <h3>
                        Mantené una oferta diversificada
                    </h3>

                    <p>
                        Ningún producto concentra una parte
                        excesiva de tu facturación.
                        Seguí desarrollando los productos
                        que mejor funcionan.
                    </p>

                    <span
                        class="insight-value"
                        style="color: ${COLOR_PROFIT};"
                    >
                        Buena distribución de ventas
                    </span>

                </article>

            `;

        }

    }

    container.innerHTML =

        insightProducto +

        insightTendencia +

        insightGastos +

        insightFacturacion +

        insightDependencia +

        recomendacionProducto;

}


// ========================================
// ACTUALIZAR TODO
// ========================================

function actualizarTodo() {

    mostrarVentas();

    mostrarProductos();

    mostrarGastos();

    actualizarPanelGastos();

    actualizarContadorAutomatico();

    actualizarResumen();

    actualizarGraficoVentas();

    actualizarComparacion();

    generarInsights();

}


// ========================================
// NORMALIZAR CÓDIGO DE BARRAS
// ========================================

function normalizarCodigo(codigo) {
    return String(codigo || "")
        .trim()
        .replace(/\s+/g, "");
}


// ========================================
// AUTOCOMPLETADO Y ESCANEO - DASHBOARD
// ========================================

const campoProductoVenta =
    document.getElementById("producto");

const sugerenciasDropdown =
    document.getElementById("sugerenciasProducto");

const campoPrecioVenta =
    document.getElementById("precio");

const campoCantidadVenta =
    document.getElementById("cantidad");

const botonEscanearVenta =
    document.getElementById("escanearVenta");

const barcodeNotificacion =
    document.getElementById("barcodeNotificacion");

const scannerVentaModal =
    document.getElementById("scannerVentaModal");

const scannerVentaVideo =
    document.getElementById("scannerVentaVideo");

const scannerVentaStatus =
    document.getElementById("scannerVentaStatus");

const codigoVentaDetectado =
    document.getElementById("codigoVentaDetectado");

const botonCerrarScannerVenta =
    document.getElementById("cerrarScannerVenta");


let productoSeleccionadoId = null;

let sugerenciaActivaIndex = -1;

let sugerenciasActuales = [];

let lectorVenta = null;

let controlCamaraVenta = null;

let barcodeBuffer = "";

let barcodeLastKeypress = 0;


// ========================================
// NORMALIZAR TEXTO PARA BÚSQUEDA
// ========================================

function normalizarBusqueda(texto) {
    return String(texto || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}


// ========================================
// RESALTAR COINCIDENCIA
// ========================================

function resaltarCoincidencia(texto, busqueda) {
    if (!busqueda) {
        return escaparHTML(texto);
    }
    const textoNorm = normalizarBusqueda(texto);
    const busquedaNorm = normalizarBusqueda(busqueda);
    const idx = textoNorm.indexOf(busquedaNorm);
    if (idx === -1) {
        return escaparHTML(texto);
    }
    const antes = texto.slice(0, idx);
    const match = texto.slice(idx, idx + busqueda.length);
    const despues = texto.slice(idx + busqueda.length);
    return (
        escaparHTML(antes) +
        '<span class="autocomplete-highlight">' +
        escaparHTML(match) +
        "</span>" +
        escaparHTML(despues)
    );
}


// ========================================
// BUSCAR PRODUCTOS PARA SUGERENCIAS
// ========================================

function buscarProductosSugerencia(consulta) {
    const consultaNorm = normalizarBusqueda(consulta);

    if (consultaNorm === "") {
        return productosGuardados
            .filter(p => p.activo !== false)
            .sort((a, b) => {
                const ua = Number(a.unidadesVendidas || 0);
                const ub = Number(b.unidadesVendidas || 0);
                return ub - ua;
            })
            .slice(0, 8);
    }

    const resultados = [];
    const porNombreExacto = [];
    const porNombreInicio = [];
    const porNombreContiene = [];
    const porCodigo = [];

    productosGuardados.forEach(producto => {
        if (producto.activo === false) {
            return;
        }

        const nombre = String(producto.nombre || "");
        const codigo = String(producto.codigoBarras || "");
        const nombreNorm = normalizarBusqueda(nombre);
        const codigoNorm = normalizarBusqueda(codigo);

        if (nombreNorm === consultaNorm) {
            porNombreExacto.push(producto);
        }
        else if (nombreNorm.startsWith(consultaNorm)) {
            porNombreInicio.push(producto);
        }
        else if (nombreNorm.includes(consultaNorm)) {
            porNombreContiene.push(producto);
        }
        else if (
            codigoNorm !== "" &&
            codigoNorm.includes(consultaNorm)
        ) {
            porCodigo.push(producto);
        }
    });

    return porNombreExacto
        .concat(porNombreInicio)
        .concat(porNombreContiene)
        .concat(porCodigo)
        .slice(0, 8);
}


// ========================================
// RENDERIZAR SUGERENCIAS
// ========================================

function renderizarSugerencias(productos, consulta) {
    if (!sugerenciasDropdown) {
        return;
    }

    sugerenciasActuales = productos;
    sugerenciaActivaIndex = -1;

    if (productos.length === 0) {
        sugerenciasDropdown.innerHTML = `
            <div class="autocomplete-empty">
                No encontramos productos
                ${consulta ? ` para "${escaparHTML(consulta)}"` : ""}.
            </div>
        `;
        sugerenciasDropdown.classList.add("active");
        return;
    }

    let html = "";
    productos.forEach((producto, index) => {
        const stock = Number(producto.stock || 0);
        const precio = Number(
            producto.precioVenta ||
            producto.precio ||
            0
        );
        const codigo = producto.codigoBarras
            ? escaparHTML(producto.codigoBarras)
            : null;

        html += `
            <div
                class="autocomplete-item"
                data-index="${index}"
                data-producto-id="${producto.id}"
            >
                <div class="autocomplete-item-info">
                    <div class="autocomplete-item-name">
                        ${resaltarCoincidencia(
                            producto.nombre,
                            consulta
                        )}
                    </div>
                    ${codigo ? `
                        <div class="autocomplete-item-code">
                            Código: ${codigo}
                        </div>
                    ` : ""}
                    <div class="autocomplete-item-stock">
                        Stock disponible: ${stock}
                    </div>
                </div>
                <div class="autocomplete-item-price">
                    ${formatoDinero(precio)}
                </div>
            </div>
        `;
    });

    sugerenciasDropdown.innerHTML = html;
    sugerenciasDropdown.classList.add("active");
}


// ========================================
// CERRAR SUGERENCIAS
// ========================================

function cerrarSugerencias() {
    if (sugerenciasDropdown) {
        sugerenciasDropdown.classList.remove("active");
    }
    sugerenciaActivaIndex = -1;
    sugerenciasActuales = [];
}


// ========================================
// ACTUALIZAR SELECCIÓN VISUAL
// ========================================

function actualizarSeleccionVisual() {
    const items = sugerenciasDropdown.querySelectorAll(
        ".autocomplete-item"
    );
    items.forEach((item, i) => {
        if (i === sugerenciaActivaIndex) {
            item.classList.add("selected");
        }
        else {
            item.classList.remove("selected");
        }
    });
}


// ========================================
// APLICAR SELECCIÓN
// ========================================

function aplicarSeleccionProducto(producto) {
    if (!producto) {
        return;
    }

    if (campoProductoVenta) {
        campoProductoVenta.value = producto.nombre;
    }

    const precio = Number(
        producto.precioVenta ||
        producto.precio ||
        0
    );

    if (campoPrecioVenta && precio > 0) {
        campoPrecioVenta.value = precio.toLocaleString("es-AR");
    }

    if (campoCantidadVenta && !campoCantidadVenta.value) {
        campoCantidadVenta.value = 1;
    }

    productoSeleccionadoId = producto.id;
    cerrarSugerencias();

    setTimeout(() => {
        if (campoCantidadVenta) {
            campoCantidadVenta.focus();
            campoCantidadVenta.select();
        }
    }, 30);
}


// ========================================
// SELECCIONAR POR ÍNDICE
// ========================================

function seleccionarSugerenciaPorIndice(index) {
    const producto = sugerenciasActuales[index];
    if (producto) {
        aplicarSeleccionProducto(producto);
    }
}


// ========================================
// INPUT EN CAMPO PRODUCTO
// ========================================

if (campoProductoVenta) {

    campoProductoVenta.addEventListener(
        "input",
        () => {
            const valor = campoProductoVenta.value;
            productoSeleccionadoId = null;

            const productos =
                buscarProductosSugerencia(valor);

            renderizarSugerencias(productos, valor);
        }
    );


    campoProductoVenta.addEventListener(
        "focus",
        () => {
            const valor = campoProductoVenta.value;
            const productos =
                buscarProductosSugerencia(valor);
            renderizarSugerencias(productos, valor);
        }
    );


    campoProductoVenta.addEventListener(
        "keydown",
        event => {

            if (
                !sugerenciasDropdown.classList.contains(
                    "active"
                )
            ) {
                return;
            }

            const items =
                sugerenciasDropdown.querySelectorAll(
                    ".autocomplete-item"
                );

            if (items.length === 0) {
                return;
            }

            if (event.key === "ArrowDown") {
                event.preventDefault();
                sugerenciaActivaIndex =
                    (sugerenciaActivaIndex + 1) %
                    items.length;
                actualizarSeleccionVisual();
                const item = items[sugerenciaActivaIndex];
                if (item) {
                    item.scrollIntoView({
                        block: "nearest"
                    });
                }
            }

            else if (event.key === "ArrowUp") {
                event.preventDefault();
                sugerenciaActivaIndex =
                    sugerenciaActivaIndex <= 0
                        ? items.length - 1
                        : sugerenciaActivaIndex - 1;
                actualizarSeleccionVisual();
                const item = items[sugerenciaActivaIndex];
                if (item) {
                    item.scrollIntoView({
                        block: "nearest"
                    });
                }
            }

            else if (event.key === "Enter") {
                if (sugerenciaActivaIndex >= 0) {
                    event.preventDefault();
                    seleccionarSugerenciaPorIndice(
                        sugerenciaActivaIndex
                    );
                }
            }

            else if (event.key === "Escape") {
                cerrarSugerencias();
            }
        }
    );
}


// ========================================
// CLICK EN SUGERENCIA
// ========================================

if (sugerenciasDropdown) {

    sugerenciasDropdown.addEventListener(
        "mousedown",
        event => {
            const item = event.target.closest(
                ".autocomplete-item"
            );
            if (!item) {
                return;
            }
            event.preventDefault();
            const index = Number(
                item.dataset.index
            );
            if (
                Number.isInteger(index) &&
                index >= 0 &&
                index < sugerenciasActuales.length
            ) {
                seleccionarSugerenciaPorIndice(index);
            }
        }
    );
}


// ========================================
// CLICK FUERA PARA CERRAR
// ========================================

document.addEventListener(
    "click",
    event => {
        if (
            !campoProductoVenta ||
            !sugerenciasDropdown
        ) {
            return;
        }
        const target = event.target;
        if (
            target === campoProductoVenta ||
            sugerenciasDropdown.contains(target)
        ) {
            return;
        }
        cerrarSugerencias();
    }
);


// ========================================
// NOTIFICACIÓN
// ========================================

let notificacionTimer = null;

function mostrarNotificacion(
    tipo,
    titulo,
    producto = null,
    precio = null
) {
    if (!barcodeNotificacion) {
        return;
    }

    if (notificacionTimer) {
        clearTimeout(notificacionTimer);
    }

    barcodeNotificacion.classList.remove(
        "show",
        "errored"
    );

    const icono =
        tipo === "error" ? "⚠" : "✓";

    let contenido = `
        <div class="barcode-notification-box">
            <div class="barcode-notification-header">
                <div class="barcode-notification-icon">
                    ${icono}
                </div>
                <div class="barcode-notification-title">
                    ${escaparHTML(titulo)}
                </div>
            </div>
    `;

    if (producto) {
        contenido += `
            <div class="barcode-notification-product">
                ${escaparHTML(producto)}
            </div>
        `;
    }

    if (precio !== null) {
        contenido += `
            <div class="barcode-notification-price">
                Precio: ${formatoDinero(precio)}
            </div>
        `;
    }

    contenido += "</div>";

    barcodeNotificacion.innerHTML = contenido;

    if (tipo === "error") {
        barcodeNotificacion.classList.add(
            "errored"
        );
    }

    requestAnimationFrame(() => {
        barcodeNotificacion.classList.add(
            "show"
        );
    });

    notificacionTimer = setTimeout(() => {
        barcodeNotificacion.classList.remove(
            "show"
        );
        notificacionTimer = null;
    }, 3500);
}


// ========================================
// PROCESAR CÓDIGO DE BARRAS (VENTA)
// ========================================

function procesarCodigoVenta(codigo) {
    const codigoNorm =
        normalizarCodigo(codigo);

    if (codigoNorm === "") {
        return;
    }

    const producto =
        buscarProductoPorCodigo(codigoNorm);

    if (!campoProductoVenta) {
        return;
    }

    if (producto) {

        aplicarSeleccionProducto(producto);

        mostrarNotificacion(
            "success",
            "Producto detectado",
            producto.nombre,
            Number(
                producto.precioVenta ||
                producto.precio ||
                0
            )
        );

        campoProductoVenta.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });
    }
    else {

        campoProductoVenta.value = codigoNorm;
        productoSeleccionadoId = null;

        mostrarNotificacion(
            "error",
            "Producto no registrado",
            `Código: ${codigoNorm}`,
            null
        );

        const productos =
            buscarProductosSugerencia(codigoNorm);
        renderizarSugerencias(productos, codigoNorm);
    }
}


// ========================================
// DETECCIÓN DE LECTOR USB POR TECLADO
// ========================================

document.addEventListener(
    "keydown",
    event => {

        const ahora = Date.now();
        const esRapido =
            ahora - barcodeLastKeypress < 60;
        barcodeLastKeypress = ahora;

        const tag =
            event.target &&
            event.target.tagName;

        const enCampoEditable =
            tag === "INPUT" ||
            tag === "TEXTAREA" ||
            (event.target &&
                event.target.isContentEditable);

        if (enCampoEditable && event.key === "Enter") {

            const campoActivo =
                document.activeElement;

            if (
                campoActivo === campoProductoVenta &&
                barcodeBuffer.length >= 4
            ) {
                const posibleCodigo = barcodeBuffer;
                barcodeBuffer = "";
                procesarCodigoVenta(posibleCodigo);
                return;
            }

            barcodeBuffer = "";
            return;
        }

        if (event.key === "Enter") {

            if (
                barcodeBuffer.length >= 4 &&
                barcodeBuffer.length <= 30
            ) {
                const codigo = barcodeBuffer;
                barcodeBuffer = "";
                procesarCodigoVenta(codigo);
                return;
            }

            barcodeBuffer = "";
            return;
        }

        if (event.key.length === 1) {

            if (enCampoEditable) {
                if (esRapido) {
                    barcodeBuffer += event.key;
                }
                else {
                    barcodeBuffer = event.key;
                }
            }
            else {
                if (esRapido) {
                    barcodeBuffer += event.key;
                }
                else {
                    barcodeBuffer = event.key;
                }
            }

            if (barcodeBuffer.length > 40) {
                barcodeBuffer = "";
            }
        }
    }
);


// ========================================
// DETENER SCANNER VENTA
// ========================================

function detenerScannerVenta() {
    if (controlCamaraVenta) {
        try {
            controlCamaraVenta.stop();
        }
        catch (e) {
            console.log(e);
        }
        controlCamaraVenta = null;
    }
    if (lectorVenta) {
        try {
            lectorVenta.reset();
        }
        catch (e) {
            console.log(e);
        }
        lectorVenta = null;
    }
    if (
        scannerVentaVideo &&
        scannerVentaVideo.srcObject
    ) {
        scannerVentaVideo
            .srcObject
            .getTracks()
            .forEach(
                track => track.stop()
            );
        scannerVentaVideo.srcObject = null;
    }
}


// ========================================
// CERRAR SCANNER VENTA
// ========================================

function cerrarScannerVenta() {
    detenerScannerVenta();
    if (scannerVentaModal) {
        scannerVentaModal.classList.remove(
            "active"
        );
    }
}


// ========================================
// ABRIR SCANNER VENTA
// ========================================

async function abrirScannerVenta() {
    if (!scannerVentaModal) {
        return;
    }

    scannerVentaModal.classList.add("active");

    if (scannerVentaStatus) {
        scannerVentaStatus.textContent =
            "Iniciando cámara...";
    }
    if (codigoVentaDetectado) {
        codigoVentaDetectado.textContent = "";
    }

    try {

        if (
            typeof ZXingBrowser === "undefined"
        ) {
            throw new Error(
                "No se pudo cargar el lector."
            );
        }

        lectorVenta =
            new ZXingBrowser
                .BrowserMultiFormatReader();

        const dispositivos =
            await lectorVenta
                .listVideoInputDevices();

        if (
            !dispositivos ||
            dispositivos.length === 0
        ) {
            throw new Error(
                "No se encontró ninguna cámara."
            );
        }

        let camaraSeleccionada =
            dispositivos.find(
                d =>
                    /back|rear|environment/i.test(
                        d.label
                    )
            );

        if (!camaraSeleccionada) {
            camaraSeleccionada =
                dispositivos[
                    dispositivos.length - 1
                ];
        }

        if (scannerVentaStatus) {
            scannerVentaStatus.textContent =
                "Apuntá la cámara al código de barras.";
        }

        controlCamaraVenta =
            await lectorVenta
                .decodeFromVideoDevice(
                    camaraSeleccionada.deviceId,
                    scannerVentaVideo,
                    (resultado, error) => {

                        if (!resultado) {
                            return;
                        }

                        const codigo =
                            resultado.getText();

                        if (codigoVentaDetectado) {
                            codigoVentaDetectado.innerHTML =
                                `
                                    <strong>
                                        Código detectado
                                    </strong>
                                    <span>${codigo}</span>
                                `;
                        }

                        if (scannerVentaStatus) {
                            scannerVentaStatus.textContent =
                                "Código detectado correctamente.";
                        }

                        detenerScannerVenta();

                        setTimeout(
                            () => {
                                cerrarScannerVenta();
                                procesarCodigoVenta(
                                    codigo
                                );
                            },
                            450
                        );
                    }
                );

    }
    catch (error) {

        console.error(error);

        if (scannerVentaStatus) {
            scannerVentaStatus.textContent =
                "No pudimos acceder a la cámara.";
        }

        if (codigoVentaDetectado) {
            codigoVentaDetectado.innerHTML = `
                <p>
                    No pudimos acceder a una cámara.
                </p>
                <p>
                    Podés usar un lector USB
                    o ingresar el código
                    en el campo Producto.
                </p>
            `;
        }
    }
}


// ========================================
// EVENTOS SCANNER VENTA
// ========================================

if (botonEscanearVenta) {
    botonEscanearVenta.addEventListener(
        "click",
        abrirScannerVenta
    );
}

if (botonCerrarScannerVenta) {
    botonCerrarScannerVenta.addEventListener(
        "click",
        cerrarScannerVenta
    );
}

if (scannerVentaModal) {
    scannerVentaModal.addEventListener(
        "click",
        event => {
            if (event.target === scannerVentaModal) {
                cerrarScannerVenta();
            }
        }
    );
}


// ========================================
// ENTER EN CANTIDAD = AGREGAR VENTA
// ========================================

if (campoCantidadVenta) {
    campoCantidadVenta.addEventListener(
        "keydown",
        event => {
            if (event.key === "Enter") {
                event.preventDefault();
                agregarVenta();
            }
        }
    );
}

if (campoPrecioVenta) {
    campoPrecioVenta.addEventListener(
        "keydown",
        event => {
            if (event.key === "Enter") {
                event.preventDefault();
                if (campoCantidadVenta) {
                    campoCantidadVenta.focus();
                    campoCantidadVenta.select();
                }
            }
        }
    );
}


// ========================================
// MODO CAJA / POS
// Carrito en memoria únicamente.
// Las ventas confirmadas van a ventasGuardadas
// mediante registrarVentaProducto().
// ========================================

let carritoCaja = [];

let modoCajaActivo = false;


function obtenerProductosActivosCaja() {

    return productosGuardados.filter(
        p => p.activo !== false
    );

}


function toggleModoCaja() {

    const seccionNormal =
        document.querySelector(
            ".content"
        );

    const seccionCaja =
        document.getElementById(
            "modoCajaSeccion"
        );

    const btnToggle =
        document.getElementById(
            "btnToggleCaja"
        );

    if (!seccionCaja) {
        return;
    }

    modoCajaActivo = !modoCajaActivo;

    if (modoCajaActivo) {

        if (seccionNormal) {
            seccionNormal.style.display =
                "none";
        }

        seccionCaja.style.display =
            "block";

        if (btnToggle) {
            btnToggle.textContent =
                "Volver al Panel";
        }

        // Recargar productos activos
        productosGuardados =
            JSON.parse(
                localStorage.getItem(
                    "productosLUiv"
                )
            ) || productosGuardados;

        filtrarProductosCaja();

        renderizarCarritoCaja();

        const buscador =
            document.getElementById(
                "buscadorCaja"
            );

        if (buscador) {
            setTimeout(
                () => buscador.focus(),
                80
            );
        }

    }

    else {

        // Si hay items sin confirmar, solo se descartan
        // (no se registran ventas ni se toca stock)
        if (carritoCaja.length > 0) {

            const confirmar =
                confirm(
                    "Tenés productos en la venta actual que todavía no se confirmaron.\n\n¿Querés salir de Modo Caja y descartar esta venta?"
                );

            if (!confirmar) {
                modoCajaActivo = true;
                return;
            }

            carritoCaja = [];

        }

        if (seccionNormal) {
            seccionNormal.style.display =
                "";
        }

        seccionCaja.style.display =
            "none";

        if (btnToggle) {
            btnToggle.textContent =
                "Modo Caja";
        }

        // Refrescar panel con datos actuales
        actualizarTodo();

    }

}


function filtrarProductosCaja() {

    const buscador =
        document.getElementById(
            "buscadorCaja"
        );

    const contenedor =
        document.getElementById(
            "productosCajaResultados"
        );

    if (!contenedor) {
        return;
    }

    const consulta =
        buscador
            ? buscador.value.trim()
            : "";

    const consultaNorm =
        normalizarBusqueda(consulta);

    let productos =
        obtenerProductosActivosCaja();

    if (consultaNorm !== "") {

        productos =
            productos.filter(
                producto => {

                    const nombre =
                        normalizarBusqueda(
                            producto.nombre
                        );

                    const codigo =
                        normalizarBusqueda(
                            producto.codigoBarras
                        );

                    return (
                        nombre.includes(
                            consultaNorm
                        ) ||
                        (
                            codigo !== "" &&
                            codigo.includes(
                                consultaNorm
                            )
                        )
                    );

                }
            );

        // Priorizar coincidencias de nombre al inicio
        productos.sort(
            (a, b) => {

                const na =
                    normalizarBusqueda(
                        a.nombre
                    );

                const nb =
                    normalizarBusqueda(
                        b.nombre
                    );

                const aStarts =
                    na.startsWith(
                        consultaNorm
                    )
                        ? 0
                        : 1;

                const bStarts =
                    nb.startsWith(
                        consultaNorm
                    )
                        ? 0
                        : 1;

                if (aStarts !== bStarts) {
                    return aStarts - bStarts;
                }

                return na.localeCompare(nb);

            }
        );

    }

    else {

        productos =
            productos
                .slice()
                .sort(
                    (a, b) => {

                        const ua =
                            Number(
                                a.unidadesVendidas || 0
                            );

                        const ub =
                            Number(
                                b.unidadesVendidas || 0
                            );

                        return ub - ua;

                    }
                );

    }

    productos =
        productos.slice(0, 40);

    if (productos.length === 0) {

        contenedor.innerHTML = `

            <div class="caja-carrito-vacio" style="padding: 24px 12px;">
                <h3>
                    ${
                        consulta
                            ? "No encontramos productos"
                            : "No hay productos activos"
                    }
                </h3>
                <p>
                    ${
                        consulta
                            ? "Probá con otro nombre o código de barras."
                            : "Registrá productos desde el catálogo para venderlos en caja."
                    }
                </p>
            </div>

        `;

        return;

    }

    let html = "";

    productos.forEach(
        producto => {

            const precio =
                Number(
                    producto.precioVenta ||
                    producto.precio ||
                    0
                );

            const stock =
                Number(
                    producto.stock || 0
                );

            const codigo =
                producto.codigoBarras
                    ? escaparHTML(
                        producto.codigoBarras
                    )
                    : "";

            let stockLabel =
                "Sin stock";

            let stockColor =
                COLOR_PERDIDA;

            if (stock > 0) {
                stockLabel =
                    `Stock: ${stock}`;
                stockColor =
                    COLOR_PROFIT;
            }

            html += `

                <div
                    class="caja-producto-sugerencia"
                    data-producto-id="${producto.id}"
                    onclick="agregarProductoAlCarritoCajaPorId(${producto.id})"
                >

                    <div class="caja-carrito-item-info">

                        <div class="caja-carrito-item-name">
                            ${escaparHTML(producto.nombre)}
                        </div>

                        <div class="caja-carrito-item-details">
                            <span style="color: ${stockColor};">
                                ${stockLabel}
                            </span>
                            ${
                                codigo
                                    ? ` · Código: ${codigo}`
                                    : ""
                            }
                        </div>

                    </div>

                    <div class="caja-carrito-item-total">
                        ${formatoDinero(precio)}
                    </div>

                </div>

            `;

        }
    );

    contenedor.innerHTML = html;

}


function buscarProductoCajaPorId(id) {

    return productosGuardados.find(
        p =>
            String(p.id) === String(id) &&
            p.activo !== false
    ) || null;

}


function agregarProductoAlCarritoCajaPorId(id) {

    const producto =
        buscarProductoCajaPorId(id);

    if (!producto) {
        mostrarNotificacion(
            "error",
            "Producto no disponible"
        );
        return;
    }

    agregarProductoAlCarritoCaja(producto);

}


function agregarProductoAlCarritoCaja(producto, cantidadAgregar = 1) {

    if (!producto) {
        return;
    }

    if (producto.activo === false) {

        mostrarNotificacion(
            "error",
            "Este producto está dado de baja y no puede venderse."
        );

        return;

    }

    const cantidad =
        Math.max(
            1,
            Number(cantidadAgregar) || 1
        );

    const precio =
        Number(
            producto.precioVenta ||
            producto.precio ||
            0
        );

    if (precio <= 0) {

        alert(
            `El producto "${producto.nombre}" no tiene un precio válido.`
        );

        return;

    }

    // Unificar línea si ya está en el carrito
    const existente =
        carritoCaja.find(
            item =>
                String(item.id) ===
                String(producto.id)
        );

    if (existente) {

        existente.cantidad +=
            cantidad;

    }

    else {

        carritoCaja.push({

            id: producto.id,

            nombre: producto.nombre,

            precio,

            cantidad,

            codigoBarras:
                producto.codigoBarras || ""

        });

    }

    renderizarCarritoCaja();

    mostrarNotificacion(
        "success",
        "Producto agregado",
        producto.nombre,
        precio
    );

    // Limpiar buscador y volver a listar
    const buscador =
        document.getElementById(
            "buscadorCaja"
        );

    if (buscador) {
        buscador.value = "";
        filtrarProductosCaja();
        buscador.focus();
    }

}


function cambiarCantidadCarritoCaja(index, delta) {

    if (
        index < 0 ||
        index >= carritoCaja.length
    ) {
        return;
    }

    carritoCaja[index].cantidad +=
        delta;

    if (
        carritoCaja[index].cantidad <= 0
    ) {

        carritoCaja.splice(
            index,
            1
        );

    }

    renderizarCarritoCaja();

}


function eliminarItemCarritoCaja(index) {

    if (
        index < 0 ||
        index >= carritoCaja.length
    ) {
        return;
    }

    carritoCaja.splice(
        index,
        1
    );

    renderizarCarritoCaja();

}


function calcularTotalCarritoCaja() {

    return carritoCaja.reduce(
        (suma, item) =>
            suma +
            (
                Number(item.precio || 0) *
                Number(item.cantidad || 0)
            ),
        0
    );

}


function renderizarCarritoCaja() {

    const contenedor =
        document.getElementById(
            "carritoCajaLista"
        );

    const elSubtotal =
        document.getElementById(
            "cajaSubtotal"
        );

    const elTotal =
        document.getElementById(
            "cajaTotal"
        );

    if (!contenedor) {
        return;
    }

    const total =
        calcularTotalCarritoCaja();

    if (elSubtotal) {
        elSubtotal.textContent =
            formatoDinero(total);
    }

    if (elTotal) {
        elTotal.textContent =
            formatoDinero(total);
    }

    calcularVueltoCaja();

    if (carritoCaja.length === 0) {

        contenedor.innerHTML = `

            <div class="caja-carrito-vacio">
                <h3>
                    Tu carrito de ventas está vacío
                </h3>
                <p>
                    Buscá un producto en el buscador de la derecha
                    o escaneá un código de barras para agregarlo.
                </p>
            </div>

        `;

        return;

    }

    let html = "";

    carritoCaja.forEach(
        (item, index) => {

            const lineaTotal =
                Number(item.precio || 0) *
                Number(item.cantidad || 0);

            // Stock actual (informativo, no descontado aún)
            const producto =
                buscarProductoCajaPorId(
                    item.id
                );

            const stock =
                producto
                    ? Number(
                        producto.stock || 0
                    )
                    : null;

            let stockInfo = "";

            if (
                stock !== null &&
                Number.isFinite(stock)
            ) {

                if (stock < item.cantidad) {
                    stockInfo =
                        `<span style="color: ${COLOR_PERDIDA};">Stock: ${stock} (insuficiente)</span>`;
                }
                else if (stock === 0) {
                    stockInfo =
                        `<span style="color: ${COLOR_PERDIDA};">Sin stock</span>`;
                }
                else {
                    stockInfo =
                        `<span style="color: ${COLOR_PROFIT};">Stock: ${stock}</span>`;
                }

            }

            html += `

                <div class="caja-carrito-item">

                    <div class="caja-carrito-item-info">

                        <div class="caja-carrito-item-name">
                            ${escaparHTML(item.nombre)}
                        </div>

                        <div class="caja-carrito-item-details">
                            ${formatoDinero(item.precio)} c/u
                            ${stockInfo ? " · " + stockInfo : ""}
                        </div>

                    </div>

                    <div class="caja-carrito-item-controls">

                        <button
                            type="button"
                            class="caja-qty-btn"
                            onclick="cambiarCantidadCarritoCaja(${index}, -1)"
                            title="Disminuir"
                        >
                            −
                        </button>

                        <span class="caja-carrito-item-qty">
                            ${item.cantidad}
                        </span>

                        <button
                            type="button"
                            class="caja-qty-btn"
                            onclick="cambiarCantidadCarritoCaja(${index}, 1)"
                            title="Aumentar"
                        >
                            +
                        </button>

                        <button
                            type="button"
                            class="caja-qty-btn"
                            onclick="eliminarItemCarritoCaja(${index})"
                            title="Quitar"
                            style="color: #ef4444 !important; border-color: rgba(239,68,68,0.35) !important;"
                        >
                            ×
                        </button>

                    </div>

                    <div class="caja-carrito-item-total">
                        ${formatoDinero(lineaTotal)}
                    </div>

                </div>

            `;

        }
    );

    contenedor.innerHTML = html;

}


function calcularVueltoCaja() {

    const input =
        document.getElementById(
            "cajaEfectivoRecibido"
        );

    const elVuelto =
        document.getElementById(
            "cajaVuelto"
        );

    if (!elVuelto) {
        return;
    }

    const total =
        calcularTotalCarritoCaja();

    const recibido =
        input
            ? numeroDesdeFormato(input.value)
            : 0;

    if (
        !Number.isFinite(recibido) ||
        recibido <= 0
    ) {

        elVuelto.textContent =
            formatoDinero(0);

        elVuelto.style.color =
            "#22c55e";

        return;

    }

    const vuelto =
        recibido - total;

    elVuelto.textContent =
        formatoDinero(
            Math.max(0, vuelto)
        );

    if (vuelto < 0) {
        elVuelto.style.color =
            COLOR_PERDIDA;
        elVuelto.textContent =
            formatoDinero(vuelto);
    }
    else {
        elVuelto.style.color =
            "#22c55e";
    }

}


function limpiarCajaConConfirmacion() {

    if (carritoCaja.length === 0) {
        return;
    }

    const confirmar =
        confirm(
            "¿Querés vaciar la venta actual?\n\nLos productos del carrito se descartarán y no se registrará ninguna venta."
        );

    if (!confirmar) {
        return;
    }

    limpiarCaja();

}


function limpiarCaja() {

    carritoCaja = [];

    const input =
        document.getElementById(
            "cajaEfectivoRecibido"
        );

    if (input) {
        input.value = "";
    }

    renderizarCarritoCaja();

    const buscador =
        document.getElementById(
            "buscadorCaja"
        );

    if (buscador) {
        buscador.value = "";
        filtrarProductosCaja();
        buscador.focus();
    }

}


function confirmarVentaCaja() {

    if (carritoCaja.length === 0) {

        alert(
            "Agregá al menos un producto antes de confirmar la venta."
        );

        return;

    }

    // Validar productos dados de baja y stock (una sola confirmación global)
    const problemasStock = [];

    for (const item of carritoCaja) {

        const producto =
            buscarProductoCajaPorId(
                item.id
            );

        if (!producto) {

            alert(
                `El producto "${item.nombre}" ya no está disponible. Quitálo del carrito para continuar.`
            );

            return;

        }

        if (producto.activo === false) {

            alert(
                `El producto "${producto.nombre}" está dado de baja y no puede venderse.`
            );

            return;

        }

        const stock =
            Number(
                producto.stock
            );

        if (
            Number.isFinite(stock) &&
            stock >= 0 &&
            producto.stock !== "" &&
            producto.stock !== null &&
            producto.stock !== undefined &&
            stock < item.cantidad
        ) {

            problemasStock.push(
                `${producto.nombre}: pedís ${item.cantidad}, hay ${stock}`
            );

        }

    }

    if (problemasStock.length > 0) {

        const mensaje =
            "Hay productos con stock insuficiente:\n\n" +
            problemasStock.join("\n") +
            "\n\n¿Querés registrar igualmente la venta?";

        const continuar =
            confirm(mensaje);

        if (!continuar) {
            return;
        }

    }

    // Registrar cada línea con la función central
    // (omitir confirmación individual de stock: ya se preguntó)
    let registradas = 0;

    for (const item of carritoCaja) {

        const resultado =
            registrarVentaProducto(
                item.nombre,
                item.precio,
                item.cantidad,
                {
                    silencioso: true,
                    omitirConfirmacionStock: true
                }
            );

        if (resultado.ok) {
            registradas += 1;
        }

    }

    if (registradas === 0) {

        alert(
            "No se pudo registrar la venta."
        );

        return;

    }

    const efectivoRecibido = numeroDesdeFormato(
        document.getElementById("cajaEfectivoRecibido")?.value
    );
    const ticketVenta = {
        numero: `LU-${Date.now().toString().slice(-8)}`,
        fecha: new Date(),
        items: carritoCaja.map(item => ({ ...item })),
        total: calcularTotalCarritoCaja(),
        efectivo: efectivoRecibido,
        vuelto: Math.max(0, efectivoRecibido - calcularTotalCarritoCaja())
    };

    // Limpiar carrito y refrescar todo el sistema
    carritoCaja = [];

    const input =
        document.getElementById(
            "cajaEfectivoRecibido"
        );

    if (input) {
        input.value = "";
    }

    // Recargar productos desde localStorage por si cambió stock
    productosGuardados =
        JSON.parse(
            localStorage.getItem(
                "productosLUiv"
            )
        ) || productosGuardados;

    renderizarCarritoCaja();

    filtrarProductosCaja();

    actualizarTodo();

    mostrarNotificacion(
        "success",
        "Venta registrada correctamente",
        registradas === 1
            ? "1 producto"
            : `${registradas} productos`
    );

    mostrarTicketVenta(ticketVenta);

    const buscador =
        document.getElementById(
            "buscadorCaja"
        );

    if (buscador) {
        buscador.focus();
    }

}


// ========================================
// PROCESAR CÓDIGO EN MODO CAJA
// ========================================

function procesarCodigoCaja(codigo) {

    const codigoNorm =
        normalizarCodigo(codigo);

    if (codigoNorm === "") {
        return;
    }

    const producto =
        buscarProductoPorCodigo(
            codigoNorm
        );

    if (!producto) {

        mostrarNotificacion(
            "error",
            "Producto no encontrado",
            `Código: ${codigoNorm}`
        );

        const buscador =
            document.getElementById(
                "buscadorCaja"
            );

        if (buscador) {
            buscador.value =
                codigoNorm;
            filtrarProductosCaja();
            buscador.focus();
        }

        return;

    }

    if (producto.activo === false) {

        mostrarNotificacion(
            "error",
            "Este producto está dado de baja y no puede venderse."
        );

        return;

    }

    // Si ya está en carrito → cantidad +1
    agregarProductoAlCarritoCaja(
        producto,
        1
    );

}


// ========================================
// OVERRIDE: procesar código según modo
// ========================================

const _procesarCodigoVentaOriginal =
    typeof procesarCodigoVenta === "function"
        ? procesarCodigoVenta
        : null;

procesarCodigoVenta = function (codigo) {

    if (modoCajaActivo) {
        procesarCodigoCaja(codigo);
        return;
    }

    if (_procesarCodigoVentaOriginal) {
        _procesarCodigoVentaOriginal(codigo);
    }

};


// ========================================
// ATAJOS DE TECLADO (Modo Caja)
// ========================================

document.addEventListener(
    "keydown",
    event => {

        if (!modoCajaActivo) {
            return;
        }

        const tag =
            event.target &&
            event.target.tagName;

        const enInput =
            tag === "INPUT" ||
            tag === "TEXTAREA" ||
            (
                event.target &&
                event.target.isContentEditable
            );

        // F2 → enfocar buscador
        if (event.key === "F2") {

            event.preventDefault();

            const buscador =
                document.getElementById(
                    "buscadorCaja"
                );

            if (buscador) {
                buscador.focus();
                buscador.select();
            }

            return;

        }

        // Escape → limpiar buscador / cerrar scanner
        if (event.key === "Escape") {

            const scannerActivo =
                scannerVentaModal &&
                scannerVentaModal.classList.contains(
                    "active"
                );

            if (scannerActivo) {
                cerrarScannerVenta();
                return;
            }

            const buscador =
                document.getElementById(
                    "buscadorCaja"
                );

            if (
                buscador &&
                document.activeElement ===
                    buscador &&
                buscador.value
            ) {
                buscador.value = "";
                filtrarProductosCaja();
            }

            return;

        }

        // Enter en buscador vacío + carrito → confirmar
        // (si hay texto, el flujo normal filtra)
        if (
            event.key === "Enter" &&
            !enInput &&
            carritoCaja.length > 0
        ) {

            // No interferir si hay modal abierto
            const scannerActivo =
                scannerVentaModal &&
                scannerVentaModal.classList.contains(
                    "active"
                );

            if (!scannerActivo) {
                // Evitar doble submit accidental: no auto-confirmar
            }

        }

    }
);


// Enter en buscador de caja: si hay exactamente 1 resultado, agregarlo
const buscadorCajaEl =
    document.getElementById(
        "buscadorCaja"
    );

if (buscadorCajaEl) {

    buscadorCajaEl.addEventListener(
        "keydown",
        event => {

            if (event.key !== "Enter") {
                return;
            }

            event.preventDefault();

            const consulta =
                buscadorCajaEl.value
                    .trim();

            if (consulta === "") {
                return;
            }

            // Si parece código de barras numérico largo
            const soloNumeros =
                /^[0-9]{4,}$/.test(
                    consulta.replace(
                        /\s+/g,
                        ""
                    )
                );

            if (soloNumeros) {
                procesarCodigoCaja(
                    consulta
                );
                return;
            }

            const consultaNorm =
                normalizarBusqueda(
                    consulta
                );

            const productos =
                obtenerProductosActivosCaja()
                    .filter(
                        p => {

                            const nombre =
                                normalizarBusqueda(
                                    p.nombre
                                );

                            const codigo =
                                normalizarBusqueda(
                                    p.codigoBarras
                                );

                            return (
                                nombre.includes(
                                    consultaNorm
                                ) ||
                                (
                                    codigo !== "" &&
                                    codigo.includes(
                                        consultaNorm
                                    )
                                )
                            );

                        }
                    );

            if (productos.length === 1) {

                agregarProductoAlCarritoCaja(
                    productos[0],
                    1
                );

            }

            else if (productos.length > 1) {

                // Si hay coincidencia exacta de nombre
                const exacto =
                    productos.find(
                        p =>
                            normalizarBusqueda(
                                p.nombre
                            ) === consultaNorm
                    );

                if (exacto) {
                    agregarProductoAlCarritoCaja(
                        exacto,
                        1
                    );
                }
                else {
                    filtrarProductosCaja();
                }

            }

            else {

                mostrarNotificacion(
                    "error",
                    "Producto no encontrado",
                    consulta
                );

            }

        }
    );

}


// ========================================
// INICIAR
// ========================================

// ========================================
// TICKET DE VENTA Y CONTADOR AUTOMÁTICO
// ========================================

let contadorPeriodoActual = "day";
let contadorChart = null;
let contadorVistaActual = 0;
let ajustesReporteFinanciero = JSON.parse(localStorage.getItem("ajustesReporteFinanciero") || "[]");

function mostrarTicketVenta(ticket) {
    const modal = document.getElementById("ticketVentaModal");
    const contenido = document.getElementById("ticketImprimible");
    if (!modal || !contenido) return;
    contenido.innerHTML = `<div class="ticket-head"><h2 id="ticketVentaTitulo">LUiv</h2><div>Comprobante de venta</div><div class="ticket-meta">Ticket ${escaparHTML(ticket.numero)} · ${ticket.fecha.toLocaleString("es-AR")}</div></div>${ticket.items.map(item => `<div class="ticket-line"><div><strong>${escaparHTML(item.nombre)}</strong><small>${Number(item.cantidad)} × ${formatoDinero(item.precio)}</small></div><strong>${formatoDinero(Number(item.cantidad) * Number(item.precio))}</strong></div>`).join("")}<div class="ticket-line ticket-total"><span>Total abonado</span><strong>${formatoDinero(ticket.total)}</strong></div><div class="ticket-line"><span>Efectivo recibido</span><strong>${formatoDinero(ticket.efectivo)}</strong></div><div class="ticket-line"><span>Vuelto</span><strong>${formatoDinero(ticket.vuelto)}</strong></div>`;
    modal.classList.add("active");
    modal.setAttribute("aria-hidden", "false");
}

function cerrarTicketVenta() {
    const modal = document.getElementById("ticketVentaModal");
    if (!modal) return;
    modal.classList.remove("active");
    modal.setAttribute("aria-hidden", "true");
    document.getElementById("buscadorCaja")?.focus();
}

function gastoEnPeriodoContador(gasto) {
    const fecha = fechaGastoAFecha(gasto.fecha);
    return contadorPeriodoActual === "day" ? esHoy(fecha) : contadorPeriodoActual === "week" ? esEstaSemana(fecha) : esEsteMes(fecha);
}

function ventaEnPeriodoContador(venta) {
    const fecha = obtenerFechaVenta(venta);
    return contadorPeriodoActual === "day" ? esHoy(fecha) : contadorPeriodoActual === "week" ? esEstaSemana(fecha) : esEsteMes(fecha);
}

function actualizarContadorAutomatico() {
    const resumen = document.getElementById("contadorResumen");
    const tabla = document.getElementById("contadorTabla");
    if (!resumen || !tabla) return;
    const ventas = ventasGuardadas.filter(ventaEnPeriodoContador);
    const gastos = gastosGuardados.filter(gastoEnPeriodoContador);
    const ajustesPeriodo = ajustesReporteFinanciero.filter(ajuste => ajuste.periodo === contadorPeriodoActual);
    const ajustesIngreso = ajustesPeriodo.filter(ajuste => ajuste.tipo === "ingreso").reduce((suma, ajuste) => suma + Number(ajuste.valor || 0), 0);
    const ajustesGasto = ajustesPeriodo.filter(ajuste => ajuste.tipo === "gasto").reduce((suma, ajuste) => suma + Number(ajuste.valor || 0), 0);
    const totalVentas = ventas.reduce((suma, venta) => suma + Number(venta.total || 0), 0) + ajustesIngreso;
    const totalGastos = gastos.reduce((suma, gasto) => suma + Number(gasto.monto || 0), 0) + ajustesGasto;
    const neto = totalVentas - totalGastos;
    const margen = totalVentas ? neto / totalVentas * 100 : 0;
    const gastosCategoria = gastos.reduce((mapa, gasto) => { const categoria = gasto.categoria || CATEGORIA_GASTO_POR_DEFECTO; mapa[categoria] = (mapa[categoria] || 0) + Number(gasto.monto || 0); return mapa; }, {});
    const categoriaTop = Object.entries(gastosCategoria).sort((a, b) => b[1] - a[1])[0];
    const productosPeriodo = ventas.reduce((mapa, venta) => { const nombre = venta.producto || venta.nombre || "Sin producto"; mapa[nombre] = (mapa[nombre] || 0) + Number(venta.cantidad || 0); return mapa; }, {});
    const productoTop = Object.entries(productosPeriodo).sort((a, b) => b[1] - a[1])[0];
    resumen.innerHTML = `<article class="contador-kpi"><span>Total de ventas</span><strong>${formatoDinero(totalVentas)}</strong><small>${ventas.length} operaciones</small></article><article class="contador-kpi"><span>Total de gastos</span><strong>${formatoDinero(totalGastos)}</strong><small>${Object.keys(gastosCategoria).length} categorías</small></article><article class="contador-kpi"><span>Resultado neto</span><strong>${formatoDinero(neto)}</strong><small>Margen ${margen.toFixed(1)}%</small></article><article class="contador-kpi"><span>Producto más vendido</span><strong>${escaparHTML(productoTop?.[0] || "—")}</strong><small>${productoTop ? `${productoTop[1]} unidades` : "Sin ventas"}</small></article>`;
    const filasGastos = Object.entries(gastosCategoria).sort((a, b) => b[1] - a[1]).map(([categoria, monto]) => `<tr><td>Gasto · ${escaparHTML(categoria)}</td><td>${formatoDinero(monto)}</td></tr>`).join("");
    const filasStock = productosGuardados.filter(producto => producto.activo !== false).map(producto => { const vendidas = productosPeriodo[producto.nombre] || 0; const actual = Number(producto.stock || 0); return `<tr><td>${escaparHTML(producto.nombre)}</td><td>Inicio: ${actual + vendidas} · Vendidas: ${vendidas} · Actual: ${actual}</td></tr>`; }).join("");
    const filasAjustes = ajustesPeriodo.map(ajuste => `<tr class="contador-adjustment"><td><select data-ajuste-tipo="${escaparHTML(ajuste.id)}"><option value="ingreso" ${ajuste.tipo === "ingreso" ? "selected" : ""}>Ajuste de ingreso</option><option value="gasto" ${ajuste.tipo === "gasto" ? "selected" : ""}>Ajuste de gasto</option></select><input class="contador-note-input" data-ajuste-nota="${escaparHTML(ajuste.id)}" value="${escaparHTML(ajuste.nota || "")}" placeholder="Nota opcional"></td><td><div class="contador-edit-value"><input inputmode="numeric" data-ajuste-valor="${escaparHTML(ajuste.id)}" value="${Number(ajuste.valor || 0).toLocaleString("es-AR")}"><button type="button" data-eliminar-ajuste="${escaparHTML(ajuste.id)}" aria-label="Eliminar ajuste">×</button></div></td></tr>`).join("");
    tabla.innerHTML = `<table class="contador-table"><thead><tr><th>Concepto</th><th>Valor</th></tr></thead><tbody><tr><td>Ventas (${ventas.length} operaciones)</td><td>${formatoDinero(totalVentas)}</td></tr><tr><td>Gastos totales</td><td>${formatoDinero(totalGastos)}</td></tr><tr><td>Resultado neto</td><td>${formatoDinero(neto)} (${margen.toFixed(1)}%)</td></tr><tr><td>Mayor categoría de gasto</td><td>${escaparHTML(categoriaTop?.[0] || "—")} ${categoriaTop ? `· ${formatoDinero(categoriaTop[1])}` : ""}</td></tr>${filasGastos}${filasStock}${filasAjustes}</tbody></table>`;
    tabla.querySelectorAll("[data-ajuste-valor], [data-ajuste-nota], [data-ajuste-tipo]").forEach(campo => campo.addEventListener("change", () => {
        const id = campo.dataset.ajusteValor || campo.dataset.ajusteNota || campo.dataset.ajusteTipo;
        const ajuste = ajustesReporteFinanciero.find(item => item.id === id);
        if (!ajuste) return;
        if (campo.dataset.ajusteValor) ajuste.valor = numeroDesdeFormato(campo.value);
        if (campo.dataset.ajusteNota) ajuste.nota = campo.value.trim();
        if (campo.dataset.ajusteTipo) ajuste.tipo = campo.value;
        localStorage.setItem("ajustesReporteFinanciero", JSON.stringify(ajustesReporteFinanciero));
        actualizarContadorAutomatico();
    }));
    tabla.querySelectorAll("[data-eliminar-ajuste]").forEach(boton => boton.addEventListener("click", () => { ajustesReporteFinanciero = ajustesReporteFinanciero.filter(item => item.id !== boton.dataset.eliminarAjuste); localStorage.setItem("ajustesReporteFinanciero", JSON.stringify(ajustesReporteFinanciero)); actualizarContadorAutomatico(); }));
    renderizarGraficoContador({ ventas, gastosCategoria, productosPeriodo, totalVentas, totalGastos, neto, margen });
}

function renderizarGraficoContador(datos) {
    const canvas = document.getElementById("contadorChart");
    const titulo = document.getElementById("contadorChartTitle");
    if (!canvas || typeof Chart === "undefined") return;
    const vistas = ["Ventas vs. gastos", "Tendencia de ventas", "Top productos vendidos", "Gastos por categoría"];
    contadorVistaActual = (contadorVistaActual + vistas.length) % vistas.length;
    if (titulo) titulo.textContent = vistas[contadorVistaActual];
    contadorChart?.destroy();
    const base = { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ labels:{ color:"#cbd5e1", boxWidth:12 } } }, scales:{ x:{ ticks:{ color:"#94a3b8" }, grid:{ color:"#1b2635" } }, y:{ ticks:{ color:"#94a3b8" }, grid:{ color:"#1b2635" }, beginAtZero:true } } };
    let configuracion;
    if (contadorVistaActual === 0) configuracion = { type:"doughnut", data:{ labels:["Ventas", "Gastos", "Resultado neto"], datasets:[{ data:[datos.totalVentas, datos.totalGastos, Math.max(0, datos.neto)], backgroundColor:["#2563eb", "#f59e0b", "#22c55e"], borderColor:"#131b26", borderWidth:3 }] }, options:base };
    if (contadorVistaActual === 1) { const tendencia = datos.ventas.reduce((mapa, venta) => { mapa[venta.fecha] = (mapa[venta.fecha] || 0) + Number(venta.total || 0); return mapa; }, {}); configuracion = { type:"line", data:{ labels:Object.keys(tendencia), datasets:[{ label:"Ventas", data:Object.values(tendencia), borderColor:"#2563eb", backgroundColor:"rgba(37,99,235,.18)", fill:true, tension:.35 }] }, options:base }; }
    if (contadorVistaActual === 2) { const productos = Object.entries(datos.productosPeriodo).sort((a,b) => b[1]-a[1]).slice(0,7); configuracion = { type:"bar", data:{ labels:productos.map(item => item[0]), datasets:[{ label:"Unidades", data:productos.map(item => item[1]), backgroundColor:"#60a5fa", borderRadius:6 }] }, options:base }; }
    if (contadorVistaActual === 3) { const categorias = Object.entries(datos.gastosCategoria).sort((a,b) => b[1]-a[1]); configuracion = { type:"doughnut", data:{ labels:categorias.map(item => item[0]), datasets:[{ data:categorias.map(item => item[1]), backgroundColor:["#f59e0b", "#fb7185", "#a78bfa", "#38bdf8", "#4ade80", "#f97316"], borderColor:"#131b26", borderWidth:3 }] }, options:base }; }
    contadorChart = new Chart(canvas, configuracion);
    const texto = document.getElementById("contadorDistribucion");
    if (texto) texto.textContent = contadorVistaActual === 0 ? (datos.totalVentas ? `Los gastos consumen ${(datos.totalGastos / datos.totalVentas * 100).toFixed(1)}% de las ventas. Margen neto: ${datos.margen.toFixed(1)}%.` : "Registrá ventas para analizar el período.") : `Vista ${contadorVistaActual + 1} de ${vistas.length}. Usá las flechas para explorar los indicadores.`;
}

function exportarReporteContador() {
    const ventas = ventasGuardadas.filter(ventaEnPeriodoContador);
    const gastos = gastosGuardados.filter(gastoEnPeriodoContador);
    const totalVentas = ventas.reduce((suma, venta) => suma + Number(venta.total || 0), 0);
    const totalGastos = gastos.reduce((suma, gasto) => suma + Number(gasto.monto || 0), 0);
    const vendidos = ventas.reduce((mapa, venta) => { const nombre = venta.producto || venta.nombre || "Sin producto"; mapa[nombre] = (mapa[nombre] || 0) + Number(venta.cantidad || 0); return mapa; }, {});
    const gastosCategoria = gastos.reduce((mapa, gasto) => { const categoria = gasto.categoria || CATEGORIA_GASTO_POR_DEFECTO; mapa[categoria] = (mapa[categoria] || 0) + Number(gasto.monto || 0); return mapa; }, {});
    const filas = [["REPORTE FINANCIERO LUIV", contadorPeriodoActual], ["RESUMEN", ""], ["Total de ventas", totalVentas], ["Operaciones", ventas.length], ["Total de gastos", totalGastos], ["Resultado neto", totalVentas - totalGastos], ["Margen neto", totalVentas ? `${((totalVentas - totalGastos) / totalVentas * 100).toFixed(1)}%` : "0%"], ["GASTOS POR CATEGORÍA", ""], ...Object.entries(gastosCategoria), ["INVENTARIO", "Stock inicial estimado / Vendidas / Actual"], ...productosGuardados.filter(producto => producto.activo !== false).map(producto => { const actual = Number(producto.stock || 0); const vendidasProducto = vendidos[producto.nombre] || 0; return [producto.nombre, `${actual + vendidasProducto} / ${vendidasProducto} / ${actual}`]; })];
    const csv = "\uFEFF" + filas.map(fila => fila.map(valor => `"${String(valor).replaceAll('"', '""')}"`).join(";")).join("\n");
    const enlace = document.createElement("a"); enlace.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); enlace.download = `reporte-luiv-${contadorPeriodoActual}.csv`; enlace.click(); URL.revokeObjectURL(enlace.href);
}

activarMascarasMonetarias();
document.querySelectorAll(".contador-filter").forEach(boton => boton.addEventListener("click", () => { contadorPeriodoActual = boton.dataset.contadorPeriod; document.querySelectorAll(".contador-filter").forEach(item => item.classList.toggle("active", item === boton)); actualizarContadorAutomatico(); }));
document.getElementById("exportarReporteContador")?.addEventListener("click", exportarReporteContador);
document.getElementById("agregarAjusteReporte")?.addEventListener("click", () => { ajustesReporteFinanciero.push({ id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, periodo:contadorPeriodoActual, tipo:"gasto", valor:0, nota:"" }); localStorage.setItem("ajustesReporteFinanciero", JSON.stringify(ajustesReporteFinanciero)); actualizarContadorAutomatico(); });
document.getElementById("contadorChartPrev")?.addEventListener("click", () => { contadorVistaActual -= 1; actualizarContadorAutomatico(); });
document.getElementById("contadorChartNext")?.addEventListener("click", () => { contadorVistaActual += 1; actualizarContadorAutomatico(); });
document.getElementById("cerrarTicketVenta")?.addEventListener("click", cerrarTicketVenta);
document.getElementById("imprimirTicketVenta")?.addEventListener("click", () => window.print());
document.getElementById("ticketVentaModal")?.addEventListener("click", evento => { if (evento.target.id === "ticketVentaModal") cerrarTicketVenta(); });

actualizarTodo();
