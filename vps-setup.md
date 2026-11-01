# Hostinger VPS / VPN First-Time Setup & Hardening

## 1. Initial Login & System Update

Connect to the VPS as `root` using the IP address from Hostinger hPanel:

```bash
ssh root@<VPS_IP>
```

Update package lists and upgrade existing packages:

```bash
apt update && apt upgrade -y
```

---

## 2. Create a Non-Root Sudo User

Create a new user (replace `deploy` with your preferred username) and grant `sudo` privileges:

```bash
adduser deploy
usermod -aG sudo deploy
```

---

## 3. Configure SSH Key Authentication

### Option A: Copy a specific local SSH public key from your machine

Run this from your **local terminal**, using `-i` to point to the specific `.pub` key file (otherwise `ssh-copy-id` may copy all keys loaded in `ssh-agent`):

```bash
# List your local public keys first if needed
ls -la ~/.ssh/*.pub

# Copy only the specific public key
ssh-copy-id -i ~/.ssh/<your_key>.pub deploy@<VPS_IP>
```

### Option B: Copy keys already added via Hostinger hPanel from `root`

If you attached an SSH key during Hostinger VPS creation, copy it from `root` to the new user on the **VPS**:

```bash
mkdir -p /home/deploy/.ssh
cp /root/.ssh/authorized_keys /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
```

> **Important:** Open a **new local terminal window** and verify you can log in with that specific SSH key and run `sudo` **before** disabling root or password access:
>
> ```bash
> ssh -i ~/.ssh/<your_key> -o IdentitiesOnly=yes deploy@<VPS_IP>
> sudo whoami # should output: root
> ```
>
> _(Optional)_ Add an entry to your local `~/.ssh/config` so you don't have to pass `-i` every time:
>
> ```sshconfig
> Host hostinger-vps
>   HostName <VPS_IP>
>   User deploy
>   IdentityFile ~/.ssh/<your_key>
>   IdentitiesOnly yes
> ```

---

## 4. Disable Root Login & Password Authentication

Edit the main SSH daemon config:

```bash
sudo nano /etc/ssh/sshd_config
```

Ensure the following directives are set:

```text
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
KbdInteractiveAuthentication no
ChallengeResponseAuthentication no
UsePAM yes
```

### Check Hostinger / Cloud-Init SSH Overrides

Hostinger Ubuntu/Debian templates often include override files in `/etc/ssh/sshd_config.d/` (such as `50-cloud-init.conf`) that re-enable `PasswordAuthentication yes`. Check and update them:

```bash
grep -rn "PasswordAuthentication\|PermitRootLogin" /etc/ssh/sshd_config.d/
```

If `PasswordAuthentication yes` or `PermitRootLogin yes` is present in any file under `/etc/ssh/sshd_config.d/`, change it to `no`:

```bash
sudo sed -i 's/^PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config.d/*.conf
sudo sed -i 's/^PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config.d/*.conf
```

Validate the SSH configuration and restart the SSH service:

```bash
sudo sshd -t
sudo systemctl restart ssh
```

_(Note: On older Debian/Ubuntu releases the service may be named `sshd` instead of `ssh`: `sudo systemctl restart sshd`)_

---

## 5. Lock Down Ports (UFW + Hostinger Firewall)

### A. Configure UFW (On-Server Firewall)

Install UFW (if not already installed) and set default policies:

```bash
sudo apt install -y ufw
sudo ufw default deny incoming
sudo ufw default allow outgoing
```

Allow essential ports **before** enabling UFW:

```bash
# Allow SSH (or your custom SSH port if changed)
sudo ufw allow OpenSSH

# Allow HTTP / HTTPS (if hosting web services / reverse proxy)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow VPN port (example: WireGuard default UDP port)
sudo ufw allow 51820/udp
```

Enable UFW and verify rules:

```bash
sudo ufw enable
sudo ufw status verbose
```

### B. Configure Hostinger hPanel Network Firewall

For defense in depth, lock ports at the hypervisor level in Hostinger:

1. Go to **Hostinger hPanel** -> **VPS** -> Select your VPS -> **Security** -> **Firewall**.
2. Create a firewall configuration and attach it to your VPS.
3. Add **Accept** rules only for the ports you need:
   - **SSH**: TCP `22` (or custom port) from `Anywhere` (or your static IP)
   - **VPN (e.g., WireGuard)**: UDP `51820` from `Anywhere`
   - **HTTP / HTTPS** (if needed): TCP `80` and `443` from `Anywhere`
4. Ensure the default/fallback policy drops all other inbound traffic.

---

## 6. Optional: Fail2Ban & Automatic Security Updates

Install `fail2ban` to block brute-force attempts and `unattended-upgrades` for automatic security patches:

```bash
sudo apt install -y fail2ban unattended-upgrades
sudo systemctl enable --now fail2ban
sudo dpkg-reconfigure --priority=low unattended-upgrades
```

<!-- My bersion -->

adduser sagel
usermod -aG sudo sagel
cp -R /root/.ssh/ /home/sagel/
chown -R sagel:sagel /home/sagel/.ssh/

<!-- ssh as new user -->

Disable:
password login: sudo nano /etc/ssh/sshd_config and /etc/ssh/sshd_config.d/50-cloud-init.conf
root login here: sudo nano /etc/ssh/sshd_config
sudo service ssh restart

<!-- Firewall and network -->
