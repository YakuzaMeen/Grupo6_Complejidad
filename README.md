# EcoRegula All-in-One

Este proyecto es una aplicación web Flask que integra análisis geoespacial y algoritmos de grafos para la gestión y visualización de datos de redes de gas, incluyendo análisis de rutas, MST (Árbol de Expansión Mínima) y niveles de gases. Utiliza PostgreSQL con la extensión PostGIS para el almacenamiento eficiente de datos geoespaciales.

## 🚀 Inicio Rápido

Sigue estos pasos para configurar y ejecutar el proyecto en tu máquina local.

### Prerrequisitos

Asegúrate de tener instalado lo siguiente:

1.  **Git**: Para clonar el repositorio. Puedes descargarlo de [git-scm.com](https://git-scm.com/downloads).
2.  **Python 3.x**: Recomendamos Python 3.9 o superior.
3.  **PostgreSQL**: El sistema de gestión de bases de datos. Descárgalo de [postgresql.org/download](https://www.postgresql.org/download/).
4.  **PostGIS**: La extensión geoespacial para PostgreSQL. Normalmente se instala junto con PostgreSQL o como una extensión adicional (consulta la documentación de tu versión de PostgreSQL).

### 1. Clonar el Repositorio

Abre tu terminal (Git Bash, PowerShell, CMD) y clona el repositorio:

```bash
git clone [https://github.com/YakuzaMeen/Grupo6_Complejidad.git](https://github.com/YakuzaMeen/Grupo6_Complejidad.git)
cd Grupo6_Complejidad
2. Obtener el Dataset ly_osi_tramos.xlsxEl archivo ly_osi_tramos.xlsx es demasiado grande para ser incluido en GitHub. Necesitarás obtenerlo por separado:Pídele a YakuzaMeen el archivo ly_osi_tramos.xlsx a través de Google Drive, Dropbox, u otro medio de transferencia de archivos grandes.Una vez que lo tengas, coloca este archivo directamente en la carpeta raíz del proyecto que acabas de clonar (Grupo6_Complejidad/).Grupo6_Complejidad/
├── app.py
├── import_data_to_db.py
├── ly_osi_tramos.xlsx  <-- ¡Debe estar aquí!
├── README.mkdown       # Este archivo
└── src/
    └── ...
3. Configurar la Base de Datos PostgreSQLIniciar el Servidor PostgreSQL: Asegúrate de que tu servidor PostgreSQL esté corriendo.Crear la Base de Datos y Usuario: Necesitas crear una base de datos y un usuario con permisos para acceder a ella. Abre psql (la terminal de PostgreSQL) o una herramienta como pgAdmin y ejecuta los siguientes comandos:-- Crear el usuario (si no existe)
CREATE USER yakuza WITH PASSWORD '1305';

-- Crear la base de datos (si no existe)
CREATE DATABASE ecoregula_db;

-- Conceder todos los privilegios al usuario 'yakuza' en la base de datos 'ecoregula_db'
GRANT ALL PRIVILEGES ON DATABASE ecoregula_db TO yakuza;

-- Conectarse a la nueva base de datos
\c ecoregula_db

-- Habilitar la extensión PostGIS en la base de datos
CREATE EXTENSION postgis;
¡Importante! Las credenciales (yakuza, 1305, ecoregula_db, localhost, 5432) deben coincidir con las configuradas en import_data_to_db.py y grafo_logic.py. Si cambias estas credenciales en tu base de datos, ¡asegúrate de actualizar los archivos Python correspondientes!4. Instalar Dependencias de PythonEs una buena práctica crear un entorno virtual para el proyecto. En la carpeta raíz del proyecto (Grupo6_Complejidad/):python -m venv venv
# Activar el entorno virtual
# En Windows:
.\venv\Scripts\activate
# En macOS/Linux:
source venv/bin/activate
Una vez activado el entorno virtual, instala las dependencias. Si el archivo requirements.txt no existe, créalo con el siguiente contenido:requirements.txtFlask==2.3.3
pandas==2.0.3
openpyxl==3.1.2
geopandas==0.13.2
networkx==3.1
scikit-learn==1.3.0
shapely==2.0.1
psycopg2-binary==2.9.7
SQLAlchemy==2.0.20
pyproj==3.6.0
Luego, instala las dependencias:pip install -r requirements.txt
5. Importar Datos a PostgreSQLCon el archivo ly_osi_tramos.xlsx en la carpeta raíz del proyecto y tu base de datos PostgreSQL/PostGIS configurada, ejecuta el script de importación de datos:python import_data_to_db.py
Este script leerá el Excel y creará la tabla tramos_gas en tu base de datos ecoregula_db. Este proceso puede tardar unos minutos debido al tamaño del archivo.6. Ejecutar la Aplicación FlaskFinalmente, inicia la aplicación Flask:python app.py
La aplicación se ejecutará en http://127.0.0.1:5000/. Abre esta URL en tu navegador.7. Uso de la AplicaciónHaz clic en el botón "Cargar Grafo en Mapa" para visualizar la red de gas y ejecutar los análisis.Explora las diferentes pestañas ("Bitácora", "Rutas", "MST", "Nodo Info") para ver los resultados de los análisis y la información detallada de los nodos.En la pestaña "Nodo Info", puedes pasar el mouse sobre los nodos del mapa o hacer clic en ellos para ver sus propiedades y niveles de gases simulados.Estructura del ProyectoGrupo6_Complejidad/
├── app.py                # Aplicación principal Flask y endpoints API
├── import_data_to_db.py  # Script para importar datos de Excel a PostgreSQL/PostGIS
├── grafo_logic.py        # Lógica de procesamiento de grafos (algoritmos, KMeans)
├── ly_osi_tramos.xlsx    # Dataset original (¡No subido a Git debido al tamaño!)
├── README.mkdown         # Este archivo
├── requirements.txt      # Dependencias de Python
└── src/
    ├── static/           # Archivos estáticos (CSS, JS, imágenes)
    │   ├── main.js       # Lógica JavaScript para el frontend (mapa, interacciones)
    │   └── styles.css    # Estilos CSS de la aplicación
    └── templates/        # Plantillas HTML
        └── index.html    # La página principal de la aplicación
