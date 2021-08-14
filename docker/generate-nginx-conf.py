from pathlib import Path
import json

config = json.loads(Path('../run/config/production.json').read_bytes())
template = Path('./nginx-template.conf').read_text()
Path('./nginx.conf').write_text(template.format(
    publicAddress=config['publicAddress'],
    online=config['assetServer']['address'] + ':' + config['assetServer']['port'],
    gateways=''.join([f"\n        server online:{v['httpAddress'].split(':')[1]}; # {k}" for k, v in config['gatewayServers'].items()])
))