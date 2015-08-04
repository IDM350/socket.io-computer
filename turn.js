var Emitter = require('events').EventEmitter;

var TURN_TIMEOUT = 15;

function TurnRoster() {
  if (!this instanceof TurnRoster) return new TurnRoster();
  this.listings = {};
  this.minorPositions = {};
  this.scheduleIndex = [];
  this.lastLeaseTime = 0;
}

TurnRoster.prototype.__proto__ = Emitter.prototype;

TurnRoster.prototype.push = function(id) {
  if (!this.listings[id]) this.listings[id] = new Date();
}

TurnRoster.prototype.checkQueue = function() {
  if (!Object.keys(this.listings).length) return;

  function rebuildIndex() {
    var orderedTimes = Object.keys(this.listings).map(function(id) {
      return +this.listings[id];
    }, this).sort();
    var idRecalls = [];
    this.scheduleIndex = new Array(Object.keys(this.listings).length);

    for (id in this.listings) {
      var firstIndex = orderedTimes.indexOf(this.listings[id]);
      if (orderedTimes.indexOf(this.listings[id]), firstIndex + 1) > 0) {
        if (this.minorPositions[id]) this.scheduleIndex[firstIndex + this.minorPositions[id] - 1] = id;
        else idRecalls.push(id);
      }
      else {
        this.scheduleIndex[firstIndex] = this.listings[firstIndex];
      }
    }

    idRecalls.forEach(function(id) {
      var minorPosition = 1, firstIndex = orderedTimes.indexOf(this.listings[id]);
      while (this.scheduleIndex[firstIndex + minorPosition - 1]) minorPosition++;
      this.scheduleIndex[firstIndex + minorPosition - 1] = id;
      this.minorPositions[id] = minorPosition;
    });
  }

  var prevScheduleIndex = this.scheduleIndex;
  if (+(new Date()) > this.lastLeaseTime + TURN_TIMEOUT) {
    var idEpxirations = [];
    if (prevScheduleIndex.length) {
      var lastId = prevScheduleIndex[0];
      if (this.minorPositions[lastId]) delete this.minorPositions[lastId];
      delete this.listings[lastId];
      idExpirations.push(lastId);
    }
    rebuildIndex();
    if (this.scheduleIndex.length) {
      this.emit('turn-lease', this.scheduleIndex[0]);
      this.lastLeaseTime = +(new Date());
      idExpirations.forEach(function(id) {
        this.emit('turn-expired', id);
      });
    }
  }
  else if (Object.keys(this.listings).length > prevScheduleIndex.length) {
    rebuildIndex();
  }

  this.scheduleIndex.slice(1).forEach(function(id, pos) {
    if (prevScheduleIndex.indexOf(id) < 0) this.emit('turn-receipt', id, (+(new Date()) - this.lastLeaseTime) + (pos*TURN_TIMEOUT));
  });
}

var redis = require('./redis').emu();
var io = require('socket.io-emitter')(redis, {key: 'xpemu'});
var socketCollection = {};

module.exports = transitoryInstance = new TurnRoster();
transitoryInstance.on('turn-lease', function(sockid) {
  if (!socketCollection[sockid]) socketCollection[sockid] = io.in(sockid);
  socketCollection[sockid].emit('your-turn');
  setTimeout(transitoryInstance.checkQueue, TURN_TIMEOUT*1080);
})
transitoryInstance.on('turn-expired', function(sockid) {
  socketCollection[sockid].emit('lose-turn');
  delete socketCollection[sockid];
});
transitoryInstance.on('turn-receipt', function(sockid, time) {
  socketCollection[sockid] = io.in(sockid);
  socketCollection[sockid].emit('turn-ack', time*1000);
});
