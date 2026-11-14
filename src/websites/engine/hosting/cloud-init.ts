export interface CloudInitFile {
  name: string;
  url: string;
}

const shq = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

export function cloudInit(files: CloudInitFile[]): string {
  const downloads = files.map((f) => `curl -fsSL -o ${shq(f.name)} ${shq(f.url)}`).join(' && ');
  return `#cloud-config
runcmd:
  # Containers run AI-generated code: keep them away from the metadata endpoint
  - iptables -I DOCKER-USER -d 169.254.169.254 -j DROP
  - mkdir -p /opt/mc /data
  - cd /opt/mc && ${downloads} && docker build -t mc . && docker run -d --name mc -p 25565:25565 -v /data:/data --restart unless-stopped mc
`;
}
