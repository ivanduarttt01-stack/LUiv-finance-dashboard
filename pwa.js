/* Registro aislado de la PWA. No modifica los datos ni la lógica de la app. */
if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("service-worker.js").catch(error => {
            console.warn("No se pudo registrar el modo sin conexión de LUiv.", error);
        });
    });
}
