from pathlib import Path
import json
import sys

config = json.loads(Path('/run/config/production.json').read_bytes())
template = Path('./nginx-template.conf').read_text()

config_loc = 'nginx.conf' if len(sys.argv) < 2 else sys.argv[1]

Path(config_loc).touch()
Path(config_loc).write_text(template.format(
    publicAddress=config['publicAddress'],
    online='online:' + str(config['assetServer']['port']),
    gateways=''.join([f"\n        server online:{v['httpAddress'].split(':')[1]}; # {k}" for k, v in config['gatewayServers'].items()])
))