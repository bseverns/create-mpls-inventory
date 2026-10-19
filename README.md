# createMPLS Inventory

A simple inventory website for [createMPLS](https://www.creatempls.org). Can track categories of stuff, the stuff itself, and who currently owns it.

**Stack:**

- Next.js
- TypeScript
- Tailwind CSS
- PostgreSQL
- Docker Compose

## Run it

Ensure [Docker](https://www.docker.com/products/docker-desktop/) is installed.

Clone the repository and configure the environment file:

```bash
git clone https://github.com/aidan-labs/create-mpls-inventory.git
cd create-mpls-inventory
cp .env.example .env
```

Change `POSTGRES_PASSWORD` in `.env`, then build and start the containers:

```bash
docker compose up --build -d
```

Open <http://localhost:3000>.

## Notes

- The Docker build fails if Rebrickable can't be reached, which is on purpose, because the catalog is required.
- Downloads [Rebrickable's](https://rebrickable.com/downloads/) free `sets.csv.gz` and `themes.csv.gz`.
