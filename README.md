# algorithms-visualization-backend

## Formato de los algoritmos

Cada algoritmo de ordenamiento recibe un arreglo de números y devuelve el arreglo ordenado, la lista de **pasos** que el frontend reproduce como animación y las **métricas** para la comparación. Los tipos están en [`src/algorithms/algorithm.types.ts`](src/algorithms/algorithm.types.ts) y el motor en [`src/algorithms/algorithm.tracer.ts`](src/algorithms/algorithm.tracer.ts).

### Entrada

- Un arreglo de números finitos (`NaN` e `Infinity` no se aceptan).
- Máximo **50 elementos** (`MAX_INPUT_LENGTH`), para que las respuestas no rebasen el límite de tamaño de Vercel.
- Si la entrada no es válida, `validateInput` lanza `TypeError` o `RangeError`.

### Pasos

Cada paso describe **solo lo que cambia**. El frontend parte de `input` y aplica `swap` y `write` en orden para reconstruir el arreglo en cualquier momento. `line` es el índice de la línea de `pseudocode` que se está ejecutando, para resaltarla.

| Tipo | Datos | Significado | Lo usan |
|---|---|---|---|
| `compare` | `indices: [i, j]`, `line` | Se comparan las posiciones `i` y `j` | Todos |
| `swap` | `indices: [i, j]`, `line` | Se intercambian `i` y `j` | Todos menos Merge |
| `write` | `index`, `value`, `line` | Se escribe `value` en `index` | Merge |
| `pivot` | `index`, `line` | Pivote actual | Quick |
| `range` | `start`, `end`, `line` | Subarreglo activo | Merge, Quick |
| `sorted` | `indices` | Posiciones ya en su lugar final | Todos (al final, automático) |

### Resultado

Ejemplo real de Insertion Sort con `[3, 1, 2]`:

```json
{
  "algorithm": "insertion-sort",
  "input": [3, 1, 2],
  "output": [1, 2, 3],
  "steps": [
    { "type": "compare", "indices": [0, 1], "line": 2 },
    { "type": "swap", "indices": [0, 1], "line": 3 },
    { "type": "compare", "indices": [1, 2], "line": 2 },
    { "type": "swap", "indices": [1, 2], "line": 3 },
    { "type": "compare", "indices": [0, 1], "line": 2 },
    { "type": "sorted", "indices": [0, 1, 2] }
  ],
  "metrics": {
    "comparisons": 3,
    "swaps": 2,
    "writes": 0,
    "steps": 6,
    "executionTimeMs": 0.0026
  }
}
```

Además, cada algoritmo tiene una ficha `AlgorithmInfo` con `id`, `name`, `complexity` (`best`, `average`, `worst`), `description` y `pseudocode`.

### Cómo se escribe un algoritmo

Cada algoritmo es un archivo `src/algorithms/<id>.ts` que exporta un objeto `AlgorithmDefinition` con su ficha (`info`) y una función `sort(t)`. El algoritmo no modifica el arreglo directamente: usa el tracer `t`, que hace la operación, la registra como paso y la cuenta en las métricas.

```ts
export const insertionSort: AlgorithmDefinition = {
  info: {
    id: "insertion-sort",
    name: "Insertion Sort",
    complexity: { best: "O(n)", average: "O(n²)", worst: "O(n²)" },
    description: "Inserción en la parte ya ordenada",
    pseudocode: [
      "for i = 1 to n-1",
      "  j = i",
      "  while j > 0 and A[j-1] > A[j]",
      "    swap(A[j-1], A[j])",
      "    j = j - 1",
    ],
  },
  sort(t) {
    for (let i = 1; i < t.length; i++)
      for (let j = i; j > 0 && t.compare(j - 1, j, 2) > 0; j--)
        t.swap(j - 1, j, 3);
  },
};
```

| Operación | Método del tracer |
|---|---|
| Comparar dos posiciones | `t.compare(i, j, line)`: devuelve `< 0`, `0` o `> 0` |
| Comparar valores fuera del arreglo (Merge) | `t.compareValues(a, b, [i, j], line)` |
| Intercambiar | `t.swap(i, j, line)` |
| Escribir un valor | `t.write(i, value, line)` |
| Leer sin comparar | `t.array[i]` |
| Avisos para la animación | `t.pivot(i, line)`, `t.range(start, end, line)`, `t.sorted(indices)` |

### Ejecución y métricas

`runAlgorithm(definition, input)` valida la entrada y ejecuta el algoritmo dos veces sobre copias de `input`:

1. Con `RecordingTracer`: obtiene los pasos, los contadores y el arreglo ordenado.
2. Con `CountingTracer`: no guarda pasos y mide el tiempo con `performance.now()`.

| Métrica | Dónde se calcula |
|---|---|
| `comparisons` | `CountingTracer.compareValues` |
| `swaps` | `CountingTracer.swap` |
| `writes` | `CountingTracer.write` |
| `steps` | Tamaño de la lista de pasos |
| `executionTimeMs` | `runAlgorithm`, en la segunda ejecución |

### Servicio para las rutas

`AlgorithmsModule` ([`src/algorithms/algorithms.module.ts`](src/algorithms/algorithms.module.ts)) exporta `AlgorithmsService`, que es lo que deben usar los controladores. Convierte los errores de entrada en respuestas HTTP:

| Método | Uso sugerido | Errores |
|---|---|---|
| `findAll()` | `GET /algorithms`: lista de `AlgorithmInfo` | — |
| `findOne(id)` | `GET /algorithms/:id`: ficha de un algoritmo | 404 si el id no existe |
| `run(id, input)` | `POST /algorithms/:id/run` con `{ "input": number[] }` | 404 si el id no existe, 400 si la entrada es inválida |
| `compare(ids, input)` | `POST /algorithms/compare` con `{ "algorithms": string[], "input": number[] }` | 400 con menos de dos ids o ids repetidos, 404 si algún id no existe, 400 si la entrada es inválida |

Los algoritmos disponibles se registran en [`src/algorithms/algorithms.registry.ts`](src/algorithms/algorithms.registry.ts). Para agregar uno nuevo, se crea su archivo y se añade a `ALGORITHM_DEFINITIONS`; las pruebas de `algorithms.spec.ts` lo cubren automáticamente.

### Pruebas

```bash
pnpm test
```
