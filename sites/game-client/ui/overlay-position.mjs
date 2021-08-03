// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

/**
 * TODO(fanlan1210)
 */
const OverlayPosition = Object.freeze({
  LEFT_TOP: Symbol(1),
  LEFT_BOTTOM: Symbol(2),
  RIGHT: Symbol(3),
  MAIN_VIEW: Symbol(4),
  // CENTER_TOP: Symbol(), // overlapped with notification
  /*
    LEFT_CENTER: Symbol(),
    CENTER_BOTTOM: Symbol(),
    RIGHT_TOP: Symbol(),
    RIGHT_CENTER: Symbol(),
    RIGHT_BOTTOM: Symbol()
    */
});

export default OverlayPosition;
