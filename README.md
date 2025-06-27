# Complejidad Algorítmica - Grupo 6

Visualización y análisis de grafos para el curso de Complejidad Algorítmica.

## Requisitos

- Python 3.8 o superior
- pip (gestor de paquetes de Python)
- (Opcional) Crear un entorno virtual

## Instalación

1. **Clona este repositorio:**
   ```sh
   git clone https://github.com/YakuzaMeen/Grupo6_Complejidad.git
   cd Grupo6_Complejidad
   ```

2. **(Opcional) Crea y activa un entorno virtual:**
   ```sh
   python -m venv venv
   # En Windows:
   venv\Scripts\activate
   # En Mac/Linux:
   source venv/bin/activate
   ```

3. **Instala las dependencias:**
   ```sh
   pip install -r requirements.txt
   ```
   > Si no tienes `requirements.txt`, instala manualmente:
   ```sh
   pip install flask pandas networkx scikit-learn geopandas
   ```

4. **Asegúrate de tener el archivo de datos `ly_osi_tramos.xlsx` en la raíz del proyecto (no se sube a GitHub por su tamaño).**

## Ejecución

1. Ejecuta el servidor Flask:
   ```sh
   python app.py
   ```

2. Abre tu navegador y entra a [http://127.0.0.1:5000](http://127.0.0.1:5000)

---

**Nota:**  
El archivo `ly_osi_tramos.xlsx` es necesario para el análisis, pero no está incluido en el repositorio por su tamaño. Solicítalo a un miembro del grupo si lo necesitas.

---

**Desarrollado por:**  
-U202212214@upc.edu.pe