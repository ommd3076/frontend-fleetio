# Production setup

FleetIO is a static browser simulation built with React, Vite and Three.js. A browser Web Worker owns simulation state. No robotics server, database, authentication service or environment secrets are required for this release.

Use Node.js **22.12 or newer**, npm, and the committed `package-lock.json`. Run commands from the source repository root:

```sh
node --version
npm ci
npm run lint
npm test
npm run build
npm run verify:build
```

`npm ci` installs the locked dependencies. Lint checks source and scripts; the test command runs the simulation, integration, assets and presentation checks. Build emits `dist/`; build verification checks the produced artifact. Passing these commands does not establish browser visual quality, a frame-rate guarantee or a successful hosted deployment.

For development, run `npm run dev`. To inspect the production build locally, run `npm run preview` and open the HTTP address it prints. Do not open `dist/index.html` directly through a file URL: module workers and runtime assets need an HTTP origin.

Prepared assets under `public/models/` are runtime inputs and must remain in the source checkout and deployed output. Original download folders are unnecessary for normal builds. Asset regeneration is a separate maintenance step requiring those original downloads; see [asset attribution](../public/models/ATTRIBUTION.md).

After validation, run:

```sh
npm run package:release
```

This creates `release/fleetio-1.0.0.zip` and a release manifest. The ZIP is a static deployment artifact, not a Git source archive. Keep the manifest with the ZIP to identify and check the packaged files. See [deployment](DEPLOYMENT.md) for publishing and [limitations](LIMITATIONS.md) for the release boundaries.

Before reporting a release as complete, inspect the production build in a browser: load its models, play/pause/reset, select robots and docks, open navigation views, exercise a recovery scenario, and check mobile drawers and reduced motion. Record the exact revision, device, viewport, errors and any measured performance separately from command results.
