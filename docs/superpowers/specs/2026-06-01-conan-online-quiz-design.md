# Conan Online Character Quiz Design

## Goal

Build a Thai-language online quiz game for guessing Detective Conan characters from text-only clues. Players compete in realtime rooms with friends, using nicknames and room codes instead of account login.

## Scope

The first version focuses on realtime rooms. It allows one-player rooms for testing, but does not include a separate single-player mode, account login, persistent global leaderboards, or character images.

## Product Rules

- A match has 10 rounds.
- Each round asks players to guess one character from 5 text clues.
- All 5 clues appear at the start of the round.
- Each round lasts 20 seconds.
- The answer roster contains 50 searchable character names.
- A room supports up to 8 players.
- The room host starts the match.
- Players enter with nicknames only.
- The first player to submit the correct answer wins the round and gets 1 point.
- Incorrect answers score 0 and do not stop other players from answering.
- A round ends immediately when the first correct answer is submitted, or when the 20-second timer expires.
- After each round, players see a 5-second reveal phase with the correct answer, their own answer, and the latest ranking.

## Visual Direction

Use the Detective Board style selected during brainstorming:

- Dark investigative room mood.
- Prominent countdown timer.
- Clear clue board.
- Searchable answer list that remains fast on mobile.
- Live score/ranking area that stays readable with up to 8 players.

The UI should feel like a case room rather than a marketing page. The first screen should be the playable app: nickname entry, create room, and join room.

## Architecture

Use approach A:

- Frontend: Vite + React deployed to Vercel.
- Backend: Node + Express + Socket.IO deployed to Render.
- Realtime transport: Socket.IO.
- Initial room state: in-memory on the Render server.
- Character data: editable seed data file containing 50 Thai-language characters, each with 5 text clues.

The server is the authority for room state, round timing, answer validation, round winner selection, score calculation, and leaderboard broadcasts.

## Frontend Screens

### Home

Players enter a nickname, then either create a room or join a room with a room code. If the backend is unavailable, the screen shows a reconnect/offline state instead of failing silently.

### Lobby

The lobby shows:

- Room code.
- Copy/share action.
- Player list.
- Host indicator.
- Start button for the host only.
- Waiting state for non-host players.

The match can start with one player for testing, but the room still supports up to 8 players.

### Game Round

The round screen shows:

- Round number out of 10.
- 20-second timer.
- 5 text clues.
- Search input for the answer roster.
- Selectable list of 50 character names.
- Current leaderboard.

Players may keep trying after wrong answers until someone answers correctly or the round timer expires. Once a player submits the correct answer, the server ends the round immediately and the UI moves to the reveal phase for everyone.

### Reveal

The reveal phase shows:

- Correct answer.
- The player's submitted answer.
- Round winner and point gained.
- Latest ranking.
- Countdown to the next round.

### Final Result

After round 10, the final result shows:

- Final ranking.
- Each player's total score.
- Play again action for the host.
- Return home action.

## Backend Events

Expected Socket.IO event shape:

- `room:create` with nickname.
- `room:join` with nickname and room code.
- `room:start` from host.
- `answer:submit` with selected character id.
- `room:leave` or disconnect handling.
- Server broadcasts `room:update`, `match:round`, `match:reveal`, `match:final`, and error events.

Exact payloads will be defined in the implementation plan, but all client-visible state should come from server broadcasts.

## Room Lifecycle

1. Host creates a room and receives a short room code.
2. Other players join with the code.
3. Host starts the match.
4. Server selects 10 unique characters from the 50-character seed set.
5. For each round, server broadcasts clues and starts the 20-second timer.
6. Players submit answers and may keep trying after wrong answers.
7. Server awards 1 point to the first player who submits the correct answer.
8. Round ends immediately on the first correct answer, or when time expires with no winner.
9. Server broadcasts the 5-second reveal.
10. After round 10, server broadcasts final rankings.

## Error Handling

- Unknown room code: show a clear join error.
- Full room: reject join with a room-full message.
- Duplicate nickname: automatically append a short number suffix for display, while keeping each player identified by a stable player id.
- Host disconnect: transfer host to the next connected player.
- Player refresh: preserve a session id in localStorage so the player can reconnect to the same room when possible.
- Backend offline/reconnect: show reconnecting status and avoid losing submitted-answer UI state until server confirms the room state.
- Late answer: ignore answers received after the server-side round deadline or after the round already has a winner.

## Data Model

Character seed records should include:

- Stable character id.
- Thai display name.
- Optional alternate names for search.
- Five Thai clues.

Room state should include:

- Room code.
- Host player id.
- Player list.
- Match status.
- Current round index.
- Round start/deadline timestamps.
- Answer attempts for the active round.
- Winner for the active round, when one exists.
- Per-player scores.

## Scoring Formula

The server calculates round score as a race:

- First correct answer before the deadline: 1 point.
- Wrong answer: 0 points, and the player may try again while the round is still active.
- Correct answers after another player has already won the round: ignored.
- No correct answer before the deadline: no player gets a point.

This makes speed matter through winner selection while keeping the leaderboard easy to read across 10 rounds.

## Testing Strategy

Backend tests:

- Score calculation for first correct, wrong, repeated, late, and post-winner answers.
- Room creation and join limits.
- Host-only start behavior.
- Wrong answers do not lock a player out of the round.
- First correct answer ends the round.
- Round transition and reveal timing.

Frontend verification:

- Build succeeds.
- Home, lobby, round, reveal, and final screens render.
- Searchable answer roster works with 50 characters.
- Wrong answer feedback allows another attempt while the round remains active.
- Reconnecting/offline state is visible.

End-to-end smoke verification:

- Start backend and frontend locally.
- Create a room.
- Join with a second client where practical.
- Start a match.
- Submit wrong and correct answers.
- Confirm reveal and leaderboard updates.

## Deployment

Vercel hosts the frontend. Render hosts the backend Socket.IO server. The frontend reads the backend URL from an environment variable so local development and production deployments can use different server endpoints.

## Open Decisions

No open product decisions remain for the initial implementation plan. Payload shapes, exact file names, and component boundaries will be decided during implementation planning based on the generated project structure.
