// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

// Boilerplate for getting require() in es module.
import {createRequire} from 'module';
const require = createRequire(import.meta.url);
import pty from 'node-pty';
const promisify = require('util').promisify;
const randomBytes = require('crypto').randomBytes;
const exec = promisify(require('child_process').exec);

const containerPrefix = 'escape_';

/**
 * This class handles the container.  It's *not* created and destroyed along with the container.
 * One should call `spawn` and `destroyContainer` explicitly.
 */
class ContainerHandler {
  constructor(imageName) {
    this.containerName = containerPrefix + randomBytes(32).toString('hex');
    this.imageName = imageName;
    this.ptys = {};
  }

  /**
   * Create new docker container.
   */
  async spawn() {
    try {
      let ret = await exec(`docker run -it -d --name ${this.containerName} --rm ${this.imageName}`);
      return !!ret.stderr;
    } catch (err) {
      console.error(`Failed to start container ${this.containerName} with ${this.imageName}: `, err);
    }
  }

  /**
   * Create new PTY and bind to the socket.
   * @param socket
   */
  newPty(socket) {
    if (!(socket.id in this.ptys)) {
      this.ptys[socket.id] = pty.spawn('docker', ['exec', '-it', this.containerName, 'bash'], {
        name: 'xterm-color',
        cols: 80,
        rows: 30
      });
    }

    // Redirect the input to pty.
    socket.on('ptyDataInput', (data) => {
      this.ptys[socket.id].write(data);
    });

    // Redirect the output to socket io.
    this.ptys[socket.id].onData((data) => {
      socket.emit('ptyDataOutput', data);
    });
  }

  /**
   * Destroy PTY
   * @param socket
   */
  destroyPty(socket) {
    if (!(socket.id in this.ptys)) {
      throw new Error('Not PTY attached.');
    }

    this.ptys[socket.id].kill();
    delete this.ptys[socket.id];
  }

  /**
   * Destroy container
   */
  async destroyContainer() {
    try {
      let ret = await exec(`docker stop ${this.containerName}`);
      return !!ret.stderr;
    } catch (err) {
      console.error(`Failed to stop ${this.containerName}: `, err);
    }
  }
}
export default ContainerHandler;
