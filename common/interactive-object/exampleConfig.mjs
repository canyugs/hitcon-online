// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

const exampleConfig1 = {
  'enabled': true,
  'initialPosition': {'mapName': 'world1', 'x': 5, 'y': 15},
  // TODO // 'availableDistance': 5,
  'display': [

  ],
  'FSM': {
    'initialState': 's1',
    'states': {
      's1': {
        'func': 'showDialog',
        'kwargs': {
          'dialogs': 'Hello!\nNice to meet you!',
          'options': {
            'How are you?': 's2',
            'Bye!': 's3',
          },
        },
      },
      's2': {
        'func': 'showDialog',
        'kwargs': {
          'dialogs': ['I\'m fine thank you!', 'Not so well ...'], // randomly choose a dialog in the Array
          'options': {
            'Bye!': 's3',
          },
        },
      },
      's3': {
        'func': 'exit',
        'kwargs': {
          'next': 's1',
        },
      },
    },
  },
};

const exampleConfig2 = {
  'enabled': true,
  'initialPosition': {'mapName': 'world1', 'x': 5, 'y': 17},
  'display': [

  ],
  'FSM': {
    'initialState': 's1',
    'states': {
      's1': {
        'func': 'checkItems',
        'kwargs': {
          'items': ['apple', 'banana'],
          'goto': ['s2', 's3'], // [success, fail]
        },
      },
      's2': {
        'func': 'showDialog',
        'kwargs': {
          'dialogs': 'Yeah! You have apple and banana.',
          'options': {
            'Bye!': 's4',
          },
        },
      },
      's3': {
        'func': 'showDialog',
        'kwargs': {
          'dialogs': 'Bring some apples and bananas for me.',
          'options': {
            'Okay ...': 's4',
          },
        },
      },
      's4': {
        'func': 'exit',
        'kwargs': {
          'next': 's1',
        },
      },
    },
  },
};
