### PRUEBA UNITARIA: BiblioChile — Backend

### CÓDIGO EC: EC-PU-001
### Caso de uso / Historia de usuario a probar

| Código EC  | Caso de Uso                          |
|------------|---------------------------------------|
| EC-CU-001  | Iniciar sesión (login de usuario)     |

**Archivo bajo prueba:** `src/services/auth.service.js` (función `login`)
**Archivo de test:** `tests/unit/auth.service.test.js`
**Schema de validación:** `src/schemas/auth.schema.js` (`loginSchema`)

---

### Objetivo general de la prueba

Verificar la lógica del caso de uso **Iniciar sesión**, comprobando que el sistema:

- Autentique correctamente con credenciales válidas y devuelva un token JWT.
- Rechace el login cuando la contraseña es incorrecta o el usuario no existe.
- Valide que `email` y `password` sean obligatorios antes de llegar a la lógica de negocio.

---

### Pasos de la prueba

| ID | Descripción |
|----|-------------|
| 1  | Invocar `login({ email, password })` con los datos del escenario. |
| 2  | Mockear `prisma.user.findUnique`, `bcrypt.compare` y `jwt.sign` según el escenario. |
| 3  | Verificar el resultado devuelto o el error lanzado. |
| 4  | Confirmar si el token fue generado o si el login fue rechazado. |
| 5  | Registrar el resultado obtenido y compararlo con el resultado esperado. |

---

### Evaluación de escenarios

#### Escenario 1: Mejor caso

| Campo    | Dato                       |
|----------|-----------------------------|
| email    | juan.perez@email.cl        |
| password | password123 (correcta)     |

**Salida esperada**
- Se devuelve un objeto `{ token, user }`.
- `user` contiene `id`, `name`, `email`, `role` (sin el hash de la contraseña).
- No se lanza ninguna excepción.

#### Escenario 2: Caso inválido

| Campo    | Dato                              |
|----------|-------------------------------------|
| email    | juan.perez@email.cl (usuario existe) |
| password | clave-incorrecta                   |

**Salida esperada**
- El sistema rechaza el login.
- Se lanza el error `"Credenciales inválidas"`.
- No se genera token (`jwt.sign` no es invocado).

Variante 2b: email de un usuario inexistente → mismo error `"Credenciales inválidas"` (por diseño, no se distingue "usuario no existe" de "password incorrecta", para no filtrar qué emails están registrados).

#### Escenario 3: Campos vacíos

| Campo    | Dato     |
|----------|----------|
| email    | (vacío)  |
| password | (vacío)  |

**Salida esperada**
- `loginSchema.safeParse()` retorna `success: false`.
- Los errores incluyen los campos `email` y `password`.
- Esta validación ocurre en la capa de middleware (`validate(loginSchema)`), antes de llegar al servicio — por eso se prueba contra el schema directamente y no contra `login()`.

---

### Resultado obtenido

✅ **PASS** — los 4 tests del archivo (incluida la variante 2b) pasaron en la ejecución de `npx vitest run` del 2026-08-05.
