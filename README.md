# Orquestador de Extraccion de Datos
Este repositorio contiene una plataforma full-stack diseñada para la creación, programación y gestión centralizada de bots de web scraping. Construida con una arquitectura orientada a la eficiencia operativa, esta herramienta permite automatizar la recolección de datos de fuentes externas para generar inteligencia de negocios en tiempo real.

Arquitectura y Stack Tecnológico
El sistema está dividido en dos capas principales que garantizan la escalabilidad:

Backend (Node.js, Express, Puppeteer): Un motor asíncrono robusto que ejecuta navegadores headless para capturar información dinámica. Utiliza Node-cron para orquestar la ejecución precisa de tareas programadas sin bloquear el hilo principal del servidor.

Base de Datos (MongoDB): Almacenamiento no estructurado (NoSQL) ideal para persistir de manera flexible las configuraciones de los bots, los selectores CSS y la data extraída.

Frontend (Angular, Angular Material): Un panel administrativo reactivo e intuitivo que permite a los usuarios gestionar el ciclo de vida completo de los bots, configurar frecuencias de extracción y visualizar la información consolidada mediante componentes limpios.

Filosofía de Diseño
El valor central de esta solución es la modernización integral de los procesos de captura de información y automatización. Se ha diseñado bajo un ecosistema 100% web que procesa, limpia y presenta los datos directamente en la interfaz administrativa. Esta decisión arquitectónica elimina por completo la necesidad de exportar resultados o manipular archivos de Excel intermedios, asegurando que toda la gestión de la información ocurra directamente dentro de la plataforma para una experiencia más fluida, centralizada y segura.

Este proyecto evidencia la capacidad de construir sistemas end-to-end, manejando flujos asíncronos complejos en el servidor y proporcionando interfaces de usuario limpias orientadas a la productividad corporativa.
