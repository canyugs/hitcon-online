// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

function randomShuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = arr[i];
    arr[i] = arr[j];
    arr[j] = temp;
  }
}

function randomChoice(arr) {
  const min = 0;
  const max = arr.length;
  const index = Math.floor(Math.random() * (max - min) + min); // The maximum is exclusive and the minimum is inclusive
  return arr[index];
}

export {
  randomShuffle,
  randomChoice,
};
