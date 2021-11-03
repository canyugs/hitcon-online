from pathlib import Path
import json
import sys

if len(sys.argv) < 2 or len(sys.argv) > 3:
    print('Usage: python3 generate-nginx-conf.py run_dir [config_name]')
    print('For example, python3 generate-nginx-conf.py ../run production')
    sys.exit()

run_dir = sys.argv[1]
config_name = sys.argv[2] if len(sys.argv) == 3 else 'production'

config = json.loads(Path(f'{run_dir}/config/{config_name}.json').read_bytes())
template = Path('./nginx-template.conf').read_text()

Path(f'{run_dir}/nginx.conf').touch()
Path(f'{run_dir}/nginx.conf').write_text(template.format(
    publicAddress=config['publicAddress'],
    online='online:' + str(config['assetServer']['port']),
    terminal=str(config['terminal']['internalAddress']) + ':' + str(config['terminal']['socketioPort']),
    gateways=''.join([f"\n        server online:{v['httpAddress'].split(':')[1]}; # {k}" for k, v in config['gatewayServers'].items()])
))