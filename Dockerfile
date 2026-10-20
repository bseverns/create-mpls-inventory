# Download the LEGO catalog, then build the website
FROM node:22-alpine AS build
WORKDIR /app
ADD https://cdn.rebrickable.com/media/downloads/sets.csv.gz /app/data/sets.csv.gz
ADD https://cdn.rebrickable.com/media/downloads/themes.csv.gz /app/data/themes.csv.gz
COPY package*.json ./
RUN npm ci
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Image that runs
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/data ./data
USER node
EXPOSE 3000
CMD ["node", "server.js"]
