from pathlib import Path
import json
import sys

if len(sys.argv) < 2 or len(sys.argv) > 3:
    print('Usage: python3 generate-conf.py run_dir [config_name]')
    print('For example, python3 generate-conf.py ../run production')
    sys.exit()

run_dir = sys.argv[1]
config_name = sys.argv[2] if len(sys.argv) == 3 else 'production'

config = json.loads(Path(f'{run_dir}/config/{config_name}.json').read_bytes())

# Process nginx template
template = Path('./nginx-template.conf').read_text()

Path(f'{run_dir}/nginx.conf').touch()
Path(f'{run_dir}/nginx.conf').write_text(template.format(
    publicAddress=config['publicAddress'],
    online='online:' + str(config['assetServer']['port']),
    gateways=''.join([f"\n        server online:{v['httpAddress'].split(':')[1]}; # {k}" for k, v in config['gatewayServers'].items()])
))

# Process haprox template
template_haproxy = Path('./haproxy-template.cfg').read_text()

Path(f'{run_dir}/haproxy.cfg').touch()
Path(f'{run_dir}/haproxy.cfg').write_text(template_haproxy.format(
    publicAddress=config['publicAddress'],
    online='online:' + str(config['assetServer']['port']),
    gateways=''.join([f"\n  server {k} online:{v['httpAddress'].split(':')[1]} check cookie {k}" for k, v in config['gatewayServers'].items()])
))


