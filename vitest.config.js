import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Los tests de integración llaman a APIs externas reales (Gutendex) y a
    // Postgres real. Bajo ejecución en paralelo (comportamiento por defecto
    // de Vitest), esas llamadas pueden tardar más que el timeout por
    // defecto de 5000ms y fallar de forma intermitente sin ser un bug real.
    testTimeout: 15000,
  },
});
