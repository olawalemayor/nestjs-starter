<div align="center">

# Injvstice API

Backend API for the Injvstice project.

</div>

## Overview

This directory contains the API service for Injvstice. It lives in the [`injvstice`](https://github.com/olawalemayor/injvstice) repository at `injvstice/injvstice-api` and provides the server-side interface used by the project's clients.

## Getting started

### Prerequisites

- Git
- The runtime and package manager required by this project

### Installation

Clone the Injvstice repository, enter the API subdirectory, and install its dependencies using the package manager configured for the project:

```sh
git clone https://github.com/olawalemayor/injvstice.git
cd injvstice/injvstice-api
npm install
```

### Configuration

The required environment variable names are not documented in this README. Check `injvstice-api/.env` and list each required variable here, without including secret values. Set them in your local environment or deployment configuration; do not commit `.env` files or secrets. Keep this list aligned with `.env` whenever the required variables change.

| Variable               | Description                                                       |
| ---------------------- | ----------------------------------------------------------------- |
| `APP_URL`              | Base URL of the application; defaults to `http://localhost:3000`. |
| `GOOGLE_CLIENT_ID`     | Client ID used for Google OAuth authentication.                   |
| `GOOGLE_CLIENT_SECRET` | Client secret used for Google OAuth authentication.               |
| `JWT_SECRET`           | Secret used to sign and verify JSON Web Tokens.                   |
| `TOTP_ENCRYPTION_KEY`  | Key used to encrypt and decrypt TOTP authentication data.         |
| `DATABASE_URL`         | Connection URL for the application's database.                    |

### Run locally

Use the development command configured by the project:

```sh
npm run dev
```

## API documentation

When available, API routes and request/response formats should be documented here or in the project's API specification. The service's configured base URL and health-check endpoint depend on the deployment configuration.

## Testing

Run the test command configured by the project:

```sh
npm test
```

### End-to-end tests

End-to-end tests exercise the API through its HTTP interface. Start any required services and configure the test environment variables before running them:

```sh
npm run test:e2e
```

If this script is not configured in `package.json`, add the project's E2E test runner command there.

## Deployment

Build and deploy the service using the process configured for your environment. Set required environment variables through your hosting platform's secrets/configuration settings.

## Contributing

1. Create a branch for your change.
2. Make the change and run the relevant checks.
3. Open a pull request with a concise description and any relevant testing notes.

## License

Add the project's license information here.
