// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import Modal from './modal.mjs';

const ERROR_MODAL_DIV = 'error-modal';
const ERROR_MESSAGE_DIV = 'error-message';
const ERROR_HANDLER_MESSAGE_DIV = 'error-handler-message';

class ErrorModal extends Modal {

  constructor(mainUI) {
    const dom = document.getElementById(ERROR_MODAL_DIV);
    super(mainUI, dom);
    this.errorMessageDom = document.getElementById(ERROR_MESSAGE_DIV);
    this.handlerMessageDom = document.getElementById(ERROR_HANDLER_MESSAGE_DIV);
  }

  displayError(errorMsg, handlerMsg) {
    this.errorMessageDom.innerText = errorMsg;
    this.handlerMessageDom.innerText = handlerMsg;
    this.show();
  }

  canDismiss() {
    return false;
  }
}

export default ErrorModal;
