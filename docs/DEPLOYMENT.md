# Deployment

Use the existing GitHub repository [`ommd3076/frontend-fleetio`](https://github.com/ommd3076/frontend-fleetio), its `main` branch, and the existing Vercel project serving [`frontend-fleetio.vercel.app`](https://frontend-fleetio.vercel.app/). This release updates that project; do not create another Vercel project or change its production domain.

## Deploy from source

1. Complete the checks in [production setup](PRODUCTION.md), then commit the intended source, prepared models, scripts and documentation to the existing repository.
2. Push the checked revision to `origin/main`. The existing Vercel Git integration should build that revision. If a redeploy is needed, select the existing project and the intended deployment in Vercel; verify its source commit before redeploying.
3. Use the repository root as the project root, Vite as the framework, `npm run build` as the build command, and `dist` as the output directory. Use a Node version satisfying the repository requirement of 22.12 or newer.
4. Inspect Vercel's build result and production alias. A successful push or local build alone does not confirm deployment.

In this local workspace, `.publish/frontend-fleetio` is the Git checkout used for publication. It is not an output directory and must not be deployed as a nested Vercel root. The checked source and the published checkout must agree before pushing.

## Static ZIP

`npm run package:release` produces `release/fleetio-1.0.0.zip` with an accompanying manifest. The ZIP contains the built static site. It does not contain the editable application source, npm dependency installation or Git history.

For a static host, extract the ZIP so `index.html` is at the served root; keep `assets/` and `models/` paths intact. Serve it over HTTP or HTTPS. The application uses root-relative asset URLs, so deployment under a nested URL prefix requires a deliberate base-path change and another build. The existing Vercel project continues to deploy from Git source rather than treating this ZIP as a source checkout.

## Verify and roll back

Open the production URL and verify the intended revision in Vercel, then check model loading, simulation controls, navigation, selection and a recovery scenario in the actual hosted browser. Inspect network requests and the browser console for failures. Keep local tests, build verification and hosted-browser results distinct.

If the release fails, use the existing project's previous known-good deployment as the rollback target. Record which source revision is serving production; do not create a replacement project or claim a rollback succeeded before checking the alias and browser behavior.
