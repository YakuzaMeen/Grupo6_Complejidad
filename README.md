# EcoRegula All-in-One: Sistema de Monitoreo y Simulación Ambiental

¡Bienvenido al repositorio de EcoRegula All-in-One! Este proyecto es un sistema integral para el monitoreo, análisis y simulación del impacto ambiental en nodos geográficos, centrándose en la calidad del aire y la optimización de rutas. Desarrollado como parte del Grupo 6 para el curso de Complejidad Algorítmica.

## Tabla de Contenidos

1.  [Descripción General del Proyecto](#1-descripción-general-del-proyecto)
2.  [Módulos Implementados](#2-módulos-implementados)
    * [Módulo 1: Carga y Visualización de Grafo](#módulo-1-carga-y-visualización-de-grafo)
    * [Módulo 2: Cálculo del Árbol de Expansión Mínima (MST)](#módulo-2-cálculo-del-árbol-de-expansión-mínima-mst)
    * [Módulo 3: Planificación de Rutas Óptimas](#módulo-3-planificación-de-rutas-óptimas)
    * [Módulo 4: Análisis Ambiental y Recomendaciones](#módulo-4-análisis-ambiental-y-recomendaciones)
    * [Módulo 5: Simulador de Impacto Local](#módulo-5-simulador-de-impacto-local)
    * [Módulo 6: Alertas Inteligentes](#módulo-6-alertas-inteligentes)
3.  [Estructura del Proyecto](#3-estructura-del-proyecto)
4.  [Configuración del Entorno Local](#4-configuración-del-entorno-local)
    * [Prerrequisitos](#prerrequisitos)
    * [Instalación de Dependencias](#instalación-de-dependencias)
    * [Configuración de la Base de Datos (Firestore)](#configuración-de-la-base-de-datos-firestore)
    * [Ejecutar la Aplicación](#ejecutar-la-aplicación)
5.  [Uso de la Aplicación](#5-uso-de-la-aplicación)
6.  [Contribuciones](#6-contribuciones)
7.  [Contacto](#7-contacto)

---

## 1. Descripción General del Proyecto

EcoRegula All-in-One es una aplicación web que permite visualizar un grafo de nodos geográficos (representando ubicaciones o intersecciones) y sus conexiones (tramos). Cada nodo contiene información ambiental (niveles de CO₂, CH₄, NOx). La aplicación ofrece herramientas para analizar la calidad del aire, simular el impacto de medidas de mitigación y optimizar rutas, todo ello con una interfaz interactiva y responsive.

## 2. Módulos Implementados

### Módulo 1: Carga y Visualización de Grafo

* **Funcionalidad:** Carga un grafo desde el backend (Flask) que contiene nodos con coordenadas geográficas y niveles de gases, y aristas que representan conexiones.
* **Visualización:** Los nodos se renderizan en un mapa interactivo de Leaflet. El color de cada nodo indica su nivel de contaminación general (verde: bajo, amarillo: moderado, rojo: alto).
* **Interacción:** Al hacer clic en un nodo, se muestra información detallada en un panel lateral.

### Módulo 2: Cálculo del Árbol de Expansión Mínima (MST)

* **Funcionalidad:** Calcula el peso total del Árbol de Expansión Mínima (MST) del grafo cargado. El MST es útil para entender la conectividad más eficiente o el costo mínimo para conectar todos los nodos.
* **Visualización:** El peso total del MST se muestra en un panel dedicado en la interfaz.

### Módulo 3: Planificación de Rutas Óptimas

* **Funcionalidad:** Permite al usuario seleccionar un nodo de origen y un nodo de destino (mediante sus IDs) y calcula la ruta óptima entre ellos utilizando algoritmos de grafos (Dijkstra y Bellman-Ford en el backend).
* **Visualización:** La ruta calculada se dibuja sobre el mapa, resaltando el camino más eficiente. Se muestra la distancia de la ruta en el panel.

### Módulo 4: Análisis Ambiental y Recomendaciones

* **Funcionalidad:** Al seleccionar un nodo en el mapa, el panel lateral "Nodo Info" se actualiza para mostrar un análisis ambiental detallado de la zona.
* **Contenido:** Incluye los niveles actuales de CO₂, CH₄ y NOx, y clasifica el nivel general de contaminación (Bajo, Moderado, Alto).
* **Recomendaciones:** Proporciona sugerencias personalizadas de mitigación y energías renovables basadas en el nivel de contaminación detectado en esa zona.

### Módulo 5: Simulador de Impacto Local

* **Funcionalidad:** Permite al usuario simular el impacto de la implementación de tecnologías de mitigación (como "Panel Solar" o "Biodigestor") en los niveles de gases de un nodo seleccionado.
* **Interfaz:** Se abre un modal interactivo con una barra de progreso durante la simulación.
* **Resultados:** Muestra una comparación clara de los niveles de gases "Antes" y "Después" de la simulación, junto con "Tips y Mejoras" personalizados basados en el resultado.
* **Actualización Visual:** El color del nodo en el mapa y la información en el panel lateral se actualizan en tiempo real para reflejar los nuevos niveles de gases simulados.

### Módulo 6: Alertas Inteligentes

* **Funcionalidad:** Si los valores de gases en un nodo seleccionado (o su "Distrito/Zona" asociada, basada en el cluster KMeans) superan un umbral predefinido y se clasifican como "Alto", una alerta visual prominente aparece en la parte superior de la interfaz.
* **Visualización:** La alerta es un banner naranja con un icono de advertencia y un mensaje dinámico: "⚠️ Contaminación alta detectada en [Distrito/Zona X]".
* **Interacción:** La alerta se oculta automáticamente si el nivel de contaminación baja o si el usuario cambia a un nodo con niveles más bajos. También incluye un botón para cerrarla manualmente.
* **Responsividad:** La alerta está diseñada para adaptarse a diferentes tamaños de pantalla.

## 3. Estructura del Proyecto

```

.
├── app.py                  \# Lógica principal de la aplicación Flask (backend)
├── grafo\_logic.py          \# Lógica para la creación y manipulación del grafo, cálculo de rutas y simulación
├── static/
│   ├── styles.css          \# Estilos CSS de la aplicación (incluye responsividad)
│   └── main.js             \# Lógica JavaScript del frontend (interacción con el mapa, paneles, simulador, alertas)
└── templates/
└── index.html          \# Plantilla HTML principal de la aplicación

````

## 4. Configuración del Entorno Local

Para ejecutar este proyecto en tu máquina local, sigue estos pasos:

### Prerrequisitos

* **Python 3.x** (se recomienda Python 3.8 o superior)
* **pip** (gestor de paquetes de Python, usualmente viene con Python)
* **Git** (para clonar el repositorio)

### Instalación de Dependencias

1.  **Clona el repositorio:**
    ```bash
    git clone [https://github.com/YakuzaMeen/Grupo6_Complejidad.git](https://github.com/YakuzaMeen/Grupo6_Complejidad.git)
    ```
2.  **Navega al directorio del proyecto:**
    ```bash
    cd Grupo6_Complejidad
    ```
3.  **Instala las dependencias de Python:**
    Se recomienda usar un entorno virtual para aislar las dependencias del proyecto.
    ```bash
    # Crear un entorno virtual (una sola vez)
    python -m venv venv

    # Activar el entorno virtual
    # En Windows:
    .\venv\Scripts\activate
    # En macOS/Linux:
    source venv/bin/activate

    # Instalar las librerías necesarias
    pip install Flask networkx pandas scikit-learn
    ```

### Configuración de la Base de Datos (Firestore)

Este proyecto está diseñado para interactuar con una base de datos Firestore, especialmente en un entorno como Google Cloud Canvas, que proporciona variables de entorno (`__app_id`, `__firebase_config`, `__initial_auth_token`) para la conexión y autenticación.

**Para que tus amigos (o tú fuera del entorno Canvas) puedan vincularse a una base de datos Firestore, necesitarán:**

1.  **Crear un Proyecto Firebase:**
    * Ve a la [Consola de Firebase](https://console.firebase.google.com/).
    * Haz clic en "Añadir proyecto" y sigue los pasos para crear un nuevo proyecto.
    * Una vez creado, ve a "Configuración del proyecto" (el icono de engranaje) > "Configuración del proyecto".
    * En la sección "Tus apps", haz clic en el icono de "Web" (`</>`).
    * Registra tu aplicación y copia el objeto `firebaseConfig`. Se verá algo así:
        ```javascript
        const firebaseConfig = {
            apiKey: "TU_API_KEY",
            authDomain: "TU_AUTH_DOMAIN",
            projectId: "TU_PROJECT_ID",
            storageBucket: "TU_STORAGE_BUCKET",
            messagingSenderId: "TU_MESSAGING_SENDER_ID",
            appId: "TU_APP_ID"
        };
        ```

2.  **Habilitar Firestore Database:**
    * En el menú lateral de Firebase Console, ve a "Firestore Database".
    * Haz clic en "Crear base de datos".
    * Elige "Iniciar en modo de prueba" para empezar (puedes cambiar las reglas de seguridad después). Selecciona una ubicación.

3.  **Adaptar el Código para Entorno Local (sin Canvas):**
    El `main.js` actual utiliza variables globales (`__app_id`, `__firebase_config`, `__initial_auth_token`) que son inyectadas por el entorno Canvas. Para ejecutarlo localmente sin Canvas, necesitarías modificar `main.js` para usar tu `firebaseConfig` directamente y manejar la autenticación.

    **Ejemplo de cómo podrías adaptar `main.js` para pruebas locales (esto es solo una guía, no está incluido en el código actual de este repo):**

    ```javascript
    // En main.js, al inicio del script o en la función de inicialización de Firebase:
    import { initializeApp } from 'firebase/app';
    import { getAuth, signInAnonymously } from 'firebase/auth'; // O signInWithEmailAndPassword, etc.
    import { getFirestore } from 'firebase/firestore';

    // TU CONFIGURACIÓN DE FIREBASE (reemplaza con la que copiaste de la consola de Firebase)
    const localFirebaseConfig = {
        apiKey: "TU_API_KEY_AQUI",
        authDomain: "TU_AUTH_DOMAIN_AQUI",
        projectId: "TU_PROJECT_ID_AQUI",
        storageBucket: "TU_STORAGE_BUCKET_AQUI",
        messagingSenderId: "TU_MESSAGING_SENDER_ID_AQUI",
        appId: "TU_APP_ID_AQUI"
    };

    let db;
    let auth;
    let userId; // Para simular el userId

    document.addEventListener('DOMContentLoaded', async () => {
        // ... (resto de tu código DOMContentLoaded) ...

        // Inicializar Firebase
        const app = initializeApp(localFirebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);

        // Autenticación anónima para pruebas locales (o implementa tu propio login)
        try {
            const userCredential = await signInAnonymously(auth);
            userId = userCredential.user.uid;
            console.log("Autenticado anónimamente con UID:", userId);
        } catch (error) {
            console.error("Error al autenticar anónimamente:", error);
            // Manejar error de autenticación
        }

        // Aquí puedes usar db y userId para tus operaciones de Firestore
        // ...
    });
    ```
    **Nota:** Para un proyecto colaborativo que use Firestore fuera de Canvas, lo ideal sería implementar un sistema de autenticación de usuarios (ej. email/contraseña, Google Sign-In) y usar las reglas de seguridad de Firestore para controlar el acceso a los datos.

4.  **Reglas de Seguridad de Firestore (Importante):**
    Para que la aplicación pueda leer y escribir datos, necesitarás configurar las reglas de seguridad en tu consola de Firebase. Aquí un ejemplo de reglas básicas que permiten lectura/escritura a usuarios autenticados (para pruebas):

    ```firestore
    rules_version = '2';
    service cloud.firestore {
      match /databases/{database}/documents {
        // Reglas para datos públicos (si los usas)
        match /artifacts/{appId}/public/data/{document=**} {
          allow read, write: if request.auth != null;
        }

        // Reglas para datos privados (por usuario)
        match /artifacts/{appId}/users/{userId}/{document=**} {
          allow read, write: if request.auth != null && request.auth.uid == userId;
        }
      }
    }
    ```
    **Asegúrate de entender las implicaciones de seguridad de estas reglas antes de desplegar en producción.**

### Ejecutar la Aplicación

1.  **Asegúrate de que tu entorno virtual esté activado.**
2.  **Ejecuta la aplicación Flask:**
    ```bash
    python app.py
    ```
3.  **Abre tu navegador:**
    Accede a `http://127.0.0.1:5000/` (o la dirección que muestre tu terminal).

## 5. Uso de la Aplicación

Una vez que la aplicación esté en funcionamiento:

1.  **Cargar Grafo:** Haz clic en el botón "Cargar Grafo en Mapa" para visualizar los nodos y aristas.
2.  **Explorar Nodos:** Haz clic en cualquier nodo en el mapa para ver su información detallada en el panel "Nodo Info" a la derecha. Observa los niveles de gases y las recomendaciones.
3.  **Simular Impacto:** Con un nodo seleccionado, haz clic en "Abrir Simulador" en el panel "Nodo Info". Elige una acción (Panel Solar, Biodigestor) y observa el impacto en los niveles de gases y los tips. El color del nodo en el mapa se actualizará.
4.  **Alertas de Contaminación:** Si seleccionas un nodo con un nivel de contaminación "Alto", aparecerá un banner de alerta en la parte superior de la interfaz.
5.  **Calcular Rutas:** Ve a la pestaña "Rutas", introduce los IDs de origen y destino, y haz clic en "Calcular Ruta Óptima".
6.  **Ver MST:** La pestaña "MST" mostrará el peso total del Árbol de Expansión Mínima.
7.  **Bitácora:** La pestaña "Bitácora" muestra los logs de las operaciones realizadas.

## 6. Contribuciones

¡Las contribuciones son bienvenidas! Si deseas mejorar este proyecto, por favor, sigue estos pasos:

1.  Haz un "fork" de este repositorio.
2.  Crea una nueva rama (`git checkout -b feature/nueva-funcionalidad`).
3.  Realiza tus cambios y haz commits descriptivos.
4.  Empuja tus cambios a tu fork (`git push origin feature/nueva-funcionalidad`).
5.  Abre un "Pull Request" a la rama `main` de este repositorio.

## 7. Contacto

Si tienes alguna pregunta o sugerencia, no dudes en contactar al desarrollador principal:

* **YakuzaMeen**
* Correo electrónico: U202212214@upc.edu.pe

---

¡Gracias por usar EcoRegula All-in-One!
````
