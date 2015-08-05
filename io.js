
var sio = require('socket.io');
var debug = require('debug');

process.title = 'socket.io-computer-io';

var port = process.env.COMPUTER_IO_PORT || 6001;
var io = module.exports = sio(port);
console.log('listening on *:' + port);

// redis socket.io adapter
var uri = require('redis').uri;
io.adapter(require('socket.io-redis')(uri, {key: 'xpemu'}));

// redis queries instance
var redis = require('./redis').io();

// some per-connection functions are in a separate module
var delegatedListeners = require('./delegated');

var uid = process.env.COMPUTER_IO_SERVER_UID || port;
debug('server uid %s', uid);

io.total = 0;
io.on('connection', function(socket) {
  var req = socket.request;

  delegatedListeners[socket.id] = function(ident, data) {
    if (ident == 'turn-given') {
      socket.emit('your-turn');

      // send keypress to emulator
      socket.on('keydown', function(key) {
        redis.publish('computer:keydown', key);
      });

      // pointer events
      socket.on('pointer', function(x, y, state) {
        redis.publish('computer:pointer', x + ':' + y + ':' + state);
      });
    } else if (ident == 'computer:turn-lost') {
      socket.removeAllListeners('pointer');
      socket.removeAllListeners('keydown');
      socket.emit('lose-turn');
    } else if (ident == 'computer:turn-queued') {
      // data is a waiting time in milliseconds
      socket.emit('turn-ack', data);
    }
  }

  // keep track of connected clients
  updateClientCount(++io.total);
  socket.on('disconnect', function() {
    delete delegatedListeners[socket.id];
    updateClientCount(--io.total);
  });

  // in case user is reconneting send last known state
  redis.get('computer:frame', function(err, image) {
    if (image) socket.emit('raw', {
      width: 800,
      height: 600,
      x: 0,
      y: 0,
      image: image
    });
  });

  socket.on('turn-request', function(time) {
    redis.publish('computer:turn', socket.id);
  });
});

function updateClientCount(total) {
  redis.hset('computer:connections', uid, total);
}
