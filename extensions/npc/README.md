# NPC Extension

For every NPC, please add the configuration file in `/run/npc/` of this project.

For example configuration, please refer to `/common/interactive-object/exampleConfig.mjs`.

## Example

> last updated: 2022/07/20

## The JSON File

You can refer to the file under `/run/npc/*.json` to see some examples.

Every JSON object should contains the following properties:

* `enabled`: Whether this NPC is enabled.
* `initialPosition`: The map coordinate where this NPC is spawned. See `MapCoord` for its format. (Note that in the future some NPCs might be allowed to move around, so developer should not expect the NPC to stay at this place at all time)
* `display`: An array which defines how to draw this NPC onto canvas. For example, if an NPC consists of a cat image and a hat image, the configuration may look like this:
  ```json
  [
    {
      "zIndex": 11,
      "layerName": "npcImage",
      "renderFunction": "_drawOneCharacterImage",
      "renderArgs": null,
      "character": "cat1"
    },
    {
      "zIndex": 12,
      "layerName": "npcImage",
      "renderFunction": "_drawOneCharacterImage",
      "renderArgs": null,
      "character": "hat1"
    },
    {
      "zIndex": 16,
      "layerName": "npcName",
      "renderFunction": "_drawOneCharacterName",
      "renderArgs": null
    }
  ]
  ```
* `FSM`: Finite State Machine which defines the game logic of this NPC. We will give more details later.

### FSM (Finite State Machine)

Finite state machine is also called Automaton in the context of information theory. It is composed of an initial state and a lot of states, which have their own purpose and functionalities. In this project we use "state function" (abbreviated as `sf_`) to define the functionality of a state and its successors (next state).

In JSON file, a state contains two properties: `func` and `kwargs`. Take the following FSM for example:

```json
{
  "FSM": {
    "initialState": "s1",
    "states": {
      "s1": {
        "func": "showDialog", "kwargs": {
          "dialogs": "How may I help you?", "options": {
            "What is the answer of 7+8?": "s2",
            "Bye!": "s3"
          }
        }
      },
      "s2": {
        "func": "showDialog", "kwargs": {
          "dialogs": "The answer of 7+8 is 15. Have a nice day!", "options": {
            "Thanks!": "s3"
          }
        }
      },
      "s3": {
        "func": "exit",
        "kwargs": {
          "next": "s1"
        }
      }
    }
  }
}
```

It is quite straightforward to know how this NPC works by the above configuration. When the player clicks the NPC, the NPC will start from the initial state, until reaching a state which calls `exit`.

If you want to achieve more complicated functionalities such as asking the user to enter a password or checking whether the user has an item, you have to use other state functions. If there is no existing state function that caters to your requirement, you have to implement one by yourself. Here is the partial list of current state functions:
* `exit`: It means the current FSM interaction ends.
* `showDialog`: Shows a dialog and provide the player with some options. Each option would lead to a next state.
* `teleport`: Teleport the player to the target location.

More state functions can be found in:
* `/common/interactive-object/fsm-executor.mjs`
* `/extensions/iobj-lib/standalone.mjs`
* `/extensions/escape-game/standalone.mjs`
* ...

When developing new state functions, keep in mind that you can call the function of other extensions using `this.helper.callS2sAPI()` or call the function in client browser using `this.helper.callS2cAPI()`. See the implementation of `s2s_sf_teamGiveItem` and `s2s_sf_showDialog` respectively.
