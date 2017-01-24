const express = require('express');
const md5 = require('md5');
const _ = require('lodash');

const app = express();
const sockets = {};

require('express-ws')(app);

app.use(express.static('public'));

app.ws('/', function(ws, req) {
  ws.on('message', function(messageString) {
    const message = JSON.parse(messageString);

    console.log('message', message);

    if (message.event === 'joinGame') {
      sockets[message.gameId] = sockets[message.gameId] || [];

      broadcast(message.gameId, {
        event: 'newGamerJoined'
      });
      
      sockets[message.gameId].push(ws);
    } else if (message.event === 'submitHash') {
      broadcast(message.gameId, {
        event: 'hashSubmited',
        name: message.name,
        hash: message.hash
      });
    } else if (message.event === 'confirm') {
      broadcast(message.gameId, {
        event: 'confirmed',
        name: message.name,
        salt: message.salt
      });
    } else if (message.event === 'secretNumber') {
      broadcast(message.gameId, {
        event: 'secretNumber',
        name: message.name,
        secretNumber: message.secretNumber
      });
    }
  });
});

function broadcast(gameId, message) {
  sockets[gameId].forEach( socket => {
    try {
      socket.send(JSON.stringify(message));
    } catch (err) {
      if (err.message === 'not opened') {
        _.pull(sockets, socket);
      } else {
        throw err;
      }
    }
  });
}

app.listen(process.env.LEANCLOUD_APP_PORT);
