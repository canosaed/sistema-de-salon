# Atelier Beauty Studio — Sistema de Gestión y Turnos

Plataforma moderna y minimalista de gestión de turnos, agenda y administración integral diseñada para salones de belleza, estética y estudios de manicuría/pestañas.

---

## 🌟 Características Principales

- **Dashboard / Resumen General:** Métricas clave de rendimiento diario y mensual (turnos del día, pendientes, clientes nuevos, ingresos facturados), gráfico visual de evolución semanal y servicios más solicitados.
- **Agenda Semanal:** Visualización de turnos por día con estados (confirmado, pendiente), profesionales asignados y acceso rápido a detalle.
- **Gestión de Clientes:** Directorio de clientas con historial de visitas, datos de contacto (teléfono) y filtro de búsqueda en tiempo real.
- **Catálogo de Servicios:** Administración de técnicas y servicios clasificados por categoría (Manos, Pies, Pestañas), duración estimada y precios.
- **Equipo de Profesionales:** Vista de especialistas activas, especialidades y carga horaria / turnos asignados por jornada.
- **Reserva de Turnos (Modal):** Flujo de creación ágil para seleccionar cliente, servicio, fecha, horario y profesional responsable.
- **Diseño Responsive y UI Editorial:** Experiencia visual adaptada tanto a ordenadores como a dispositivos móviles, con una paleta cálida y refinada pensada para centros de estética de alta gama.

---

## 🛠️ Stack Tecnológico

- **Framework:** [Next.js](https://nextjs.org/) (App Router, Turbopack)
- **Librería de Interfaz:** [React 19](https://react.dev/)
- **Lenguaje:** [TypeScript](https://www.typescriptlang.org/)
- **Estilos y Componentes:** [Tailwind CSS v4](https://tailwindcss.com/) & [Lucide Icons](https://lucide.dev/)
- **Gestor de Paquetes:** [pnpm](https://pnpm.io/)

---

## 🚀 Inicio Rápido

### Requisitos Previos

- [Node.js](https://nodejs.org/) (versión 18+ recomendada)
- [pnpm](https://pnpm.io/) (versión 9+)

### Instalación

1. Clona el repositorio:
   ```bash
   git clone <URL_DEL_REPOSITORIO>
   cd <NOMBRE_DEL_DIRECTORIO>
   ```

2. Instala las dependencias:
   ```bash
   pnpm install
   ```

### Ejecución en Desarrollo

Inicia el servidor de desarrollo en local:

```bash
pnpm dev
```

Abre tu navegador en [http://localhost:3000](http://localhost:3000) para ver la aplicación interactiva.

### Compilación para Producción

Para generar el build optimizado de producción:

```bash
pnpm build
```

Para iniciar el servidor con el build de producción:

```bash
pnpm start
```

---

## 📁 Estructura del Proyecto

```text
├── app/
│   ├── globals.css      # Estilos globales, variables de color y tokens de diseño
│   ├── layout.tsx       # Layout principal con metadatos y fuentes
│   └── page.tsx         # Vista principal (Dashboard, Agenda, Clientes, Servicios, Profesionales)
├── components/
│   └── ui/              # Componentes de UI reutilizables
├── lib/
│   └── utils.ts         # Funciones utilitarias (clsx, twMerge)
├── public/              # Recursos estáticos (iconos, placeholders, imágenes)
├── package.json         # Dependencias y scripts
├── next.config.mjs      # Configuración de Next.js
└── tsconfig.json        # Configuración de TypeScript
```

---

## 📄 Licencia

Este proyecto es de uso privado para Atelier Beauty Studio.
