# Bomb Man Extension

## Mechanism

An "arena" is a region where players can play bomb man.

If a player is inside an arena, they can press `keyboardMapping.place` (defined in `client.mjs`) to place a bomb. Every player has a cool down counter which acts as a rate limit. After a while, the bomb explodes. Every player affected by the bomb will be transported outside the arena.

## Implementation

### Static Cell Set

In `GameMap`, there will be several default cell sets which is constant and preloaded to the extension. These cell sets are configured in `map.json`.

* `bombmanArena`: This cell set indicates the arena of bomb man game.
* `bombmanObstacles`: This cell set should be the subset of `bombmanArena`. It indicates the cells which is cannot be passed.

In practice, there may be more than one arenas in one map. They are named `bombArena1`, `bombArena2`, and so on. `bombmanObstacles` are named similarly.

### Dynamic Cell Set

There are several dynamic cell set to store the state of a bomb man game.

* `bombmanHasBomb`: This cell set contains the cells on which a bomb has been placed. The extension itself will maintain the countdown of each bomb.
