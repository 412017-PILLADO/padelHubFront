# Imagen del front con SSR.
#
# Vive acá y no junto al resto del deploy (que está en padelBack/deploy) porque un Dockerfile
# describe cómo se construye ESTE proyecto: necesita el package.json y el árbol de fuentes al lado.
# La orquestación -quién habla con quién, qué variables, qué volúmenes- sí vive toda allá.
#
# SSR y no estático: la ruta '' se renderiza por request (RenderMode.Server en app.routes.server.ts)
# para decidir marketing-vs-club según el Host, así el HTML que recibe cada subdominio ya sale con
# el contenido correcto -indexable por Google y sin parpadeo hasta que hidrata-.

# ── Build ──
FROM node:22-alpine AS build
WORKDIR /app
# Las dependencias van en su propia capa: mientras no cambie el package-lock, Docker reusa el
# `npm ci` cacheado y el build sólo recompila el código.
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ── Run ──
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
# `--omit=dev` deja fuera Angular CLI, Vitest y Playwright: lo que el server.mjs necesita en runtime
# es express y los paquetes de @angular que el bundle no inlinea.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
# El server.mjs escucha en process.env.PORT y cae a 4000 (ver src/server.ts).
ENV PORT=4000
EXPOSE 4000
CMD ["node", "dist/padel-hub/server/server.mjs"]
