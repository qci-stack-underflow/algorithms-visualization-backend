# Especificación del Formato Huffman y Endpoints de la API

Este documento contiene la especificación oficial técnica acordada para el servicio de compresión mediante el **Algoritmo de Huffman** y el formato binario propietario **`.suf` (SUF1)** en el backend de visualización de algoritmos.

---

## 1. Convenciones y Reglas del Algoritmo

Para garantizar total sincronía y determinismo entre la lógica del backend, el archivo binario generado y las animaciones visuales en el frontend, se establecen las siguientes reglas invariantes:

### 1.1. Normalización del Texto
1. **Delimitadores de Project Gutenberg**: Se descartan el encabezado y el pie de licencia oficial comprendidos entre `*** START OF` y `*** END OF`.
2. **Eliminación de BOM**: Si el texto de entrada contiene el marcador Byte Order Mark (`\uFEFF`), se elimina al inicio.
3. **Normalización de Saltos de Línea**: Todos los saltos de línea estilo Windows (`\r\n`) se transforman de manera uniforme al estándar Unix (`\n`).

### 1.2. Conteo de Símbolos
- Se recorre la cadena normalizada por **punto de código Unicode** (e.g. `for...of` en JavaScript/TypeScript), asegurando que caracteres con tildes (`á`, `é`), caracteres especiales (`ñ`, `¿`), y emojis sean contabilizados como un único símbolo independiente.
- Las hojas iniciales del árbol se ordenan según su **primera aparición** en el texto original (asumiendo IDs `0` a `k - 1` para $k$ símbolos distintos).

### 1.3. Regla de Desempate en la Cola de Prioridad (Min-Heap)
Al extraer o comparar nodos en la cola de prioridad:
1. **Menor peso (frecuencia acumulada)**: El nodo con menor valor numérico tiene prioridad estricta.
2. **Menor `id` (orden de creación / primera aparición)**: Si dos nodos tienen idéntica frecuencia acumulada, tiene prioridad el que tenga menor `id`.
3. **Asignación de Ramas**:
   - El **primer nodo extraído** (`x = extraerMin(Q)`) se asigna como **hijo izquierdo**, correspondiendo a la arista de bit `'0'`.
   - El **segundo nodo extraído** (`y = extraerMin(Q)`) se asigna como **hijo derecho**, correspondiendo a la arista de bit `'1'`.
4. **Caso Degenerado (1 solo símbolo)**: Si el texto completo se compone de un único símbolo repetido, se le asigna el código `"0"`.

### 1.4. Pseudocódigo Oficial (9 Líneas)
El algoritmo y el generador de pasos animables (`HuffmanTracer`) siguen el pseudocódigo expuesto en el visualizador (`huffman.html`):

```text
1: contar las apariciones de cada símbolo
2: Q = cola de prioridad con una hoja por símbolo
3: mientras Q tenga más de un nodo
4:   x = extraerMin(Q)
5:   y = extraerMin(Q)
6:   z = nodo(peso = x.peso + y.peso, izq = x, der = y)
7:   insertar(Q, z)
8: raíz = extraerMin(Q)
9: asignar 0 a cada rama izquierda y 1 a cada derecha
```

---

## 2. Especificación de Endpoints REST

Todos los endpoints están agrupados bajo el prefijo `/huffman`.

```mermaid
flowchart TD
    Client(["Cliente (Frontend / App)"])
    
    subgraph Catálogo y Búsqueda
        E1["GET /huffman/books<br/>(Catálogo predeterminado)"]
        E2["GET /huffman/books/search?q={query}<br/>(RapidAPI Gutenberg)"]
    end

    subgraph Procesamiento de Libros
        E3["GET /huffman/books/:id<br/>(Análisis y pasos JSON)"]
        E4["GET /huffman/books/:id/file<br/>(Descarga .suf directo)"]
    end

    subgraph Archivos Locales
        E5["POST /huffman/compress/file?metadata={true|false}<br/>(Subida multipart .txt -> .suf con/sin JSON)"]
        E6["POST /huffman/decompress/file?metadata={true|false}<br/>(Subida multipart .suf -> descarga .txt)"]
    end

    Client --> E1
    Client --> E2
    Client --> E3
    Client --> E4
    Client --> E5
    Client --> E6
```

---

### 2.1. `GET /huffman/books`
Retorna la lista de libros predeterminados acordados en el catálogo local.

