<div align="center">

# NestJS Starter

A NestJS 12 starter with full authentication, PostgreSQL (Drizzle ORM), transactional email and OpenAPI docs already set up.

</div>

## What's included

- **NestJS 12** with ESM, TypeScript 6 and global validation (`class-validator`, whitelisting on)
- **Authentication** via `@nestjs/authentication`:
  - Email and password sign-up and sign-in
  - Server-side sessions (14-day absolute, 3-day idle), with session listing and revocation
  - JWT access tokens for non-browser clients
  - API keys
  - Google sign-in (OIDC), with account linking
  - Magic-link sign-in
  - Email verification and email change
  - Password reset
  - TOTP multi-factor authentication with recovery codes
- **Rate limiting** via `@nestjs/throttler`: 100 req/min globally, stricter limits on sign-in, token, magic-link and password-reset routes
- **Database**: PostgreSQL with Drizzle ORM and `drizzle-kit` migrations
- **Email**: `@nestjs/mail` with HTML templates; logs emails to the console when no SMTP server is set
- **API docs**: Swagger UI at `/api/docs`
- **Tooling**: Vitest (unit and e2e), oxlint, Prettier

## Getting started

### Prerequisites

- Node.js 24+
- PostgreSQL

### 1. Create your project

```sh
git clone <this-repo-url> my-app
cd my-app
rm -rf .git && git init
npm install
```

Then rename the project in `package.json` and update the Swagger title in `src/main.ts`.

### 2. Configure the environment

Create a `.env` file (it is gitignored):

```sh
DATABASE_URL=postgres://postgres:postgres@localhost:5432/app
APP_URL=http://localhost:3000
JWT_SECRET=          # openssl rand -base64 32
TOTP_ENCRYPTION_KEY= # openssl rand -base64 32
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
# SMTP_URL=smtp://user:pass@smtp.example.com:587
```

| Variable               | Required | Description                                                                                       |
| ---------------------- | -------- | ------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`         | Yes      | PostgreSQL connection string.                                                                     |
| `APP_URL`              | Yes      | Public base URL. Used to build OIDC callback, email verification, password-reset and magic links. |
| `JWT_SECRET`           | Yes      | Key used to sign access tokens.                                                                   |
| `TOTP_ENCRYPTION_KEY`  | Yes      | Key used to encrypt stored TOTP secrets.                                                          |
| `GOOGLE_CLIENT_ID`     | For OIDC | Google OAuth client ID.                                                                           |
| `GOOGLE_CLIENT_SECRET` | For OIDC | Google OAuth client secret.                                                                       |
| `SMTP_URL`             | No       | SMTP connection URL. If unset, emails (and the links in them) are printed to the log.             |
| `PORT`                 | No       | HTTP port. Defaults to `3000`.                                                                    |
| `TEST_DATABASE_URL`    | No       | Database used by the e2e tests. Falls back to `DATABASE_URL`.                                     |

Both the app and `drizzle-kit` load `.env` automatically. Variables already set in the environment take precedence.

### 3. Set up the database

Create the database, then generate the migrations from the schema and apply them:

```sh
createdb app            # or create it however you prefer
npm run db:generate
npm run db:migrate
```

### 4. Run

```sh
npm run start:dev
```

The API runs on `http://localhost:3000` and the Swagger UI on `http://localhost:3000/api/docs`.

## Migrations

