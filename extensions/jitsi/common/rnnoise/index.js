// @flow

// Script expects to find rnnoise webassembly binary in the same public path root, otherwise it won't load
// During the build phase this needs to be taken care of manually
import rnnoiseWasmInit from './rnnoise-wasm.js';
import RnnoiseProcessor from './RnnoiseProcessor.js';

export {RNNOISE_SAMPLE_LENGTH} from './RnnoiseProcessor.js';

let rnnoiseModule;

/**
 * Creates a new instance of RnnoiseProcessor.
 *
 * @returns {Promise<RnnoiseProcessor>}
 */
export function createRnnoiseProcessor() {
    if (!rnnoiseModule) {
        rnnoiseModule = rnnoiseWasmInit();
    }

    return rnnoiseModule.then(mod => new RnnoiseProcessor(mod));
}
