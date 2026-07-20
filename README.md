# Dead Flip

A fast, chaotic browser pinball game built for a one-day vibe coding challenge. It uses a custom Canvas physics loop with responsive keyboard and touch controls, procedural sound, scoring, multipliers, and automatic stuck-ball recovery.

## Play locally

No build step or dependencies are required.

```bash
python3 -m http.server 4173
```

Open [http://localhost:4173](http://localhost:4173).

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Left flipper | `Z` or `Left Arrow` | `L` |
| Right flipper | `/` or `Right Arrow` | `R` |
| Launch | `Space` | `Launch` |
| Nudge | `Left Arrow` / `Right Arrow` | - |
| Pause | `P` | Header control |

The table automatically searches for a stationary ball and returns it to the launcher if it cannot be freed.

## License

[MIT](LICENSE)
