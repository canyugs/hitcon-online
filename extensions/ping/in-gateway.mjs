// Copyright 2022 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

/**
 * This represents the in-gateway/in-area part of the extension.
 * One instance of InGateway will be created for each gateway service
 * launched.
 */
 class InGateway {
    /**
     * Create the in-gateway extension object but does not start it.
     * @constructor
     * @param {ExtensionHelper} helper - An extension helper object for servicing
     * various functionalities of the extension.
     */
    constructor(helper) {
      void helper;
    }

    /**
     * This is called by gateway service to initialize the in gateway part of
     * the extension.
     */
    async initialize() {
    }

    /**
     * Returns true if this extension has an in-gateway part.
     * If this returns false, the constructor for InGateway will not be called.
     * Otherwise, a InGateway object is instanciated for each gateway service
     * instance launched.
     * @return {Boolean} hasInGateway - See above.
     */
    static hasInGateway() {
      return false;
    }
  }

  export default InGateway;