- **Método**: `GET`
- **Ruta**: `/huffman/books`
- **Respuestas**:
  - `200 OK`: Lista de libros disponibles en catálogo (`BookInfo[]`).

#### Ejemplo de Respuesta:
```json
[
  {
    "id": 2000,
    "title": "Don Quijote",
    "author": "Miguel de Cervantes Saavedra",
    "language": "Español",
    "size": "2.2 MB",
    "bytes": 2168320
  },
  {
    "id": 1342,
    "title": "Pride and Prejudice",
    "author": "Jane Austen",
    "language": "Inglés",
    "size": "772 KB",
    "bytes": 772412
  }
]
```

---

### 2.2. `GET /huffman/books/search`
Permite a los usuarios buscar obras literarias en Project Gutenberg mediante la API de RapidAPI (`project-gutenberg-free-books-api1`). Los resultados se transforman internamente para entregar una lista limpia de libros que reutiliza la interfaz `BookInfo`.

- **Método**: `GET`
- **Ruta**: `/huffman/books/search`
- **Query Params**:
  - `q` (string, obligatorio): Término de búsqueda (ej. `grimms fairy tales`, `cervantes`).
- **Comportamiento**:
  - Consulta RapidAPI con la clave configurada en las variables de entorno.
  - Filtra y transforma las entradas devueltas descartando metadatos irrelevantes.
  - Conserva únicamente títulos que cuenten con versión de texto plano UTF-8 (`text/plain; charset=utf-8` o `text/plain`).
  - Conserva solo los libros en cuyo título o autor cada palabra buscada es el inicio de una palabra, sin distinguir acentos ni mayúsculas ("el" encuentra "El sombrero de tres picos", pero no "Shelley"). RapidAPI devuelve los mismos 32 libros populares para cualquier consulta (#62), así que sin este filtro `q=zzzzqq` daba 32 resultados.
  - Los libros del catálogo que coinciden van primero, porque funcionan aunque Gutenberg no responda. Si RapidAPI falla y hay coincidencias en el catálogo, se responden esas en lugar del error.
- **Respuestas**:
  - `200 OK`: Objeto con el resultado de búsqueda (`{ result: BookInfo[] }`), que puede estar vacío.
  - `400 Bad Request`: Si el parámetro `q` está ausente o vacío.
  - `502 Bad Gateway`: Si el servicio de RapidAPI no responde o falla y ningún libro del catálogo coincide.

#### Ejemplo de Respuesta:
```json
{
  "result": [
    {
      "type": "gutenberg",
      "id": 2591,
      "title": "Grimms' Fairy Tales",
      "author": "Jacob Grimm, Wilhelm Grimm",
      "language": "Inglés",
      "size": "580 KB"
    },
    {
      "type": "gutenberg",
      "id": 52521,
      "title": "Grimm's Fairy Tales",
      "author": "Jacob Grimm, Wilhelm Grimm",
      "language": "Inglés",
      "size": "620 KB"
    }
  ]
}
```

---

### 2.3. `GET /huffman/books/:id`
Descarga el libro correspondiente desde Project Gutenberg, aplica el algoritmo de Huffman y genera tanto el árbol como los pasos de animación y métricas analíticas.

- **Método**: `GET`
- **Ruta**: `/huffman/books/:id`
- **Parámetros**:
  - `id` (entero, obligatorio): ID numérico del libro en Project Gutenberg (ej. `2000`). Puede ser cualquier libro de Gutenberg, no solo los del catálogo (es lo que usa el campo de enlace del frontend); en ese caso el título, el autor y el idioma salen de la cabecera del propio texto (`Title:`, `Author:`, `Language:`).
- **Respaldo local**: Don Quijote (`2000`), Frankenstein (`84`) y Los pazos de Ulloa (`18005`) tienen el libro completo en `assets/catalog-backup/`. Si Gutenberg falla por cualquier motivo (no responde, tarda más de 10 s o contesta `503`, lo que pasa seguido desde Vercel), se comprimen desde esa copia. Los demás libros solo se descargan en línea. Una prueba exige que cada copia sea el libro completo, con las marcas `START` y `END` y del mismo tamaño que anuncia el catálogo.
- **Límites y Restricciones**:
  - Tamaño máximo de descarga: **4.5 MB**.
  - Si el libro supera los 4.5 MB, la petición es abortada inmediatamente con error `413 Payload Too Large`.
  - Timeout de descarga de Gutenberg: **10 segundos**.
  - Una respuesta de Gutenberg con `Content-Type: text/html` (página de aviso o bloqueo) no se toma como el libro.
- **Respuestas**:
  - `200 OK`: Objeto de respuesta completo (`HuffmanResult`).
  - `400 Bad Request`: Si el `id` no es un número entero válido.
  - `404 Not Found`: Si el libro no existe en Project Gutenberg.
  - `413 Payload Too Large`: Si el archivo excede los 4.5 MB.
  - `502 Bad Gateway`: Si Gutenberg no está disponible y el libro no tiene respaldo local.
  - `504 Gateway Timeout`: Si la descarga supera los 10 segundos y el libro no tiene respaldo local.

#### Estructura de Respuesta (`HuffmanResult` para libro Gutenberg):
```json
{
  "source": {
    "type": "gutenberg",
    "id": 2000,
    "title": "Don Quijote",
    "author": "Miguel de Cervantes Saavedra",
    "language": "Español",
    "size": "2.2 MB",
    "bytes": 2168320
  },
  "book": {
    "type": "gutenberg",
    "id": 2000,
    "title": "Don Quijote",
    "author": "Miguel de Cervantes Saavedra",
    "language": "Español",
    "size": "2.2 MB",
    "bytes": 2168320
  },
  "totalCharacters": 2110737,
  "distinctSymbols": 92,
  "rootId": 182,
  "nodes": [
    { "id": 0, "weight": 37681, "symbol": "\n", "left": null, "right": null, "parentId": 163, "isLeaf": true, "code": "101110" }
  ],
  "steps": [
    { "type": "extract-min", "nodeId": 32, "line": 4, "description": "Extraer nodo 32 con peso 1" }
  ],
  "table": [
    { "symbol": " ", "frequency": 354706, "percentage": 16.8, "code": "111", "bits": 3, "nodeId": 3 }
  ],
  "codes": {
    " ": "111",
    "e": "010"
  },
  "metrics": {
    "originalBytes": 2168320,
    "compressedBytes": 1165190,
    "fileSizeBytes": 1166923,
    "headerBytes": 1733,
    "savingsPercentage": 46.2,
    "totalBits": 9321515,
    "paddingBits": 5,
    "bitsPerSymbol": 4.42,
    "entropy": 4.38,
    "fixedBits": 16885896,
    "comparisons": 1905,
    "merges": 91,
    "steps": 274,
    "executionTimeMs": 358.36
  },
  "preview": {
    "text": "En un lugar de la Mancha",
    "tokens": [
      { "char": "E", "code": "11010010111" },
      { "char": "n", "code": "0110" }
    ],
    "encodedBits": "110100101110110..."
  }
}
```

> [!NOTE]
> `HuffmanResult` modela el origen mediante la **unión discriminada** `source: GutenbergSourceInfo | UserFileSourceInfo`. Cuando el archivo proviene de una subida de usuario (`POST /huffman/compress/file`), `source.type` es `'upload'`, conteniendo `{ filename, title, size, bytes, mimeType }` sin forzar atributos inexistentes de libros. Se conserva además el campo `book` como alias hacia `source` para retrocompatibilidad con clientes que esperen libros de Gutenberg.

---

### 2.4. `GET /huffman/books/:id/file`
Genera y transmite de forma directa el archivo binario empaquetado en formato `.suf`.

- **Método**: `GET`
- **Ruta**: `/huffman/books/:id/file`
- **Cabeceras de Respuesta**:
  - `Content-Type: application/octet-stream`
  - `Content-Disposition: attachment; filename="<id-o-titulo>.suf"`
- **Respuestas**:
  - `200 OK`: Stream binario con la cabecera `SUF1` y los datos comprimidos.
  - `404 Not Found`: Si el libro solicitado no existe.

---

### 2.5. `POST /huffman/compress/file`
Permite a los usuarios subir un archivo de texto plano propio (`.txt`) mediante `multipart/form-data` (preservando el texto crudo sin limpieza para garantizar una compresión y descompresión sin pérdida byte a byte).

Conforme a la decisión de arquitectura adoptada en el Issue #53, cuando `metadata=true` (comportamiento por defecto) la respuesta se transmite de forma síncrona en un **único stream binario combinado con `Content-Type: application/octet-stream`**. Cuando `metadata=false`, se devuelve únicamente el binario `.suf` puro (`SUF1`) sin prefijo JSON.

- **Método**: `POST`
- **Ruta**: `/huffman/compress/file`
- **Query Params**:
  - `metadata` (boolean opcional, por defecto `true`):
    - `true`: Devuelve `[uint32 BE longitud][JSON HuffmanResult][binario .suf]`.
    - `false`: Devuelve únicamente el archivo binario `.suf` (`SUF1`) sin JSON adjunto.
- **Content-Type de Petición**: `multipart/form-data`
- **Parámetros Form-Data**:
  - `file` (archivo texto, obligatorio): Archivo de texto plano `.txt`.
  - `title` (string, opcional): Título personalizado del texto (por defecto toma el nombre del archivo).
- **Validaciones**:
  - Solo se aceptan archivos de tipo texto (`text/plain` o extensión `.txt`).
  - Tamaño máximo permitido: **4 MB** (`MAX_UPLOAD_FILE_SIZE_BYTES`), previendo el límite de 4.5 MB del cuerpo en Vercel.
- **Cabeceras de Respuesta**:
  - `Content-Type: application/octet-stream`
  - `Content-Disposition: attachment; filename="<nombre>.suf"`
- **Estructura del Binario de Respuesta Combinada (`metadata=true`)**:
  ```
  +--------------------------------------------------------------------------+
  | Longitud del JSON: uint32 BE (4 bytes)                                   |
  +--------------------------------------------------------------------------+
  | JSON HuffmanResult: Codificado en UTF-8 (longitud indicada previamente)  |
  +--------------------------------------------------------------------------+
  | Archivo binario .suf completo: Iniciando con magic bytes "SUF1"          |
  +--------------------------------------------------------------------------+
  ```
- **Respuestas de Error (formato JSON estándar con `message` y `statusCode`)**:
  - `400 Bad Request`: Si no se adjuntó ningún archivo, no es un `.txt` válido, está vacío o `metadata` no es `"true"`/`"false"`.
  - `413 Payload Too Large`: Si el archivo o la respuesta supera el límite permitido (4 MB / 4.5 MB).

---

### 2.6. `POST /huffman/decompress/file`
Permite subir un archivo comprimido `.suf` mediante `multipart/form-data` y descargar el archivo de texto plano `.txt` reconstruido sin pérdida.

- **Método**: `POST`
- **Ruta**: `/huffman/decompress/file`
- **Query Params**:
  - `metadata` (boolean opcional, por defecto `false`):
    - `false`: Asume un archivo `.suf` puro que comienza con los magic bytes `"SUF1"` (sin JSON adjunto).
    - `true`: Asume el formato combinado `[uint32 BE longitud][JSON][binario .suf]`, descarta el bloque JSON y descomprime la sección `.suf`.
- **Content-Type de Petición**: `multipart/form-data`
- **Parámetros Form-Data**:
  - `file` (archivo binario `.suf`, obligatorio): Archivo comprimido en formato `.suf`.
- **Cabeceras de Respuesta**:
  - `Content-Type: text/plain; charset=utf-8`
  - `Content-Disposition: attachment; filename="<nombre>.txt"`
- **Respuestas**:
  - `200 OK`: Descarga directa del texto plano descomprimido en UTF-8.
  - `400 Bad Request`: Si no se adjuntó archivo, no tiene extensión `.suf`, el formato `SUF1`/JSON es inválido o está corrupto, o `metadata` no es `"true"`/`"false"`.
  - `413 Payload Too Large`: Si el archivo supera los 4 MB o el texto descomprimido excede los 4.5 MB de Vercel.
- **Protección contra archivos alterados**: antes de decodificar se comprueba con la cabecera que el número de caracteres declarado no supere el límite de 4.5 MB ni los bits disponibles, que las frecuencias sumen ese número y que los códigos sean prefijo. Sin esas revisiones, un `.suf` de 4 MB con un solo símbolo de código `0` declara 33 millones de caracteres y agota la memoria de la función. La decodificación recorre el árbol bit a bit, sin construir la cadena de bits completa.

---

## 3. Formato Binario Propietario `.suf` (SUF1)

El archivo `.suf` consta de dos secciones: **Encabezado (Header con Diccionario)** y **Cuerpo (Compressed Bitstream)**.

```
+-----------------------------------------------------------------------+
|                             ENCABEZADO                                |
|  - Magic: "SUF1" (4 bytes)                                            |
|  - Caracteres originales: uint32 BE (4 bytes)                         |
|  - Bits de relleno (padding): uint8 (1 byte)                          |
|  - Símbolos distintos (k): uint16 BE (2 bytes)                         |
|  - Longitud del título: uint16 BE (2 bytes)                           |
|  - Título: UTF-8 (longitud variable)                                  |
|  - Diccionario de k símbolos:                                         |
|      * Longitud símbolo UTF-8: uint8 (1 byte)                         |
|      * Símbolo en UTF-8 (1 a 4 bytes)                                 |
|      * Frecuencia absoluta: uint32 BE (4 bytes)                       |
|      * Longitud del código: uint8 (1 byte)                            |
|      * Código Huffman en ASCII: (codeLength bytes)                    |
+-----------------------------------------------------------------------+
|                           CUERPO DE DATOS                             |
|  - Secuencia de bits empaquetada en bytes MSB a LSB                   |
|  - Último byte rellenado con 'paddingBits' ceros a la derecha         |
+-----------------------------------------------------------------------+
```

### 3.1. Detalle Campo por Campo

| Campo | Tipo / Tamaño | Descripción |
| :--- | :--- | :--- |
| **Magic Bytes** | 4 bytes ASCII | Debe ser exactamente `"SUF1"`. Identifica inequívocamente el formato. |
| **Original Characters** | 4 bytes (`uint32` Big-Endian) | Total de caracteres procesados en el texto original. |
| **Padding Bits** | 1 byte (`uint8`: `0..7`) | Cantidad de bits añadidos al último byte del cuerpo para completar un octeto. |
| **Distinct Symbols ($k$)** | 2 bytes (`uint16` Big-Endian) | Cantidad de símbolos únicos presentes en el diccionario ($k \ge 1$). |
| **Title Length** | 2 bytes (`uint16` Big-Endian) | Longitud en bytes de la cadena del título codificada en UTF-8. |
| **Title** | Variable | Título de la obra o archivo en UTF-8. |

#### Entrada de Diccionario (repetida $k$ veces):
Para cada uno de los $k$ símbolos:
1. `symbolBytesLength`: 1 byte (`uint8`), longitud en bytes del símbolo UTF-8 (entre 1 y 4 bytes).
2. `symbolBytes`: De 1 a 4 bytes con la codificación UTF-8 del símbolo.
3. `frequency`: 4 bytes (`uint32` Big-Endian), cantidad de apariciones del símbolo en el texto.
4. `codeLength`: 1 byte (`uint8`), cantidad de bits que forman el código binario de Huffman.
5. `codeAscii`: `codeLength` bytes con los caracteres ASCII `'0'` y `'1'` que forman el código.

### 3.2. Cuerpo de Datos Comprimidos
- Los bits resultantes de sustituir cada símbolo del texto original por su código de Huffman se concatenan en orden.
- Se agrupan de **8 en 8 bits** con convención **MSB first** (Most Significant Bit al bit 7 del byte):
  - Ejemplo: Si el código inicia con `10110000`, el primer byte generado es `0xB0`.
- Si el número total de bits no es múltiplo de 8, los bits sobrantes se colocan en los bits más significativos del último byte y los bits restantes (indicados en `paddingBits`) se rellenan con ceros `0`.

---

## 4. Límites y Restricciones de Infraestructura

1. **Límite de Vercel Serverless Function**:
   - Vercel impone un límite estricto de **4.5 MB** en el cuerpo de las respuestas HTTP.
   - El payload JSON (`HuffmanResult`) se mantiene optimizado; para libros grandes, el binario `.suf` se descarga siempre mediante streaming/archivos independientes (`application/octet-stream`) para evitar serializaciones pesadas en Base64 dentro del JSON.
2. **Límite de Tamaño de Entrada**:
   - Tamaño máximo para libros de Gutenberg y archivos `.txt` subidos: **6 MB** (`MAX_BOOK_SIZE_BYTES`).
3. **Seguridad contra SSRF**:
   - El cliente de Project Gutenberg (`gutenberg.client.ts`) únicamente recibe el identificador numérico entero del libro y construye internamente la URL segura `https://www.gutenberg.org/cache/epub/{id}/pg{id}.txt`. No se aceptan URLs arbitrarias enviadas por el usuario.
