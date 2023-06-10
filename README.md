# Contract schema

![Contract schema](https://cdn.dorahacks.io/static/files/188a55ed8aff4cf520ae0eb483286810.jpeg "Contracts")
# Setup

## Install dependencies
```bash
npm ci
```
## Env
Create a .env file in the root directory and add the following from .env.template or just use default settings

# Run
## Tests
```bash
npx locklift test -n local
```
## Deploy
```bash
npx locklift deploy -n {PREFERRED_NETWORK} --script script/1-deploy-root.ts
```
