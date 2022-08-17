# Rotating Teleport

The game map should contain a layer 'rotatingTeleport'. The value should be:

1. `null`. This coordinate is not a portal.
2. A string like `id\.(in|out)`. Example: `1.in`, `1.out`, `wc3.in`, `b5.out`. When a player goes into `ID.in`, he/she would be teleported to `ID.out`.