The schema lives in [src/database/schema.ts](src/database/schema.ts), and migrations are managed with [drizzle-kit](https://orm.drizzle.team/docs/kit-overview) (config in [drizzle.config.ts](drizzle.config.ts)). They are written to `./drizzle`.

To change the data model:

1. Edit [src/database/schema.ts](src/database/schema.ts).
2. Run `npm run db:generate` to create a new SQL migration from the diff.
3. Review the generated SQL in `./drizzle`.
4. Run `npm run db:migrate` to apply pending migrations to `DATABASE_URL`.

| Command               | Description                                                                                                                       |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `npm run db:generate` | Generate a migration from schema changes.                                                                                         |
| `npm run db:migrate`  | Apply pending migrations.                                                                                                         |
| `npm run db:push`     | Sync the schema straight to the database, without migration files. Handy for quick local prototyping; don't use it in production. |
| `npm run db:studio`   | Open Drizzle Studio to browse the database.                                                                                       |

In production, run `npm run db:migrate` as a deploy step before starting the new version of the app.

The starter ships without migrations: running `npm run db:generate` on a fresh clone creates a single initial migration for the whole schema. Commit the `./drizzle` folder with your code so every environment applies the same migration history.

## Project structure

```
src/
├── main.ts                 # Bootstrap and Swagger setup
├── app.module.ts           # Database, mail, throttling and authentication config
├── auth/                   # Auth controllers, providers, mailers and the Drizzle auth store
├── users/                  # User repository and /me endpoints
├── database/schema.ts      # Drizzle schema (users, sessions, tokens, MFA, API keys, ...)
└── mail/templates/         # HTML email templates
test/                       # e2e tests and PostgreSQL test helpers
```

## API overview

All routes require authentication unless marked public. Mark your own public routes with the `@Public()` decorator from `@nestjs/authentication`.

| Route                                                                  | Purpose                                          |
| ---------------------------------------------------------------------- | ------------------------------------------------ |
| `POST /auth/sign-up`, `POST /auth/sign-in`                             | Password sign-up and sign-in (public)            |
| `POST /auth/sign-out`, `/sign-out-everywhere`                          | End the current session or all sessions          |
| `GET /auth/sessions`, `DELETE /auth/sessions/:id`                      | List and revoke sessions                         |
| `POST /auth/token`, `/refresh`, `/revoke`                              | Issue, refresh and revoke access tokens (public) |
| `POST/GET/DELETE /auth/api-keys`                                       | Manage API keys                                  |
| `GET /auth/oidc/:provider/login`, `/callback`                          | OIDC sign-in, e.g. Google (public)               |
| `POST /auth/magic-link`, `/consume`                                    | Request and consume a magic link (public)        |
| `POST /auth/email/verification`, `/verify`                             | Send and confirm email verification              |
| `POST /auth/password/forgot`, `/reset`                                 | Password reset (public)                          |
| `POST /auth/mfa/enroll`, `/confirm`, `/replace`, `/verify`, `/disable` | TOTP MFA                                         |
| `GET /me`, `PATCH /me/email`                                           | The current user                                 |

See `/api/docs` for request and response schemas.

## Customizing

- **Auth settings** (session lifetimes, token TTL, issuer and audience, link URLs, OIDC providers) are in `AuthenticationModule.forRootAsync` in [src/app.module.ts](src/app.module.ts). Replace the `example.com` placeholders there before deploying.
- **Email sender and templates**: change `from` in [src/app.module.ts](src/app.module.ts) and edit the HTML in [src/mail/templates/](src/mail/templates/).
- **Rate limits**: change the global limit in `ThrottlerModule.forRoot` and the per-route limits in the `@Throttle()` decorators.
- **Data model**: add tables to [src/database/schema.ts](src/database/schema.ts), then run `npm run db:generate` and `npm run db:migrate`. See [Migrations](#migrations).

## Scripts

| Command               | Description                              |
| --------------------- | ---------------------------------------- |
| `npm run start:dev`   | Start in watch mode                      |
| `npm run start:prod`  | Run the compiled build                   |
| `npm run build`       | Compile to `dist/`                       |
| `npm test`            | Run unit tests                           |
| `npm run test:e2e`    | Run e2e tests (needs PostgreSQL)         |
| `npm run test:cov`    | Run unit tests with coverage             |
| `npm run db:generate` | Generate a migration from schema changes |
| `npm run db:migrate`  | Apply pending migrations                 |
| `npm run lint`        | Lint with oxlint                         |
| `npm run format`      | Format with Prettier                     |

## License

UNLICENSED. Choose a license for your project and update `package.json`.
