# Arcane & Beszel — First-Time VPS Setup Guide

This guide covers deploying and configuring **Arcane** (Docker Compose, `.env`, container, image, volume & network manager) and **Beszel** (historical CPU, memory, disk & network monitoring) via the manual GitHub Actions pipeline (`.github/workflows/deploy-infra.yml`).

---

## 1. VPS Folder Structure (`~/infra`)

Each infrastructure service is deployed independently into its own subfolder inside `~/infra` on the VPS, containing a `compose.yaml` and an optional `.env` file:

```text
~/infra/
├── caddy/
│   └── compose.yaml          (from infra/caddy-compose.yaml)
├── cloudflare-tunnel/
│   ├── compose.yaml          (from infra/cloudfare-tunnel.yaml)
│   └── .env                  (CLOUDFLARE_TUNNEL_TOKEN)
└── arcane-beszel/
    ├── compose.yaml          (from infra/arcane-beszel.yaml)
    └── .env                  (INFRA_DOMAIN, ARCANE_ENCRYPTION_KEY, BESZEL_TOKEN, BESZEL_PUBLIC_KEY)
```

Because `arcane` mounts `${STACKS_DIR:-..}:/app/data/projects`, it automatically discovers all sibling folders inside `~/infra` (`caddy`, `cloudflare-tunnel`, `arcane-beszel`) as projects in the Arcane UI.

---

## 2. GitHub Variables Setup

In your GitHub repository (**Settings → Secrets and variables → Actions → Variables**), configure the following variables (the workflow also supports reading sensitive values from **Secrets** if you prefer):

| Component | Variable Name | Required | Description |
| :--- | :--- | :--- | :--- |
| `cloudflare-tunnel` | `CLOUDFLARE_TUNNEL_TOKEN` | Yes | Tunnel token from Cloudflare Zero Trust dashboard |
| `arcane-beszel` | `ARCANE_ENCRYPTION_KEY` | Yes | Generate locally with `openssl rand -base64 32` |
| `arcane-beszel` | `INFRA_DOMAIN` | Optional | Defaults to `sohizi.net` (`containers.<domain>`, `monitor.<domain>`) |
| `arcane-beszel` | `BESZEL_TOKEN` | After 1st boot | Copied from Beszel UI on first login (see Step 3 below) |
| `arcane-beszel` | `BESZEL_PUBLIC_KEY` | After 1st boot | Copied from Beszel UI on first login (see Step 3 below) |
| `arcane-beszel` | `STACKS_DIR` | Optional | Defaults to `..` (`~/infra`). Set to `/home/<user>` if you want Arcane to also see `~/sohizi-rc`, `~/sohizi-prod`, and `~/sohizi-stateful` |

---

## 3. First-Time Deployment Steps

### Step 1: Deploy `caddy` and `cloudflare-tunnel`
1. Go to **GitHub Actions → Deploy Infra Service → Run workflow**.
2. Select **`caddy`** and click **Run workflow**.
3. Once complete, run the workflow again with **`cloudflare-tunnel`**.

### Step 2: First Boot of `arcane-beszel`
1. Generate your Arcane key locally:
   ```bash
   openssl rand -base64 32
   ```
2. Save it in GitHub Actions Variables as `ARCANE_ENCRYPTION_KEY`.
3. Run the **Deploy Infra Service** workflow with **`arcane-beszel`**.
   *(Note: `beszel-agent` will wait until `BESZEL_TOKEN` and `BESZEL_PUBLIC_KEY` are configured in Step 3).*

### Step 3: Connect Beszel Agent (`monitor.sohizi.net`)
1. Open **`https://monitor.sohizi.net`** in your browser and create your admin account.
2. Click **+ Add System** in the top-right corner:
   - **Name**: `Hostinger VPS` (or your preferred name)
   - **Host / IP**: `/beszel_socket/beszel.sock` *(uses the shared Unix socket volume—no TCP port needed)*
3. Copy the **Token** and **Public Key** from the modal and save them in GitHub Variables as:
   - `BESZEL_TOKEN`
   - `BESZEL_PUBLIC_KEY`
4. Click **Add system** in the Beszel UI, then re-run **Deploy Infra Service** for **`arcane-beszel`** (or update `.env` in Arcane UI) so `beszel-agent` starts with the new token and key.
5. Within a few seconds, the system status in Beszel will turn **Green (Up)** and start recording host and per-container CPU, memory, disk, and network metrics.

### Step 4: Log into Arcane (`containers.sohizi.net`)
1. Open **`https://containers.sohizi.net`** in your browser.
2. Log in or complete the initial admin account setup (default initial credentials if prompted are `arcane` / `arcane-admin`, which you will immediately be asked to change).
3. Under **Projects**, you will see your `~/infra` stacks (`caddy`, `cloudflare-tunnel`, `arcane-beszel`) along with their `compose.yaml` and `.env` files.

---

## 4. How Database & Log Size Are Capped

- **Beszel**: Automatically rolls up metrics (`1m` -> `10m` -> `20m` -> `120m` -> `480m`) and deletes records older than **30 days**. Storage stays around ~800 rows per server (~2–5 MB total).
- **Arcane**: Configured with SQLite `_pragma=journal_size_limit(67108864)` (64 MB max WAL file) and `_pragma=auto_vacuum(FULL)` so deleted activity/build history is reclaimed on disk immediately.
- **Docker Container Logs**: Capped via `x-logging` at `10m` max file size (`max-file: 3`, max 30 MB per container).
