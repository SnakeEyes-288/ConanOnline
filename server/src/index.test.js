import { afterEach, describe, expect, test } from 'vitest';
import { characters } from '@conan-online/shared';
import WebSocket from 'ws';
import { createConanServer } from './index.js';

const clients = new Set();
const servers = new Set();

afterEach(async () => {
  await Promise.all([...clients].map((client) => client.close()));
  await Promise.all([...servers].map((server) => server.close()));
  clients.clear();
  servers.clear();
});

function once(target, eventName) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${eventName}`)), 2_000);
    target.addEventListener(
      eventName,
      (event) => {
        clearTimeout(timer);
        resolve(event);
      },
      { once: true }
    );
  });
}

async function createTestServer() {
  const conanServer = createConanServer({ port: 0 });
  servers.add(conanServer);
  await conanServer.start();
  const address = conanServer.server.address();
  return { conanServer, port: address.port };
}

async function connectSocket(port) {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/socket.io/?EIO=4&transport=websocket`);
  clients.add(socket);

  const openPacket = await once(socket, 'message');
  expect(openPacket.data).toMatch(/^0/);
  socket.send('40');
  const connectedPacket = await waitForPacket(socket, (packet) => packet.startsWith('40'));
  expect(connectedPacket).toMatch(/^40/);

  return {
    close: () =>
      new Promise((resolve) => {
        if (socket.readyState === WebSocket.CLOSED) {
          resolve();
          return;
        }
        socket.addEventListener('close', resolve, { once: true });
        socket.close();
      }),
    emit: (eventName, payload = {}) => socket.send(`42${JSON.stringify([eventName, payload])}`),
    waitForEvent: (eventName) =>
      waitForPacket(socket, (packet) => {
        const event = parseSocketEvent(packet);
        return event?.name === eventName;
      }).then((packet) => parseSocketEvent(packet).payload)
  };
}

function parseSocketEvent(packet) {
  if (!packet.startsWith('42')) {
    return null;
  }

  const [name, payload] = JSON.parse(packet.slice(2));
  return { name, payload };
}

function waitForPacket(socket, predicate) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.removeEventListener('message', onMessage);
      reject(new Error('Timed out waiting for packet'));
    }, 2_000);

    function onMessage(event) {
      const packet = String(event.data);

      if (packet === '2') {
        socket.send('3');
        return;
      }

      if (!predicate(packet)) {
        return;
      }

      clearTimeout(timer);
      socket.removeEventListener('message', onMessage);
      resolve(packet);
    }

    socket.addEventListener('message', onMessage);
  });
}

describe('conan server factory', () => {
  test('serves health without listening at import time', async () => {
    const { port } = await createTestServer();

    const response = await fetch(`http://127.0.0.1:${port}/health`);

    await expect(response.json()).resolves.toEqual({ ok: true, service: 'conan-online-server' });
  });

  test('derives privileged room start identity from the socket participant', async () => {
    const { port } = await createTestServer();
    const host = await connectSocket(port);
    const player = await connectSocket(port);

    host.emit('room:create', { nickname: 'Ran' });
    const created = await host.waitForEvent('room:created');

    player.emit('room:join', { roomCode: created.room.code, nickname: 'Conan' });
    const joined = await player.waitForEvent('room:joined');

    player.emit('room:start', { roomCode: created.room.code, playerId: created.player.id });
    const error = await player.waitForEvent('app:error');

    expect(joined.player.id).not.toBe(created.player.id);
    expect(error.message).toBe('Only host can start match');
  });

  test('derives answer identity from the socket participant', async () => {
    const { port } = await createTestServer();
    const host = await connectSocket(port);
    const player = await connectSocket(port);

    host.emit('room:create', { nickname: 'Ran' });
    const created = await host.waitForEvent('room:created');

    player.emit('room:join', { roomCode: created.room.code, nickname: 'Conan' });
    const joined = await player.waitForEvent('room:joined');

    host.emit('room:start');
    const round = await host.waitForEvent('match:round');
    const correctAnswerId = characters.find((character) => character.clues.includes(round.round.clue)).id;

    const answerResult = player.waitForEvent('answer:result');
    const roomUpdate = player.waitForEvent('room:update');
    player.emit('answer:submit', {
      roomCode: created.room.code,
      playerId: created.player.id,
      answerId: correctAnswerId
    });
    await answerResult;
    const update = await roomUpdate;

    const hostScore = update.room.players.find((candidate) => candidate.id === created.player.id).score;
    const playerScore = update.room.players.find((candidate) => candidate.id === joined.player.id).score;
    expect(hostScore).toBe(0);
    expect(playerScore).toBe(1);
  });
});
